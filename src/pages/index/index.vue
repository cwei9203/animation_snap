<template>
  <view class="container">
    <!-- 页面标题 -->
    <view class="header fade-in">
      <view class="title">智能抠图工具</view>
      <view class="subtitle">上传图片，一键移除背景</view>
    </view>
    
    <!-- 步骤指示器 -->
    <view class="steps-container slide-up">
      <view class="step" :class="{ active: currentStep >= 1, completed: currentStep > 1 }">
        <view class="step-icon">
          <text class="icon">1</text>
        </view>
        <view class="step-text">上传图片</view>
      </view>
      <view class="step-line"></view>
      <view class="step" :class="{ active: currentStep >= 2, completed: currentStep > 2 }">
        <view class="step-icon">
          <text class="icon">2</text>
        </view>
        <view class="step-text">智能抠图</view>
      </view>
      <view class="step-line"></view>
      <view class="step" :class="{ active: currentStep >= 3 }">
        <view class="step-icon">
          <text class="icon">3</text>
        </view>
        <view class="step-text">合成图片</view>
      </view>
    </view>
    
    <!-- 图片上传区域 -->
    <view class="upload-section card scale-in" v-if="currentStep === 1">
      <view class="upload-area" @tap="chooseImage" :class="{ 'has-image': originalImage }">
        <image v-if="originalImage" :src="originalImage" class="preview-image" mode="aspectFit"></image>
        <view v-else class="upload-placeholder">
          <view class="upload-icon">📷</view>
          <view class="upload-text">点击上传图片</view>
          <view class="upload-hint">支持JPG、PNG、WebP格式</view>
        </view>
      </view>
      
      <view class="upload-actions" v-if="originalImage">
        <button class="btn btn-secondary" @tap="chooseImage">重新选择</button>
        <button class="btn btn-primary" @tap="startMatting" :disabled="isProcessing">
          <text v-if="isProcessing">正在处理...</text>
          <text v-else>开始抠图</text>
        </button>
      </view>
    </view>
    
    <!-- 抠图处理中 -->
    <view class="processing-section card fade-in" v-if="currentStep === 2 && isProcessing">
      <view class="processing-content">
        <view class="processing-icon">
          <view class="loading-spinner"></view>
        </view>
        <view class="processing-text">正在使用AI智能抠图...</view>
        <view class="processing-hint" v-if="processingProgress < 20">正在创建异步任务...</view>
        <view class="processing-hint" v-else-if="processingProgress < 90">正在轮询处理结果，请稍候...</view>
        <view class="processing-hint" v-else>即将完成...</view>
        <view class="progress-bar">
          <view class="progress-fill" :style="{ width: processingProgress + '%' }"></view>
        </view>
        <view class="progress-text">{{ Math.floor(processingProgress) }}%</view>
        <view class="processing-mode" v-if="processingProgress >= 20">
          <text class="mode-badge">异步处理模式</text>
        </view>
      </view>
    </view>
    
    <!-- 抠图结果展示 -->
    <view class="result-section" v-if="currentStep === 2 && !isProcessing && mattedImage">
      <view class="result-card card fade-in">
        <view class="result-header">
          <view class="result-title">抠图结果</view>
          <view class="result-actions">
            <button class="btn-icon" @tap="saveResult">
              <text class="icon">💾</text>
            </button>
          </view>
        </view>
        
        <view class="result-images">
          <view class="image-compare">
            <view class="image-item">
              <image :src="originalImage" class="result-image" mode="aspectFit"></image>
              <view class="image-label">原图</view>
            </view>
            <view class="vs-divider">
              <text class="vs-text">VS</text>
            </view>
            <view class="image-item">
              <image :src="mattedImage" class="result-image" mode="aspectFit"></image>
              <view class="image-label">抠图结果</view>
            </view>
          </view>
        </view>
        
        <view class="result-footer">
          <button class="btn btn-secondary" @tap="resetProcess">重新开始</button>
          <button class="btn btn-primary" @tap="goToCompose">继续合成</button>
        </view>
      </view>
    </view>
    
    <!-- 错误提示 -->
    <view class="error-section card fade-in" v-if="errorMessage">
      <view class="error-content">
        <view class="error-icon">⚠️</view>
        <view class="error-text">{{ errorMessage }}</view>
        <button class="btn btn-primary" @tap="clearError">知道了</button>
      </view>
    </view>
  </view>
</template>

<script>
import { ImageUtils } from '../../utils/imageUtils.js'
import { MattingService } from '../../services/mattingService.js'

export default {
  data() {
    return {
      currentStep: 1,
      originalImage: '',
      mattedImage: '',
      isProcessing: false,
      processingProgress: 0,
      errorMessage: '',
      originalImagePath: '' // 保存原始图片路径
    }
  },
  
  onLoad() {
    // 页面初始化
    this.checkApiKey()
  },
  
  methods: {
    /**
     * 检查API Key配置
     */
    checkApiKey() {
      const { API_CONFIG } = require('../../config/api.js')
      console.log('🚀 ~ checkApiKey ~ API_CONFIG.KOUKOUTU.API_KEY:', API_CONFIG.KOUKOUTU.API_KEY)
      if (API_CONFIG.KOUKOUTU.API_KEY === 'YOUR_API_KEY_HERE') {
        uni.showModal({
          title: '配置提示',
          content: '请在config/api.js中配置您的koukoutu.com API Key',
          showCancel: false
        })
      }
    },
    
    /**
     * 选择图片
     */
    async chooseImage() {
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
        
        this.originalImagePath = compressedPath
        this.originalImage = compressedPath
        this.currentStep = 1
        this.mattedImage = ''
        this.errorMessage = ''
        
        uni.showToast({
          title: '图片上传成功',
          icon: 'success'
        })
      } catch (error) {
        if (!error.errMsg || !error.errMsg.includes('cancel')) {
          this.showError('选择图片失败')
        }
      }
    },
    
    /**
     * 开始抠图处理 - 只使用异步API
     */
    async startMatting() {
      if (!this.originalImagePath) {
        this.showError('请先选择图片')
        return
      }
      
      this.isProcessing = true
      this.currentStep = 2
      this.errorMessage = ''
      this.processingProgress = 10
      
      try {
        uni.showLoading({
          title: '正在创建抠图任务...',
          mask: true
        })
        
        // 调用异步API创建任务
        const taskId = await MattingService.removeBackgroundAsync(this.originalImagePath, {
          output_format: 'webp',
          response: 'url'
        })
        
        uni.hideLoading()
        console.log('异步任务创建成功，任务ID:', taskId)
        
        this.processingProgress = 20
        
        // 开始轮询查询结果
        const mattedImageUrl = await MattingService.pollAsyncResult(taskId, (progress) => {
          // 更新进度信息
          this.processingProgress = Math.min(20 + (progress.attempts / progress.maxAttempts) * 70, 90)
          console.log(`轮询进度: ${progress.attempts}/${progress.maxAttempts}, 状态: ${progress.status}`)
        })
        
        this.mattedImage = mattedImageUrl
        this.processingProgress = 100
        
        uni.showToast({
          title: '抠图完成',
          icon: 'success'
        })
      } catch (error) {
        console.error('抠图失败:', error)
        // 只提示错误，不再回退到同步API
        this.showError(error.message || '抠图处理失败，请稍后再试')
        this.currentStep = 1
      } finally {
        this.isProcessing = false
        uni.hideLoading()
      }
    },
    
    /**
     * 模拟处理进度
     */
    simulateProgress() {
      let progress = 0
      const interval = setInterval(() => {
        if (this.isProcessing && progress < 90) {
          progress += Math.random() * 10
          this.processingProgress = Math.min(progress, 90)
        } else {
          clearInterval(interval)
        }
      }, 500)
    },
    
    /**
     * 保存抠图结果
     */
    async saveResult() {
      if (!this.mattedImage) {
        this.showError('没有可保存的图片')
        return
      }
      
      try {
        uni.showLoading({ title: '正在保存...' })
        
        // 下载图片到本地
        const downloadResult = await uni.downloadFile({
          url: this.mattedImage
        })
        
        // 保存到相册
        await ImageUtils.saveImageToPhotosAlbum(downloadResult.tempFilePath)
        
      } catch (error) {
        this.showError('保存失败')
      } finally {
        uni.hideLoading()
      }
    },
    
    /**
     * 进入合成页面
     */
    goToCompose() {
      if (!this.mattedImage) {
        this.showError('请先完成抠图处理')
        return
      }
      
      uni.navigateTo({
        url: `/pages/compose/compose?mattedImage=${encodeURIComponent(this.mattedImage)}&originalImage=${encodeURIComponent(this.originalImage)}`
      })
    },
    
    /**
     * 重置流程
     */
    resetProcess() {
      this.currentStep = 1
      this.originalImage = ''
      this.mattedImage = ''
      this.originalImagePath = ''
      this.isProcessing = false
      this.processingProgress = 0
      this.errorMessage = ''
    },
    
    /**
     * 显示错误信息
     */
    showError(message) {
      this.errorMessage = message
      setTimeout(() => {
        this.errorMessage = ''
      }, 5000)
    },
    
    /**
     * 清除错误信息
     */
    clearError() {
      this.errorMessage = ''
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--secondary-color) 100%);
  padding: 40rpx 32rpx;
}

/* 页面标题 */
.header {
  text-align: center;
  margin-bottom: 60rpx;
}

.title {
  font-size: 56rpx;
  font-weight: bold;
  color: var(--primary-color);
  margin-bottom: 16rpx;
}

.subtitle {
  font-size: 28rpx;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* 步骤指示器 */
.steps-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 60rpx;
  padding: 0 40rpx;
  width: 100%;
  box-sizing: border-box;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  max-width: 120rpx;
  box-sizing: border-box;
}

.step-icon {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  background-color: var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
  transition: all 0.3s ease;
}

.step.active .step-icon {
  background-color: var(--primary-color);
  color: white;
}

.step.completed .step-icon {
  background-color: var(--success-color);
  color: white;
}

.step-icon .icon {
  font-size: 24rpx;
  font-weight: bold;
}

.step-text {
  font-size: 24rpx;
  color: var(--text-light);
  text-align: center;
}

.step.active .step-text {
  color: var(--primary-color);
  font-weight: 500;
}

.step-line {
  flex: 1;
  height: 2rpx;
  background-color: var(--border-color);
  margin: 0 20rpx;
  margin-bottom: 40rpx;
}

/* 上传区域 */
.upload-section {
  margin-bottom: 40rpx;
  width: 100%;
  box-sizing: border-box;
}

.upload-area {
  min-height: 400rpx;
  border: 3rpx dashed var(--border-color);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
}

.upload-area:active {
  transform: scale(0.98);
}

.upload-area.has-image {
  border-style: solid;
  border-color: var(--primary-color);
}

.preview-image {
  width: 100%;
  height: 400rpx;
  border-radius: var(--radius-lg);
}

.upload-placeholder {
  text-align: center;
  padding: 60rpx 40rpx;
}

.upload-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}

.upload-text {
  font-size: 32rpx;
  color: var(--text-primary);
  margin-bottom: 16rpx;
  font-weight: 500;
}

.upload-hint {
  font-size: 24rpx;
  color: var(--text-light);
}

.upload-actions {
  display: flex;
  gap: 24rpx;
  margin-top: 32rpx;
  width: 100%;
  box-sizing: border-box;
}

.upload-actions .btn {
  flex: 1;
  box-sizing: border-box;
}

/* 处理中 */
.processing-section {
  text-align: center;
}

.processing-content {
  padding: 80rpx 40rpx;
}

.processing-icon {
  margin-bottom: 40rpx;
}

.loading-spinner {
  width: 80rpx;
  height: 80rpx;
  border: 6rpx solid var(--border-color);
  border-top: 6rpx solid var(--primary-color);
  border-radius: 50%;
  margin: 0 auto;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.processing-text {
  font-size: 36rpx;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 16rpx;
}

.processing-hint {
  font-size: 28rpx;
  color: var(--text-secondary);
  margin-bottom: 40rpx;
}

.progress-bar {
  width: 100%;
  height: 8rpx;
  background-color: var(--border-color);
  border-radius: 4rpx;
  overflow: hidden;
  margin-bottom: 16rpx;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color), var(--primary-light));
  transition: width 0.3s ease;
  border-radius: 4rpx;
}

.progress-text {
  font-size: 24rpx;
  color: var(--text-light);
}

.processing-mode {
  margin-top: 20rpx;
  text-align: center;
}

.mode-badge {
  display: inline-block;
  background: var(--primary-color);
  color: white;
  padding: 8rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  font-weight: 500;
}

/* 结果展示 */
.result-section {
  margin-bottom: 40rpx;
}

.result-card {
  padding: 0;
  overflow: hidden;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx;
  border-bottom: 1rpx solid var(--border-color);
}

.result-title {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.result-actions {
  display: flex;
  gap: 16rpx;
}

.btn-icon {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  background-color: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  font-size: 24rpx;
}

.result-images {
  padding: 32rpx;
}

.image-compare {
  display: flex;
  align-items: center;
  gap: 20rpx;
  width: 100%;
  box-sizing: border-box;
}

.image-item {
  flex: 1;
  text-align: center;
  box-sizing: border-box;
}

.result-image {
  width: 100%;
  height: 240rpx;
  border-radius: var(--radius-md);
  border: 1rpx solid var(--border-color);
}

.image-label {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 16rpx;
}

.vs-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60rpx;
  height: 60rpx;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
  border-radius: 50%;
  flex-shrink: 0;
}

.vs-text {
  font-size: 20rpx;
  font-weight: bold;
  color: white;
}

.result-footer {
  display: flex;
  gap: 24rpx;
  padding: 32rpx;
  border-top: 1rpx solid var(--border-color);
  width: 100%;
  box-sizing: border-box;
}

.result-footer .btn {
  flex: 1;
  box-sizing: border-box;
}

/* 错误提示 */
.error-section {
  margin-bottom: 40rpx;
}

.error-content {
  text-align: center;
  padding: 40rpx;
}

.error-icon {
  font-size: 60rpx;
  margin-bottom: 24rpx;
}

.error-text {
  font-size: 32rpx;
  color: var(--error-color);
  margin-bottom: 32rpx;
  line-height: 1.5;
}
</style>