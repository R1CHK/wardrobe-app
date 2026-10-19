/**
 * 冒烟测试：用内存假数据库把 db 层和页面逻辑跑一遍。
 * 目的不是替代真机测试，而是在打开开发者工具之前就发现明显的逻辑错误。
 *
 * 运行： node tools/smoke-test.js
 */
const path = require('path')

/* ---------------- 内存版云数据库 ---------------- */
const store = { docs: [], seq: 0, files: [] }

function match(doc, where) {
  if (!where) return true
  return Object.keys(where).every(k => doc[k] === where[k])
}

function makeQuery() {
  const q = { _where: null, _order: null, _skip: 0, _limit: 20 }
  q.where = w => (q._where = w, q)
  q.orderBy = (f, d) => (q._order = [f, d], q)
  q.skip = n => (q._skip = n, q)
  q.limit = n => (q._limit = n, q)
  q.get = () => {
    let rows = store.docs.filter(d => match(d, q._where))
    if (q._order) {
      const [f, dir] = q._order
      rows = rows.slice().sort((a, b) => (dir === 'desc' ? (b[f] || 0) - (a[f] || 0) : (a[f] || 0) - (b[f] || 0)))
    }
    return Promise.resolve({ data: rows.slice(q._skip, q._skip + q._limit) })
  }
  q.count = () => Promise.resolve({ total: store.docs.filter(d => match(d, q._where)).length })
  q.add = ({ data }) => {
    const _id = 'id_' + (++store.seq)
    store.docs.push(Object.assign({ _id, _openid: 'me' }, data))
    return Promise.resolve({ _id })
  }
  q.doc = id => ({
    get: () => {
      const d = store.docs.find(x => x._id === id)
      return d ? Promise.resolve({ data: d }) : Promise.reject(new Error('document not found'))
    },
    update: ({ data }) => {
      const i = store.docs.findIndex(x => x._id === id)
      if (i < 0) return Promise.reject(new Error('document not found'))
      store.docs[i] = Object.assign(store.docs[i], data)
      return Promise.resolve({ stats: { updated: 1 } })
    },
    remove: () => {
      store.docs = store.docs.filter(x => x._id !== id)
      return Promise.resolve({ stats: { removed: 1 } })
    }
  })
  return q
}

/* ---------------- 假 wx ---------------- */
global.wx = {
  cloud: {
    database: () => ({ collection: () => makeQuery() }),
    uploadFile: ({ cloudPath }) => {
      const fileID = 'cloud://' + cloudPath
      store.files.push(fileID)
      return Promise.resolve({ fileID })
    },
    deleteFile: ({ fileList }) => {
      store.files = store.files.filter(f => fileList.indexOf(f) < 0)
      return Promise.resolve({ fileList })
    }
  },
  compressImage: ({ src, success }) => success({ tempFilePath: src + '.zip' }),
  chooseMedia: ({ success }) =>
    success({ tempFiles: [{ tempFilePath: '/tmp/a.jpg' }, { tempFilePath: '/tmp/b.jpg' }] }),
  showToast: () => {},
  showLoading: () => {},
  hideLoading: () => {},
  showModal: () => {},
  navigateTo: () => {},
  navigateBack: () => {},
  setNavigationBarTitle: () => {},
  previewImage: () => {},
  stopPullDownRefresh: () => {}
}

global.getApp = () => ({ globalData: { wardrobeDirty: false } })

/* ---------------- 加载 Page ---------------- */
function setPath(obj, key, value) {
  const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]]
  cur[parts[parts.length - 1]] = value
}

function loadPage(rel) {
  let cfg = null
  global.Page = c => (cfg = c)
  const abs = path.join(__dirname, '..', 'miniprogram', 'pages', rel)
  delete require.cache[require.resolve(abs)]
  require(abs)
  const inst = Object.assign({}, cfg)
  inst.data = JSON.parse(JSON.stringify(cfg.data))
  inst.setData = patch => {
    Object.keys(patch).forEach(k => {
      if (k.indexOf('[') > -1 || k.indexOf('.') > -1) setPath(inst.data, k, patch[k])
      else inst.data[k] = patch[k]
    })
  }
  return inst
}

const ok = []
const fail = []
function check(name, cond, extra) {
  if (cond) ok.push(name)
  else fail.push(name + (extra ? ' → ' + JSON.stringify(extra) : ''))
}

/* ---------------- 用录��页造 3 件数据 ---------------- */
async function seed() {
  const specs = [
    { cat: 'top', name: '白衬衫', price: '399', seasons: [0, 2] },
    { cat: 'bottom', name: '黑色西裤', price: '599', seasons: [2, 3] },
    { cat: 'top', name: '', price: '', seasons: [] }
  ]

  for (const s of specs) {
    const p = loadPage('edit/edit.js')
    p.onLoad({})
    p.onChoose()
    p.onCategory({ currentTarget: { dataset: { k: s.cat } } })
    s.seasons.forEach(i => p.onSeason({ currentTarget: { dataset: { i } } }))
    p.onName({ detail: { value: s.name } })
    p.onPrice({ detail: { value: s.price } })
    await p.onSave()
  }
}

async function main() {
  await seed()

  check('录入 3 件后数据库有 3 条', store.docs.length === 3, store.docs.length)
  check('价格转成了数字', store.docs[0].price === 399, store.docs[0].price)
  check('空价格存为 0', store.docs[2].price === 0, store.docs[2].price)
  check('每件都有 2 张图', store.docs[0].images.length === 2, store.docs[0].images)
  check('图片已上传到云存储', store.docs[0].images.every(f => f.indexOf('cloud://') === 0))
  check('季节被转成 key', JSON.stringify(store.docs[0].seasons) === '["spring","autumn"]', store.docs[0].seasons)
  check('创建时间已写入', typeof store.docs[0].createdAt === 'number')

  /* ---- 列表页 ---- */
  const idx = loadPage('index/index.js')
  idx.onLoad()
  idx.onShow()
  await new Promise(r => setTimeout(r, 30))

  check('列表拿到全部 3 件', idx.data.list.length === 3, idx.data.list.length)
  check('总数正确', idx.data.total === 3, idx.data.total)
  check('ready 已置位', idx.data.ready === true)
  check('封面取第一张图', idx.data.list[0].cover.indexOf('cloud://') === 0, idx.data.list[0].cover)
  check('空名称回退为品类名', idx.data.list.some(i => i.title === '上装'), idx.data.list.map(i => i.title))
  check('价格带 ¥ 前缀', idx.data.list.some(i => i.priceText === '¥399'))
  check('无价格的条目不显示价格', idx.data.list.filter(i => !i.priceText).length === 1)

  /* ---- 品类筛选 ---- */
  idx.onCat({ currentTarget: { dataset: { k: 'top' } } })
  await new Promise(r => setTimeout(r, 30))
  check('筛选上装得到 2 件', idx.data.list.length === 2, idx.data.list.length)
  check('筛选结果品类一致', idx.data.list.every(i => i.title === '白衬衫' || i.title === '上装'))

  idx.onCat({ currentTarget: { dataset: { k: 'all' } } })
  await new Promise(r => setTimeout(r, 30))
  check('切回全部得到 3 件', idx.data.list.length === 3, idx.data.list.length)

  /* ---- 分页 ---- */
  const firstPage = idx.data.list.length
  check('首页不超过 20 条', firstPage <= 20)

  /* ---- 详情 + 编辑 + 删除 ---- */
  const detail = loadPage('detail/detail.js')
  const target = store.docs[0]
  detail.onLoad({ id: target._id })
  detail.onShow()
  await new Promise(r => setTimeout(r, 30))

  check('详情读取成功', !!detail.data.item, detail.data.item)
  check('详情品类名映射正确', detail.data.catName === '上装', detail.data.catName)
  check('季节文案拼接正确', detail.data.seasonText === '春 · 秋', detail.data.seasonText)
  check('录入时间格式化正确', /^\d{4}\.\d{2}\.\d{2}$/.test(detail.data.dateText), detail.data.dateText)

  // 编辑：改名 + 删掉一张图
  const edit = loadPage('edit/edit.js')
  edit.onLoad({ id: target._id })
  await new Promise(r => setTimeout(r, 30))
  check('编辑页回填了图片', edit.data.images.length === 2, edit.data.images.length)
  check('编辑页回填了名称', edit.data.name === '白衬衫', edit.data.name)
  check('编辑页回填了季节选中态', edit.data.seasonsList[0].checked === true)

  edit.onName({ detail: { value: '真丝白衬衫' } })
  edit.onRemove({ currentTarget: { dataset: { i: 0 } } })
  await edit.onSave()

  check('编辑后名称已更新', store.docs[0].name === '真丝白衬衫', store.docs[0].name)
  check('编辑后只剩 1 张图', store.docs[0].images.length === 1, store.docs[0].images.length)
  check('被移除的旧图已从云存储删除', store.files.length === 5, store.files.length)

  // 删除
  delete require.cache[require.resolve(path.join(__dirname, '..', 'miniprogram/pages/detail/detail.js'))]
  const detail2 = loadPage('detail/detail.js')
  detail2.onLoad({ id: target._id })
  detail2.onShow()
  await new Promise(r => setTimeout(r, 30))
  await detail2.doDelete()

  check('删除后数据库剩 2 条', store.docs.length === 2, store.docs.length)
  check('删除后云文件也清了', store.files.length === 4, store.files.length)

  /* ---- 统计 ---- */
  const mine = loadPage('mine/mine.js')
  mine.onShow()
  await new Promise(r => setTimeout(r, 30))
  check('统计件数正确', mine.data.count === 2, mine.data.count)
  check('统计总价值正确', mine.data.valueText === '599', mine.data.valueText)
  check('统计品类数正确', mine.data.catCount === 2, mine.data.catCount)

  /* ---------------- 输出 ---------------- */
  console.log('\n通过 ' + ok.length + ' 项')
  if (fail.length) {
    console.log('\n失败 ' + fail.length + ' 项：')
    fail.forEach(f => console.log('  ✗ ' + f))
    process.exit(1)
  }
  console.log('全部通过\n')
}

main().catch(e => {
  console.error('测试崩溃：', e)
  process.exit(1)
})
