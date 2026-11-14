# -*- coding: utf-8 -*-
"""把 public/games/<id>/ 打成 zip，供上传到平台后端。

为什么打 zip 而不是只传 `.plugin.mjs`：
  这批游戏的 `assets/` + `sound.pack` 和模块在同一个目录里，客户端远程装完之后
  是按目录里的 `assetBase` 去取资源的。只传模块 ⇒ 装上了但场景全白（404 纹理），
  看起来像「下载坏了」，其实只是少了资源。

zip 里**直接放目录内容**（`<id>.plugin.mjs` / `assets/` / `sound.pack` 在根上）：
服务端的 `commonTopDir` 会剥掉唯一的顶层目录，我们这里不让它多一层。

产物放 C:/tmp（E 盘只剩 1.5G，zip 别落在 E 上）。
"""
import json
import zipfile
from pathlib import Path

ROOT = Path('public/games')
OUT = Path('C:/tmp/kqf-uploads')
OUT.mkdir(parents=True, exist_ok=True)

index = json.loads((ROOT / 'index.json').read_text(encoding='utf-8'))
rows = []
for item in index['games']:
    gid = item['id']
    ver = item['version']
    d = ROOT / gid
    assert d.is_dir(), f'目录不存在：{d}'
    mjs = d / f'{gid}.plugin.mjs'
    assert mjs.is_file(), f'包不存在：{mjs}'

    # 清单里的版本和模块里写的版本必须一致 —— 不一致的话，目录说是 v1.0.1、
    # 装完 manifest 说是 v1.0.0，界面上会一直劝人「更新」而永远更新不完。
    # 版本号在压缩后的模块里不一定落在开头（manifest 可能在中间），所以整份扫
    body = mjs.read_text(encoding='utf-8', errors='replace')
    assert f'"{ver}"' in body or f"'{ver}'" in body, f'{gid}: 模块里找不到版本 {ver}'

    out = OUT / f'{gid}-{ver}.zip'
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for f in sorted(d.rglob('*')):
            if f.is_file():
                z.write(f, f.relative_to(d).as_posix())
    rows.append({'id': gid, 'version': ver, 'zip': str(out), 'bytes': out.stat().st_size})

(OUT / 'manifest.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
total = sum(r['bytes'] for r in rows)
print(f'{len(rows)} 个包，合计 {total / 1048576:.1f} MB → {OUT}')
for r in rows:
    print(f"  {r['id']:<12} v{r['version']:<8} {r['bytes'] / 1048576:6.1f} MB")
