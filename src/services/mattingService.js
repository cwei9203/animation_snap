import { API_CONFIG, API_STATUS } from '../config/api.js'

/**
 * 抠图服务类
 */
export class MattingService {

  /**
   * 同步抠图API
   * @param {String} filePath 图片文件路径
   * @param {Object} options 抠图选项
   * @returns {Promise<String>} 返回处理后的图片URL
   */
  static async removeBackgroundSync(filePath, options = {}) {
    const apiKey = API_CONFIG.KOUKOUTU.API_KEY

    if (apiKey === 'YOUR_API_KEY_HERE') {
      throw new Error('请先配置API Key')
    }

    const url = API_CONFIG.KOUKOUTU.BASE_URL + API_CONFIG.KOUKOUTU.ENDPOINTS.SYNC_CREATE

    const defaultOptions = {
      output_format: 'webp',
      crop: '0',
      border: '0',
      response: 'url'
    }

    const finalOptions = { ...defaultOptions, ...options }

    return new Promise((resolve, reject) => {
      uni.showLoading({
        title: '正在处理中...',
        mask: true
      })

      uni.uploadFile({
        url: url,
        filePath: filePath,
        name: 'image_file',
        header: {
          'X-API-Key': apiKey
        },
        formData: {
          'model_key': 'background-removal',
          ...finalOptions
        },
        success: (uploadFileRes) => {
          console.log('抠图上传成功:', uploadFileRes)

          if (uploadFileRes.statusCode === API_STATUS.SUCCESS) {
            try {
              const dataAll = JSON.parse(uploadFileRes.data)
              const data = dataAll.data
              if (data.result_file) {
                resolve(data.result_file)
              } else {
                reject(new Error(data.error || '抠图处理失败'))
              }
            } catch (e) {
              reject(new Error('解析响应数据失败'))
            }
          } else {
            reject(new Error(`请求失败: ${uploadFileRes.statusCode}`))
          }
        },
        fail: (err) => {
          console.error('抠图上传失败:', err)
          reject(new Error('网络请求失败，请检查网络连接'))
        },
        complete: () => {
          uni.hideLoading()
        }
      })
    })
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

    return new Promise((resolve, reject) => {
      uni.uploadFile({
        url: url,
        filePath: filePath,
        name: 'image_file',
        header: {
          'X-API-Key': apiKey
        },
        formData: {
          'model_key': 'background-removal',
          ...finalOptions
        },
        success: (uploadFileRes) => {
          if (uploadFileRes.statusCode === API_STATUS.SUCCESS) {
            try {
              const dataAll = JSON.parse(uploadFileRes.data)
              const data = dataAll.data
              if (data.task_id) {
                resolve(data.task_id)
              } else {
                reject(new Error(data.error || '创建任务失败'))
              }
            } catch (e) {
              reject(new Error('解析响应数据失败'))
            }
          } else {
            reject(new Error(`请求失败: ${uploadFileRes.statusCode}`))
          }
        },
        fail: (err) => {
          console.error('异步抠图任务创建失败:', err)
          reject(new Error('网络请求失败，请检查网络连接'))
        }
      })
    })
  }

  /**
   * 查询异步任务结果
   * @param {String} taskId 任务ID
   * @returns {Promise<Object>} 任务结果
   */
  static async queryAsyncResult(taskId) {
    const apiKey = API_CONFIG.KOUKOUTU.API_KEY
    const url = `${API_CONFIG.KOUKOUTU.ASYNC_BASE_URL}${API_CONFIG.KOUKOUTU.ENDPOINTS.ASYNC_QUERY}?task_id=${taskId}`

    return new Promise((resolve, reject) => {
      uni.request({
        url: url,
        method: 'GET',
        header: {
          'X-API-Key': apiKey
        },
        success: (res) => {
          if (res.statusCode === API_STATUS.SUCCESS) {
            resolve(res.data)
          } else {
            reject(new Error(`查询失败: ${res.statusCode}`))
          }
        },
        fail: (err) => {
          reject(new Error('网络请求失败'))
        }
      })
    })
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

          // 重置连续错误计数
          consecutiveErrors = 0

          if (result.status === API_STATUS.COMPLETED) {
            console.log('异步任务完成，结果:', result.result_file)
            resolve(result.result_file)
          } else if (result.status === API_STATUS.FAILED) {
            console.error('异步任务失败:', result.error)
            reject(new Error(result.error || '服务器处理失败'))
          } else if (result.status === API_STATUS.PROCESSING) {
            if (attempts >= maxAttempts) {
              reject(new Error('处理超时，请稍后再试或使用同步模式'))
            } else {
              console.log(`轮询第${attempts}次，任务仍在处理中...`)
              setTimeout(poll, interval)
            }
          } else {
            // 未知状态，继续轮询
            console.warn('未知任务状态:', result.status)
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