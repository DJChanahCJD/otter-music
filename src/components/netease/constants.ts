export type FilterItem = { id: string; name: string };
export type FilterCategory = { category: string; filters: FilterItem[] };

const mapF = (names: string[]) => names.map(n => ({ id: n, name: n }));

const DATA: Record<string, string[]> = {
  '语种': ['华语', '欧美', '日语', '韩语', '粤语'],
  '风格': ['流行', '说唱', '电子', '民谣', '舞曲', '轻音乐', 'R&B/Soul', '爵士', '古典', '古风'],
  '场景': ['学习', '工作', '运动', '驾车', '旅行', '夜晚'],
  '情感': ['快乐', '治愈', '放松', '浪漫', '怀旧', '伤感'],
  '主题': ['影视原声', 'ACG', '经典', '网络歌曲', '00后'],
};

export const ALL_FILTERS: FilterCategory[] = Object.entries(DATA).map(([category, filters]) => ({
  category,
  filters: mapF(filters),
}));

export const RECOMMEND_FILTERS: FilterItem[] = [
  { id: '', name: '全部' },
  { id: 'toplist', name: '排行榜' },
  ...mapF(DATA['风格'].slice(0, 6)),
];