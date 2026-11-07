# Balcony reading pose, revision 2 (2026-11-06)

Revision of the Codex pose in Blender scene `Balcony • Reading by the window`, made on a copy
(`Balcony • Reading v2 (Claude)`, side check `Balcony • Reading v2 side (Claude)`). The Codex scene and pose are unchanged.
Scripts: `spike/balcony-pose/setup_v2.py` (copy scene, cameras) then `spike/balcony-pose/pose_v2.py` (re-runnable; resets
to the Codex pose each run). Private checkpoint: `assets/characters/marycia/balcony-study/marycia-reading-v2.blend` (git-ignored).

[reading-before-after.png](reading-before-after.png): Codex main, revision main, Codex side, revision side.

## What was wrong, measured

| | Codex pose | Revision |
| --- | --- | --- |
| Wrist twist (left / right) | −113° / +111° | 0° / 0° (forearm takes 49° / 53° of roll) |
| Wrist bend (left / right) | 63° / 37° | 14° / 10° |
| Finger curl | bent backwards (+7°), flat paddle hands | curled toward the palm, fan closed by 75 % |
| Lower spine lean | 32° back | 22° back |
| Neck to head | head hangs, face hidden | 30° down, eyes take the rest, face visible |
| Prop | flat magazine at stomach height, forearms floating | open hardback at chest height, 0.36 m from the eyes, elbows by the waist |
| Seat | bottom on the seat, lower back on the backrest | unchanged |

The seat check: her lowest point is 1 mm into the woven seat and her lower back touches the backrest. Ray tests through the
seat are unreliable because the reduced weave is full of holes; measure against nearby chair vertices instead.

## Not done

Legs, feet, pelvis and chair are the Codex ones. The book replaces the magazine. Static pose only: no animation, no
MToon/runtime check, no browser test.
