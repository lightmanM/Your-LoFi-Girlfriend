# Marycia working integration

The room now opens with the purchased Marycia character. This is a functioning character integration with initial materials and secondary motion; it is not the final lofi character redesign.

- Room: http://127.0.0.1:5173/room.html
- Facial/rig studio: http://127.0.0.1:5173/?character=marycia
- Vivi comparison: http://127.0.0.1:5173/room.html?character=vivi
- [Recorded demonstration](demo.mp4)
- [Greeting](recording/room-greeting.png), [returned to idle](recording/room-returned.png), [mobile](mobile.png)

This page records the initial model integration; the videos below are historical. **Current playback:** use the supplied-action selector and **Play action**. See [source-motion conversion and fresh demo](../marycia-source-motions/README.md). **Demonstrate transition** plays two queued source actions. The camera remains fixed with the existing small pointing range. Behind the scene retains **Restore Vivi**, **Load Marycia**, local VRM replacement, lighting comparison, pause and playback speed.

## Conversion

Source: the owner's purchased Marycia 1.5.1 package, ©BeroarN. The user confirmed project licensing resolved before authorizing integration. Original purchase files remain unchanged. Generated asset binaries are ignored by git; they are available in this local workspace and included in the local Vite build.

The pipeline applies the supplied clothing-fit preset and human-ear configuration; removes cat ear/tail meshes; bakes a T-pose across geometry, normals and retained morphs; resizes three color textures to 2K; exports GLB; and adds VRM1 humanoid, expression, MToon and hair-spring metadata.

| Working asset | Measured result |
| --- | --- |
| Download | 14,702,500 bytes (14.02 MiB) |
| Triangles | 65,113 |
| Mesh objects / material slots | 5 / 7 |
| Humanoid mapping | 53 bones, including eyes and all finger joints |
| Retained facial morphs | 160 |
| Semantic expression presets | 13 |
| Color textures | 3 × 2048² |
| Hair | 36 spring chains, 42 simulated joints |

The working file now keeps all 160 deforming facial keys except the baked eye-shadow appearance control, including ARKit, MMD and visemes. The source package still contains the complete customization set. The underlying rig retains its helper bones.

Local editable artifacts: `assets/characters/marycia/marycia-imported.blend`, `marycia-working.blend`, `marycia-working.glb`, `marycia-working.export.json`, and `marycia-working.reimport.json`. Runtime file: `web/public/models/marycia/marycia.vrm`.

## Motion reuse

The room now uses Marycia’s supplied sitting and relaxed-hand poses plus the roughly twelve-second facial idle. Smile, wink, relax, peace fingers, thumbs-up fingers and finger heart are selectable. Old Quaternius playback, procedural smiling/blinking and camera eye tracking have been removed from the room.

Twelve supplied clips were converted using the portable Unidot humanoid muscle decoder and direct facial curve sampling. Full AFK, standing and two-hand heart are retained for inspection but excluded from the sofa action menu. Unity runtime parity has not been established. See [method, evidence and limits](../marycia-source-motions/README.md).

## Initial-integration verification (historical)

Current asset/playback validation is recorded in the [source-motion report](../marycia-source-motions/README.md). The following results and recording describe the previous motion setup.

Final checks: **15 unit tests and all 16 browser tests passed**, including Marycia as the independent replacement model. The production build passed. An independent review found a download-selection race; it was fixed and covered by a delayed-download regression test.

- All five original FBXs imported during the preceding asset review.
- Working GLB reimport: 65,113 triangles, five actual model meshes, 177 imported rig bones, 70 facial morphs and three images. Blender's auxiliary bone-display mesh was excluded from model counts. Arm-chain height deviation in the T-pose was approximately 1.13 mm.
- glTF Validator: **0 errors, 10 warnings**, plus three notices that VRM extensions are unsupported by that validator. The warnings concern MToon with its unlit fallback and non-root skinned-mesh nodes. Actual Three.js/three-vrm loading and motion were tested separately; this is not full VRM schema certification.
- Browser checks cover real face controls, bone mapping, animated finger deformation, continuous greeting/idle blending, no network requests during interaction, queued input, pause/resume, failed-file recovery, model swapping, mobile layout, reduced-motion startup and a fixed camera.
- The recorded demonstration completed three greetings and ended idle with no page errors. [Recording evidence](recording/demo-evidence.json).
- A 353-frame transition run measured maximum right-hand step of approximately **9.5 mm** and index-finger angular excursion of approximately **0.446 radians**. Later runs vary with frame scheduling; see [latest samples](transition-metrics.json). This measures sampled continuity, not professional animation quality or physical-device performance.
- Production build succeeds. The existing approximately 722 kB shared JavaScript chunk warning remains.

## Remaining polish

MToon is an approximation of the original lilToon materials: complex masks, normal maps, matcaps, outlines and Unity lighting are not reproduced exactly. Hair springs are conservative, without full head/body collision matching or Unity constraints. The current selectable finger poses do not supply arm placement; crossed hands can overlap and are not finished gestural animations. Clothing contact, exact seating, character scale relative to furniture, lighting and original-reference appearance still need deliberate art direction. No physical-phone frame-rate or GPU-memory benchmark was performed.

## Reproduce

Requires Blender 5.2 and the privately extracted purchased package from the earlier scan. Replace the source/output arguments with your own paths when using another checkout.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec \
  --python scripts/marycia/export_blender.py -- \
  --source ~/Library/Caches/lofi-asset-review/marycia-c8b312ba/extracted/Assets/BeroarN/bn0010_Marycia \
  --output assets/characters/marycia
python3 scripts/marycia/package_vrm.py \
  assets/characters/marycia/marycia-working.glb \
  assets/characters/marycia/marycia-working.export.json \
  web/public/models/marycia/marycia.vrm
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec \
  --python scripts/marycia/check_reimport.py -- assets/characters/marycia
```

The exporter limits skinning to the four strongest weights per vertex and renormalizes them for Three.js. It also reports unused vertex-color and shared-texture sampler warnings; those maps are not used in the working material graph. The original source retains all original weights/material information for future refinement.
