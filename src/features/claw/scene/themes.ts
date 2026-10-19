/**
 * 三档配色 —— 逐字抄参考实现（`claw-machine/src/themes.ts`）。
 *
 * 一台 Gen-2 商场的娃娃机是「白色机身 + 一个亮色」。那个亮色要同时染到
 * 柜身、灯带、灯箱、背板、取物口灯环、控制台 —— 少一处就会露馅
 * （「柜身变青了，灯箱还是粉的」）。
 *
 * `accentSoft` 是同一个色的**浅版**，用在灯箱渐变和背板上；
 * `dark` 是**深版**，给按钮的阴影 / 文字用。
 */
export interface ClawTheme {
  id: 'pink' | 'yellow' | 'cyan'
  name: string
  accent: number
  accentHex: string
  accentSoft: number
  led: number
  ledHex: string
  dark: number
}

export const CLAW_THEMES: ClawTheme[] = [
  { id: 'pink', name: '粉', accent: 0xf47aa8, accentHex: '#f47aa8', accentSoft: 0xffd6e6, led: 0xff8eb8, ledHex: '#ff8eb8', dark: 0xc44a78 },
  { id: 'yellow', name: '黄', accent: 0xf5c52a, accentHex: '#f5c52a', accentSoft: 0xfff0a8, led: 0xffd84a, ledHex: '#ffd84a', dark: 0xc48a10 },
  { id: 'cyan', name: '青', accent: 0x3ec8d8, accentHex: '#3ec8d8', accentSoft: 0xb8f0f6, led: 0x5ee0ee, ledHex: '#5ee0ee', dark: 0x1a8a98 },
]

/** 灯箱上的字。改品牌只改这里（贴图是从这几个字符串画出来的）。 */
export const BRAND = { cn: '爪爪乐', en: 'PAW PLAY', tag: 'HAPPY GAMES' }

/** `0xf47aa8` → `'#f47aa8'`。画 canvas 时 `fillStyle` 只吃字符串。 */
export function hexOf(n: number): string {
  return '#' + (n >>> 0).toString(16).padStart(6, '0')
}
