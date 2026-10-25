/**
 * 包体大小的显示格式。
 *
 * ## 为什么单独一个文件
 *
 * 这个函数原来只写在 `PluginStoreCard.tsx` 里（远程商店用）。2026-10-24
 * 游戏市场（`GameStore.tsx`）也要显示大小，而**两处各写一份必然走散**：
 * 一处改成 `MB` 保留一位、另一处保留两位，同一个包在两个界面上显示两个数字。
 * 那正是「本文件存在的理由」。
 *
 * ⚠️ `bytes` 是清单里给的**提示值，不是校验依据**（校验只认 SHA-256）。
 *   所以拿不到就写「大小未知」，不要编一个数出来。
 */
export function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '大小未知'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
