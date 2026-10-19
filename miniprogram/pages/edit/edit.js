const { CATEGORIES, SEASONS, MAX_IMAGES } = require('../../utils/constants')
const db = require('../../utils/db')

Page({
  data: {
    isEdit: false,
    id: '',
    images: [],           // [{ url, fileID }]  fileID 为空表示还没上传
    categories: CATEGORIES,
    category: '',
    seasonsList: [],      // [{ key, name, checked }]
    name: '',
    price: '',
    maxImages: MAX_IMAGES,
    saving: false,
    canSave: false
  },

  // 编辑时被移除的旧图，保存成功后再从云存储删掉，避免产生孤儿文件
  removedFiles: [],

  onLoad(options) {
    this.setData({
      seasonsList: SEASONS.map(s => Object.assign({}, s, { checked: false }))
    })

    if (options && options.id) {
      this.setData({ isEdit: true, id: options.id })
      wx.setNavigationBarTitle({ title: '编辑衣物' })
      this.loadDetail(options.id)
    } else {
      wx.setNavigationBarTitle({ title: '添加衣物' })
    }
  },

  async loadDetail(id) {
    wx.showLoading({ title: '加载中', mask: true })
    try {
      const row = await db.getClothing(id)
      const seasonsList = this.data.seasonsList.map(s =>
        Object.assign({}, s, { checked: (row.seasons || []).indexOf(s.key) > -1 })
      )

      this.setData({
        images: (row.images || []).map((f, i) => ({ key: 'old-' + i, url: f, fileID: f })),
        category: row.category || '',
        seasonsList,
        name: row.name || '',
        price: row.price ? String(row.price) : ''
      })
      this.refreshCanSave()
    } catch (e) {
      console.error('[衣橱] 读取失败', e)
      wx.showToast({ title: '读取失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  /* ---------- 照片 ---------- */

  onChoose() {
    const remain = this.data.maxImages - this.data.images.length
    if (remain <= 0) {
      wx.showToast({ title: `最多 ${this.data.maxImages} 张`, icon: 'none' })
      return
    }

    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: res => {
        const base = Date.now()
        const added = res.tempFiles.map((f, i) => ({
          key: 'new-' + base + '-' + i,
          url: f.tempFilePath,
          fileID: ''
        }))
        this.setData({ images: this.data.images.concat(added) })
        this.refreshCanSave()
      },
      fail: err => {
        // 用户主动取消不需要提示
        if (err && err.errMsg && err.errMsg.indexOf('cancel') > -1) return
        wx.showToast({ title: '选择图片失败', icon: 'none' })
      }
    })
  },

  onPreview(e) {
    const index = e.currentTarget.dataset.i
    const urls = this.data.images.map(i => i.url)
    wx.previewImage({ current: urls[index], urls })
  },

  onRemove(e) {
    const index = e.currentTarget.dataset.i
    const images = this.data.images.slice()
    const removed = images.splice(index, 1)[0]

    if (removed && removed.fileID) {
      this.removedFiles.push(removed.fileID)
    }

    this.setData({ images })
    this.refreshCanSave()
  },

  /* ---------- 表单 ---------- */

  onCategory(e) {
    this.setData({ category: e.currentTarget.dataset.k })
    this.refreshCanSave()
  },

  onSeason(e) {
    const index = e.currentTarget.dataset.i
    const key = `seasonsList[${index}].checked`
    this.setData({ [key]: !this.data.seasonsList[index].checked })
  },

  onName(e) {
    this.setData({ name: e.detail.value })
  },

  onPrice(e) {
    this.setData({ price: e.detail.value })
  },

  refreshCanSave() {
    this.setData({
      canSave: this.data.images.length > 0 && !!this.data.category
    })
  },

  /* ---------- 保存 ---------- */

  async uploadAll() {
    const images = this.data.images.slice()

    for (let i = 0; i < images.length; i++) {
      if (images[i].fileID) continue

      wx.showLoading({ title: `上传 ${i + 1}/${images.length}`, mask: true })
      const compressed = await db.compressImage(images[i].url, 80)
      const fileID = await db.uploadImage(compressed)

      // 立刻写回，万一后面某张失败，重试时不用重复上传
      images[i] = Object.assign({}, images[i], { fileID })
      this.setData({ images })
    }

    return images.map(i => i.fileID)
  },

  async onSave() {
    if (this.data.saving) return

    if (!this.data.images.length) {
      wx.showToast({ title: '至少添加一张照片', icon: 'none' })
      return
    }
    if (!this.data.category) {
      wx.showToast({ title: '请选择品类', icon: 'none' })
      return
    }

    this.setData({ saving: true })

    try {
      const images = await this.uploadAll()

      const payload = {
        images,
        category: this.data.category,
        seasons: this.data.seasonsList.filter(s => s.checked).map(s => s.key),
        name: (this.data.name || '').trim(),
        price: this.data.price ? Number(this.data.price) : 0,
        updatedAt: Date.now()
      }

      if (this.data.isEdit) {
        await db.updateClothing(this.data.id, payload)
        // 更新成功后再清理旧图，降低误删风险
        if (this.removedFiles.length) {
          await db.deleteFiles(this.removedFiles)
        }
      } else {
        payload.createdAt = Date.now()
        await db.addClothing(payload)
      }

      wx.hideLoading()
      getApp().globalData.wardrobeDirty = true

      wx.showToast({ title: '已保存', icon: 'success', duration: 700 })
      setTimeout(() => wx.navigateBack(), 700)
    } catch (e) {
      wx.hideLoading()
      console.error('[衣橱] 保存失败', e)

      const msg = (e && (e.errMsg || e.message)) || '未知错误'
      wx.showModal({
        title: '保存失败',
        content: msg.indexOf('permission') > -1 || msg.indexOf('Permission') > -1
          ? '没有写入权限。请到云开发控制台把 clothes 集合的权限设为「仅创建者可读写」。'
          : '请检查网络后重试。\n' + msg,
        showCancel: false,
        confirmColor: '#4E6144'
      })
    } finally {
      this.setData({ saving: false })
    }
  }
})
