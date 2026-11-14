/* ============================================================
   安装进度 —— 类型与文案
   ------------------------------------------------------------
   用户 2026-11-13：「游戏下载时能否像华为应用商城那样显示下载进度、安装中」

   ## 为什么要单独一个文件

   阶段词表（下载中 / 校验中 / 安装中）会被**三个地方**用到：
   列表行、详情页那颗按钮、领奖后的 toast。写在任一组件里，
   另外两处就会慢慢长歪 —— 最后同一个动作在三处显示三个不同的说法。

   ## `percent === -1` 是「不知道总长」，不是「0%」

   服务端没给 `Content-Length` 时（有些 CDN / 反代会去掉），只能报已下载量。
   把它当成 0 会让进度条一直停在起点，看着像卡死；当成 100 更糟。
   ============================================================ */

/** 一次安装走到哪一步 */
export type InstallPhase = 'catalog' | 'download' | 'verify' | 'install'

export interface InstallProgress {
  /** 哪一款（列表里只给那一行显示进度） */
  gameId: string
  phase: InstallPhase
  /** 0–100；`-1` = 总长未知 */
  percent: number
  received: number
  total: number
}

/** 上游（store）回调形状：只关心"我现在到哪了" */
export type InstallProgressReporter = (p: InstallProgress) => void

/**
 * 每个阶段给人看的说法。
 *
 * ⚠️ `download` 的文案由 `installProgressText` 拼百分比，这里只给"主体"。
 */
export const PHASE_LABEL: Record<InstallPhase, string> = {
  catalog: '正在核对清单',
  download: '下载中',
  verify: '校验中',
  install: '安装中',
}

/** 进度条旁边那一行字。有百分比就带百分比，没有就报已下载量。 */
export function installProgressText(p: InstallProgress): string {
  if (p.phase !== 'download') return PHASE_LABEL[p.phase] + '…'
  if (p.percent >= 0) return `下载中 ${p.percent}%`
  return `下载中 ${humanSize(p.received)}`
}

/**
 * 进度条该填多少（0–1）。**未知总长时返回 0** —— 界面据此切成
 * 「不确定态」（来回滚动的条），而不是画一条假的百分比。
 */
export function barRatio(p: InstallProgress): number {
  if (p.percent < 0) return 0
  return Math.min(1, Math.max(0, p.percent / 100))
}

/**
 * **按钮上**那一行字（比 `installProgressText` 短）。
 *
 * 按钮宽度有限（列表行里是药丸形），"下载中 42%" 会把它撑到换行；
 * 这里压成"下载 42%"。
 */
export function installButtonText(p: InstallProgress): string {
  switch (p.phase) {
    case 'catalog':
      return '核对中…'
    case 'download':
      return p.percent >= 0 ? `下载 ${p.percent}%` : `下载 ${humanSize(p.received)}`
    case 'verify':
      return '校验中…'
    case 'install':
      return '安装中…'
  }
}

/** 体积（1.2 MB / 856 KB）。下载进度和"多大"标签共用一处。 */
export function humanSize(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 KB'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export { percentOf } from '../games/download'
