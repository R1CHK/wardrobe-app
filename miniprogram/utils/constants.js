/**
 * 写死的枚举值。
 * 练手项目不做「自定义分类」——那会带来一整套管理逻辑，
 * 等你真的发现自己只用得上这几个类，再加也不迟。
 */

const CATEGORIES = [
  { key: 'top', name: '上装' },
  { key: 'bottom', name: '下装' },
  { key: 'dress', name: '连衣裙' },
  { key: 'coat', name: '外套' },
  { key: 'shoes', name: '鞋' },
  { key: 'bag', name: '包' },
  { key: 'acc', name: '配饰' }
]

const SEASONS = [
  { key: 'spring', name: '春' },
  { key: 'summer', name: '夏' },
  { key: 'autumn', name: '秋' },
  { key: 'winter', name: '冬' }
]

/** 最多几张照片：够表达，又不至于让上传变慢 */
const MAX_IMAGES = 4

const CATEGORY_MAP = CATEGORIES.reduce((acc, c) => {
  acc[c.key] = c
  return acc
}, {})

const SEASON_MAP = SEASONS.reduce((acc, s) => {
  acc[s.key] = s
  return acc
}, {})

module.exports = {
  CATEGORIES,
  SEASONS,
  MAX_IMAGES,
  CATEGORY_MAP,
  SEASON_MAP
}
