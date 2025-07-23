<template>
  <view class="compose-container">
    <!-- 工具栏 -->
    <view class="toolbar">
      <view class="toolbar-group">
        <button class="tool-btn" :class="{ active: selectedTool === 'move' }" @tap="selectTool('move')">
          <text class="tool-icon">⚔️</text>
          <text class="tool-text">移动</text>
        </button>
        <button class="tool-btn" :class="{ active: selectedTool === 'scale' }" @tap="selectTool('scale')">
          <text class="tool-icon">🔍</text>
          <text class="tool-text">缩放</text>
        </button>
      </view>
      
      <view class="toolbar-group">
        <button class="tool-btn" @tap="resetTransform">
          <text class="tool-icon">🔄</text>
          <text class="tool-text">重置</text>
        </button>
      </view>
    </view>
    
    <!-- 编辑画布 -->
    <view class="canvas-section">
      <!-- 背景图片上传 -->
      <view class="background-upload" v-if="!backgroundImage" @tap="chooseBackground">
        <view class="upload-placeholder">
          <text class="upload-icon">🇿️</text>
          <text class="upload-text">点击上传背景图片</text>
        </view>
      </view>
      
      <!-- 编辑主画布 -->
      <view class="edit-canvas" v-else>
        <!-- 背景图层 -->
        <image 
          :src="backgroundImage" 
          class="background-layer"
          mode="aspectFit"
          @load="onBackgroundLoad"
        />
        
        <!-- 抠图图层 -->
        <view 
          class="foreground-layer"
          :style="foregroundStyle"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        >
          <image 
            :src="mattedImage" 
            class="matted-image"
            mode="aspectFit"
            @load="onMattedImageLoad"
          />
          
          <!-- 选中状态边框 -->
          <view class="selection-border" v-if="isSelected">
            <view class="corner corner-tl"></view>
            <view class="corner corner-tr"></view>
            <view class="corner corner-bl"></view>
            <view class="corner corner-br"></view>
          </view>
        </view>
        
        <!-- 操作提示 -->
        <view class="operation-hint" v-if="showHint">
          <text>{{ operationHint }}</text>
        </view>
      </view>
    </view>
    
    <!-- 属性控制面板 -->
    <view class="control-panel" v-if="backgroundImage">
      <view class="control-group">
        <view class="control-title">位置调整</view>
        <view class="control-row">
          <view class="control-item">
            <text class="control-label">X轴</text>
            <slider 
              class="control-slider"
              :value="transform.x"
              :min="-200"
              :max="200"
              @change="onXChange"
            />
          </view>
          <view class="control-item">
            <text class="control-label">Y轴</text>
            <slider 
              class="control-slider"
              :value="transform.y"
              :min="-200"
              :max="200"
              @change="onYChange"
            />
          </view>
        </view>
      </view>
      
      <view class="control-group">
        <view class="control-title">大小缩放</view>
        <view class="control-row">
          <view class="control-item full-width">
            <text class="control-label">缩放比例: {{ transform.scale.toFixed(1) }}x</text>
            <slider 
              class="control-slider"
              :value="transform.scale * 100"
              :min="10"
              :max="300"
              @change="onScaleChange"
            />
          </view>
        </view>
      </view>
      
      <view class="control-group">
        <view class="control-title">透明度</view>
        <view class="control-row">
          <view class="control-item full-width">
            <text class="control-label">透明度: {{ Math.round(transform.opacity * 100) }}%</text>
            <slider 
              class="control-slider"
              :value="transform.opacity * 100"
              :min="0"
              :max="100"
              @change="onOpacityChange"
            />
          </view>
        </view>
      </view>
    </view>
    
    <!-- 底部操作栏 -->
    <view class="bottom-actions">
      <button class="action-btn secondary" @tap="changeBackground" v-if="backgroundImage">
        <text class="btn-icon">🖼️</text>
        <text>更换背景</text>
      </button>
      
      <button class="action-btn secondary" @tap="previewResult" v-if="backgroundImage">
        <text class="btn-icon">👁️</text>
        <text>预览</text>
      </button>
      
      <button class="action-btn primary" @tap="exportImage" v-if="backgroundImage" :disabled="isExporting">
        <text class="btn-icon">💾</text>
        <text v-if="isExporting">导出中...</text>
        <text v-else>导出图片</text>
      </button>
    </view>
    
    <!-- 隐藏Canvas用于合成 -->
    <canvas 
      canvas-id="composeCanvas" 
      class="hidden-canvas"
      :style="{ width: canvasSize.width + 'px', height: canvasSize.height + 'px' }"
    ></canvas>
  </view>
</template>

<script>
import { ImageUtils } from '../../utils/imageUtils.js'
import { CanvasUtils } from '../../utils/canvasUtils.js'

export default {
  data() {
    return {
      // 图片数据
      mattedImage: '',
      originalImage: '',
      backgroundImage: '',
      
      // 工具状态
      selectedTool: 'move',
      isSelected: false,
      showHint: false,
      
      // 变换参数
      transform: {
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 1
      },
      
      // 触摸状态
      touchState: {
        isMoving: false,
        startX: 0,
        startY: 0,
        startTransform: null,
        lastDistance: 0
      },
      
      // 画布配置
      canvasSize: {
        width: 896,  // 16:9 横屏比例，基于896x504
        height: 504
      },
      
      // 其他状态
      isExporting: false,
      backgroundImageInfo: null,
      mattedImageInfo: null
    }
  },
  
  computed: {
    /**
     * 前景图样式
     */
    foregroundStyle() {
      return {
        transform: `translate(${this.transform.x}px, ${this.transform.y}px) scale(${this.transform.scale}) rotate(${this.transform.rotation}deg)`,
        opacity: this.transform.opacity,
        transition: this.touchState.isMoving ? 'none' : 'transform 0.2s ease'
      }
    },
    
    /**
     * 操作提示文本
     */
    operationHint() {
      switch (this.selectedTool) {
        case 'move':
          return '拖动手指移动图片位置'
        case 'scale':
          return '双指缩放调整图片大小'
        default:
          return ''
      }
    }
  },
  
  onLoad(options) {
    // 获取传入参数
    if (options.mattedImage) {
      this.mattedImage = decodeURIComponent(options.mattedImage)
      console.log('接收到的抠图路径:', this.mattedImage)
    }
    if (options.originalImage) {
      this.originalImage = decodeURIComponent(options.originalImage)
      console.log('接收到的原图路径:', this.originalImage)
    }
    
    // 初始化提示
    this.showOperationHint()
  },
  
  methods: {
    /**
     * 选择工具
     */
    selectTool(tool) {
      this.selectedTool = tool
      this.showOperationHint()
    },
    
    /**
     * 显示操作提示
     */
    showOperationHint() {
      this.showHint = true
      setTimeout(() => {
        this.showHint = false
      }, 2000)
    },
    
    /**
     * 选择背景图片
     */
    async chooseBackground() {
      try {
        const tempFilePaths = await ImageUtils.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera']
        })
        
        const filePath = tempFilePaths[0]
        
        // 验证图片
        const isValid = await ImageUtils.validateImage(filePath)
        if (!isValid) {
          return
        }
        
        // 压缩图片
        const compressedPath = await ImageUtils.compressImage(filePath, 80)
        this.backgroundImage = compressedPath
        
        // 重置变换
        this.resetTransform()
        
        uni.showToast({
          title: '背景图片设置成功',
          icon: 'success'
        })
      } catch (error) {
        if (!error.errMsg || !error.errMsg.includes('cancel')) {
          uni.showToast({
            title: '选择图片失败',
            icon: 'error'
          })
        }
      }
    },
    
    /**
     * 更换背景
     */
    changeBackground() {
      this.chooseBackground()
    },
    
    /**
     * 背景图加载完成
     */
    async onBackgroundLoad() {
      try {
        this.backgroundImageInfo = await ImageUtils.getImageInfo(this.backgroundImage)
        this.updateCanvasSize()
        console.log('背景图信息加载成功:', this.backgroundImageInfo)
      } catch (error) {
        console.error('获取背景图信息失败:', error)
        this.backgroundImageInfo = null
      }
    },
    
    /**
     * 抠图图加载完成
     */
    async onMattedImageLoad() {
      try {
        this.mattedImageInfo = await ImageUtils.getImageInfo(this.mattedImage)
        console.log('抠图信息加载成功:', this.mattedImageInfo)
      } catch (error) {
        console.error('获取抠图信息失败:', error)
        this.mattedImageInfo = null
      }
    },
    
    /**
     * 更新画布尺寸
     */
    updateCanvasSize() {
      if (this.backgroundImageInfo) {
        const { width, height } = this.backgroundImageInfo
        const targetAspectRatio = 16 / 9  // 16:9 横屏比例
        const maxSize = 1200
        
        // 计算适合16:9比例的canvas尺寸
        let canvasWidth, canvasHeight
        
        if (width > height) {
          // 横向图片
          canvasWidth = Math.min(width, maxSize)
          canvasHeight = canvasWidth / targetAspectRatio
        } else {
          // 纵向图片，按高度适配
          canvasHeight = Math.min(height, maxSize / targetAspectRatio)
          canvasWidth = canvasHeight * targetAspectRatio
        }
        
        // 确保canvas尺寸不超过背景图片尺寸，且保持16:9比例
        const scaleFactor = Math.min(maxSize / canvasWidth, (maxSize / targetAspectRatio) / canvasHeight)
        
        this.canvasSize.width = Math.floor(canvasWidth * scaleFactor)
        this.canvasSize.height = Math.floor(canvasHeight * scaleFactor)
        
        console.log('更新Canvas尺寸:', this.canvasSize, '背景图片尺寸:', { width, height })
      }
    },
    
    /**
     * 触摸开始
     */
    onTouchStart(e) {
      this.isSelected = true
      const touch = e.touches[0]
      
      this.touchState.isMoving = true
      this.touchState.startX = touch.clientX
      this.touchState.startY = touch.clientY
      this.touchState.startTransform = { ...this.transform }
      
      // 双指缩放
      if (e.touches.length === 2 && this.selectedTool === 'scale') {
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        this.touchState.lastDistance = this.getTouchDistance(touch1, touch2)
      }
    },
    
    /**
     * 触摸移动
     */
    onTouchMove(e) {
      if (!this.touchState.isMoving) return
      
      e.preventDefault()
      
      if (e.touches.length === 1 && this.selectedTool === 'move') {
        // 单指移动
        const touch = e.touches[0]
        const deltaX = touch.clientX - this.touchState.startX
        const deltaY = touch.clientY - this.touchState.startY
        
        this.transform.x = this.touchState.startTransform.x + deltaX
        this.transform.y = this.touchState.startTransform.y + deltaY
        
      } else if (e.touches.length === 2 && this.selectedTool === 'scale') {
        // 双指缩放
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        const currentDistance = this.getTouchDistance(touch1, touch2)
        
        if (this.touchState.lastDistance > 0) {
          const scaleRatio = currentDistance / this.touchState.lastDistance
          const newScale = this.touchState.startTransform.scale * scaleRatio
          this.transform.scale = Math.max(0.1, Math.min(3, newScale))
        }
      }
    },
    
    /**
     * 触摸结束
     */
    onTouchEnd() {
      this.touchState.isMoving = false
      this.touchState.lastDistance = 0
    },
    
    /**
     * 获取两点间距离
     */
    getTouchDistance(touch1, touch2) {
      const dx = touch1.clientX - touch2.clientX
      const dy = touch1.clientY - touch2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    },
    
    /**
     * X轴位置改变
     */
    onXChange(e) {
      this.transform.x = e.detail.value
    },
    
    /**
     * Y轴位置改变
     */
    onYChange(e) {
      this.transform.y = e.detail.value
    },
    
    /**
     * 缩放改变
     */
    onScaleChange(e) {
      this.transform.scale = e.detail.value / 100
    },
    
    /**
     * 透明度改变
     */
    onOpacityChange(e) {
      this.transform.opacity = e.detail.value / 100
    },
    
    /**
     * 重置变换
     */
    resetTransform() {
      this.transform = {
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 1
      }
    },
    
    /**
     * 预览结果
     */
    async previewResult() {
      try {
        uni.showLoading({ title: '正在生成预览...' })
        
        // 验证图片路径
        if (!this.backgroundImage || !this.mattedImage) {
          throw new Error('请确保已选择背景图片和抠图图片')
        }
        
        const tempFilePath = await this.generateComposedImage()
        
        // 显示预览和调试信息
        const foregroundConfig = await this.calculateForegroundConfig()
        
        console.log('预览调试信息:', {
          Canvas尺寸: this.canvasSize,
          背景图信息: this.backgroundImageInfo,
          前景图配置: foregroundConfig,
          导出文件: tempFilePath
        })
        
        uni.previewImage({
          urls: [tempFilePath],
          current: tempFilePath
        })
        
        // 可选：显示一些调试信息给用户
        if (this.transform.scale !== 1 || this.transform.x !== 0 || this.transform.y !== 0 || this.transform.opacity !== 1) {
          setTimeout(() => {
            uni.showToast({
              title: `缩放:${this.transform.scale.toFixed(1)}x 透明度:${Math.round(this.transform.opacity * 100)}%`,
              icon: 'none',
              duration: 2000
            })
          }, 1000)
        }
        
      } catch (error) {
        console.error('预览错误:', error)
        uni.showToast({
          title: error.message || '预览失败',
          icon: 'error'
        })
      } finally {
        uni.hideLoading()
      }
    },
    
    /**
     * 导出图片
     */
    async exportImage() {
      if (this.isExporting) return
      
      this.isExporting = true
      
      try {
        uni.showLoading({ title: '正在合成图片...' })
        
        // 检查图片是否准备就绪
        if (!this.backgroundImage || !this.mattedImage) {
          throw new Error('请确保已选择背景图片和抠图图片')
        }
        
        // 验证图片路径有效性
        await this.validateImagePaths()
        
        const tempFilePath = await this.generateComposedImage()
        
        // 保存到相册
        await ImageUtils.saveImageToPhotosAlbum(tempFilePath)
        
      } catch (error) {
        console.error('导出错误:', error)
        let errorMessage = '导出失败'
        
        if (error.message.includes('抠图文件已失效')) {
          errorMessage = '抠图文件已失效，请返回重新抠图'
        } else if (error.message.includes('背景图片')) {
          errorMessage = '背景图片已失效，请重新选择'
        } else if (error.message.includes('请确保已选择')) {
          errorMessage = error.message
        } else if (error.message.includes('图片路径无效')) {
          errorMessage = '图片文件已失效，请重新操作'
        }
        
        uni.showModal({
          title: '导出失败',
          content: errorMessage,
          showCancel: false,
          confirmText: '知道了'
        })
      } finally {
        this.isExporting = false
        uni.hideLoading()
      }
    },
    
    /**
     * 验证图片路径
     */
    async validateImagePaths() {
      try {
        // 验证背景图片
        if (this.backgroundImage) {
          const isBackgroundValid = await ImageUtils.validateImagePath(this.backgroundImage)
          if (!isBackgroundValid) {
            throw new Error('背景图片路径无效，请重新选择背景图片')
          }
        }
        
        // 验证抠图文件
        if (this.mattedImage) {
          const isMattedValid = await ImageUtils.validateImagePath(this.mattedImage)
          if (!isMattedValid) {
            // 如果是网络URL，尝试重新下载
            if (ImageUtils.isNetworkUrl(this.mattedImage)) {
              try {
                console.log('检测到抠图文件失效，尝试重新下载:', this.mattedImage)
                uni.showLoading({ title: '正在重新下载抠图...' })
                
                // 下载图片到本地临时文件
                const localPath = await ImageUtils.downloadImage(this.mattedImage)
                
                // 更新抠图路径为本地路径
                this.mattedImage = localPath
                console.log('抠图重新下载成功，本地路径:', localPath)
                
                uni.hideLoading()
                uni.showToast({
                  title: '抠图文件已更新',
                  icon: 'success',
                  duration: 1000
                })
              } catch (downloadError) {
                uni.hideLoading()
                console.error('重新下载抠图失败:', downloadError)
                throw new Error(`抠图文件已失效且下载失败，请返回重新抠图`)
              }
            } else {
              throw new Error('抠图文件已失效，请返回重新进行抠图操作')
            }
          }
        }
      } catch (error) {
        console.error('验证图片路径失败:', error)
        throw error
      }
    },

    /**
     * 生成合成图片
     */
    async generateComposedImage() {
      try {
        console.log('=== 开始生成合成图片 ===')
        console.log('背景图路径:', this.backgroundImage)
        console.log('抠图路径:', this.mattedImage)
        console.log('背景图信息:', this.backgroundImageInfo)
        console.log('抠图信息:', this.mattedImageInfo)
        console.log('Canvas尺寸:', this.canvasSize)
        
        // 验证Canvas尺寸
        if (!this.canvasSize.width || !this.canvasSize.height || this.canvasSize.width <= 0 || this.canvasSize.height <= 0) {
          console.error('❌ Canvas尺寸无效:', this.canvasSize)
          throw new Error('Canvas尺寸设置无效')
        }
        
        // 验证图片路径的有效性
        if (!this.backgroundImage) {
          throw new Error('背景图路径为空')
        }
        if (!this.mattedImage) {
          throw new Error('抠图路径为空')
        }
        
        // 验证图片文件是否存在和有效
        try {
          console.log('验证背景图路径...')
          const bgValid = await ImageUtils.validateImagePath(this.backgroundImage)
          if (!bgValid) {
            throw new Error('背景图路径无效')
          }
          console.log('✅ 背景图路径验证通过')
          
          console.log('验证抠图路径...')
          const fgValid = await ImageUtils.validateImagePath(this.mattedImage)
          if (!fgValid) {
            throw new Error('抠图路径无效')
          }
          console.log('✅ 抠图路径验证通过')
        } catch (validationError) {
          console.error('❌ 图片路径验证失败:', validationError)
          throw validationError
        }
        
        // 等待DOM渲染完成
        await this.$nextTick()
        
        // 验证Canvas元素是否存在
        try {
          const query = uni.createSelectorQuery().in(this)
          const canvasExists = await new Promise((resolve) => {
            query.select('.hidden-canvas').boundingClientRect((rect) => {
              console.log('Canvas查询结果:', rect)
              resolve(!!rect)
            }).exec()
          })
          
          if (!canvasExists) {
            console.error('❌ Canvas元素不存在')
            throw new Error('Canvas元素未找到')
          }
          console.log('✅ Canvas元素验证通过')
        } catch (canvasError) {
          console.error('❌ Canvas验证失败:', canvasError)
          throw new Error('Canvas元素验证失败')
        }
        
        // 计算前景图在画布中的实际尺寸和位置
        console.log('计算前景图配置...')
        const foregroundConfig = await this.calculateForegroundConfig()
        console.log('✅ 前景图配置计算完成:', foregroundConfig)
        
        // 验证前景图配置的合理性
        if (!foregroundConfig || typeof foregroundConfig.width !== 'number' || foregroundConfig.width <= 0) {
          console.error('❌ 前景图配置无效:', foregroundConfig)
          throw new Error('前景图配置计算失败')
        }
        
        // 使用Canvas合成 - 传入背景图信息以正确适配
        console.log('开始Canvas合成...')
        const composedImagePath = await CanvasUtils.composeImages({
          canvasId: 'composeCanvas',
          component: this,
          backgroundImagePath: this.backgroundImage,
          foregroundImagePath: this.mattedImageInfo.path || this.mattedImage,
          canvasWidth: this.canvasSize.width,
          canvasHeight: this.canvasSize.height,
          foregroundConfig: foregroundConfig,
          backgroundImageInfo: this.backgroundImageInfo  // 传入背景图信息
        })
        
        console.log('🎉 图片合成完成:', composedImagePath)
        console.log('=== 合成图片生成结束 ===')
        return composedImagePath
      } catch (error) {
        console.error('❌ 图片合成过程中出错:', error)
        throw new Error('图片合成失败: ' + error.message)
      }
    },
    
    /**
     * 计算前景图配置
     */
    async calculateForegroundConfig() {
      // 获取界面显示区域的实际尺寸
      const query = uni.createSelectorQuery().in(this)
      
      return new Promise((resolve, reject) => {
        query.select('.edit-canvas').boundingClientRect((canvasRect) => {
          if (!canvasRect) {
            console.error('❌ 无法获取canvas区域信息')
            reject(new Error('无法获取canvas区域信息'))
            return
          }
          
          // 界面显示区域的尺寸
          const viewWidth = canvasRect.width
          const viewHeight = canvasRect.height
          
          if (!viewWidth || !viewHeight || viewWidth <= 0 || viewHeight <= 0) {
            console.error('❌ Canvas区域尺寸无效:', { viewWidth, viewHeight })
            reject(new Error('Canvas区域尺寸无效'))
            return
          }
          
          // Canvas实际尺寸
          const canvasWidth = this.canvasSize.width
          const canvasHeight = this.canvasSize.height
          
          // 计算从界面坐标到Canvas坐标的缩放比例
          const scaleRatio = Math.min(canvasWidth / viewWidth, canvasHeight / viewHeight)
          
          // 前景图在界面中的基础尺寸（25%）
          const baseSize = Math.min(viewWidth, viewHeight) * 0.25
          
          // 应用用户的缩放
          const finalSize = baseSize * this.transform.scale * scaleRatio
          
          // 计算在Canvas中的位置
          // 界面中心点 + 用户偏移，然后映射到Canvas坐标
          const canvasCenterX = canvasWidth / 2
          const canvasCenterY = canvasHeight / 2
          const offsetX = this.transform.x * scaleRatio
          const offsetY = this.transform.y * scaleRatio
          
          const finalX = canvasCenterX + offsetX - finalSize / 2
          const finalY = canvasCenterY + offsetY - finalSize / 2
          
          const config = {
            x: finalX,
            y: finalY,
            width: finalSize,
            height: finalSize,
            rotation: this.transform.rotation,
            opacity: this.transform.opacity
          }
          
          // 验证配置的合理性
          if (config.width <= 0 || config.height <= 0) {
            console.error('❌ 计算出的前景图尺寸无效:', config)
            reject(new Error('前景图尺寸计算结果无效'))
            return
          }
          
          console.log('前景图配置计算:', {
            界面尺寸: { viewWidth, viewHeight },
            Canvas尺寸: { canvasWidth, canvasHeight },
            缩放比例: scaleRatio,
            用户变换: this.transform,
            基础尺寸: baseSize,
            最终配置: config
          })
          
          resolve(config)
        }).exec()
      })
    }
  }
}
</script>

<style scoped>
.compose-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-secondary);
}

/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  background-color: var(--bg-primary);
  border-bottom: 1rpx solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.toolbar-group {
  display: flex;
  gap: 16rpx;
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 10rpx 20rpx;
  background-color: var(--bg-tertiary);
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.tool-btn.active {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.tool-icon {
  font-size: 32rpx;
}

.tool-text {
  font-size: 32rpx;
}

/* 画布区域 */
.canvas-section {
  flex: 1;
  position: relative;
  overflow: hidden;
  padding: 32rpx;
  box-sizing: border-box;
}

.background-upload {
  width: 100%;
  aspect-ratio: 16/9;  /* 保持16:9比例 */
  max-height: 60vh;    /* 限制最大高度 */
  margin: 0 auto;      /* 居中显示 */
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx dashed var(--border-color);
  border-radius: var(--radius-lg);
}

.upload-placeholder {
  text-align: center;
  padding: 80rpx 40rpx;
}

.upload-icon {
  font-size: 80rpx;
  display: block;
  margin-bottom: 24rpx;
}

.upload-text {
  font-size: 32rpx;
  color: var(--text-secondary);
}

.edit-canvas {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;  /* 保持16:9比例 */
  max-height: 60vh;    /* 限制最大高度，避免在小屏幕上过高 */
  margin: 0 auto;      /* 居中显示 */
  overflow: hidden;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.background-layer {
  width: 100%;
  height: 100%;
  object-fit: contain;  /* 确保长边完全展示 */
}

.foreground-layer {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 25%;      /* 动态尺寸，相对于容器 */
  aspect-ratio: 1; /* 保持正方形 */
  margin-left: -12.5%;  /* 宽度的一半 */
  margin-top: -12.5%;   /* 高度的一半 */
  transform-origin: center;
  cursor: grab;
}

.foreground-layer:active {
  cursor: grabbing;
}

.matted-image {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.selection-border {
  position: absolute;
  top: -4rpx;
  left: -4rpx;
  right: -4rpx;
  bottom: -4rpx;
  border: 2rpx solid var(--primary-color);
  border-radius: 8rpx;
  pointer-events: none;
}

.corner {
  position: absolute;
  width: 16rpx;
  height: 16rpx;
  background-color: var(--primary-color);
  border: 2rpx solid white;
  border-radius: 50%;
}

.corner-tl { top: -8rpx; left: -8rpx; }
.corner-tr { top: -8rpx; right: -8rpx; }
.corner-bl { bottom: -8rpx; left: -8rpx; }
.corner-br { bottom: -8rpx; right: -8rpx; }

.operation-hint {
  position: absolute;
  top: 32rpx;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 16rpx 32rpx;
  border-radius: var(--radius-lg);
  font-size: 24rpx;
  z-index: 10;
}

/* 控制面板 */
.control-panel {
  background-color: var(--bg-primary);
  border-top: 1rpx solid var(--border-color);
  padding: 32rpx;
  max-height: 600rpx;
  overflow-y: auto;
}

.control-group {
  margin-bottom: 32rpx;
}

.control-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16rpx;
}

.control-row {
  display: flex;
  gap: 48rpx;
}

.control-item {
  flex: 1;
}

.control-item.full-width {
  flex: none;
  width: 100%;
}

.control-label {
  font-size: 24rpx;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 16rpx;
}

.control-slider {
  width: 100%;
  margin:0;
}

/* 底部操作栏 */
.bottom-actions {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 32rpx;
  background-color: var(--bg-primary);
  border-top: 1rpx solid var(--border-color);
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap:10rpx;
  border-radius: var(--radius-lg);
  font-size: 24rpx;
  font-weight: 500;
  border: none;
  transition: all 0.2s ease;
}

.action-btn.primary {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
  color: white;
  box-shadow: var(--shadow-md);
}

.action-btn.primary:active {
  transform: translateY(1px);
}

.action-btn.secondary {
  background-color: var(--bg-tertiary);
  color: var(--primary-color);
  border: 1rpx solid var(--border-color);
}

.action-btn.secondary:active {
  background-color: var(--border-color);
}

.btn-icon {
  font-size: 36rpx;
}

.action-btn:disabled {
  opacity: 0.6;
  pointer-events: none;
}

/* 隐藏Canvas */
.hidden-canvas {
  position: fixed;
  top: -9999rpx;
  left: -9999rpx;
  z-index: -1;
}
</style>