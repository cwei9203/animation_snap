// API配置文件
export const API_CONFIG = {
  // koukoutu.com API配置
  KOUKOUTU: {
    // 请在此处填入您的API Key
    API_KEY: 'neGJs94Wl96LfDMYOApjPIXa04cjOkG0',
    BASE_URL: 'https://sync.koukoutu.com',
    ASYNC_BASE_URL: 'https://async.koukoutu.com',
    ENDPOINTS: {
      SYNC_CREATE: '/v1/create',
      ASYNC_CREATE: '/v1/create',
      ASYNC_QUERY: '/v1/query'
    }
  }
}

// API状态码
export const API_STATUS = {
  SUCCESS: 200,
  PROCESSING: 'processing',
  COMPLETED: 1,
  FAILED: 'failed'
}

// 支持的图片格式
export const SUPPORTED_FORMATS = ['jpg', 'jpeg', 'png', 'webp']

// 图片大小限制 (字节)
export const MAX_FILE_SIZE = 40 * 1024 * 1024 // 40MB