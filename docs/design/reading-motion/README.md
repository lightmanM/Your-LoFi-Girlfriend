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

