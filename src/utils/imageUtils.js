import { API_CONFIG, SUPPORTED_FORMATS, MAX_FILE_SIZE } from '../config/api.js'

/**
 * 图片处理工具类
 */
export class ImageUtils {

  /**
   * 验证图片格式和大小
   * @param {String} filePath 图片路径
   * @returns {Promise<Boolean>}
   */
  static async validateImage(filePath) {
    try {
      const fileInfo = await uni.getFileInfo({
        filePath: filePath
      })

      // 检查文件大小
      if (fileInfo.size > MAX_FILE_SIZE) {
        uni.showToast({
          title: '图片大小不能超过40MB',
          icon: 'none'
        })
        return false
      }

      // 检查文件格式
      const extension = filePath.split('.').pop().toLowerCase()
      if (!SUPPORTED_FORMATS.includes(extension)) {
        uni.showToast({
          title: '仅支持JPG、PNG、WebP格式',
          icon: 'none'
        })
        return false
      }

      return true
    } catch (error) {
      console.error('验证图片失败:', error)
      return false
    }
  }

  /**
   * 压缩图片
   * @param {String} src 图片路径
   * @param {Number} quality 压缩质量 0-100
   * @returns {Promise<String>} 压缩后的图片路径
   */
  static async compressImage(src, quality = 80) {
    try {
      const result = await uni.compressImage({
        src: src,
        quality: quality
      })
      return result.tempFilePath
    } catch (error) {
      console.error('压缩图片失败:', error)
      return src // 压缩失败则返回原图
    }
  }

  /**
   * 验证图片路径是否有效
   * @param {String} src 图片路径
   * @returns {Promise<Boolean>}
   */
  static async validateImagePath(src) {
    try {
      if (!src || typeof src !== 'string') {
        return false
      }

      // 检查路径格式
      if (!src.startsWith('http') && !src.startsWith('file://') && !src.startsWith('wxfile://') && !src.includes('tmp_base64')) {
        console.warn('图片路径格式可能不正确:', src)
      }

      // 如果是临时文件，检查是否存在
      if (src.includes('tmp_') || src.includes('temp')) {
        try {
          await uni.getFileInfo({ filePath: src })
          return true
        } catch (error) {
          console.error('临时文件不存在:', src, error)
          return false
        }
      }

      return true
    } catch (error) {
      console.error('验证图片路径失败:', error)
      return false
    }
  }

  /**
   * 获取图片信息
   * @param {String} src 图片路径
   * @returns {Promise<Object>} 图片信息
   */
  static async getImageInfo(src) {
    try {
      // 先验证路径
      const isValidPath = await this.validateImagePath(src)
      if (!isValidPath) {
        throw new Error(`图片路径无效: ${src}`)
      }

      console.log('正在获取图片信息:', src)

      const result = await uni.getImageInfo({
        src: src
      })

      console.log('图片信息获取成功:', {
        width: result.width,
        height: result.height,
        path: result.path
      })

      return {
        width: result.width,
        height: result.height,
        path: result.path,
        orientation: result.orientation,
        type: result.type
      }
    } catch (error) {
      console.error('获取图片信息失败:', error)

      // 提供更详细的错误信息
      if (error.errMsg) {
        if (error.errMsg.includes('invalid')) {
          throw new Error(`图片路径无效或文件不存在: ${src}`)
        } else if (error.errMsg.includes('fail')) {
          throw new Error(`图片信息获取失败: ${error.errMsg}`)
        }
      }

      throw error
    }
  }

  /**
   * 保存图片到相册
   * @param {String} filePath 图片路径
   * @returns {Promise<Boolean>}
   */
  static async saveImageToPhotosAlbum(filePath) {
    try {
      // 先请求权限
      const authResult = await uni.authorize({
        scope: 'scope.writePhotosAlbum'
      })

      if (authResult.errMsg === 'authorize:ok') {
        await uni.saveImageToPhotosAlbum({
          filePath: filePath
        })
        uni.showToast({
          title: '保存成功',
          icon: 'success'
        })
        return true
      } else {
        throw new Error('用户拒绝授权')
      }
    } catch (error) {
      if (error.errMsg && error.errMsg.includes('auth deny')) {
        uni.showModal({
          title: '提示',
          content: '需要您授权保存图片到相册',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              uni.openSetting()
            }
          }
        })
      } else {
        uni.showToast({
          title: '保存失败',
          icon: 'error'
        })
      }
      return false
    }
  }

  /**
   * 选择图片
   * @param {Object} options 选择选项
   * @returns {Promise<Array>} 选择的图片路径数组
   */
  static async chooseImage(options = {}) {
    const defaultOptions = {
      count: 1,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera']
    }

    const finalOptions = { ...defaultOptions, ...options }

    try {
      const result = await uni.chooseImage(finalOptions)
      return result.tempFilePaths
    } catch (error) {
      if (error.errMsg && !error.errMsg.includes('cancel')) {
        uni.showToast({
          title: '选择图片失败',
          icon: 'error'
        })
      }
      throw error
    }
  }

  /**
   * 下载网络图片到本地临时文件
   * @param {String} url 图片URL
   * @returns {Promise<String>} 本地临时文件路径
   */
  static async downloadImage(url) {
    try {
      if (!url || typeof url !== 'string') {
        throw new Error('图片URL无效')
      }

      console.log('开始下载图片:', url)

      const result = await uni.downloadFile({
        url: url,
        header: {
          'User-Agent': 'Mozilla/5.0 (compatible; uniapp)',
          'Referer': url
        }
      })

      if (result.statusCode === 200) {
        console.log('图片下载成功:', result.tempFilePath)
        return result.tempFilePath
      } else {
        throw new Error(`下载失败，状态码: ${result.statusCode}`)
      }
    } catch (error) {
      console.error('下载图片失败:', error)
      if (error.errMsg) {
        if (error.errMsg.includes('network')) {
          throw new Error('网络连接失败，请检查网络后重试')
        } else if (error.errMsg.includes('timeout')) {
          throw new Error('下载超时，请重试')
        }
      }
      throw new Error('图片下载失败，请重试')
    }
  }

  /**
   * 检查URL是否为网络地址
   * @param {String} url 
   * @returns {Boolean}
   */
  static isNetworkUrl(url) {
    return url && (url.startsWith('http://') || url.startsWith('https://'))
  }
}