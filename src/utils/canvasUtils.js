/**
 * Canvas图片合成工具类
 */
export class CanvasUtils {
  
  /**
   * 创建Canvas上下文
   * @param {String} canvasId Canvas ID
   * @param {Object} component 组件实例
   * @returns {Object} Canvas上下文
   */
  static createCanvasContext(canvasId, component) {
    // #ifdef MP-WEIXIN
    return uni.createCanvasContext(canvasId, component)
    // #endif
    
    // #ifdef H5
    return uni.createCanvasContext(canvasId)
    // #endif
    
    // #ifdef APP-PLUS
    return uni.createCanvasContext(canvasId, component)
    // #endif
  }
  
  /**
   * 合成两张图片
   * @param {Object} options 合成选项
   * @returns {Promise<String>} 合成后的图片临时路径
   */
  static async composeImages(options) {
    const {
      canvasId,
      component,
      backgroundImage,
      foregroundImage,
      canvasWidth,
      canvasHeight,
      foregroundConfig
    } = options
    
    const ctx = this.createCanvasContext(canvasId, component)
    
    return new Promise((resolve, reject) => {
      try {
        // 清空画布
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)
        
        // 绘制背景图
        ctx.drawImage(
          backgroundImage.url,
          0,
          0,
          canvasWidth,
          canvasHeight
        )
        
        // 绘制前景图（抠图结果）
        const {
          x = 0,
          y = 0,
          width = 200,
          height = 200,
          rotation = 0,
          opacity = 1
        } = foregroundConfig
        
        // 保存当前状态
        ctx.save()
        
        // 设置透明度
        ctx.globalAlpha = opacity
        
        // 应用旋转
        if (rotation !== 0) {
          ctx.translate(x + width / 2, y + height / 2)
          ctx.rotate(rotation * Math.PI / 180)
          ctx.translate(-(x + width / 2), -(y + height / 2))
        }
        
        // 绘制前景图
        ctx.drawImage(
          foregroundImage.url,
          x,
          y,
          width,
          height
        )
        
        // 恢复状态
        ctx.restore()
        
        // 绘制到画布
        ctx.draw(false, () => {
          // 导出图片
          setTimeout(() => {
            uni.canvasToTempFilePath({
              canvasId: canvasId,
              success: (res) => {
                resolve(res.tempFilePath)
              },
              fail: (err) => {
                console.error('Canvas导出失败:', err)
                reject(new Error('图片合成失败'))
              }
            }, component)
          }, 500) // 延迟确保绘制完成
        })
      } catch (error) {
        console.error('Canvas合成错误:', error)
        reject(error)
      }
    })
  }
  
  /**
   * 计算图片在Canvas中的适配尺寸
   * @param {Number} imageWidth 图片原始宽度
   * @param {Number} imageHeight 图片原始高度
   * @param {Number} containerWidth 容器宽度
   * @param {Number} containerHeight 容器高度
   * @param {String} mode 适配模式: 'contain' | 'cover' | 'fill'
   * @returns {Object} 适配后的尺寸和位置
   */
  static calculateImageSize(imageWidth, imageHeight, containerWidth, containerHeight, mode = 'contain') {
    let targetWidth, targetHeight, x = 0, y = 0
    
    const imageRatio = imageWidth / imageHeight
    const containerRatio = containerWidth / containerHeight
    
    switch (mode) {
      case 'contain':
        if (imageRatio > containerRatio) {
          targetWidth = containerWidth
          targetHeight = containerWidth / imageRatio
          y = (containerHeight - targetHeight) / 2
        } else {
          targetHeight = containerHeight
          targetWidth = containerHeight * imageRatio
          x = (containerWidth - targetWidth) / 2
        }
        break
        
      case 'cover':
        if (imageRatio > containerRatio) {
          targetHeight = containerHeight
          targetWidth = containerHeight * imageRatio
          x = (containerWidth - targetWidth) / 2
        } else {
          targetWidth = containerWidth
          targetHeight = containerWidth / imageRatio
          y = (containerHeight - targetHeight) / 2
        }
        break
        
      case 'fill':
      default:
        targetWidth = containerWidth
        targetHeight = containerHeight
        break
    }
    
    return {
      width: targetWidth,
      height: targetHeight,
      x: x,
      y: y
    }
  }
  
  /**
   * 预加载图片
   * @param {String} src 图片路径
   * @returns {Promise<Object>} 图片信息
   */
  static async preloadImage(src) {
    return new Promise((resolve, reject) => {
      uni.getImageInfo({
        src: src,
        success: (res) => {
          resolve({
            url: src,
            width: res.width,
            height: res.height,
            path: res.path
          })
        },
        fail: (err) => {
          console.error('预加载图片失败:', err)
          reject(new Error('图片加载失败'))
        }
      })
    })
  }
}