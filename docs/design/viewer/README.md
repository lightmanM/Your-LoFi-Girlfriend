# Viewer (2026-11-06)

The page a visitor opens, `web/index.html` (the root URL). A fullscreen still camera on the warm afternoon balcony,
no buttons or text; it fades in once loaded. She reads most of the time (eyes along the lines, page turns, looking up,
shifting in her seat, legs drifting) and every 4 to 8 minutes puts the book down for a short break (since 2026-11-09:
shoulder rolls and head tilts; since 2026-11-10 an overhead stretch as well, every 5 to 15 minutes, see
[reading motion](../reading-motion/README.md)). Each visit
uses a new random seed, so no two sessions match. Clip: [viewer-v1.mp4](viewer-v1.mp4) (stretch triggered early).

The old character studio moved from `index.html` to `studio.html`; the room and Balcony development pages are unchanged.

## How it is built

- **Background:** the saved Afternoon v1 toon look rendered in Blender at 2560x1440 without her
  (`scripts/balcony-toon/render_web_plate.py`): `plate.webp` (0.56 MB) and the blurry near leaves as a transparent layer
  over her (`leaves.webp`, 52 KB), plus a depth-only chair so the chair can pass in front of her.
- **Her:** the live VRM with `web/src/balcony/reader.js`, the motion layer shared with the Balcony development page.
  Light and a colour grade on her and the book (`web/src/viewer/grade.js`) were matched to the Blender picture by colour
  samples on her face, legs, sleeves, hair and shorts (average difference about 18 on a 0 to 255 scale).
- **Screens:** wider than 16:9 crops top and bottom; narrower (phones) crops the sides around her.
- **Stretch clip:** only the played part shipped (`stretch-break.json`, 0.39 MB instead of 1.6 MB). Since 2026-11-09
  the break is procedural and the page no longer downloads it.

## Numbers (headless Chrome, M2 Max, 1280x720)

| | |
| --- | --- |
| Ready after navigation (local) | 0.47 s |
| Download | 6 MB, of which her model 5.3 MB (was 15.4 MB with the original 14.7 MB model) |
| Draw calls / triangles | 18 / 77,091 |
| Frame time | 16.7 ms median and p95 (60 Hz cap, no drops) |

Tests: `web/tests/viewer.spec.js` (no controls, reading advances, a stretch plays); skipped where the private files
are absent.

## Private files

`web/public/environment/balcony-toon/`, `marycia.vrm`, `reading-balcony.json` and `stretch-break.json` are
git-ignored: they come from the purchased character and the paid Balcony textures. A production build (`web/dist`)
copies them, so it must not be deployed anywhere public until the licences are cleared.

## Not done

- Nothing in the background moves yet (plants, curtains); the picture is still one image.
- No sound or music.
- Her model is still most of the download (5.3 MB, compressed textures; see `docs/design/compression/`).

## The chair and how she sits (2026-11-06)

Codex replaced the chair in the picture with the real 3D chair (`scripts/balcony-web/export_visible_chair.py`,
`chair-visible.glb`) so she has something to contact. It was lit by the web lights, which made it darker than the
picture, dropped its red frame, and drew streaks across the backrest. Now (`web/src/balcony/visible-chair.js`):

- **Colours from the picture.** Each point of the chair takes the picture's colour at that spot, seen from the fixed
  camera, so it looks exactly like the rendered toon chair; it is still real geometry in front of and behind her.
- **Her contact.** The chair darkens where it is close to her back, hips and thighs (capsules around those bones,
  radii fitted to her pose at load), plus a soft shadow from a light that adds no brightness, placed above her on the
  sun's side, so it lands just under and behind her. Two solid panels across the woven seat and back carry both
  across the weave's gaps. The low sun itself would have shadowed the whole chair, with streaks from her hair.
- **She sits on the seat** (`web/src/balcony/seat.js`). The reading pose had her bottom about 6 cm above this
  chair's seat, with only the thighs touching its front edge, so her shorts hung in the air. She is lowered by the
  measured gap (5.7 cm); both legs re-bend each frame so her feet stay exactly where they were (knees move 1 to 3 cm),
  and the shorts and skin are pressed flat wherever they would sink into the seat.

[chair-seating-before-after.png](chair-seating-before-after.png), [viewer-seated-closeup.mp4](viewer-seated-closeup.mp4)
(with a stretch break). `?seat=0` shows the old placement for comparison.

## Wind (2026-11-06)

The near leaves, the palm, the ivy across the street and the balcony plants (roses and pots) sway in one wind
(`web/src/viewer/wind.js`): a slow breeze plus a gust every 18 to 40 s; each group feels it a moment apart (ivy
first, then the balcony, the near leaves, the palm) through a spring, so it lags, overshoots and settles.

How, without real 3D plants: `render_web_plate.py` with `STEPS=['wind']` renders the same toon picture with those
plants removed (their background filled), a mask of which pixels belong to each group, and a flex map (0 at each
plant's anchor, 1 at its tips, from object-space height; the ivy hangs, so it is reversed). `wind_fields.py` turns
those into `plate-clean.webp` (alpha = plant coverage) and a half-size `wind-field.webp` (flex, and soft weights per
group that reach a little past each plant). The background is then one shader pass: each pixel looks up the picture
at a displaced spot (tips move most, bases stay), and where a plant has moved away the plant-free picture shows
through, so shadows and everything else stay exactly as rendered. The near leaves bend in their own layer, anchored
past the right edge.

Tip movement at 2560 px: palm up to 18 px in a gust, near leaves up to 44 px; extra download 1.2 MB; frame time
unchanged (16.7 ms at 60 Hz). `?wind=0` stops it. Clip: [wind-v1.mp4](wind-v1.mp4),
[wind-palm-calm-vs-gust.png](wind-palm-calm-vs-gust.png).

### Wind, second version: whole-plant bend

The first version moved small patches (it read as ripples). Following the two Blender tutorials the owner shared
(a Simple Deform bend on each plant driven by noise, plus a Displace modifier on the leaves), each plant now bends as a
whole around its base (the ivy around where it hangs from; the near leaves around a branch past the right edge), more
toward its tips, lagging and overshooting through a spring; and its leaves move in clumps as a slow two-octave noise
drifts through them in the wind's direction. Potted plants lean; roses bend around their base.

Only plant pixels move: each pixel shows the displaced plant where the displaced spot is plant, and the still,
plant-free picture everywhere else, so the door, curtains and wall behind a swinging frond stay straight. The wind
field reaches 110 px past each plant (was 28) for the larger swings. Palm bend up to about 4° in a gust, near leaves
up to about 6.5°; frame time unchanged. Clip: [wind-v2.mp4](wind-v2.mp4).

### Wind, third version: roses, balcony plants and ivy as live 3D

At the owner's request these are no longer parts of the picture. `scripts/balcony-toon/export_plants.py` exports light
copies of the Blender plants (collapse decimation: roses 20 %, ivy 11 %, balcony plants 7 % with at least 5,000
triangles per object; about 520,000 triangles in all, 7.6 MB, 5.9 MB gzip; the originals are about 4 million).
`web/src/viewer/plants.js` draws them: each point is coloured from the rendered toon picture at its rest position
(projected from the fixed camera), so at rest they match the render
([plants-3d-at-rest-vs-render.png](plants-3d-at-rest-vs-render.png)); how much of each point shows (behind the door
frame, through the sheer) comes from the render's per-plant coverage mask at that rest position. In the vertex shader
each plant bends around its anchor (pots and roses their base, ivy where it hangs) toward the wind, more toward the
tips, and its leaves move in clumps with a drifting 3D noise.

The palm stays a picture layer (approved as is), drawn a second time after the 3D plants so its fronds stay in front of
the roses; under the 3D plants the background shows the plant-free render. The near leaves stay a soft-focus layer,
now bending further (5.5° per unit of wind, larger clumps). Roses, pots and ivy sway slower and less regularly (two
drifting rhythms instead of one), like the palm.

Frame time still 16.7 ms at 60 Hz on the M2 Max; ready after 0.9 s locally. Clip: [wind-v3-3d-plants.mp4](wind-v3-3d-plants.mp4).
Not done: the plant meshes are not compressed (meshopt/quantised positions would roughly halve them); untested on a phone.

Door frames (2026-11-06): the left ivy and the flowers on the right console table drew over the glass doors' frames
when they swung, because how much of each point shows was read only at its rest position. `render_web_plate.py` with
`STEPS=['depth']` now renders the distance to the first surface with the swaying plants hidden (glass see-through),
widened slightly so the dithered sheer reads as solid (`depth.webp`, half size, log scale 1 to 64 m). A plant point
is hidden where it has moved behind something clearly nearer that did not already cover it at rest, so leaves pass
behind the frames, and plants seen through the sheer at rest stay as they were.
[plants-behind-door-frames.png](plants-behind-door-frames.png): the swing exaggerated 8 times both ways
(`?plantgain=8` / `-8`), frames stay clean.

## Closer framing (2026-11-06)

Chosen from the stills in `docs/design/framing/`: camera 30 % closer to her (1.94 m) and turned 3° left, the near
leaf branch moved with the camera and 2.5 cm to its right, the chair and her 15 cm left along the floor. All of it is in
`scripts/balcony-toon/framing.json`, which `render_web_plate.py` applies after building the toon scene (it also redraws
the facade's shade line through the same points on the facade, and writes the palm's new bend point, the leaves'
shift and the character offset into `scene.json` under `framing`). Re-rendered: picture, leaves, plant-free picture,
plant masks, flex, depth; then `wind_fields.py` (which now also widens the depth) and the WebP encodes. The viewer moves
the chair and her by the offset; the 3D plants stay where they are in the world and take their colours from the new
picture. At rest they match it (26 to 27 dB). The previous layers are kept privately in
`assets/characters/marycia/balcony-study/balcony-toon-web-v1-framing/`. Clip: [viewer-closer-framing.mp4](viewer-closer-framing.mp4).

## Fixes after the closer framing (2026-11-07)

Four problems the owner saw after the framing move, and what changed. Clip (normal wind, a stretch at 12 s):
[fixes-2026-11-07.mp4](fixes-2026-11-07.mp4).

| Problem | Cause | Fix |
| --- | --- | --- |
| Cut-off lines on the palm and plants when they moved, also behind the door frames | Colour came from the picture only, so any part hidden at rest (behind a frame, past the picture edge) was missing and the moving plant ended in a straight line; the plant-free picture was badly encoded (its alpha wrecked the colour) and the picture's ink outlines leaked past the plant masks as ghost lines | `render_web_plate.py` `STEPS=['full']` renders each group alone and whole (everything else hidden from the camera but still casting shadows, same compositor) and the palm 8 % wider than the frame; `wind_fields.py` packs them as `plants-full.webp` (ivy, roses, pots stacked) and `palm-full.webp`. Parts the picture shows at rest keep the picture's colour; hidden parts use the whole-plant colour. The plant-free picture is now encoded without alpha, and the plant-free area is widened by 3 px |
| Plants drawing over things | The old blurred 8-bit depth needed a wide margin | `STEPS=['cover']`: `cover.webp` holds the distance to the nearest opaque surface (16-bit, R + G/255, plants and sheer hidden) and how much the sheer curtain covers (B, everything behind it is past 5 m). A plant point is hidden wherever something opaque is nearer, with a 5 cm + 1.2 % margin; behind the sheer it fades by the curtain's coverage (about 90 %, which matches the picture). The palm is hidden only where something is nearer than its nearest point (2.9 m) |
| Book floating, arms snapping straight at the put-down and during the stretch | The book was exported at her old seat and did not move 15 cm with her, so her hands reached for a book that was not there | The viewer moves the book with the character offset |
| Book still floating above her left hand (owner, same day) | The book was exported in her hands at her unseated height; seating lowers her 2 to 12 cm onto the chair, and the book's grip was captured after that, so it stayed above her hands for good | The book drops with her by the seat drop before its grip is captured ([`main.js`](../../../web/src/viewer/main.js)) |
| Her hand crossing the book at the pick-up | After the stretch the clip leaves her right hand about 15 cm above the open pages; blending to the grip then slid it sideways across the book | While the book lies on her lap, a hand low over it is moved out past the side edge (`KEEP_OUT` in `reader.js`: 24 cm from the spine, fully below 10 cm above the pages, fading out by 45 cm). Joints passing low over the book during a stretch: 181 samples before, only fingertips within 4 cm of the edge as they take hold after. Test hook `lofiViewer.hands()` reports the hand joints in the book's frame. Clip: [book-hold-2026-11-07.mp4](book-hold-2026-11-07.mp4) |
| Arms locking straight just before the stretch and before the pick-up (owner) | The clip drops her hands low and nearly straight (right elbow about 156°) before raising them, and the keep-out push asked for more than her arm's reach, which locked the right elbow at 178° | With her hands below shoulder height during a stretch, no hand target asks for more than 94 % of the arm's length (`SOFT_ARMS` in `reader.js`), fading out as the hands rise past the shoulder. Elbows with hands low now peak at 140° on both sides; the overhead stretch is unchanged (about 168°). The fastest joint turn in the whole stretch is 98°/s |
| Ivy right of the right ivy, behind the top of the door frame, not moving | `moxing1019` was in neither the wind groups nor the plant export | Added to both; ivy export budget 75,000 triangles; `plants.glb` 8.0 MB |
| Near leaves too close, barely in frame | | Moved 0.5 m farther from the camera and 6 cm further right (`framing.json`: `leaves_back_m` 0.5, `leaves_offset_right_m` 0.085). Farther back they shrink by about a third and come into the frame (they sit right of centre, so moving away pulls them inward) |

New downloads: `cover.webp` 0.84 MB, `plants-full.webp` 0.33 MB, `palm-full.webp` 0.14 MB; `depth.webp` is no
longer used. All of it is rendered from the licensed Balcony scene and stays local and git-ignored.

Blender state saved (2026-11-07): `assets/characters/marycia/balcony-study/balcony-toon-web-v2-2026-11-07.blend`
(private, git-ignored, 978 MB, compressed copy of the live session; the open Codex file was not changed). Scene
`Balcony • Toon test (Claude)` is in the state these layers were rendered from (new framing, near leaves moved, ivy
`moxing1019` in the wind group). 69 of 81 images are packed, the rest use absolute paths, and it links
`marycia-working.blend` (Codex workspace) and the Balcony source by absolute path, so those must stay where they are.
