# Balcony for the web: rendered plate + live character (2026-11-06)

The trimmed-geometry exports drifted from the reading layout (old camera, tray still on the chair, replacement
curtains, decimated roses) and looked worse than Cycles. Because the camera never moves, only rotates within the
FixedCamera look limits (±2.5° yaw, ±1.5° pitch), a single image already shows exactly what the 3D room would. So the
web scene is now four layers:

1. **Plate**: the original full-quality scene rendered in Cycles from the original camera, wider by the look limits plus
   0.5°, with depth of field and the source glare. Her body is invisible to the camera but her shadow and bounce light are
   baked in. The foreground leaves are left out of this layer.
2. **Chair depth**: the fitted chair, decimated, drawn depth-only so the seat and rails can sit in front of her.
3. **Marycia**: the real VRM with MToon, posed from the approved reading pose, breathing and blinking, eyes on the page; the book.
4. **Foreground**: the out-of-focus leaves as a transparent layer drawn over her.

Pure rotation keeps a flat plate exact, so the room behind her needs no geometry at all. Room space outside the
view, minor props and polygon budgets no longer affect the web cost.

[cycles-vs-browser.png](cycles-vs-browser.png): Cycles reference (left) and the browser (right). [browser-main.png](browser-main.png),
[browser-character.png](browser-character.png), [browser-look-offset.png](browser-look-offset.png) (maximum look offset, no plate edge).

## Scene fixes (in the plate)

| Issue | Fix |
| --- | --- |
| Camera moved for the reading study | Back to the original camera (67 mm, focus 8.4 m, f/5.9), so the window shows through the door and the right leaves blur |
| Left curtain near-black, door floating in black | Original brown linen curtains and door restored (the stand-in curtains are gone) |
| Right sheer linen replaced by a striped panel | Original sheer restored |
| Roses stripped by decimation | Original full geometry, roses back |
| Tray, flowers and candle on her chair | Removed |
| Chair too tall for her | Same fitted chair as the reading pose |
| Compositor of copied scenes read another scene | Own compositor group with the source glare, reading this scene |

The blanket stays: on the web it now costs nothing, and it adds lived-in texture to the daybed. Removing it is one
line (`hide moxing1057`) and a re-render; [blanket-compare.png](blanket-compare.png) shows both.

## Numbers

Chrome, WebGL2, ANGLE Metal, Apple M2 Max, 1600×900, DPR 1, headless, 300 frames (`node web/bench-balcony.mjs`).

| | Codex geometry bake | Codex projected geometry | Plate + live character |
| --- | --- | --- | --- |
| Environment triangles | 280,989 | 280,989 | 11,182 depth-only + 2 cards |
| Environment download | 8.1 MB | 3.6 MB | 0.99 MB |
| Environment GPU textures (RGBA8 + mips) | 32 MiB | 21 MiB | 24 MiB (plate 2560×1470, leaves 1280×735) |
| Matches the Cycles look | no | close, no depth of field | yes, depth of field and glare included |
| Matches the reading layout | no | no | yes |
| Tested with her | no | no | yes: 18 draw calls, 77k triangles in total |
| Frame time | 8.3 ms at 120 Hz, scene only | 8.7 ms, scene only | 16.7 ms median and p95: locked to 60 Hz, no dropped frames |

The character file (14.7 MB, three 2K textures) is now 94 % of the download and most of the GPU memory.
Headless Chrome caps at 60 Hz, so the frame time shows no drops, not maximum throughput.

## Files

- Page: `web/balcony.html`, `web/src/balcony/main.js` (open `/balcony.html`, add `?stats` for counters).
- Assets (git-ignored, rendered from purchased archviz textures): `web/public/environment/balcony-plate/`
  (`plate-reading.webp`, `foreground.webp`, `chair-occluder.glb`, `book.glb`, `balcony.json`), pose
  `web/public/models/marycia/reading-balcony.json`.
- Blender, live session (scenes `Balcony • Plate (Claude)`, `Balcony • Reading v2 (Claude)`; not saved into the file):
  rebuild with `scripts/balcony-pose/setup_v2.py`, `pose_v2.py`, then `scripts/balcony-web/build_plate.py`, the render
  passes, and `export_web.py`. The pose checkpoint is `assets/characters/marycia/balcony-study/marycia-reading-v2.blend`.

## Limits

- One plate per activity: her shadow is baked for the reading pose. The daybed or standing states need their own plate (about 2 minutes each).
- Lighting and time of day are fixed per plate; dusk or rain would be further plates.
- A toon character on a photoreal plate is still two styles. The book reads darker than in Cycles under the live lights.
- Portrait phones crop her out of the 16:9 framing; mobile needs its own framing.
- The plate is derived from CGAxis, Quixel and Evermotion textures. Keep it out of Git and any public build until the licence is cleared.

## Motion reach from the original camera

Measured by ray casting a standing figure (five body points, feet to head) over a 0.2 m floor grid from the display
camera; [motion-reach.png](motion-reach.png) draws the result on the reference frame.

| Spot | What the camera sees |
| --- | --- |
| Beside her chair, in the room | Knees up; she fills most of the frame height |
| Doorway to railing | Whole body in a lane about 1 m wide, framed by the door |
| At the railing | Whole body, a bit over half her size in the chair (11 m vs 6.4 m) |
| Railing left or right of the lane | Hidden by the wall and left door, or behind the right sheer |
| Lying on the daybed | Hidden: the left door leaf and the palm cover all but the outer edge |

The daybed limit comes from the camera and layout, so full 3D from this camera has it too. Walking on the plate
needs: a plate rendered without her (her shadow is baked in today), a live shadow on invisible floor and furniture
shapes, the near door, curtains and palm as separate transparent layers like the leaves, a depth image for the
balcony, and her lighting blended between the room and the sun. No walk clip exists yet.
