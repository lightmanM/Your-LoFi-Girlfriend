# Reading motion, first layer (2026-11-06)

`web/src/balcony/reading.js`, used by the Balcony page. Runs live in the browser on top of the static reading pose,
so a long session never repeats visibly (seeded random events, line timing jitter).

- **Eyes on real lines.** The gaze target steps along the printed text block of the book model in fixations
  (6 to 9 per line, about 0.2 to 0.35 s each, sometimes a short look back), sweeps back to the start of the next line,
  works down 22 lines, then moves to the facing page. The left page (nearer her left hand) is read first.
- **Head follows the eyes** with a 0.45 s lag: a little yaw along each line, more toward the page being read, and
  pitching down as she reads down the page. Neck takes 35 %, head the rest.
- **Breathing is visible** (about 1.8 times the old depth) with a slow weight shift.
- **Events:** a posture settle (hips, spine, head tilt) every 35 to 80 s; looking up from the book for 2 to 4.5 s every
  55 to 120 s, with a blink as she looks away and back. Blinks are rarer while reading (every 4.5 to 8.5 s).
- **The book rides between her hands**, so any hand or arm motion added later carries it.

`?events=0.15` compresses the event timing for review (as in the clips here); `?seed=N` changes the sequence.

Clips: [reading-v1-fast-events.mp4](reading-v1-fast-events.mp4) (full frame, 40 s),
[reading-v1-closeup.mp4](reading-v1-closeup.mp4).

## Second pass: page turns and body motion

- **Page turns** (`page-turn.js`, `arm-ik.js`): after the last line of the right page, a paper leaf in the book curls over
  to the left page (2.6 s). Her right hand reaches the leaf's lower outer edge, lifts it part way (never higher than
  6 cm above where it rested) and lets go; the page falls the rest of the way. While her right hand is busy the book
  is held by her left hand alone, then shared again. Eyes and head follow the page, then go to the top of the new left
  page. With 22 lines per page a turn comes about every three minutes.
- **Legs and body:** a slow drift on knees (spread), knee bend and ankles, plus a shift of the feet every 30 to 75 s;
  hip and back sway is about twice as strong as before.

`?lines=N` shortens pages for review. Clips (events at 0.25, three lines per page, 45 s):
[reading-v2-full.mp4](reading-v2-full.mp4), [reading-v2-closeup.mp4](reading-v2-closeup.mp4).

Still open: fingers (the page is lifted by the whole hand, no pinch), expressions, and from this camera the book is
seen mostly from its back, so the turn reads as a page rising above the cover.

## Fix: the book drifted (third pass)

Cause: the book sat halfway between her two hands. Breathing and sway move the hands a little differently, so the book
slid inside both grips. Now the book is fixed to her left hand, and her right wrist is pulled back onto its grip point
on the book every frame with the two-bone reach (during a page turn it travels to the page and back). Measured over
40 s in headless Chrome: the right hand stays exactly on its grip while reading (0.0 mm); during the turn it leaves by
up to 8 cm on purpose. Clips: [reading-v3-closeup.mp4](reading-v3-closeup.mp4), [reading-v3-full.mp4](reading-v3-full.mp4).

## Fourth pass: hand clear of the book, bigger motion

- **Hand no longer passes through the book.** The arm reach used to turn the hand with the forearm, so the fingers
  wrapped behind the cover swept through it. The right hand now keeps its grip orientation relative to the book, and
  during a turn travels in the book's frame: straight out past the outer edge (6 cm, more than the 4.5 cm the fingers
  wrap in), up, then over to just above the page's edge, and back the same way. Measured at 10 samples a second: no
  finger joint inside the book's thickness during the turn; at rest the middle fingertip touches the back cover, as in
  the approved pose. `window.lofiBalcony.handInBook()` reports the deepest joint.
- **Bigger motion:** breathing about 2.8 times the original depth, hip and back sway 2.2 times, a light idle head
  drift on top of reading, reading head turn up to about 15° side to side and 12° up and down, and a small head dip
  as each new line starts.

Clips: [reading-v4-closeup.mp4](reading-v4-closeup.mp4), [reading-v4-full.mp4](reading-v4-full.mp4).

## Fifth pass: bigger leg motion

Leg drift and shifts roughly doubled: knee spread 5°, knee bend 5.5°, ankles 9°, slow drift 2.2°, and a shift of the
feet every 18 to 45 s. Over 45 s each knee travels about 4 to 5 cm. The feet move up to 10 cm and are not pinned to
the floor; they sit just below the frame now, but would need foot contact if the framing ever shows them.
Clips: [reading-v5-closeup.mp4](reading-v5-closeup.mp4), [reading-v5-full.mp4](reading-v5-full.mp4).

## Stretch break (clip event)

The authored stretch (`stretchRokokoIk` in `authored-motions.json`) now plays as an occasional event while she reads,
every 4 to 8 minutes, never during a page turn or a look-up (`?stretch=N` starts one after N seconds for review).
`web/src/balcony/clip-player.js` plays clips over the reading pose; the reading layer pauses (line timing, events and
head offsets) while a clip owns the body, and resumes where it stopped.

Review of the clip as it was:

| Finding | Change |
| --- | --- |
| Authored over the sofa pose and facing: its absolute torso turned her to face the camera | Hips, spine and chest play relative to the clip's first frame on top of the reading pose; arms, neck and head absolute |
| Left forearm snaps 20° in one frame at 11.3 s; the clip ends with a fast drop to below the lap | Play 0 to 10.6 s only: the first overhead stretch and the seated twist, ending with the hands back on the lap |
| Fingers clench at up to 12° per frame around 0.8 s | Light temporal filter (±0.1 s) on every track |
| Hands drop at 1.5 m/s after the overhead hold | That second (4.0 to 5.3 s) plays at 70 % speed: peak 1.0 m/s, accelerations halved |

Book: it eases from her hands onto her lap (pages up, between hip and knee) as she lowers her arms, and back into her
grip at the end; blended about the book's own centre (its root pivot is at the scene origin, which first threw it
3 m up). The right hand's book pin fades out during the stretch. The whole event lasts about 15 s.

Clips: [stretch-v1-closeup.mp4](stretch-v1-closeup.mp4), [stretch-v1-full.mp4](stretch-v1-full.mp4). Not used yet:
the clip's second stretch, which would need the forearm snap and the end drop re-authored.

### Stretch, second pass

- **Her hands carry the book.** The event now has a put-down part (1.6 s) where the book moves from its reading
  position to her lap with both hands holding it (two-bone reach on each arm to its grip point on the book, hands
  keeping their grip orientation), then she lets go (1.1 s) into the clip; at the end she takes hold of the book on
  her lap (1.1 s) and lifts it back up (1.7 s). Measured: each hand stays at a fixed distance from the book's centre
  throughout both carries. Reading fades out as the book goes down. The event lasts about 16.5 s.
- **Shoulders.** At the top of the stretch the clip lifted her shoulders to ear level, so her upper arms looked too long
  and her head sank between them. Shoulders now keep 40 % of the clip's lift, relative to its first frame
  ([stretch-shoulders-before-after.png](stretch-shoulders-before-after.png)).

Clips: [stretch-v2-closeup.mp4](stretch-v2-closeup.mp4), [stretch-v2-full.mp4](stretch-v2-full.mp4).

### Stretch, third pass

- **Shoulders move with the arms** (`web/src/balcony/body-coupling.js`). The clip's own shoulder tracks are replaced:
  each shoulder lifts by 0.3° per degree the arm rises above 30° (up to 32°) and comes forward up to 14° as the arm
  goes forward, as the shoulder blade does; the upper arm keeps the clip's direction. At the top of the stretch the
  shoulder joints sit about 6 cm higher than at rest. [stretch-shoulders-3-versions.png](stretch-shoulders-3-versions.png):
  the clip's shoulders (head buried), 40 % of them (shoulders too low and still), driven by the arms (now).
- **Put-down and pick-up timing.** Putting down: a short hold and small lift, a quicker drop, a long soft landing.
  Picking up: a quick lift that slows, overshoots by a few centimetres and settles.
- **Twist: body follows the arms, forearms kept out of the chest.** Chest and spine turn toward the side the hands
  are on (up to 22°, the arms counter-turn so the hands stay where the clip puts them), and each wrist is pushed out to
  the front until no point of the forearm is inside the torso. The chest surface was measured by ray casts against
  the model: 11 to 12 cm in front of the spine bones. Forearm overlap with the body: 52 mm deepest and 24 of 126
  samples over 1 cm without this; 22 mm deepest (as the hands settle on the lap at the very end) and 3 samples with it.

`?shoulders=0` and `?torso=0` switch the two body layers off for comparison.
Clips: [stretch-v3-closeup.mp4](stretch-v3-closeup.mp4), [stretch-v3-full.mp4](stretch-v3-full.mp4).

### Stretch, fourth pass

- **Put-down timing:** slow while she is still reading (the book moves 4 cm in the first second), faster as it nears
  her lap, then a soft touch-down (2.3 s in all). Pick-up unchanged.
- **One-arm stretch first.** The clip raises both arms together within half a second, which read as a one-arm move cut
  short. Now her left arm stretches up alone and holds while her right hand stays on the book in her lap; after
  2.2 s the right hand lets go and joins it, and the two-arm stretch carries on as before (`lead` option in
  `clip-player.js`: the leading arm plays and holds at its peak, the other arm's clip weight stays 0 until it joins).
  [stretch-v4-opening.png](stretch-v4-opening.png).
- The overlap check now covers chest height and torso width only (the hanging elbow and a forearm resting on the lap
  were counted before). Remaining: 2 of 192 samples (0.2 s) as the left forearm rests across her waist at the start.

The event lasts about 19.5 s. Clips: [stretch-v4-closeup.mp4](stretch-v4-closeup.mp4), [stretch-v4-full.mp4](stretch-v4-full.mp4).

### Stretch, fifth pass

- **Order: single-arm stretch, then both arms up.** The one-arm lead-in of the fourth pass is gone (both arms rise
  together again). The event now plays the clip from 5.24 s: the single-arm stretch across the body, then the
  two-arm overhead stretch, ending as the arms come down (19.4 s). The swing up with the forearm snap (10.85 to 11.7 s)
  plays at 40 % and the quick drop at the end (18.3 to 19.4 s) at 35 %. Peak hand speed 0.87 m/s.
  [stretch-v5-sequence.png](stretch-v5-sequence.png).
- **Book flat on her thighs.** When she puts it down, rays cast straight down onto the model under the book's footprint
  give the thigh surface; a plane fitted to them sets the book's tilt and height, text toward her, top toward her knees.
  The pose is kept relative to both upper legs, so the book rides along when her legs shift. Every corner sits within
  about 1 cm of the thighs ([stretch-v5-book-on-lap.png](stretch-v5-book-on-lap.png)).
- **Head up before the book lands, livelier.** From about 40 % of the put-down her neck lifts, the head follows a
  beat later, both with a small overshoot and a slight tilt; reading stops as she looks up. As she takes hold of the
  book again her head goes back down to it.

Measurement note: the ray-cast contact check blocks the page while it samples, which slows the page clock; speeds
are computed from the page's own clock, and videos are recorded without that check.
Clips: [stretch-v5-closeup.mp4](stretch-v5-closeup.mp4), [stretch-v5-full.mp4](stretch-v5-full.mp4). The event lasts
about 24 s.

### Stretch, sixth pass: overhead only

The single-arm stretch is removed. The event plays the clip's two-arm overhead stretch only, from 10.4 s (hands
resting on the lap) to 19.4 s, with the same slowed swing-up and drop, the book carry, the head lift and the shoulder
and torso layers. It lasts about 18.6 s; peak hand speed 0.7 m/s; no forearm overlap with the chest.
[stretch-v6-sequence.png](stretch-v6-sequence.png). Clips: [stretch-v6-closeup.mp4](stretch-v6-closeup.mp4),
[stretch-v6-full.mp4](stretch-v6-full.mp4).

## Break from reading (replaces the stretch, 2026-11-09)

The overhead stretch is gone. Played whole (all 19.4 s of `stretchRokokoIk`), the capture showed its single-camera
limits: a hand over her head in the first swing up, a forearm through her chest in the seated twist, shoulders dipping,
an untracked wrist bent like a claw, and hard stops at the drop and the pick-up; the passes above had hidden these with
slowed spans and body layers, and the owner judged neither version natural. The stretch-exports of the IK pipeline
(v8 to v10 with firmer fists, v19 = the stored clip) are kept in the private `assets/characters/marycia/stretch-exports/`.

In its place, `web/src/balcony/unwind.js`, procedural and on the same schedule (every 4 to 8 minutes, never during a
page turn, a look-up or a line she is saying), about 16 s:

- the book goes down to her lap with the same put-down timing as before, and comes back up the same way; her hands
  stay on it throughout (no reach, nothing near her head);
- her head comes up from the book (24°, as when she looks up);
- two slow backward shoulder rolls (1.9 s each: forward and up, over the top, back and down; up to about 2 cm of rise
  at the shoulder joints, never below their reading height), with a breath in;
- her head tilts 15° to one side, holds with her eyes closed, comes back, and does the other side; then she settles.

Tests: `web/tests/unwind.test.js` (timing, hands on the book, both tilts, eyes, motion only with weight) and the break
test in `web/tests/viewer.spec.js` (hands within 3 cm of their grip, shoulders never below reading height, the old clip
not downloaded, reading resumes). The overhead stretch's code (`clip-player.js`, `body-coupling.js`) is removed.


## Overhead stretch, authored by hand in Blender (study, 2026-11-10)

A second try at the two-arm overhead stretch, this time keyed in Blender instead of taken from the motion capture
clip. It is a study only: the page still plays the break above, and nothing in `web/` changed.

The shot (15.5 s at 30 fps, `scripts/balcony-stretch/`): she reads, lowers the book to her lap (it lands on its far
edge and is laid flat as her fingers slide out from under the cover), rests her hands on the pages and looks up,
gathers her hands, raises her elbows with loose fists outside her shoulders, pushes up into an open V with her back
arched over the chair back and her eyes pressed shut, leans a little left and right at the top, lets the V fall open
with the elbows dropping first and the hands trailing, takes hold of the book, lifts it with a small overshoot and
reads on.

How it is made:

- `stretch.py` is the whole choreography: times, angles and hand positions. Every channel is a start value plus
  moves, each with its own time window and ease; windows overlap, so one move blends into the next with no stop
  (`tracks.py`). Her right arm runs 0.07 s behind her left on the way up and a little more on the way down.
- `rig.py` solves the pose with its own maths on the armature's rest data (the rig has no constraints): two-bone
  reach for the arms, the forearm taking the hand's roll as in the reading pose, and the shoulder girdle following
  the upper arm (0.27° of lift per degree above 35°, about 5 cm at the top). While her hands hold the book they are
  solved onto their grip on it every frame.
- `lap.py` finds where the open book lies: rays cast down onto her posed thighs under the book's footprint, a plane
  through the upper surface, the near edge 2 cm clear of her dress.
- `hair.py` runs after the body: strands hang a little toward the ground when her head tips back and lag behind its
  turns (a damped follower). Face: the character's own keys (`はぅ` at the top, a small open mouth, `にこり` after).
- `apply.py` shows a moment on the live rig (`show(t)`), bakes every frame to one action with three slots (bones,
  book, face keys), and reports the motion in numbers (`analyse()`); `check_shot.py` turns those into pass or fail.
- `overlap.py` measures hands against the book on the deformed skin: every hand vertex, every frame, against the
  book's solid (page surface above, cover below), plus how far a hand dips under her clothes.

Hands and the book (second pass, same day). In the first version the hands went from their grip to the pages by a
straight blend, and the resting pose assumed a flat book. The open book is a shallow V (each half rises 12° to its
outer edge, where the page surface is 4 cm up), so the resting hands lay 13 mm inside the pages and the fingers
crossed the cover on the way. Now the hand goes round the outer edge: the fingers slide out from under the cover,
the hand comes up beside the book with the palm turning down, and settles on the page, tilted with it, thumb out
beside the palm; leaving for the stretch it lifts 5 cm before it turns. Picking the book up is the same path
backwards. Measured: nothing deeper than 1.2 mm (contact) once the hands have let go, against 6.6 mm (right through
the pages) before. The reading grip itself presses 4.7 mm into the page edge; that is the approved reading pose and
is unchanged. Her left hand still brushes 6 mm into her skirt for three frames as it reaches under the cover.

Measured on the baked shot: hands peak at 1.0 m/s (rise) and 0.9 m/s (fall), no acceleration above 5 m/s²; the book
peaks at 0.5 m/s; her hands stay exactly on their grip while they carry it; elbows never straighter than 17°; first
and last frames are within 1.2° of the approved reading pose.

To rebuild and render (the study file is local, like the other files under `assets/`):

```sh
# in Blender, with assets/characters/marycia/balcony-study/balcony-stretch-anim-2026-11-10.blend open
#   import sys; sys.path.insert(0, '<repo>/scripts/balcony-stretch'); import apply, hair; apply.bake(extra=hair.layer)
blender -b assets/characters/marycia/balcony-study/balcony-stretch-anim-2026-11-10.blend \
  -P scripts/balcony-stretch/check_shot.py
blender -b assets/characters/marycia/balcony-study/balcony-stretch-anim-2026-11-10.blend \
  -P scripts/balcony-stretch/render.py -- --view close --out <frames dir> --height 480 --samples 8
python3 -m unittest discover -s scripts/balcony-stretch
```

Two things about the Blender file that cost time:

- **A scene nobody uses is not saved.** `Balcony • Stretch anim (Claude)` had no users, so a saved copy silently
  lacked it; it now has a fake user. Six other study scenes in the open session are in the same state.
- **The toon compositor reads the backdrop scene.** Its Render Layers and Cryptomatte nodes point at
  `Balcony • Toon test (Claude)`, so rendering any other scene with it gives the empty balcony. `render.py` works on
  its own copy of the node tree aimed at the scene it renders. The render has no foreground schefflera: the page
  draws that plant live over the picture.

A frame costs about 4 s at 1080p with 16 samples (7.7 s with 24), and several Blender processes at once only share
the one GPU: three in parallel were slower than one. Most of that is fixed per-frame scene work: 480 px square with
8 samples is still about 3 s a frame (23 minutes for the shot), so for a quick look render only the frames that
changed (`--start`, `--end`). Previews are rendered small: `--view close --height 480 --samples 8`.

Clips, second pass (hands round the book): [stretch-blender-v2-closeup.mp4](stretch-blender-v2-closeup.mp4) (the
whole shot, close view, 480 px), [stretch-blender-v2-hands.mp4](stretch-blender-v2-hands.mp4) (only the put-down and
the pick-up). First pass: [stretch-blender-v1-full.mp4](stretch-blender-v1-full.mp4) (the page's camera),
[stretch-blender-v1-closeup.mp4](stretch-blender-v1-closeup.mp4) (the same frames cropped on her);
[stretch-blender-v1-sequence.png](stretch-blender-v1-sequence.png).

## The overhead stretch on the page (2026-11-10)

The stretch above now plays on the page, beside the calm break rather than in place of it.

**What plays.** `web/src/balcony/overhead-stretch.js`, about 12 s: the book goes down to her lap (2.3 s), her hands
leave it, gather in front of her ribs, come up as loose fists outside her shoulders and push up into an open V with
her back arched, her head tipped back and her eyes shut; she leans a little to her left, then her right; the V falls
open with the elbows dropping first and the hands trailing; her hands go back to the book and she lifts it (1.8 s).
The study's shot reads for 1.5 s before and 2 s after; the page's event is the part in between.

**Ported, not exported.** The times, angles and hand positions are the study's (`stretch.py`, its curve maths in
`tracks.py`, here `web/src/balcony/tracks.js`), but the pose is solved on the VRM's normalized bones each frame, so it
plays on any character: the stand-in runs it as well as Marycia. A baked clip would have been tied to one skeleton.
What changed on the way:

- Wrist positions are scaled by the character's own arm length (the study's are for Marycia), and the wrist never
  goes further than 97 % of it from the shoulder, so the elbows never lock.
- The arm is solved with the page's two-bone reach (`arm-ik.js`), which now takes the direction the elbow should
  point. The upper and lower arm are then turned about their own length so the elbow folds like a hinge, whatever way
  the arm points; the forearm takes up to 75 degrees of the hand's roll and the wrist bends for the rest.
- The shoulder girdle follows the arm as in the study (0.27 degrees per degree above 35), but stops at 22 degrees:
  the motion-capture stretch showed that more puts her shoulders at her ears.
- The book is carried by the reader exactly as for the calm break (hands on its side edges while it is low). The
  study's finer handling (landing on the far edge, the hands going round the edge to rest on the pages) is not ported:
  on the page the book on her lap is at the bottom edge of the picture.
- Her hair is left to the VRM's own spring bones. Her face only shuts its eyes (the blink expression every VRM has);
  the study's Marycia-only shapes (a pressed-shut squeeze, a small smile after) are not used.
- An arm blends from the reading pose to the choreography by how far its hand is off the book, and the reader brings
  the hand back onto the book by the rest; her right arm runs 0.07 s behind her left.

**When.** `web/src/balcony/breaks.js` (pure): the calm break every 4 to 8 minutes, the stretch every 5 to 15, each on
its own timer. Neither starts during a page turn, a look-up, a line she is saying or the other one; a break whose
time has come waits. After either ends the other waits at least a minute. `Reader.busy()` is true from the moment the
book leaves her hands to its return, so she cannot be clicked, does not glow under the pointer and says nothing
through the whole stretch, as during the calm break. `?reach=<seconds>` starts one for a check (`?stretch=<seconds>`
still starts the calm break).

**Measured on the page** (Chrome, the live scene, 715 frames): her hands peak at 1.1 m/s on the way up and 0.9 m/s
coming down (the study: 1.0 and 0.9), the book at 0.5 m/s; nothing jumps between frames; both hands are 28 to 33 cm
above her head at the top (26 cm on the stand-in); the arm is never straighter than 97 %; she is busy for all of it.

**Looked at** on Marycia and on the stand-in, as stills through the whole event: the put-down, the hands leaving, the
fists by her shoulders, the top, both leans, the fall, the hands returning. Her left arm is mostly behind the near
plant from the page's camera. As her hands come back to the book they turn palm up to go under its edges; that is the
reader's grip, and reads as reaching under the book.

Tests: `web/tests/tracks.test.js`, `breaks.test.js` (a simulated day: never together, never back to back, the gaps),
`overhead-stretch.test.js` (order, hands on the book while it travels, eyes, both hands above her head, shoulders,
elbows, no jump, fists, the lean, a character without finger bones), `arm-ik.test.js`, and in the browser
`viewer.spec.js` (the motion on the live scene), `standin.spec.js` (on the stand-in) and `chat.spec.js` (a click
during the stretch starts nothing; one after it does).

