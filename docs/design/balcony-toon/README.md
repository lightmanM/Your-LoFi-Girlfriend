# Balcony toon look test (2026-11-06)

Question: does the Balcony shot work as one toon style, so Marycia stops looking pasted onto a photo, and so the scene
can become real-time 3D with animated plants, curtains and bedding? This is a still from Blender EEVEE, same camera and
reading pose as the plate, made to judge the style before any web work.

[toon-vs-now.png](toon-vs-now.png): the current browser page (photo plate, MToon girl) above the toon test.
[toon-vs-now-closeup.png](toon-vs-now-closeup.png): her, same crop. [toon-test.png](toon-test.png): the test alone.

## How it is made

`spike/balcony-toon/render_toon.py` rebuilds and renders everything in the live Blender (scene `Balcony • Toon test
(Claude)`, copied from the plate scene; mesh data shared, every original material untouched):

- **Cel shading** (`build_toon.py`): every material becomes an object-level copy whose own colour chain feeds one shared
  group. Light level is read in stops and cut into three bands (shadow colour, shade, full), the light colour is kept at
  35 %, and a short-range occlusion darkens contacts. Her skin gets a warm rose shadow colour; everything else a slightly
  violet one.
- **Light**: the archviz lamps are off. One warm sun from behind the opposite building at 45°, a cool-neutral sky fill,
  and a baked indoor light probe so less sky reaches the room. This is the kind of rig the browser can run.
- **Image pass** (`compositor.py`): ink lines from depth and surface-angle edges; none on curtains, the palm, the near
  leaves, ivy and potted plants (object mask); a solid line around her; a light anisotropic Kuwahara filter for a painted
  feel; small saturation, contrast and bloom lifts.

## What carries to the browser

| Here | In three.js |
| --- | --- |
| Cel bands, light tint, shadow colour | One toon material for the scene, close to MToon on her |
| Sun + sky fill + indoor probe | Directional light with shadows, hemisphere light, baked occlusion in vertex colour or a light map |
| Ink from depth and normal edges, per-object mask | Screen-space outline pass with a per-mesh include list |
| Kuwahara painted feel | Too costly per frame on weak GPUs; repaint the textures instead (flat colour with light brush detail) |
| Depth of field on the near leaves | Leaves as a blurred card, as today, or a cheap blur pass |

## Limits of this test

- The photo textures are still underneath, only filtered. A real build repaints them flat, which reads cleaner.
- Plants are the archviz meshes. The web version needs light leaf-card plants built for the toon look.
- The room and the outdoor shade sit in one band, so the room frames the balcony less than the photo did.
- Her white sleeves read slightly lavender in shade; the shadow colour is one setting.
- It uses the Balcony models, on this Mac only. A public build needs our own or CC0 replacements.

## Dusk variant (lofi pass)

The day test read as a game, not lofi. Against the study concept (`visual-targets/room-concept-04/01-study`) the gap was
light and colour: lofi is a warm lit room against a cool dusk outside, soft gradients, thin warm lines, glowing lights.
`render_toon.py` with `VARIANT='dusk'` applies `spike/balcony-toon/dusk.py` on top of the toon build:

- Blue-hour sky fill, the sun off; outdoor shade tinted blue, her skin shadow warm rose.
- A warm floor lamp beside her (Kenney CC0 `lampRoundFloor`, glowing shade, warm point light).
- String lights along the railing (18 glowing bulbs on a thin wire, three soft warm lights).
- The curtains in the window across the street glow warm.
- Soft shading: an eased ramp from shadow colour to full light instead of hard bands; light colour kept at 70 %.
- Image pass: no Kuwahara; thin warm-brown lines on the room at 40 %, her silhouette at 85 %; warm grade, bloom on the
  lights, a soft vignette.

[dusk-test.png](dusk-test.png), [dusk-vs-concept.png](dusk-vs-concept.png) (mood check against the concept),
[three-looks.png](three-looks.png) (photo plate, day toon, dusk toon).

Still open: photo textures under the toon shading (repaint later), heavy archviz plants, the left side of the room
stays cool because the lamp is on the right, and no rain or motion yet.

The first dusk version is kept as it was in [dusk-v1/](dusk-v1/) (render, concept comparison, script snapshots) for a
later time-of-day theme. Its floor lamp is not meant to stay.

## Warm afternoon variant (day, no lamp)

`VARIANT='afternoon'` applies `spike/balcony-toon/afternoon.py`: the warmth comes from the light itself, not a prop.

- A golden sun 38° up from the balcony side, through the door onto her from above and to the side.
- A bright sky fill (blue above, neutral below), so the balcony and the street are the bright part of the frame and the
  indoor probe keeps the room dimmer.
- A light haze in the room, so the sunlit air glows gold.
- Soft shading, warm amber-brown room shadows, warm rose skin shadows, thin warm lines, gentle bloom and vignette.
- No floor bounce light: the first try had one and it lit her from below ([afternoon-fix.png](afternoon-fix.png)).

[afternoon-test.png](afternoon-test.png), [day-before-after.png](day-before-after.png) (first day try above, warm
afternoon below). The haze reads as a gold glow, not distinct sunbeams yet.

Clean-up pass ([afternoon-clean.png](afternoon-clean.png)):

- Both curtains (`Material.002` right, `Material.005` on the left curtain object `moxing1031`) are flat cream fabric with a
  soft neutral shade and no outlines; their photo linen and cut-out transparency were the mess. Opaque, because the
  see-through version showed the building and its lines behind.
- Pure leaf textures (palm, near leaves, ivy, potted plants) keep their light and dark detail but are recoloured between a
  dark and a light green, with cool green shadows. The rose bush keeps its texture, since flowers share it.
- The window across the street has warm light on in the day too.

Second clean-up ([afternoon-curtains.png](afternoon-curtains.png)):

- Curtains stay untextured but warm again: the left one heavier warm brown (92 % opaque), the right one a warm sheer
  (62 %). Dithered rather than blended, so the object mask still keeps the building's lines behind the sheer out of the
  ink pass. Both are still the original 3D meshes, so they can be animated (they are very dense: the sheer alone is over
  half a million polygons, so the web needs lighter versions).
- Plant greens are warmer and softer, with a warm olive shadow from the same family as the room shade.
- The window across the street: an emissive panel just behind its glass gives the glow in the middle; its side curtains
  are ordinary fabric again.
- Render samples 64 to smooth the dithered sheer.

Curtain rework reverted: both flat versions looked worse. `CLEAN_CURTAINS = False` in `afternoon.py` keeps the original
warm see-through curtains (with their linen texture); the plant greens and the window glow panel stay.
The palm on the left uses darker greens than the other plants, since it stands on the shaded side of the room.

## Outdoor light options (switchable)

`render_toon.py` takes `OUTSIDE={...}` with any of four features from `spike/balcony-toon/outside.py`;
[outside/outside-compare.png](outside/outside-compare.png) shows each alone and all four (doorway crop), full frames in [outside/](outside/).

| Feature | How | Browser equivalent |
| --- | --- | --- |
| `facade`: late sun on the opposite building | a warm sun light-linked to that building only, plus a slanted cool shade painted below a line in the image pass (depth-limited to the building) | light layers per mesh; same post pass, or baked into the facade colour |
| `dapple`: sun through leaves on the balcony | a noise pattern projected along the sun direction inside the toon shader, masked to the balcony footprint | the same few shader lines |
| `distance`: depth haze | far pixels (14 to 34 m) blend 22 % toward a pale cool colour | depth-based fog |
| `rim`: warm plant edges | facing-angle rim term in the toon group on the outdoor plant materials | rim term in the toon shader |

EEVEE ignored camera-hidden shadow cards (tried for the facade edge and a leaf gobo), so both effects moved into shading
and the image pass. The rim is subtle at this distance; the haze softens the ivy a lot.

**Saved version: [afternoon-v1/](afternoon-v1/)** with facade sun, dappled sun and plant rim on, distance haze off
(now the afternoon default). It includes the render, script snapshots, and the path of a private Blender copy
(`assets/characters/marycia/balcony-study/balcony-toon-afternoon-v1.blend`, about 1 GB, git-ignored).
