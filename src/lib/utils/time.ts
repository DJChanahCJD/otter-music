/**
 * 把秒数格式化为 mm:ss（分钟补零，适合倒计时显示）
 * 注意：与 formatMediaTime (m:ss) 格式不同，不可直接替换
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
