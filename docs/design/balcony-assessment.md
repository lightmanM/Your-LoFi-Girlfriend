# Balcony scene assessment (2026-11-06)

Candidate: `assets/environment/Balcony/写实花园室内.blend` ("realistic garden interior", Chinese archviz file,
1.3 GB, textures folder 1.7 GB). Compared against the saved base option
(`assets/environment/base-option/room-base-option.blend` on the `codex/room-refresh` worktree: rainy-evening room,
sofa-lounge pose, approved sleeping pose in `assets/poses/`).

## Numbers (measured headlessly and in the live Blender file)

| | Balcony as delivered | Base option room | Comfortable web budget |
| --- | --- | --- | --- |
| Meshes | 790 (+34 empties, 7 lights) | 895 | a few hundred, batched |
| Triangles | 12.8 M (12.5 M inside the portrait frustum) | 111 k | 150–300 k |
| Materials | 59 (135 in the review file) | 39 | < 40, ideally shared |
| Textures | 32 images, 288 megapixels, two at 8K, five at 4K | 3 images, 3 MP | ≤ 60 MP, 1K–2K, KTX2 |
| GPU texture memory | ≈ 1.5 GB at full size, ≈ 100 MB capped at 1K | ≈ 16 MB | 30–100 MB |
| Renderer it was built for | Cycles, 360 samples, portrait 1828×2856, 67 mm | Cycles, then GLB export | three.js, real time |
| Scene extent | 41 × 22 × 20 m (courtyard facade included) | one room | one room + backdrop |

Where the triangles are: six curtain meshes at 643 k each (3.9 M), the opposite facade with its ivy (parent `洋房`,
686 objects, 4.5 M), rattan baskets and woven chair (≈ 2.3 M), one potted plant at 1.07 M, roses and small florals
(≈ 1.5 M). By distance from the camera: 0.36 M within 6 m, 7.8 M at 6–12 m (the balcony), 4.6 M beyond 12 m.
Capping every mesh at 10 k triangles still leaves 1.28 M; at 5 k, 0.81 M. The detail is baked into dense meshes
(one subsurface modifier in the whole file, no particle systems), so there is no slider to turn down.

## Editability

Fully editable: a native .blend, every piece a separate object, no linked libraries, all textures packed.
Removing the tray, chair or the courtyard, or moving the daybed, is trivial. The catch is organisation: objects
are named `moxingNNNN` ("model NNNN") in two flat collections, so any real work starts with sorting it.

## Provenance

Texture names identify paid libraries: CGAxis PBR (`cgaxis_pbr_13/14`), Quixel Megascans IDs (`ukpkabgbw`,
`rbesqap`, `ucmicfjl`, `tigidael`, `sltjbg2p`), Evermotion Archmodels 101, plus Chinese stock textures and a
Windows temp path (`C:\Users\EDY\...\工程贴图`) as the original source. A web build serves meshes and textures as
downloadable files, which these licences treat as redistribution. Same class of problem as the Marycia model.

## Theme fit

Strengths: warm daylight, a real sense of outdoors through a french door, sheer curtains with light through
them, plants and roses, rattan: a convincing "reading nook" and a much richer picture than either built room.

Gaps against the brief: daytime garden mood rather than the accepted rainy-evening study (room-concept-04);
no desk and no bed, so the main study state and the nap state have nowhere to happen; the composition is a
portrait architectural shot (the french door and transom are the picture) that loses most of its appeal at 16:9;
photoreal surfaces next to a cel-shaded VRM character read as two different worlds, which is the mismatch the
toon route was chosen to avoid; and the richness in the preview is Cycles global illumination, which three.js
will not reproduce without baking.

## Options

1. **Keep the base option as the production room; borrow from Balcony.** Add a daytime variant of the window
   view (courtyard facade with ivy as a baked backdrop card), a sheer curtain, a rattan chair and a plant.
   Cheapest; keeps the brief and the single look.
2. **Pre-rendered plate.** Render the Balcony (or a dressed version with a desk) in Cycles to a still, optionally
   split into two or three depth layers, and put the 3D character in front on proxy geometry for contact. Runtime
   cost near zero, full Cycles quality, several times of day as separate plates. Costs: camera fixed (which it
   already is), parallax limited to layer offsets, her lighting matched by hand, and the look mismatch unless the
   plate is rendered stylised. The licence question remains for the plate's textures, though a flattened render
   is a weaker redistribution case than shipping the textures.
3. **Real-time rebuild from the Balcony.** Replace every hero mesh with a retopologised or decimated version
   with baked normals, bake lighting, 1K/2K KTX2 textures, facade as a card. Lands at roughly 200–300 k
   triangles and 40–60 MB of textures. Several days of asset work and still needs a desk and bed added; it would
   be a second scene, not a replacement.

Recommendation: 1 now, 2 as the experiment if the daylight garden mood is wanted, 3 only if the garden becomes
the primary scene and the licence question is cleared.
