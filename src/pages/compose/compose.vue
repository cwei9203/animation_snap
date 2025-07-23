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
          mode="aspectFill"
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
        width: 750,
        height: 1000
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
    }
    if (options.originalImage) {
      this.originalImage = decodeURIComponent(options.originalImage)
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
        const maxSize = 1000
        
        if (width > height) {
          this.canvasSize.width = Math.min(width, maxSize)
          this.canvasSize.height = Math.min(height, maxSize * height / width)
        } else {
          this.canvasSize.height = Math.min(height, maxSize)
          this.canvasSize.width = Math.min(width, maxSize * width / height)
        }
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
        
        // 确保图片信息已加载
        await this.ensureImageInfoLoaded()
        
        const tempFilePath = await this.generateComposedImage()
        
        uni.previewImage({
          urls: [tempFilePath],
          current: tempFilePath
        })
      } catch (error) {
        console.error('预览错误:', error)
        let errorMessage = '预览失败'
        
        if (error.message.includes('图片信息不完整')) {
          errorMessage = '图片还在加载中，请稍后再试'
        } else if (error.message.includes('图片加载失败')) {
          errorMessage = '图片加载失败，请重新选择图片'
        }
        
        uni.showToast({
          title: errorMessage,
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
        
        // 确保图片信息已加载
        await this.ensureImageInfoLoaded()
        
        const tempFilePath = await this.generateComposedImage()
        
        // 保存到相册
        await ImageUtils.saveImageToPhotosAlbum(tempFilePath)
        
      } catch (error) {
        console.error('导出错误:', error)
        let errorMessage = '导出失败'
        
        if (error.message.includes('图片信息不完整')) {
          errorMessage = '图片还在加载中，请稍后再试'
        } else if (error.message.includes('请确保已选择')) {
          errorMessage = error.message
        } else if (error.message.includes('图片加载失败')) {
          errorMessage = '图片加载失败，请重新选择图片'
        }
        
        uni.showToast({
          title: errorMessage,
          icon: 'error',
          duration: 3000
        })
      } finally {
        this.isExporting = false
        uni.hideLoading()
      }
    },
    
    /**
     * 确保图片信息已加载
     */
    async ensureImageInfoLoaded() {
      const maxRetries = 3
      let retries = 0
      
      while (retries < maxRetries) {
        // 检查背景图信息
        if (!this.backgroundImageInfo && this.backgroundImage) {
          try {
            console.log('重新获取背景图信息...')
            this.backgroundImageInfo = await ImageUtils.getImageInfo(this.backgroundImage)
          } catch (error) {
            console.error('重新获取背景图信息失败:', error)
          }
        }
        
        // 检查抠图信息
        if (!this.mattedImageInfo && this.mattedImage) {
          try {
            console.log('重新获取抠图信息...')
            this.mattedImageInfo = await ImageUtils.getImageInfo(this.mattedImage)
          } catch (error) {
            console.error('重新获取抠图信息失败:', error)
          }
        }
        
        // 如果都有了就退出
        if (this.backgroundImageInfo && this.mattedImageInfo) {
          console.log('图片信息获取完成')
          return
        }
        
        retries++
        if (retries < maxRetries) {
          console.log(`第${retries}次重试获取图片信息...`)
          await new Promise(resolve => setTimeout(resolve, 1000)) // 等待1秒
        }
      }
      
      // 最终检查
      if (!this.backgroundImageInfo) {
        throw new Error('背景图片信息获取失败，请重新选择背景图片')
      }
      if (!this.mattedImageInfo) {
        throw new Error('抠图信息获取失败，请返回重新进行抠图')
      }
    },
    
    /**
     * 生成合成图片
     */
    async generateComposedImage() {
      // 再次确认图片信息存在
      if (!this.backgroundImageInfo || !this.mattedImageInfo) {
        throw new Error('图片信息不完整')
      }
      
      try {
        // 预加载图片
        console.log('开始预加载图片...')
        const backgroundImg = await CanvasUtils.preloadImage(this.backgroundImage)
        const mattedImg = await CanvasUtils.preloadImage(this.mattedImage)
        console.log('图片预加载完成')
        
        // 计算前景图在画布中的实际尺寸和位置
        const foregroundConfig = await this.calculateForegroundConfig()
        console.log('前景图配置:', foregroundConfig)
        
        // 使用Canvas合成
        const composedImagePath = await CanvasUtils.composeImages({
          canvasId: 'composeCanvas',
          component: this,
          backgroundImage: backgroundImg,
          foregroundImage: mattedImg,
          canvasWidth: this.canvasSize.width,
          canvasHeight: this.canvasSize.height,
          foregroundConfig: foregroundConfig
        })
        
        console.log('图片合成完成:', composedImagePath)
        return composedImagePath
      } catch (error) {
        console.error('图片合成过程中出错:', error)
        if (error.message.includes('图片加载失败')) {
          throw new Error('图片加载失败，请检查图片是否存在')
        } else if (error.message.includes('图片合成失败')) {
          throw new Error('图片合成失败，请重试')
        } else {
          throw error
        }
      }
    },
    
    /**
     * 计算前景图配置
     */
    calculateForegroundConfig() {
      // 获取页面尺寸信息
      const query = uni.createSelectorQuery().in(this)
      
      return new Promise((resolve) => {
        query.select('.edit-canvas').boundingClientRect((rect) => {
          const viewWidth = rect.width
          const viewHeight = rect.height
          
          // 计算缩放比例
          const scaleX = this.canvasSize.width / viewWidth
          const scaleY = this.canvasSize.height / viewHeight
          
          // 转换坐标和尺寸
          const config = {
            x: this.transform.x * scaleX + this.canvasSize.width / 2 - 100,
            y: this.transform.y * scaleY + this.canvasSize.height / 2 - 100,
            width: 200 * this.transform.scale * scaleX,
            height: 200 * this.transform.scale * scaleY,
            rotation: this.transform.rotation,
            opacity: this.transform.opacity
          }
          
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
  height: 100%;
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
  height: 100%;
  overflow: hidden;
}

.background-layer {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.foreground-layer {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200rpx;
  height: 200rpx;
  margin-left: -100rpx;
  margin-top: -100rpx;
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
  max-height: 400rpx;
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