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
    return uni.createCanvasContext(canvasId, component)
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
      backgroundImagePath,
      foregroundImagePath,
      canvasWidth,
      canvasHeight,
      foregroundConfig,
      backgroundImageInfo = null
    } = options

    const ctx = this.createCanvasContext(canvasId, component)

    return new Promise((resolve, reject) => {
      try {
        console.log('=== Canvas合成开始 ===')
        console.log('Canvas尺寸:', { canvasWidth, canvasHeight })
        console.log('背景图:', backgroundImagePath)
        console.log('前景图:', foregroundImagePath)
        console.log('前景图配置:', foregroundConfig)

        // 验证参数
        if (!backgroundImagePath || !foregroundImagePath) {
          throw new Error('图片路径为空')
        }

        const { x, y, width, height, rotation = 0, opacity = 1 } = foregroundConfig

        if (width <= 0 || height <= 0) {
          throw new Error('前景图尺寸无效')
        }

        console.log('✅ 参数验证通过')
        console.log('前景图绘制参数详情:', { x, y, width, height, rotation, opacity })

        // 检查前景图是否在Canvas范围内
        const isInBounds = !(x > canvasWidth || y > canvasHeight || x + width < 0 || y + height < 0)
        console.log('前景图是否在Canvas范围内:', isInBounds)
        if (!isInBounds) {
          console.warn('⚠️ 前景图可能在Canvas范围外')
        }

        // 清空画布
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)
        console.log('✅ Canvas已清空')

        // 设置白色背景
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)
        console.log('✅ 白色背景已设置')

        // 1. 绘制背景图（填充整个Canvas）
        try {
          ctx.drawImage(
            backgroundImagePath,
            0,
            0,
            canvasWidth,
            canvasHeight
          )
          console.log('✅ 背景图绘制完成')
        } catch (bgError) {
          console.error('❌ 背景图绘制失败:', bgError)
          throw new Error('背景图绘制失败: ' + bgError.message)
        }

        // 2. 绘制前景图
        console.log('开始绘制前景图...')
        ctx.save() // 保存状态
        console.log('✅ Canvas状态已保存')

        // 设置透明度
        ctx.globalAlpha = opacity
        console.log('✅ 透明度已设置:', opacity)

        try {
          if (rotation !== 0) {
            // 有旋转：移动到图片中心点，旋转，再绘制
            const centerX = x + width / 2
            const centerY = y + height / 2
            console.log('旋转中心点:', { centerX, centerY })

            ctx.translate(centerX, centerY)
            console.log('✅ 坐标系已移动到中心点')

            ctx.rotate(rotation * Math.PI / 180)
            console.log('✅ 旋转已应用:', rotation, '度')

            // 绘制图片（相对于中心点）
            ctx.drawImage(
              foregroundImagePath,
              -width / 2,
              -height / 2,
              width,
              height
            )
            console.log('✅ 前景图旋转绘制完成')
          } else {
            // 无旋转：直接绘制
            console.log('直接绘制前景图，参数:', {
              path: foregroundImagePath,
              x, y, width, height
            })

            ctx.drawImage(
              foregroundImagePath,
              x,
              y,
              width,
              height
            )
            console.log('✅ 前景图直接绘制完成')
          }
        } catch (fgError) {
          console.error('❌ 前景图绘制失败:', fgError)
          throw new Error('前景图绘制失败: ' + fgError.message)
        }

        ctx.restore() // 恢复状态
        console.log('✅ Canvas状态已恢复')

        // 验证Canvas内容
        console.log('Canvas绘制完成，参数汇总:', {
          canvasSize: { canvasWidth, canvasHeight },
          foreground: { x, y, width, height, rotation, opacity },
          backgroundPath: backgroundImagePath,
          foregroundPath: foregroundImagePath
        })

        // 3. 导出Canvas
        console.log('开始Canvas draw操作...')
        ctx.draw(false, () => {
          console.log('✅ Canvas draw完成，开始导出...')
          setTimeout(() => {
            uni.canvasToTempFilePath({
              canvasId: canvasId,
              fileType: 'jpg',
              quality: 1,
              success: (res) => {
                console.log('🎉 Canvas导出成功:', res.tempFilePath)
                resolve(res.tempFilePath)
              },
              fail: (err) => {
                console.error('❌ Canvas导出失败:', err)
                reject(new Error('导出失败: ' + JSON.stringify(err)))
              }
            }, component)
          }, 1000) // 确保绘制完成
        })

      } catch (error) {
        console.error('❌ Canvas合成错误:', error)
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
}