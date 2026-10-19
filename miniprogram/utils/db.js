/**
 * 数据库与云存储的薄封装。
 *
 * 为什么把 wx.cloud 的调用都收在这里？
 * 1. 页面里只关心「拿到数据」，不关心它怎么查的；
 * 2. 训练自己集中管理数据出口的习惯——以后要加缓存、加日志、换后端，只改这一个文件。
 *
 * 注意：collection 的权限要设成「仅创建者可读写」，
 * 这样每个用户只能看到自己的衣物，不需要在代码里手动过滤 _openid。
 */

const COLLECTION = 'clothes'

function coll() {
  return wx.cloud.database().collection(COLLECTION)
}

/**
 * 分页查询自己的衣物
 * @param {Object} opt
 * @param {string} opt.category  品类 key，'all' 表示全部
 * @param {number} opt.skip      跳过条数
 * @param {number} opt.limit     每页条数（客户端单次最多 20 条，除非显式 limit 到 100）
 */
function listMyClothes({ category = 'all', skip = 0, limit = 20 } = {}) {
  let query = coll()

  if (category && category !== 'all') {
    query = query.where({ category })
  }

  return query
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(limit)
    .get()
    .then(res => res.data)
}

/** 总共多少件 */
function countMyClothes() {
  return coll().count().then(res => res.total || 0)
}

/** 拉取全部（最多 100 条），用于「我的」页算总价值 */
function listAllForStats() {
  return coll().orderBy('createdAt', 'desc').limit(100).get().then(res => res.data)
}

/** 单件详情 */
function getClothing(id) {
  return coll().doc(id).get().then(res => res.data)
}

/** 新增，返回新记录的 _id */
function addClothing(data) {
  return coll().add({ data }).then(res => res._id)
}

/** 更新 */
function updateClothing(id, data) {
  return coll().doc(id).update({ data })
}

/** 删除记录 */
function removeClothing(id) {
  return coll().doc(id).remove()
}

/**
 * 上传一张图片到云存储，返回 fileID
 * fileID 可以直接用在 <image src> 和 wx.previewImage 里
 */
function uploadImage(filePath) {
  const matched = filePath.match(/\.(\w+)$/)
  const ext = matched ? matched[1] : 'jpg'
  const cloudPath = `clothes/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

  return wx.cloud.uploadFile({ cloudPath, filePath }).then(res => res.fileID)
}

/**
 * 批量删除云存储文件。
 * 失败不抛出——图片删不掉不应该阻断「删除记录」这个主流程。
 */
function deleteFiles(fileList) {
  const list = (fileList || []).filter(f => typeof f === 'string' && f.indexOf('cloud://') === 0)
  if (!list.length) return Promise.resolve()

  return wx.cloud.deleteFile({ fileList: list }).catch(err => {
    console.warn('[衣橱] 云文件删除失败，已忽略', err)
  })
}

/**
 * 压缩图片。基础库 2.13.0 以下没有这个 API，降级为原图。
 */
function compressImage(src, quality = 80) {
  return new Promise(resolve => {
    if (!wx.compressImage) return resolve(src)

    wx.compressImage({
      src,
      quality,
      success: res => resolve(res.tempFilePath),
      fail: () => resolve(src)
    })
  })
}

/** 时间戳 → 2026.10.19 */
function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = n => (n < 10 ? '0' + n : '' + n)
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
}

module.exports = {
  listMyClothes,
  countMyClothes,
  listAllForStats,
  getClothing,
  addClothing,
  updateClothing,
  removeClothing,
  uploadImage,
  deleteFiles,
  compressImage,
  formatDate
}
