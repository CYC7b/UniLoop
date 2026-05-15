/**
 * 图片压缩工具
 * 使用 Canvas API 在客户端压缩为 WebP 格式
 */

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_ORIGINAL_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * 将图片压缩到指定尺寸和体积
 * @param {File} file - 原始图片
 * @param {number} maxDim - 最大边长 px
 * @param {number} maxBytes - 最大体积 bytes
 * @returns {Promise<File>}
 */
const resizeToWebP = (file, maxDim, maxBytes) => {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      reject(new Error(`Unsupported type: ${file.type}`))
      return
    }
    if (file.size > MAX_ORIGINAL_SIZE) {
      reject(new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 10MB.`))
      return
    }
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        // 按比例缩放到 maxDim
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // 逐步降低质量直到满足体积要求
        let quality = 0.85
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) { resolve(file); return }
              if (blob.size <= maxBytes || quality <= 0.3) {
                const name = file.name.replace(/\.[^.]+$/, '') + '.webp'
                resolve(new File([blob], name, { type: 'image/webp', lastModified: Date.now() }))
              } else {
                quality -= 0.1
                tryCompress()
              }
            },
            'image/webp',
            quality
          )
        }
        tryCompress()
      }
      img.onerror = () => reject(new Error('Failed to load image'))
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
  })
}

/**
 * 压缩图片为商品图 (1280px, <=300KB, WebP)
 * @param {File} file - 原始图片文件
 * @returns {Promise<File>}
 */
export const compressImage = (file) => resizeToWebP(file, 1280, 300 * 1024)

/**
 * 生成缩略图 (400px, <=80KB, WebP)
 * @param {File} file - 原始图片文件
 * @returns {Promise<File>}
 */
export const generateThumbnail = async (file) => {
  return resizeToWebP(file, 400, 80 * 1024)
}

/**
 * 压缩头像 (256px, <=50KB, WebP)
 * @param {File} file - 原始图片文件
 * @returns {Promise<File>}
 */
export const compressAvatar = (file) => resizeToWebP(file, 256, 50 * 1024)

/**
 * 批量压缩多个图片
 * @param {File[]} files
 * @returns {Promise<File[]>}
 */
export const compressImages = async (files) => {
  return Promise.all(files.map(f => compressImage(f)))
}
