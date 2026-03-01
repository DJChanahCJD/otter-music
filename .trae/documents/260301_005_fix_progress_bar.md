# 修复底部播放栏进度显示问题

## 问题分析
用户反馈应用退出重进后，底部播放栏（`MusicNowPlayingBar`）虽然显示暂停状态，但进度条默认为 0，无法显示真实的播放进度。

经过分析发现：
1.  `MusicNowPlayingBar` 的进度计算依赖于 `currentAudioTime` 和 `duration`。
    ```typescript
    const progress = duration > 0 ? (currentAudioTime / duration) * 100 : 0;
    ```
2.  `useMusicStore` 中使用了 `zustand/persist` 进行状态持久化。
3.  `currentAudioTime` 已经被持久化，因此重启后能恢复上次播放进度。
4.  但是，`duration` **没有** 被持久化。重启后 `duration` 初始化为 0。
5.  由于 `hasUserGesture` 默认为 `false`，应用启动时不会立即加载音频，导致无法通过 `durationchange` 事件更新 `duration`。
6.  因此，重启后 `duration` 为 0，导致进度计算结果为 0。

## 解决方案
将 `duration` 添加到 `useMusicStore` 的持久化白名单中。这样应用重启后，`duration` 会被恢复，配合已持久化的 `currentAudioTime`，即可正确计算并显示进度条。

## 修改计划

### 1. 修改 `src/store/music-store.ts`
在 `persist` 中间件的 `partialize` 配置中，添加 `duration` 字段。

```typescript
partialize: (state) => ({
  // ... 其他字段
  currentAudioTime: state.currentAudioTime,
  duration: state.duration, // 新增
  // ... 其他字段
}),
```

## 验证计划
1.  播放一首歌曲，拖动进度条到中间位置。
2.  刷新页面或重启应用。
3.  观察底部播放栏的圆环进度条是否显示正确（非 0）。
4.  点击播放，确认能否正常继续播放。
