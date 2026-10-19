const { CATEGORIES, CATEGORY_MAP } = require('../../utils/constants')
const db = require('../../utils/db')

const PAGE_SIZE = 20

Page({
  data: {
    categories: CATEGORIES,
    activeCat: 'all',
    list: [],
    total: 0,
    ready: false,       // 首屏是否加载完（用于骨架屏）
    loadingMore: false,
    hasMore: true
  },

  onLoad() {
    this.loadCount()
  },

  onShow() {
    const app = getApp()
    // 从录入/详情页回来时，数据可能变了，重新拉一遍
    if (app.globalData.wardrobeDirty || !this.data.ready) {
      app.globalData.wardrobeDirty = false
      this.reload()
    }
  },

  onPullDownRefresh() {
    Promise.resolve(this.reload()).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return
    this.fetchPage(this.data.list.length)
  },

  /* ---------- 数据 ---------- */

  async loadCount() {
    try {
      const total = await db.countMyClothes()
      this.setData({ total })
    } catch (e) {
      console.warn('[衣橱] 计数失败', e)
    }
  },

  async reload() {
    this.setData({ list: [], hasMore: true })
    await this.fetchPage(0)
    this.setData({ ready: true })
    this.loadCount()
  },

  async fetchPage(skip) {
    this.setData({ loadingMore: true })

    try {
      const rows = await db.listMyClothes({
        category: this.data.activeCat,
        skip,
        limit: PAGE_SIZE
      })

      const mapped = rows.map(row => {
        const cat = CATEGORY_MAP[row.category]
        return {
          _id: row._id,
          cover: (row.images && row.images[0]) || '',
          title: row.name || (cat ? cat.name : '未分类'),
          priceText: row.price ? '¥' + row.price : ''
        }
      })

      this.setData({
        list: skip === 0 ? mapped : this.data.list.concat(mapped),
        hasMore: rows.length === PAGE_SIZE
      })
    } catch (e) {
      console.error('[衣橱] 加载失败', e)
      this.setData({ hasMore: false })
      wx.showToast({ title: '加载失败，请检查云环境', icon: 'none' })
    } finally {
      this.setData({ loadingMore: false })
    }
  },

  /* ---------- 交互 ---------- */

  onCat(e) {
    const key = e.currentTarget.dataset.k
    if (key === this.data.activeCat) return
    this.setData({ activeCat: key, list: [], hasMore: true, loadingMore: true })
    this.fetchPage(0)
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/edit/edit' })
  },

  onShareAppMessage() {
    return {
      title: '我的衣橱',
      path: '/pages/index/index'
    }
  }
})
