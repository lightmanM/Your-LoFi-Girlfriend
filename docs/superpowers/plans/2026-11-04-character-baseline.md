# Replaceable character baseline

Goal: start browser development with a free humanoid character suitable for eventual replacement by a licensed BOOTH avatar.

Scope: existing user-approved approach—free rigged placeholder, Three.js, semantic character adapter, assets first. Implement in the existing worktree without changing Blender studies or the video spike. No purchase or deployment.

Selected asset: Vivi / beta AvatarSample_2, official VRoid CC0 sample. Keep provenance, original file hash and license reference. The newer AvatarSample_A/B/C terms are different and are not the selected asset's license.

- [x] Import the pinned sample and audit GLB/VRM metadata, humanoid bones, expression bindings, materials and triangles. Save a machine-readable report and attribution.
- [x] Create a small Vite + Three.js + three-vrm web baseline with a neutral studio, orbit camera and face/body framing. Load local VRM replacements without upload. Retain the current character on failed replacement and dispose old GPU resources on successful replacement.
- [x] Isolate normalized humanoid and expression commands from model-specific names. Provide blink, smile, gaze and diagnostic relaxed/reach poses. These are rig checks, not a production motion library. Preserve the user's assets-first plan for real actions and scene assets.
- [x] Add unit checks for the character contract and real browser checks for rendering, mapped joints, expressions, replacement/failure recovery, resource lifecycle and responsive controls. Run a production build.
- [x] Document the BOOTH import/retarget path, remaining clothing/contact/physics work, startup commands and actual verification results. Open the working baseline for review.

Acceptance: visible, correctly oriented existing model; usable rig/expression controls; commands independent of file-specific bone names; local replacement succeeds and invalid files preserve current model; no blanket claim that any BOOTH model is drop-in compatible. No full room, authored cinematics or final character redesign in this milestone.

Verification: seven unit tests, four Chrome tests with Victoria Rubin, and an additional VRM 1 replacement test passed. Desktop/face/mobile screenshots inspected. Production build passed with a large-chunk optimization warning. Browser open requested through Codex (queued); studio is served at http://127.0.0.1:5173.
