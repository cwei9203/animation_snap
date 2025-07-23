/**
 * 通用请求封装工具
 */
export class Request {
  /**
   * 统一处理API响应数据
   * @param {Object} response uni.request或uni.uploadFile的响应对象
   * @returns {Object} 解析后的数据对象
   */
  static handleResponse(response) {
    if (response.statusCode === 200) {
      try {
        // 对于uploadFile，data是字符串，需要解析
        // 对于request，data已经是对象
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        return data.data || data; // 返回data字段或整个对象
      } catch (e) {
        throw new Error('解析响应数据失败');
      }
    } else {
      throw new Error(`请求失败: ${response.statusCode}`);
    }
  }

  /**
   * 通用上传文件方法
   * @param {Object} options 上传配置
   * @returns {Promise<any>} 返回处理后的数据
   */
  static uploadFile(options) {
    return new Promise((resolve, reject) => {
      uni.uploadFile({
        ...options,
        success: (res) => {
          try {
            const data = this.handleResponse(res);
            resolve(data);
          } catch (error) {
            reject(error);
          }
        },
        fail: (err) => {
          console.error('网络请求失败:', err);
          reject(new Error('网络请求失败，请检查网络连接'));
        }
      });
    });
  }

  /**
   * 通用GET请求方法
   * @param {Object} options 请求配置
   * @returns {Promise<any>} 返回处理后的数据
   */
  static get(options) {
    return new Promise((resolve, reject) => {
      uni.request({
        method: 'GET',
        ...options,
        success: (res) => {
          try {
            const data = this.handleResponse(res);
            resolve(data);
          } catch (error) {
            reject(error);
          }
        },
        fail: (err) => {
          console.error('网络请求失败:', err);
          reject(new Error('网络请求失败，请检查网络连接'));
        }
      });
    });
  }

  /**
   * 通用POST请求方法
   * @param {Object} options 请求配置
   * @returns {Promise<any>} 返回处理后的数据
   */
  static post(options) {
    return new Promise((resolve, reject) => {
      uni.request({
        method: 'POST',
        ...options,
        success: (res) => {
          try {
            const data = this.handleResponse(res);
            resolve(data);
          } catch (error) {
            reject(error);
          }
        },
        fail: (err) => {
          console.error('网络请求失败:', err);
          reject(new Error('网络请求失败，请检查网络连接'));
        }
      });
    });
  }
}