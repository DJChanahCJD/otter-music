export interface PodcastRssSource {
  id: string;
  name: string;
  rssUrl: string;
  author?: string;
  coverUrl?: string;
  description?: string;
  update_time?: number;
  is_deleted?: boolean;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  audioUrl: string | null;
  desc: string;
  pubDate: string | null;
  coverUrl: string | null;
}

export interface PodcastFeed {
  name: string;            //  播客标题
  description: string;
  coverUrl: string | null;
  link: string | null;      //  播客原始链接
  episodes: PodcastEpisode[];
}

export interface SearchPodcastItem {
  source: "apple" | "xyz" | "xmly";
  id: string;
  title: string;
  author: string;
  description?: string | null;
  cover: string | null;
  rssUrl: string | null;
  url: string | null;
}

const RAW_SOURCES = [
  // 中文 | 资讯与商业
  { id: "zx7", name: "资讯早7点", rssUrl: "https://feed.xyzfm.space/wb39te6k9gqw", author: "王子Wz", coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/22/ae/0b/22ae0ba7-e403-0e07-8ffb-5f2bb041ca2a/mza_13972638120233589594.jpg/600x600bb.jpg" },
  { id: "shengcoffee", name: "声动早咖啡", rssUrl: "https://www.ximalaya.com/album/51076156.xml", author: "声动活泼", coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts112/v4/a9/7f/7a/a97f7a8f-4451-05bc-bacc-637773b1b06a/mza_16067595309054880476.png/600x600bb.jpg" },
  { id: "bnt", name: "半拿铁·周刊", rssUrl: "https://feed.xyzfm.space/vylham8uw3ay", author: "刘飞&潇磊", coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/7b/91/d8/7b91d8f0-3e9f-6ffc-049d-884a839e6153/mza_6269877101523052423.jpg/600x600bb.jpg" },
  { id: "zhixing", name: "知行小酒馆", rssUrl: "https://feed.xyzfm.space/j8yp8gxkmgqr", author: "有知有行", coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts112/v4/b3/96/fc/b396fcc5-6e2b-d34e-8d3d-c849c43b6215/mza_4090324763067558601.jpeg/600x600bb.jpg" },
  { id: "wrzhx", name: "无人知晓", rssUrl: "https://feed.xyzfm.space/ypn9dydpbxpc", author: "孟岩", coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts125/v4/99/76/95/99769525-5b7f-b1f4-3d11-b669ad4d0f71/mza_7503501950013528617.jpeg/600x600bb.jpg" },

  // 中文 | 成长与人文（新增你要的4个）
  { id: "zwjhl", name: "自我进化论", rssUrl: "https://feed.xyzfm.space/artr8kfmlmxh", author: "颜晓静Athena", coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts125/v4/7e/9f/2c/7e9f2c84-e756-b687-391e-83a27724645d/mza_1150423139010350989.jpg/600x600bb.jpg" },
  { id: "xsfgs", name: "西西弗高速", rssUrl: "https://feed.xyzfm.space/76evp7fxkeu8", author: "西西弗高速", coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/39/33/c8/3933c812-a713-a8b3-2046-9d82db97ccb3/mza_12071338705578516728.jpg/600x600bb.jpg" },
  { id: "tzbtt", name: "天真不天真", rssUrl: "https://feed.xyzfm.space/mcklbwxjdvfu", author: "杨天真本真", coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/c8/bf/ca/c8bfca7f-a52c-67e1-6d93-fb31fb559324/mza_5986718045801936242.jpg/600x600bb.jpg" },
  { id: "yzhs", name: "岩中花述", rssUrl: "https://feed.xyzfm.space/hwen8wf69c6g", author: "GIADA | JustPod", coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/66/61/68/6661682f-e63e-e4ae-9a2b-24e0f469e691/mza_10195277240598994553.jpg/600x600bb.jpg" },
 
  // 英文 | 顶流与新闻
  { id: "joe", name: "The Joe Rogan Experience", rssUrl: "https://feeds.megaphone.fm/GLT1412515089", author: "Joe Rogan", coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/20/ca/57/20ca5718-1fa5-43d2-62aa-80a7b5e10a23/mza_5053467016139819545.jpg/600x600bb.jpg" },
  { id: "daily", name: "The Daily", rssUrl: "https://feeds.simplecast.com/54nAGcIl", author: "The New York Times", coverUrl: "https://image.simplecastcdn.com/images/7f2f4c05-9c2f-4deb-82b7-b538062bc22d/73549bf1-94b3-40ff-8aeb-b4054848ec1b/3000x3000/the-daily-album-art-original.jpg?aid=rss_feed" },
  { id: "ted-daily", name: "TED Talks Daily", rssUrl: "https://feeds.acast.com/public/shows/67587e77c705e441797aff96", author: "TED", coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts116/v4/2e/cf/99/2ecf996f-71f7-604f-b0a0-43116b9d6619/mza_10257768296573848480.png/600x600bb.jpg" },

  // 英文 | 学习与泛文化
  { id: "6min", name: "6 Minute English", rssUrl: "https://podcasts.files.bbci.co.uk/p02pc9tn.rss", author: "BBC Radio", coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/ba/98/35/ba9835eb-1ef3-60e4-bf05-3d141b8d1c7a/mza_3844641997714022659.jpg/600x600bb.jpg" },
  { id: "tal", name: "This American Life", rssUrl: "https://www.thisamericanlife.org/podcast/rss.xml", author: "This American Life", coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/64/aa/3a/64aa3a66-a08a-947c-cf21-a5722a1b77ae/mza_11390421932467026234.png/600x600bb.jpg" },
  { id: "sysk", name: "Stuff You Should Know", rssUrl: "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/a91018a4-ea4f-4130-bf55-ae270180c327/44710ecc-10bb-48d1-93c7-ae270180c33e/podcast.rss", author: "iHeartPodcasts", coverUrl: "https://www.omnycontent.com/d/programs/e73c998e-6e60-432f-8610-ae210140c5b1/a91018a4-ea4f-4130-bf55-ae270180c327/image.jpg?t=1749759419&size=Large" },
];

export const DEFAULT_RSS_SOURCES: PodcastRssSource[] = RAW_SOURCES.map(source => ({
  ...source,
  id: `default-${source.id}`,
  is_deleted: false,
  update_time: Date.now(),
}));