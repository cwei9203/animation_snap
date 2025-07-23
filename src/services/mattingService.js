import { API_CONFIG, API_STATUS } from '../config/api.js'
import { Request } from '../utils/request.js'

/**
 * 抠图服务类
 */
export class MattingService {

  /**
   * 同步抠图API (已弃用，仅作错误提示)
   * @param {String} filePath 图片文件路径
   * @param {Object} options 抠图选项
   * @returns {Promise<String>} 返回处理后的图片URL
   */
  static async removeBackgroundSync(filePath, options = {}) {
    // 不再调用同步接口，直接返回错误提示
    throw new Error('服务暂时不可用，请稍后再试')
  }

  /**
   * 异步抠图API - 创建任务
   * @param {String} filePath 图片文件路径
   * @param {Object} options 抠图选项
   * @returns {Promise<String>} 返回任务ID
   */
  static async removeBackgroundAsync(filePath, options = {}) {
    const apiKey = API_CONFIG.KOUKOUTU.API_KEY

    if (apiKey === 'YOUR_API_KEY_HERE') {
      throw new Error('请先配置API Key')
    }

    const url = API_CONFIG.KOUKOUTU.ASYNC_BASE_URL + API_CONFIG.KOUKOUTU.ENDPOINTS.ASYNC_CREATE

    const defaultOptions = {
      output_format: 'webp',
      crop: '0',
      border: '0',
      response: 'url'
    }

    const finalOptions = { ...defaultOptions, ...options }

    const uploadOptions = {
      url: url,
      filePath: filePath,
      name: 'image_file',
      header: {
        'X-API-Key': apiKey
      },
      formData: {
        'model_key': 'background-removal',
        ...finalOptions
      }
    };

    try {
      const result = await Request.uploadFile(uploadOptions);
      if (result.task_id) {
        return result.task_id;
      } else {
        throw new Error(result.error || '创建任务失败');
      }
    } catch (error) {
      console.error('异步抠图任务创建失败:', error);
      throw error;
    }
  }

  /**
   * 查询异步任务结果
   * @param {String} taskId 任务ID
   * @returns {Promise<Object>} 任务结果
   */
  static async queryAsyncResult(taskId) {
    const apiKey = API_CONFIG.KOUKOUTU.API_KEY
    const url = `${API_CONFIG.KOUKOUTU.ASYNC_BASE_URL}${API_CONFIG.KOUKOUTU.ENDPOINTS.ASYNC_QUERY}`

    const requestOptions = {
      url: url,
      header: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      data: {
        task_id: taskId
      }
    };

    try {
      const result = await Request.post(requestOptions);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 轮询查询异步任务结果 - 增强版
   * @param {String} taskId 任务ID
   * @param {Function} onProgress 进度回调
   * @returns {Promise<String>} 最终图片URL
   */
  static async pollAsyncResult(taskId, onProgress = null) {
    const maxAttempts = 30 // 最大尝试次数
    const interval = 2000 // 2秒间隔
    let attempts = 0
    let consecutiveErrors = 0 // 连续错误次数
    const maxConsecutiveErrors = 5 // 最大连续错误次数

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++

          if (onProgress) {
            onProgress({
              attempts,
              maxAttempts,
              status: attempts <= 3 ? '正在提交任务...' : '正在处理中...',
              progress: Math.min((attempts / maxAttempts) * 100, 90)
            })
          }

          const result = await this.queryAsyncResult(taskId)
          console.log('🚀 ~ MattingService ~ poll ~ result:', result)
          console.log('🚀 ~ MattingService ~ poll ~ +result.state:', +result.state)

          // 重置连续错误计数
          consecutiveErrors = 0

          if (+result.state === API_STATUS.COMPLETED && result.result_file) {
            console.log('异步任务完成，结果:', result.result_file)
            resolve(result.result_file)
          } else if (result.state === API_STATUS.FAILED) {
            console.error('异步任务失败:', result.error)
            reject(new Error(result.error || '服务器处理失败'))
          } else if (result.state === API_STATUS.PROCESSING) {
            if (attempts >= maxAttempts) {
              reject(new Error('处理超时，请稍后再试或使用同步模式'))
            } else {
              console.log(`轮询第${attempts}次，任务仍在处理中...`)
              setTimeout(poll, interval)
            }
          } else {
            // 未知状态，继续轮询
            console.warn('未知任务状态:', result.state)
            if (attempts >= maxAttempts) {
              reject(new Error('任务状态异常，请稍后再试'))
            } else {
              setTimeout(poll, interval)
            }
          }
        } catch (error) {
          consecutiveErrors++
          console.error(`轮询第${attempts}次出错 (连续错误${consecutiveErrors}次):`, error)

          // 如果连续错误过多，直接失败
          if (consecutiveErrors >= maxConsecutiveErrors) {
            reject(new Error('网络连接不稳定，请检查网络后重试'))
            return
          }

          // 如果达到最大尝试次数，失败
          if (attempts >= maxAttempts) {
            reject(new Error('查询超时，请稍后再试'))
            return
          }

          // 否则继续轮询，但增加延迟
          const delayInterval = interval + (consecutiveErrors * 1000) // 错误越多延迟越长
          setTimeout(poll, delayInterval)
        }
      }

      poll()
    })
  }
}