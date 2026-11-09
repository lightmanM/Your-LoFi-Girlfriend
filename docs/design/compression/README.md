# Character compression test (2026-11-06)

Test copies of Marycia's model with the three 2048×2048 PNG textures replaced; mesh, skin, expressions and the VRM
and toon-material data are copied byte for byte (`scripts/marycia/repack_vrm.py`, textures declared through
`EXT_texture_webp`). The original `marycia.vrm` is unchanged (checksum verified); the copies sit next to it as
`test-*.vrm`, git-ignored like the original.

| Copy | File | Gzip (what a web host sends) | Texture quality score |
| --- | --- | --- | --- |
| Original (PNG) | 14.70 MB | 12.11 MB | — |
| Lossless WebP | 9.31 MB | 6.68 MB | identical colours |
| WebP quality 95, full size | 5.29 MB | 2.70 MB | 47 to 48 dB (above 40 is generally invisible) |
| WebP quality 95, half size (1024) | 4.72 MB | 2.14 MB | — |

Quality 92 was tried first: the skin and face texture scored 37 dB, so 95 is used.

## In the viewer

`/?character=test-webp95.vrm&seed=11&still=6` renders a frozen moment (fixed seed, fixed time step) so runs are
pixel-identical; two runs of the original matched exactly. Compared on her body at 2560×1440, reading and at the top
of the stretch:

| Copy | Body PSNR vs original | Pixels off by more than 6 of 255 |
| --- | --- | --- |
| Lossless WebP | 85 to 90 dB | 0 % |
| WebP 95, full size | 56 dB | 0 % |
| WebP 95, half size | 54 dB | 0.06 to 0.08 % (edges of the embroidery) |

[closeups.png](closeups.png): face, embroidery and the face during the stretch at 3× zoom, with the difference boosted
16×. Full-size WebP cannot be told apart; half size softens the embroidery slightly. Load time unchanged
(0.4 to 0.6 s locally).

Recommendation: WebP 95 at full size. The remaining 4.4 MB is mesh, skin weights and expression shapes; a web host's
gzip already roughly halves it. Mesh compression would need a tool that keeps the VRM extensions.

**Adopted (2026-11-06):** the viewer loads `marycia-web.vrm` (the WebP 95 full-size copy) through
`web/public/environment/balcony-toon/scene.json`. The original `marycia.vrm` stays for the development pages and as the
source for any future re-encode: `python3 scripts/marycia/repack_vrm.py marycia.vrm marycia-web.vrm t0.webp t1.webp t2.webp`
with textures encoded by `cwebp -q 95 -m 6 -alpha_q 100 -exact`.
