const { CATEGORY_MAP, SEASON_MAP } = require('../../utils/constants')
const db = require('../../utils/db')

Page({
  data: {
    id: '',
    item: null,
    catName: '',
    seasonText: '',
    dateText: '',
    loading: true,
    error: ''
  },

  onLoad(options) {
    this.setData({ id: (options && options.id) || '' })
  },

  onShow() {
    // 详情只有一条记录，每次都重新拉，比维护脏标记更省心
    if (this.data.id) this.load()
  },

  async load() {
    this.setData({ loading: true, error: '' })

    try {
      const row = await db.getClothing(this.data.id)
      const cat = CATEGORY_MAP[row.category]

      this.setData({
        item: row,
        catName: cat ? cat.name : '未分类',
        seasonText: (row.seasons || [])
          .map(k => (SEASON_MAP[k] ? SEASON_MAP[k].name : ''))
          .filter(Boolean)
          .join(' · '),
        dateText: db.formatDate(row.createdAt),
        loading: false
      })
    } catch (e) {
      console.error('[衣橱] 详情读取失败', e)
      this.setData({ loading: false, error: '这件衣物可能已经被删除了' })
    }
  },

  onPreview(e) {
    const index = e.currentTarget.dataset.i
    const urls = this.data.item.images || []
    wx.previewImage({ current: urls[index], urls })
  },

  onEdit() {
    wx.navigateTo({ url: `/pages/edit/edit?id=${this.data.id}` })
  },

  onBack() {
    wx.navigateBack()
  },

  onDelete() {
    wx.showModal({
      title: '删除这件衣物？',
      content: '照片和信息都会被一起删掉，无法恢复。',
      confirmText: '删除',
      confirmColor: '#A5673F',
      success: res => {
        if (!res.confirm) return
        this.doDelete()
      }
    })
  },

  async doDelete() {
    wx.showLoading({ title: '删除中', mask: true })

    try {
      const item = this.data.item
      await db.removeClothing(this.data.id)

      if (item && item.images && item.images.length) {
        await db.deleteFiles(item.images)
      }

      wx.hideLoading()
      getApp().globalData.wardrobeDirty = true
      wx.showToast({ title: '已删除', icon: 'success', duration: 600 })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (e) {
      wx.hideLoading()
      console.error('[衣橱] 删除失败', e)
      wx.showToast({ title: '删除失败，请重试', icon: 'none' })
    }
  },

  onShareAppMessage() {
    return { title: '我的衣橱', path: '/pages/index/index' }
  }
})
