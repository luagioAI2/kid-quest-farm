/**
 * 「一串字节」的类型别名。
 *
 * ── 为什么要单独写一个文件 ────────────────────────────────────────
 *
 * TS 5.7 起 `Uint8Array` 对**缓冲区类型**泛型化了：裸写 `Uint8Array` 等于
 * `Uint8Array<ArrayBufferLike>`，而 `crypto.subtle.*` 要的参数是 `BufferSource`
 * （= `ArrayBufferView<ArrayBuffer>`）。两者不兼容，于是每一处 `subtle.digest`
 * / `subtle.verify` / `subtle.importKey` 都会报：
 *
 *     Type 'ArrayBufferLike' is not assignable to type 'ArrayBuffer'.
 *     Type 'SharedArrayBuffer' is not assignable to type 'ArrayBuffer'.
 *
 * 我们这里**永远只处理普通 `ArrayBuffer`**（`fetch().arrayBuffer()` / `atob` /
 * `TextEncoder.encode()` 给的），所以把类型钉死成 `ArrayBuffer` 既准确，
 * 又免掉满地的 `as BufferSource`（那种 cast 会把真正的类型错也一起吞掉）。
 *
 * 放在独立的文件里而不是塞进 `catalogKey.ts` 或 `verify.ts`：那两个模块互相
 * 有依赖（`verify` → `catalogKey`），别名放谁家都会让另一个反向 import。
 */
export type Bytes = Uint8Array<ArrayBuffer>
