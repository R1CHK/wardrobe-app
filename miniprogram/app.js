App({
  globalData: {
    // 其它页面改动数据后把它置为 true，列表页 onShow 时就会刷新
    wardrobeDirty: false
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('[衣橱] 请把基础库调到 2.2.3 以上，否则无法使用云能力')
      return
    }

    wx.cloud.init({
      // DYNAMIC_CURRENT_ENV 会自动使用当前小程序绑定的云环境，
      // 这样不用把环境 ID 写死在代码里。如果你有多个环境，改成具体 ID，例如：
      // env: 'wardrobe-3g1abcde'
      env: wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: true
    })
  }
})
