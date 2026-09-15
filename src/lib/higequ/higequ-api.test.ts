import { describe, expect, it } from "vitest";
import {
  convertHigequSearchItemToMusicTrack,
  parseHigequPlayerHtml,
  parseHigequRid,
  parseHigequSearchHtml,
  splitHigequArtists,
} from "./higequ-api";

/** 取自 https://higequ.com/s/周杰伦/ 的真实结构（截断为 2 条 + 分页容器） */
const SEARCH_HTML = `
<main class="container">
  <div id="search-results" class="search-results">
    <div id="results-container" style="display: block;">
      <div class="result-item" data-rid="228908">
        <div class="result-info">
          <div class="result-title">晴天</div>
          <div class="result-artist">周杰伦</div>
          <div class="result-album">专辑: 叶惠美</div>
        </div>
      </div>
      <div class="result-item" data-rid="1002234">
        <div class="result-info">
          <div class="result-title">说好不哭 (with 五月天阿信)</div>
          <div class="result-artist">五月天&amp;周杰伦</div>
          <div class="result-album">专辑: 说好不哭</div>
        </div>
      </div>
    </div>
  </div>
  <div id="pagination" class="pagination" style="display: flex;">
    <div class="pagination-controls">
      <button id="prev-page" class="page-button" disabled>上一页</button>
      <div id="page-numbers" class="page-numbers">
        <button class="page-button active">1</button>
        <button class="page-button">360</button>
      </div>
      <button id="next-page" class="page-button">下一页</button>
    </div>
  </div>
</main>
`;

/** 末页：站点会给 #next-page 加上 disabled（实测 /s/周杰伦/360/） */
const LAST_PAGE_HTML = SEARCH_HTML.replace(
  '<button id="next-page" class="page-button">下一页</button>',
  '<button id="next-page" class="page-button" disabled>下一页</button>'
);

/** 取自 https://higequ.com/player/228908/ 的真实结构（截断） */
const PLAYER_HTML = `
<div id="music-card" class="music-card">
  <div class="album-cover">
    <img id="album-cover" class="record-image" src="https://img1.kuwo.cn/star/albumcover/300/s3s94/93/211513640.jpg" alt="周杰伦晴天歌曲封面">
  </div>
  <h1 id="music-title" class="music-title">晴天 - 周杰伦</h1>
</div>
<div id="lyrics-container" class="lyrics-container">
  <div class="lyric-line" data-time="0">晴天 - 周杰伦 (Jay Chou)</div><div class="lyric-line" data-time="29">故事的小黄花</div><div class="lyric-line" data-time="65.5">我好想再淋一遍</div><div class="lyric-line" data-time="133">Rock &amp; Roll</div>
</div>
<script>
let code = "aHR0cHM6Ly9rdy1lci5rdXdvLmNuLzNlMzM5M2JhNTJkMTNkMjhmYmI0YmI0M2E4NjFjNDdiLzZhYThjYmVlL3Jlc291cmNlLzMwMTA2L3RyYWNrbWVkaWEvTTUwMDAwMGJZRGxjMlh4S0xzLm1wMw==";
let realUrl = atob(code);
document.getElementById('audio-element').src = realUrl;
</script>
`;

describe("splitHigequArtists", () => {
  it("单歌手原样返回", () => {
    expect(splitHigequArtists("周杰伦")).toEqual(["周杰伦"]);
  });

  it("按站点约定的 & 拆分多歌手", () => {
    expect(splitHigequArtists("五月天&周杰伦")).toEqual(["五月天", "周杰伦"]);
    expect(splitHigequArtists("大头针 Official&俊俊")).toEqual([
      "大头针 Official",
      "俊俊",
    ]);
  });

  it("西文名中的 ' & ' 不拆分", () => {
    expect(splitHigequArtists("Simon & Garfunkel")).toEqual([
      "Simon & Garfunkel",
    ]);
  });

  it("空串返回空数组", () => {
    expect(splitHigequArtists("   ")).toEqual([]);
  });
});

describe("parseHigequSearchHtml", () => {
  it("解析结果项并剥离专辑前缀", () => {
    const { items, hasMore } = parseHigequSearchHtml(SEARCH_HTML);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      rid: "228908",
      name: "晴天",
      artist: "周杰伦",
      album: "叶惠美",
    });
    // HTML 实体由 textContent 自动解码
    expect(items[1].artist).toBe("五月天&周杰伦");
    expect(hasMore).toBe(true);
  });

  it("末页 #next-page 带 disabled 时 hasMore 为 false", () => {
    expect(parseHigequSearchHtml(LAST_PAGE_HTML).hasMore).toBe(false);
  });

  it("无分页容器时保守返回 hasMore=false", () => {
    const { items, hasMore } = parseHigequSearchHtml(
      "<html><body></body></html>"
    );
    expect(items).toEqual([]);
    expect(hasMore).toBe(false);
  });
});

describe("convertHigequSearchItemToMusicTrack", () => {
  it("生成带前缀的 ID，并把 rid 写入 url_id", () => {
    expect(
      convertHigequSearchItemToMusicTrack({
        rid: "228908",
        name: "晴天",
        artist: "周杰伦",
        album: "叶惠美",
      })
    ).toEqual({
      id: "higequ_228908",
      name: "晴天",
      artist: ["周杰伦"],
      album: "叶惠美",
      pic_id: "higequ_228908",
      url_id: "228908",
      lyric_id: "higequ_228908",
      source: "higequ",
    });
  });
});

describe("parseHigequPlayerHtml", () => {
  it("解码内联 base64 得到音频直链，并重建 LRC", () => {
    const detail = parseHigequPlayerHtml(PLAYER_HTML);

    expect(detail.audioUrl).toBe(
      "https://kw-er.kuwo.cn/3e3393ba52d13d28fbb4bb43a861c47b/6aa8cbee/resource/30106/trackmedia/M500000bYDlc2XxKLs.mp3"
    );
    expect(detail.coverUrl).toBe(
      "https://img1.kuwo.cn/star/albumcover/300/s3s94/93/211513640.jpg"
    );
    expect(detail.lyric).toBe(
      [
        "[00:00.00]晴天 - 周杰伦 (Jay Chou)",
        "[00:29.00]故事的小黄花",
        "[01:05.50]我好想再淋一遍",
        "[02:13.00]Rock & Roll",
      ].join("\n")
    );
  });

  it("缺少内联 base64 时 audioUrl 为空串", () => {
    expect(parseHigequPlayerHtml("<html></html>").audioUrl).toBe("");
  });

  it("base64 内容非法时不抛错", () => {
    const html = '<script>let code = "!!!not-base64!!!";</script>';
    expect(parseHigequPlayerHtml(html).audioUrl).toBe("");
  });
});

describe("parseHigequRid", () => {
  it("接受带前缀与纯数字形式", () => {
    expect(parseHigequRid("higequ_228908")).toBe("228908");
    expect(parseHigequRid("228908")).toBe("228908");
  });

  it("拒绝空值与非法形式", () => {
    expect(parseHigequRid("")).toBeNull();
    expect(parseHigequRid(undefined)).toBeNull();
    expect(parseHigequRid("higequ_abc")).toBeNull();
  });
});
