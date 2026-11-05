# Head prototype implementation plan

**Goal:** Create an editable first head-and-hair study and three genuine Blender renders against `references/character-v1/target.jpg`.

**Architecture:** Build in a new scene, preserving the existing startup scene. Keep face, eyes, hair locks, crescent clip, neck and simple presentation bust separate. Keep the construction script beside the source asset so proportions can be revised.

**Tech stack:** Blender 5.2, official MCP, Python geometry construction, Eevee materials, PNG previews.

- [x] Verify native MCP communication with a read-only scene query.
- [x] Write `scripts/blender/build_head_prototype.py`, with unique scene names and no deletion of existing content.
- [x] Build a continuous facial surface, shaped almond eyes, separate hair cap and locks, and crescent accessory.
- [x] Save `assets/character/head-study-v004.blend` and render front, profile and three-quarter views to `renders/head-study-v004/`.
- [x] Inspect actual renders for silhouette, eyes, clipping, hair coverage, framing and reference differences. Correct major visual defects before delivery.
- [x] Verify saved file, render dimensions, named components and missing external assets. Record remaining limitations in `docs/head-study-v004.md`.

This is a visual-development asset, not a completed facial rig or production export. Shader portability and deformation topology remain later milestones. Verification is numeric asset inspection and visual review; implementation-mirroring unit tests do not establish likeness.
