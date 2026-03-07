# 网易云返回类型规范化方案（Plan）

## 目标与现状

### 目标
- 把“网易云原始返回结构的不一致”限制在 `src/lib/netease/` 内部消化，UI 只消费稳定、单一形状的数据模型。
- 清理类型层面的不一致来源（重复接口、同名不同义、过宽泛的 Response 包装），减少 `as any` 与兼容分支。
- 为后续增加/替换接口提供可扩展的适配层，避免到处改 UI。

### 现状证据（基于代码扫描）
- `netease-types.ts` 存在重复同名接口 `QrCheckResponse`（TS 接口合并导致最终形状不稳定）。
- `NeteaseResponse<T>` 同时允许 `data` 与 `result`，把不一致扩散到调用侧。
- `netease-api.ts` 内部存在多种“返回包裹风格”（`requestWeapi/requestEapi/fetchLocalApi`），上层被迫写兼容逻辑。
- UI 层 `PlaylistMarket.tsx` 有多处 `as any`，主要来自不同接口字段名（`picUrl/coverImgUrl/coverUrl`）与 creator 结构差异。
- 类型命名存在冲突：`SearchResult` 在应用层与网易云层同名不同义。

## 约束与准则（Decision Criteria）

### 约束
- 最小 Breaking Change：尽量不改变现有 UI 的业务逻辑，只替换其数据来源/类型消费方式。
- 类型必须“可读 + 可追踪”：一眼能看出是“原始 API 结构”还是“已规范化结构”。
- 不依赖运行时校验库（除非仓库已引入并普遍使用）；优先 TypeScript 类型约束 + 少量手写 normalize。

### 评估维度
- 一致性：UI 是否可以只依赖单一模型，不再出现字段兼容分支。
- 可维护性：新增接口/字段时，改动是否集中在适配层。
- 风险：对现有调用方的影响范围、重构难度。

## 方案对比

### 方案 A：保留单文件 `netease-types.ts`，在文件内做分区与局部修补
**核心做法**
- 修复重复接口、重命名冲突类型（如 `SearchResult`）。
- 为本地代理接口引入更明确的返回类型（联合/可选字段），调用侧继续兼容读取。
- 在少量 UI 文件中逐步删除 `as any`，通过联合类型补齐。

**优点**
- 改动小、迁移快。

**缺点**
- “原始返回结构不一致”仍会继续往外泄漏：调用侧仍需写 `res.data?.x || res.result?.x` 的兼容分支。
- 类型继续混放：未来维护者更容易误用/误导 import。

### 方案 B（推荐）：拆分 Raw/Normalized 类型 + 统一适配层，API 函数只暴露 Normalized
**核心做法**
- 将网易云类型分为两层：
  - Raw：严格贴近接口返回（字段名、嵌套结构、可选字段），只在 `src/lib/netease/` 内使用。
  - Normalized：面向业务/UI 的稳定模型（字段命名统一、id 统一为 string、图片字段统一为 `coverUrl` 等）。
- 在 `netease-api.ts` 或独立 adapter 文件中集中做 normalize：
  - 同一业务概念（如“歌单卡片”）无论来自“推荐/广场/榜单/我的歌单”，最终都转成同一个 `MarketPlaylist` 形状。
  - 对本地代理返回做 unwrap：把 `data/result/profile` 等差异在适配层统一。
- UI 侧移除 `as any`，改为消费规范化后的类型与字段。

**优点**
- 不一致被“封装在适配层”，UI 代码更干净、更稳定。
- 新接口接入只需补 normalize，不需要全局搜 UI 修改。

**缺点**
- 需要一次性梳理并改造 `netease-api.ts` 的返回类型与若干 UI 调用点（属于可控范围的集中重构）。

**决策**
- 选择方案 B：用类型分层 + 适配层统一作为长期可维护解法。

## 强制规则（Mandatory Rules）
- UI 组件禁止直接依赖 Raw 类型；UI 只能 import “规范化后的类型”（Normalized）。
- `src/lib/netease/` 内部允许存在 Raw 联合类型以兼容接口差异，但必须在 API 函数出口处完成 normalize。
- 禁止新增 `as any` 来绕过字段差异；若遇到新字段不一致，必须在适配层统一。
- `netease-types` 内禁止重复导出同名接口（避免 TS interface merge 产生隐式形状变化）。

## 实施步骤（Implementation Plan）

### Step 1：清点并定义“领域模型”（Normalized）
1. 列出 UI 真实需要的稳定结构（最少集），例如：
   - 登录：`NeteaseProfile`
   - 二维码轮询：`QrStatusResult`（含 `code/message/cookie?`）
   - 歌单卡片：`MarketPlaylist`（`id/name/coverUrl/playCount/userId?`）
   - 详情页：`PlaylistDetail/ArtistDetail/AlbumDetail` 可继续保留 Raw，但对外暴露可选择提供 `UnifiedDetail + tracks` 这种面向 UI 的结构（取决于 UI 是否复用）。
2. 统一字段命名策略：
   - 图片：统一 `coverUrl`（不再出现 `picUrl/coverImgUrl/coverUrl` 三选一）。
   - id：Normalized 一律 `string`（Raw 允许 `number | string`，normalize 时 `String()`）。

### Step 2：拆分/整理类型文件
1. 调整 `src/lib/netease/netease-types.ts`：
   - 删除重复 `QrCheckResponse`（只保留一个 Raw 定义或改名为 `RawQrCheckResponse`）。
   - 重命名网易云侧 `SearchResult` 为 `NeteaseSearchResult`（避免与应用层 `SearchResult` 冲突）。
   - 将 `NeteaseResponse<T>` 改为更明确的 Raw Envelope（或仅限内部使用，不再让 UI 感知）。
2. 新增类型文件（建议）：
   - `src/lib/netease/netease-raw-types.ts`：只放 Raw（与接口一致）。
   - `src/lib/netease/netease-models.ts`：只放 Normalized（给 UI/业务用）。
   - 若不拆文件，也必须在同一文件里用明确的命名与导出边界区分 Raw vs Normalized。

### Step 3：建立统一的 unwrap/normalize 工具（适配层）
1. 新增 `src/lib/netease/netease-normalize.ts`（或在 `netease-api.ts` 内分段实现）：
   - `unwrapLocalProfile(res): UserProfile | null`
   - `unwrapRecommendPlaylists(res): RecommendPlaylist[]`
   - `normalizeMarketPlaylist(raw): MarketPlaylist`
   - `normalizeQrCheck(res): QrStatusResult`
2. 适配层必须覆盖当前已发现的不一致来源：
   - `data` vs `result` vs 裸返回
   - `picUrl/coverImgUrl/coverUrl`
   - `creator` 缺失（Toplist 没 creator）

### Step 4：改造 `netease-api.ts` 的“对外返回类型”
1. 调整本地代理相关 API：
   - `getMyInfo(cookie)`：改为直接返回 `UserProfile | null`（或 `{ profile: UserProfile | null }`），不再暴露 `{ data?, profile? }`。
   - `getRecommendPlaylists(cookie)`：改为直接返回 `RecommendPlaylist[]`（或规范化后的 `MarketPlaylist[]`，看 UI 复用程度）。
   - `checkQrStatus(key)`：改为直接返回 `QrStatusResult`（含 cookie）。
2. 对 `cachedFetch` 的泛型做同步调整，确保缓存的也是“规范化后的类型”，避免缓存层再次引入联合结构。

### Step 5：逐个收敛 UI 调用点并删除 `as any`
1. `PlaylistMarket.tsx`：
   - 不再 import `Toplist/UserPlaylist` 参与 UI 映射；改为直接消费 `netease-api` 返回的 `MarketPlaylist[]`。
   - 删除所有 `as any` 与 `res.data as ...` 的断言分支。
2. `NeteaseLogin.tsx`：
   - `getMyInfo` 直接得到 profile；去掉 `res?.profile || res?.data?.profile`。
   - `checkQrStatus` 直接得到 `code/message/cookie`；去掉 `res.data?.code` 这类不稳定读取。
3. `NeteaseDetail.tsx`（可选增强）：
   - 若 `getPlaylistDetail/getArtist/getAlbum` 对外仍返回 Raw，可保持不动；若后续要复用“统一详情头”，再引入 `getUnifiedDetail(type,id)` 统一出口。

### Step 6：验证与回归
- TypeScript 编译通过（无隐式 any、无类型断言滥用）。
- 手动回归路径：
  - 网易云登录：二维码流程（801/802/803/800 等）与 Cookie 登录。
  - 歌单广场：推荐/榜单/分类/我的（含推荐、创建、收藏）。
  - 详情页：歌单/歌手/专辑三类详情正常加载与导入。

## 何时需要重新评估（Revisit Triggers）
- 本地代理接口返回结构发生变化（字段/包裹层变动）。
- 新增网易云数据源导致“歌单卡片/歌曲条目”等领域模型无法表达。
- 引入运行时校验库（如 zod）并希望强化边界校验时。

