# Motion tools

Reference-driven motion for Marycia. Nothing here is keyed from scratch: body motion comes from a
real person on video, Marycia's own clips come from the Unity pipeline (`scripts/marycia/`).

| Script | Purpose |
| --- | --- |
| `track_pose.py` | MediaPipe PoseLandmarker (VIDEO mode) → per-frame 3D world landmarks JSON, plus overlay stills to check tracking. |
| `retarget_reference.py` | Blender: transfer torso lean/twist, head turns and arm directions from the landmark JSON onto Marycia over her supplied seated pose; export a runtime clip. Legs, hips and fingers keep the supplied poses. |
| `retarget_fbx.py` | Blender: transfer upper-body motion from a mocap FBX (Rokoko Studio or Mixamo bone names) onto Marycia over her seated pose, by each bone's world rotation change from its T-pose rest; export a runtime clip, optional Workbench stills. |
| `retarget_ik.py` | Blender: same input as `retarget_fbx.py`, but the arms are placed by position: wrist targets scaled by the arm-length ratio far from the head and taken relative to the head centre near it, the whole arm kept out of a head sphere, two-bone IK with the actor's elbow as hint, actor roll and wrist bend kept, clavicle shrug blended (`--clavicle 0.3`), hands authored as a phase program per stretch episode (fists on the rise and through the hold, idle once the arms are down; `--palms-up` for the open variant) from the supplied hand poses. Use this when the character's proportions differ from the actor's. |
| `export_clip_fbx.py` | Blender: bake a runtime clip onto Marycia's skeleton and export an FBX (mesh, skeleton, animation) for tools such as Cascadeur. |
| `blender_bridge.py` | Load runtime clips onto the armature / export poses in the runtime's T-pose-relative, parent-local glTF frame. Round-trip is exact. |

## Setup (once)

```sh
python3.12 -m venv ~/.cache/lofi-mpenv && ~/.cache/lofi-mpenv/bin/pip install mediapipe opencv-python-headless numpy
curl -L -o ~/.cache/pose_landmarker_heavy.task \
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task
```

## Make a clip from a reference video

```sh
# 1. Track (about 1.6x real time on an M-series CPU). Overlay stills every 25 frames go to the last argument.
~/.cache/lofi-mpenv/bin/python -I scripts/motion/track_pose.py reference.mp4 ~/.cache/pose_landmarker_heavy.task pose.json overlay/
# 2. Retarget in Blender on top of the seated pose; --shots renders Workbench stills to check.
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python-exit-code 1 \
  assets/characters/marycia/marycia-working.blend --python scripts/motion/retarget_reference.py -- \
  --pose pose.json --motions web/public/models/marycia/source-motions.json --out clip.json --shots shots/ [--start 2 --end 9]
# 3. Add the clip to web/public/models/marycia/authored-motions.json under "clips" and list it in web/src/companion/source-motion.js.
```

Reference footage should show one person, full body, front or three-quarter view, static camera.
Free-to-modify stock (Pexels) or your own phone video both work. Frame times are kept from the
video (25 fps here); the runtime interpolates. Known limits: single-camera depth is approximate,
hand roll is not tracked (palms follow the arm), fingers are not tracked, and there is no
contact solving (hands may pass through the body on tight poses).

## Make a clip from a mocap FBX (Rokoko Vision, Mixamo, ...)

```sh
# Rokoko Studio: open the processed clip, Export tab, FBX / Default skeleton. The file lands in
# ~/Library/Application Support/com.RokokoElectronics.RokokoStudio/Exports/<clip>.fbx
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec --python-exit-code 1 \
  assets/characters/marycia/marycia-working.blend --python scripts/motion/retarget_fbx.py -- \
  --fbx clip.fbx --motions web/public/models/marycia/source-motions.json --out clip.json --name stretchRokoko --shots shots/
```

The first exported frame is the rest pose and is dropped (`--skip 1`). Both rigs rest in a T-pose facing −Y, so
the transfer is bone-roll and proportion independent; the actor is yawed so the hips face −Y on average. Fingers
are not transferred (Rokoko Vision keeps them flat). Side-by-side recording of two clips: `cd web && node record-compare.mjs stretch stretchRokoko`.

For a character whose arms are much shorter than the actor's relative to the head (Marycia: 3.7 arm lengths per
head radius, an adult about 5.5), use `retarget_ik.py` with the same arguments; it prints how many frames had a
hand target pushed out of the head sphere, how many times an arm segment had to be moved, the share of frames at
full reach and the arm-length ratio it applied. `--margin` / `--arm-margin` (m) widen the head sphere for hands /
arm segments and the chest plate, `--near-head lo hi` (m, actor hand-to-head distance) sets where targets switch from head-relative to
shoulder-relative, `--clavicle` (0..1) sets how much of the actor's shoulder shrug is kept, `--hand-timing fist hold open relax`
(seconds), `--palms-up`, `--palm-dir x y z`, `--open-amount`, `--hand-gap closed open` (m, minimum sideways wrist distance), `--symmetry` (pull of the hands to one
depth), `--roll-split` (share of the palm roll the upper arm carries) and `--lift start peak` (m above the shoulder) shape the
hand program, `--smooth a b` sets the box half-widths (frames) applied to
the targets before the keep-outs and to the solved joints after them, `--dump file.json` writes per-frame targets,
hints, elbows and wrists for debugging pops. Check `--shots` stills, the skeleton distances and the frame-step jitter
before recording.
