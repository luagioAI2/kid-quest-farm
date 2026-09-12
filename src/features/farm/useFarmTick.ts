import { useEffect, useState } from 'react'

/**
 * 农场心跳：让倒计时 / 生长进度条实时更新。
 *
 * - 默认 1 秒一跳，足够让「还要 3 分钟」和进度条动起来。
 * - 页面隐藏（切到后台 / 锁屏）时自动停跳，省电；回到前台立刻补跳一次。
 * - 组件卸载时一定清理 interval，避免野定时器。
 */
export function useFarmTick(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (timer !== null) return
      timer = setInterval(() => setNow(Date.now()), intervalMs)
    }
    const stop = () => {
      if (timer === null) return
      clearInterval(timer)
      timer = null
    }
    const onVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        setNow(Date.now())
        start()
      }
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs])

  return now
}
