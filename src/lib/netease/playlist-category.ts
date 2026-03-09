export type FilterItem = {
  id: string;
  name: string;
};

export type FilterCategory = {
  category: string;
  filters: FilterItem[];
};

/* 工具函数：避免重复写 { id, name } */
const F = (name: string): FilterItem => ({
  id: name,
  name,
});

/* =========================================================
 * 所有分类（按移动端优先级排序）
 * 顺序：语种 → 风格 → 场景 → 情感 → 主题
 * ========================================================= */

export const ALL_FILTERS: FilterCategory[] = [
  {
    category: '语种',
    filters: [
      F('华语'),
      F('欧美'),
      F('日语'),
      F('韩语'),
      F('粤语'),
    ],
  },

  {
    category: '风格',
    filters: [
      // 高频（移动端优先展示）
      F('流行'),
      F('说唱'),
      F('电子'),
      F('民谣'),
      F('舞曲'),
      F('轻音乐'),

      // 中频
      F('R&B/Soul'),
      F('摇滚'),
      F('爵士'),
      F('乡村'),
      F('古典'),
      F('民族'),
      F('英伦'),

      // 小众
      F('金属'),
      F('朋克'),
      F('蓝调'),
      F('雷鬼'),
      F('世界音乐'),
      F('拉丁'),
      F('New Age'),
      F('古风'),
      F('后摇'),
      F('Bossa Nova'),
    ],
  },

  {
    category: '场景',
    filters: [
      // 高频
      F('学习'),
      F('工作'),
      F('运动'),
      F('驾车'),
      F('旅行'),

      // 其他
      F('清晨'),
      F('夜晚'),
      F('午休'),
      F('下午茶'),
      F('地铁'),
      F('散步'),
      F('酒吧'),
    ],
  },

  {
    category: '情感',
    filters: [
      // 高频
      F('快乐'),
      F('治愈'),
      F('放松'),
      F('浪漫'),

      // 其他
      F('怀旧'),
      F('伤感'),
      F('孤独'),
      F('思念'),
      F('感动'),
      F('兴奋'),
      F('安静'),
      F('清新'),
    ],
  },

  {
    category: '主题',
    filters: [
      // 高频
      F('影视原声'),
      F('ACG'),
      F('游戏'),
      F('经典'),
      F('KTV'),

      // 扩展
      F('综艺'),
      F('儿童'),
      F('校园'),
      F('网络歌曲'),
      F('翻唱'),
      F('吉他'),
      F('钢琴'),
      F('器乐'),

      F('70后'),
      F('80后'),
      F('90后'),
      F('00后'),
    ],
  },
];

export const FEATURED_SUB_FILTERS: FilterItem[] = [
  F("官方"),
  F("榜单"),
  { id: "toplist", name: "排行榜" },
];

export const RECOMMEND_FILTERS: FilterItem[] = [
  F("全部"),
  { id: "featured", name: "精选" },
  { id: "podcast", name: "播客" },

  F("华语"),
  F("欧美"),

  F("流行"),
  F("说唱"),
  F("摇滚"),
  F("电子"),
  F("民谣"),
  F("轻音乐"),
];
