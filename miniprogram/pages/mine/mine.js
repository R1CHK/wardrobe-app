const db = require('../../utils/db')

function money(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

Page({
  data: {
    count: 0,
    valueText: '0',
    catCount: 0,
    capped: false,
    loading: true
  },

  onShow() {
    this.loadStats()
  },

  async loadStats() {
    try {
      const [count, rows] = await Promise.all([
        db.countMyClothes(),
        db.listAllForStats()
      ])

      const value = rows.reduce((sum, r) => sum + (Number(r.price) || 0), 0)
      const cats = {}
      rows.forEach(r => {
        if (r.category) cats[r.category] = true
      })

      this.setData({
        count,
        valueText: money(value),
        catCount: Object.keys(cats).length,
        capped: count > 100,
        loading: false
      })
    } catch (e) {
      console.error('[衣橱] 统计失败', e)
      this.setData({ loading: false })
    }
  },

  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' })
  },

  onAbout() {
    wx.showModal({
      title: '关于',
      content: '线上衣橱 v1.0.0\n\n一个用来练习完整开发流程的小项目：拍照录入、分类管理、随时查找。\n\n所有照片只存在你自己的云环境里，除你之外没有人能看到。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#4E6144'
    })
  },

  onShareAppMessage() {
    return { title: '我的衣橱', path: '/pages/index/index' }
  }
})
