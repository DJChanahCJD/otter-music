# 修复歌单无法打开的问题

## 问题分析
用户反馈在“我的”页面点击歌单无反应。
经排查，`MinePage` 组件接收一个 `onSelectPlaylist` 属性用于处理点击事件，但在 `src/routes/RouteWrappers.tsx` 的 `MineRoute` 中，该属性被传递了一个空函数，导致点击无效。

## 修复方案
在 `MineRoute` 组件中实现 `onSelectPlaylist` 逻辑，使用 `useNavigate` 跳转到歌单详情页 `/playlist/:id`。

## 实施步骤
1.  修改 `src/routes/RouteWrappers.tsx`：
    *   在 `MineRoute` 组件内部使用 `useNavigate` hook。
    *   将 `onSelectPlaylist` 属性修改为 `(id) => navigate('/playlist/' + id)`。

## 验证
*   进入“我的”页面。
*   点击任意歌单。
*   确认页面是否成功跳转到对应的歌单详情页。
