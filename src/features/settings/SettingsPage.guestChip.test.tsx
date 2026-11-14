import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import { useAccount } from '@/store/useAccount'
import SettingsPage from './SettingsPage'

/* ============================================================
   设置页顶栏那个账号胶囊（2026-11-05）
   ------------------------------------------------------------
   背景：顶栏下面原来有一条常驻的「临时账号 · 换手机或清数据就找不回来」
   横条，用户看了一眼说「这个感觉可以不要吧（任务不是后端有记录吗）」。
   横条连同「第 3 次启动自动弹一次」一起删了。

   删完之后有个必须补上的洞：**游客再也找不到「保存进度」的入口**。
   剩下两个地方都不像入口 —— 家长区的账号卡（要过 PIN、在第 4 栏最底下）
   和「花兑换券被服务端拒」那个硬门槛（那是挨打之后才知道）。

   所以把设置页顶栏那个胶囊变成入口：游客时它是按钮，点开就是绑定面板。
   这个文件守的就是**那根线**（组件在、点击真的调到 `openBind`）——
   只测 BindSheet 本身测不到它，只测 store 也测不到它。

   ⚠️ 正式账号那个胶囊**不能**挂 `data-guest-save`：
      走查脚本和探针拿它判「还需要存进度吗」。
   ============================================================ */

const guestSession = {
  token: 't',
  refreshToken: 'r',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  user: {
    uid: 7,
    username: '',
    mobile: '',
    mobile_verified: false,
    nickname: '小客人',
    avatar: '',
    gender: 0,
    language: 'zh',
    is_guest: true,
    has_password: false,
    has_wechat: false,
    created_at: 0,
  },
}

async function bootStore() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
}

beforeEach(async () => {
  await bootStore()
  useAccount.setState({ session: guestSession, bindSheet: { open: false, reason: null } })
})

afterEach(() => {
  cleanup()
  useAccount.setState({ session: null, bindSheet: { open: false, reason: null } })
})

describe('设置页 → 顶栏账号胶囊', () => {
  it('★ 游客时它是按钮，点开就是「保存进度」面板（横条删掉之后唯一的常规入口）', async () => {
    const user = userEvent.setup()
    render(<SettingsPage onBack={() => {}} />)

    const chip = document.querySelector('[data-guest-save]')
    expect(chip, '游客的胶囊必须挂 data-guest-save').not.toBeNull()

    await user.click(chip as HTMLElement)
    expect(useAccount.getState().bindSheet).toEqual({ open: true, reason: 'manual' })
  })

  it('正式账号：胶囊还在，但不再是入口（不会莫名其妙弹绑定面板）', async () => {
    useAccount.setState({
      session: { ...guestSession, user: { ...guestSession.user, is_guest: false } },
    })
    render(<SettingsPage onBack={() => {}} />)

    expect(document.querySelector('[data-account-chip]')).not.toBeNull()
    expect(document.querySelector('[data-guest-save]')).toBeNull()
    expect(useAccount.getState().bindSheet.open).toBe(false)
  })
})
