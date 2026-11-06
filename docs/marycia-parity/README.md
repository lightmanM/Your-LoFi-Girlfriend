# Marycia muscle-clip parity check (portable converter vs. Unity Editor)

Date: 2026-11-05. Unity 6000.6.8f1 (batchmode, `-nographics`), project at
`~/Library/Caches/lofi-asset-review/unity-marycia` (outside the repo).

## What was checked

`web/public/models/marycia/source-motions.json` is produced by
`scripts/marycia/convert_muscles.gd` (Unidot humanoid decoder on Godot's
generic `SkeletonProfileHumanoid`). Each track is, per bone and frame, a
parent-local *delta from the T-pose*:

```
delta_world = world(bone) * inverse(rest_world(bone))   # rest = T-pose
delta       = inverse(delta_world(parent)) * delta_world  # parent = nearest kept humanoid ancestor
```

in a right-handed glTF frame (VRM1, character facing +Z). This check evaluates
the same 12 clips inside the real Unity Editor on the purchased FBX
(`bn0010_Marycia.fbx`, its own humanoid Avatar: armTwist 0.5, foreArmTwist 0.2,
upperLegTwist 0.5, legTwist 0.2), records every humanoid bone's world rotation
at exactly the converter's frame times, rebuilds the same delta quantity with
Unity's own T-pose as rest, mirrors it into the glTF frame, and measures the
angle of `q_unity * inverse(q_converter)` per bone per frame.

## Files

| Path | What |
| --- | --- |
| `scripts/marycia/unity/LofiParity.cs` | Editor script (our code only). Loads the FBX prefab, applies the avatar T-pose, samples each clip, dumps world rotations, hips position, HumanPose body rotation, muscle readback at frame 0, and `bn0010_Face` blendshape weights. |
| `scripts/marycia/unity/run_parity.sh` | Recreates the project, copies the extracted package (with `.meta` files), runs the dump, runs the comparison. |
| `scripts/marycia/compare_parity.py` | stdlib-only comparison (`python3 -I`). Picks the frame conversion, writes `parity.json`. |
| `assets/characters/marycia/unity-dump.json` | Unity's evaluation (numbers and bone/morph names only; no geometry). |
| `docs/marycia-parity/parity.json` | Per clip / per bone / per region errors, face morph diffs, candidate frame totals. |
| `scripts/marycia/unity/LofiVrma.cs` | Optional `.vrma` export through UniVRM (see "VRM Animation export"). |

Raw logs: `~/Library/Caches/lofi-asset-review/unity-marycia-logs/`
(`00-create.log`, `01-import-dump.log`, `02-diag.log`, `03-dump-tpose.log`, `04-vrma.log`).

## Method notes (things that mattered)

* **Unity ran headless with the existing license**; project creation plus the
  178 MB package import took about 9 s of asset-pipeline time (`-nographics`
  skips GPU texture work), so the whole dump run is ~15 s.
* **Sampling method: `AnimationClip.SampleAnimation(gameObject, t)` retargets
  humanoid clips correctly in the editor.** Verified two ways: sit at t=0 moves
  the pose 153 deg from the T-pose, and the `HumanPoseHandler` muscle readback
  after sampling `bn0010_stand_still` at t=0 reproduces the `.anim` curve
  values exactly (e.g. `Left Upper Leg Front-Back` 0.640632, `Left Lower Leg
  Stretch` 0.9998969). The PlayableGraph and `AnimationMode` paths are
  implemented as fallbacks but were not needed. Face clips (generic
  `blendShape.*` curves on `bn0010_Face`) are also sampled with
  `SampleAnimation`.
* **A `HumanPose` with all muscles 0 is NOT the T-pose** on this avatar (this
  was the first attempt and it produced 30 deg mean errors with bent knees in
  the "rest"). The muscle readback of the real T-pose is non-zero: Upper Leg
  Front-Back 0.60, Lower Leg Stretch 1.00, Arm Down-Up 0.39, Arm Front-Back
  0.31, Forearm Stretch 1.00, plus finger values. The rest used here is the
  avatar's configured skeleton pose (`avatar.humanDescription.skeleton` local
  transforms applied by bone name, 185/186 entries; the remaining one is the
  prefab root), which is what Unity's muscle space is defined against. Both
  poses are in the dump (`rest` vs `muscleZeroPose`).
* **Frame conversion.** Candidates were tried on `sit` (total error over all
  bone-frames, lower is better):

  | candidate | total deg |
  | --- | --- |
  | identity | 902.5 |
  | **mirror-X `(x,-y,-z,w)`** | **146.2** |
  | mirror-Y `(-x,y,-z,w)` | 1373.8 |
  | mirror-Z `(-x,-y,z,w)` | 1423.1 |

  Mirror-X is the UniVRM convention (its `VrmAnimationExporter` writes
  `(q.x, -q.y, -q.z, q.w)`), so the choice is unambiguous.
* Parent folding matches the converter: this avatar maps neither UpperChest
  nor Jaw, so Unity's nearest-humanoid-ancestor parents are already the
  converter's (`neck -> chest`, `leftShoulder -> chest`, thumbs
  `leftThumbMetacarpal -> leftHand`, VRM1 thumb naming applied).
* `bodyRotation`/root: `sit` has Root Transform Rotation "Bake Into Pose"
  (based on Body Orientation), `AFK` has it based on Original. Unity keeps a
  constant 32 deg body rotation for AFK; the converter's `RootQ` correction
  lands 8.7 deg away from it (a constant hips offset for the whole clip).

## Results

Angular error in degrees of the parent-local delta, mean over all bone-frames
of the clip, max over bone-frames. Region columns are means.

| clip | frames | mean | max | torso | arms | legs | left fingers | right fingers | hips | worst bones (mean) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sit | 1 | 6.36 | 20.82 | 1.21 | 13.74 | 3.49 | – | – | 1.78 | leftHand 20.8, leftLowerArm 19.6, rightHand 18.1 |
| stand | 7 | 3.55 | 21.90 | 0.11 | 7.15 | 2.09 | – | – | 0.38 | rightUpperArm 21.9, leftUpperArm 13.9, rightHand 7.8 |
| afk | 121 | 3.19 | 30.95 | 2.66 | 11.57 | 1.89 | 1.12 | 1.42 | 8.74 | rightUpperArm 30.4, leftUpperArm 21.7, leftHand 10.1 |
| handsIdle | 1 | 1.40 | 5.70 | – | – | – | 1.40 | 1.40 | – | leftIndexDistal 5.7, rightIndexDistal 5.7, leftRingIntermediate 2.8 |
| peace | 1 | 2.55 | 7.57 | – | – | – | 2.55 | 2.55 | – | leftIndexProximal 7.6, rightIndexProximal 7.6, leftIndexDistal 6.6 |
| thumbsUp | 1 | 3.07 | 11.16 | – | – | – | 3.07 | 3.07 | – | leftIndexIntermediate 11.2, rightIndexIntermediate 11.2, leftMiddleIntermediate 5.8 |
| heart | 1 | 3.01 | 13.12 | – | – | – | 3.01 | 3.01 | – | leftIndexProximal 13.1, rightIndexProximal 13.1, leftMiddleDistal 4.9 |
| fingerHeart | 1 | 2.91 | 8.11 | – | – | – | 2.92 | 2.91 | – | rightIndexProximal 8.1, leftIndexProximal 8.1, leftMiddleProximal 6.6 |

Overall (bone-frame weighted): mean 3.19 deg, max 30.95 deg. By region:
torso 2.50, arms 11.34, legs 1.91, left fingers 1.18, right fingers 1.47.

End-effector world orientation measured relative to the hips (so the AFK root
offset is discounted), mean deg: sit head 6.4 / hands 10.8, 10.2 / feet 4.2,
6.2; stand head 0.2 / hands 15.0, 23.3 / feet 4.7, 5.0; afk head 1.4 / hands
22.6, 31.3 / feet 4.1, 6.3.

Decomposing the arm error about the posed bone axis (scratch analysis, not in
`parity.json`): on `stand` the upper-arm error is 13-22 deg of twist with
2.6-3.2 deg of swing, lower arm 12-15 deg twist / 3.6-4 deg swing, hand 13-21
deg twist / 6-10 deg swing. Legs: 4-7 deg twist, under 2.5 deg swing. So the
converter gets the *direction* of every limb nearly right and the *roll* of the
arm chain wrong, which is exactly what the generic Unidot pre/post rotations
and fixed 0.5 twist split would produce against an avatar configured with
armTwist 0.5 / foreArmTwist 0.2 / legTwist 0.2.

Face clips: the converter's morph values match Unity's sampled blendshape
weights (divided by 100) to 1e-5 or better for all 15-22 active morphs in
`faceIdle`, `smile`, `wink`, `relax`; no morph is present on one side only.

## Interpretation

* The converter is **not** within the 1-2 deg band that would let it stay as
  is. Torso, legs and fingers are close (1-3 deg mean, worst single finger
  joint 13 deg on `heart`), but the arm chain is off by 10-30 deg, mostly roll
  about the bone, and hands end up 10-30 deg from Unity's orientation. That is
  visible (wrist/elbow skinning, hand facing) in `sit`, `stand` and `afk`.
* The AFK clip additionally has a constant 8.7 deg hips/root orientation
  offset versus Unity's baked root rotation.
* Face sampling is at parity and needs no change.
* Recommendation: replace the body tracks with Unity-baked data. The dump in
  `unity-dump.json` already contains everything needed: for each clip and
  frame, `rest` and per-bone world rotations, from which
  `compare_parity.py`'s `unity_local_deltas` plus the mirror-X conjugation
  yields converter-format tracks. (Alternatively, fix `convert_muscles.gd` to
  use this avatar's own pre/post rotations and twist settings, then re-run this
  check; the harness here makes that a 20-second loop.)

## VRM Animation export (optional step, worked headlessly)

Added to the project's `Packages/manifest.json`:

```
"com.vrmc.gltf": "https://github.com/vrm-c/UniVRM.git?path=/Packages/UniGLTF#v0.131.4",
"com.vrmc.vrm":  "https://github.com/vrm-c/UniVRM.git?path=/Packages/VRM10#v0.131.4",
"com.baxter.animation-clip-to-vrma": "https://github.com/malaybaku/AnimationClipToVrmaSample.git?path=/Assets/AnimationClipToVrma/Package#0.2.0"
```

(UniVRM >= v0.131 moved its packages under `/Packages/`; `com.vrmc.vrmshaders`
no longer exists; both resolved and compiled on Unity 6000.6.8f1 in one
20-second batch run.)

The sample package does expose a non-GUI API,
`Baxter.AnimationClipToVrmaCore.Create(Animator humanoid, AnimationClip clip)`
(returns the `.vrma` bytes; the menu items in `AnimationClipToVrmaAssetCommand`
and the `VRM/VRM Animation Exporter` window are thin wrappers around it). Two
things made it unsuitable as-is: it samples at 30 fps with
`FloorToInt(length * 30)` frames, which is 0 frames for the length-0 pose
clips (`sit`, hand poses), and its `HumanoidBuilder` builds a fresh avatar
with default twist settings (0.5/0.5) instead of Marycia's.
`scripts/marycia/unity/LofiVrma.cs` therefore drives UniVRM's
`VrmAnimationExporter` directly (same structure as the sample's core, MIT), at
60 Hz, with at least two keys per clip, on a bone-only copy of the Marycia
FBX that keeps Marycia's own Avatar asset. All 8 humanoid clips exported to
`~/Library/Caches/lofi-asset-review/unity-marycia/vrma/*.vrma` (not in the
repo; the files embed skeleton node names/positions). Sanity check: the
`sit` file is a valid GLB with the `VRMC_vrm_animation` extension (spec 1.0,
51 human bones, 54 nodes, no meshes), and its hips rotation key equals the
dump's hips world rotation after mirror-X.

```
/Applications/Unity/Hub/Editor/6000.6.8f1/Unity.app/Contents/MacOS/Unity \
  -batchmode -nographics -quit \
  -projectPath ~/Library/Caches/lofi-asset-review/unity-marycia \
  -executeMethod Lofi.LofiVrma.Export \
  -lofiVrmaOut ~/Library/Caches/lofi-asset-review/unity-marycia/vrma \
  -logFile ~/Library/Caches/lofi-asset-review/unity-marycia-logs/04-vrma.log
```

`run_parity.sh` does not add these packages; copy `LofiVrma.cs` into
`Assets/Editor/` and add the manifest entries above before running it.

## Reproduce

```
# 1. Package must be extracted with .meta files at
#    ~/Library/Caches/lofi-asset-review/marycia-c8b312ba/extracted/Assets/BeroarN
# 2. Full run (recreates the Unity project, ~1-2 min incl. editor start):
scripts/marycia/unity/run_parity.sh
# 3. Only the comparison:
python3 -I scripts/marycia/compare_parity.py \
  --unity assets/characters/marycia/unity-dump.json \
  --source web/public/models/marycia/source-motions.json \
  --out docs/marycia-parity/parity.json
```

Manual equivalent of the dump step:

```
/Applications/Unity/Hub/Editor/6000.6.8f1/Unity.app/Contents/MacOS/Unity \
  -batchmode -nographics -quit \
  -projectPath ~/Library/Caches/lofi-asset-review/unity-marycia \
  -executeMethod Lofi.LofiParity.Dump \
  -lofiOut <repo>/assets/characters/marycia/unity-dump.json \
  -lofiTimes ~/Library/Caches/lofi-asset-review/unity-marycia/lofi-times.txt \
  -logFile ~/Library/Caches/lofi-asset-review/unity-marycia-logs/01-import-dump.log
```

## Limitations

* Rotations only; hips translation is recorded for information
  (`hipsPosition`, `bodyPosition`) but not compared, because the converter
  does not store it.
* Errors are measured on parent-local deltas, so a parent's error does not
  propagate to its children in the per-bone table; the hips-relative
  end-effector numbers and `worldDeltaMeanDeg` per bone cover the chained
  view.
* `sit` and the hand clips are single-frame poses (length 0), so their
  "mean" is one frame.
* Twist/swing decomposition was a scratch analysis (uses the T-pose bone
  direction rotated by the Unity world delta as the axis); it is reported here
  for interpretation only.
* The VRChat SDK and lilToon are not installed: missing-script warnings and
  pink materials in the Unity project are expected and irrelevant to bone
  sampling.

## Applied (2026-11-05)

`scripts/marycia/apply_unity_tracks.py` replaced every body/finger track in
`web/public/models/marycia/source-motions.json` with the Unity evaluation from
`unity-dump.json` (mirror-X into the glTF frame, same parent-local T-pose delta the
runtime already expects). Face curves, clip timing and the per-clip bone selection are
unchanged; `conversion` metadata now records the Unity version, sampling method and
rest source, with `unityParityVerified: true`. The previous Godot/Unidot output is kept
locally as `assets/characters/marycia/source-motions.godot.json` for comparison.
Largest per-bone change: AFK 31.0°, stand 21.9°, sit 20.8° (hands), finger poses 5.7–13.1°.
`validate_source_motions.py`, the 22 unit tests and the browser suite pass on the new file.

```sh
python3 -I scripts/marycia/apply_unity_tracks.py assets/characters/marycia/unity-dump.json \
  web/public/models/marycia/source-motions.json --backup assets/characters/marycia/source-motions.godot.json
```

### Full library rebuild

After the check, the clip tables in `extract_source_motions.py` and `LofiParity.cs` were extended to
all Face1 expression clips, the AFK face and the five remaining finger poses (33 clips).
`scripts/marycia/build_motion_library.py` now produces `source-motions.json` directly from the
extraction (times, face curves) and the Unity dump (body tracks); each clip drives exactly the bones
its own muscle curves touch, which reproduces the earlier bone selection for all 12 original clips.
The dump (41 MB) lives in the git-ignored `assets/characters/marycia/` folder and is regenerated by
`run_parity.sh --skip-create` in about 10 seconds once the project exists.
