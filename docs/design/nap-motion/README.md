# Her nap on the daybed (2026-11-12)

Now and then, when she is only reading, she yawns, closes her book, gets up, walks out through the door to the
daybed, lies down on her side with the book beside her and sleeps for 15 to 20 minutes. Then she wakes, gets up, walks
back in, sits down and opens the book again. It is her first motion that leaves the chair.

## How it is made

- **In Blender** (`scripts/balcony-nap/`, in the balcony study scene): `body.py` poses her whole body from a few
  controls in room space (hips, feet on the floor, hands, the way she faces), on top of the stretch study's
  `rig.py`. `nap.py` is the way out and `back.py` the way back: timing curves over those controls, footsteps placed
  along a line, hip height taken from her leg length. Getting up from the daybed is lying down played backwards and
  cross-faded into the stand-up; sitting down in the chair mirrors getting up from it.
- **Export** (`export_web.py`): the sleeping pose and where the book rests (`nap.json`), and each walk as a clip with
  a pose for every frame at 30 a second (`nap-walk.json`, `nap-back.json`: bone rotations in the page's pose format,
  her hips' place in the room, how far the book is shut, three expressions, a few marks).
- **On the page**: `web/src/balcony/nap-plan.js` decides when (pure, tested); `nap-walk.js` plays a clip, easing in
  from whatever pose she is in and, on the way back, easing out into her reading as the reader poses it that frame;
  `nap.js` keeps her asleep, breathing slowly. In `web/src/viewer/main.js`, `surround()` moves her light (warm room to
  open shade), her shadow on the picture and the narrow-screen crop with her.
- **The flat picture covering her** (`web/src/viewer/cover.js`): the balcony is one painted picture, so the door frame
  beside the daybed would be drawn behind her. Her pixels are tested against the picture's cover map (distance to the
  nearest solid thing, the map the live plants use) and dropped where the picture is nearer.
- **Her shadow on the picture** (`web/src/viewer/wind.js`, `REST`): each picture pixel's place in the room comes from
  the same map; it darkens near capsules along her body and where a ray toward the sun passes them.

The walks' footsteps are fitted to Marycia's legs, so a stand-in character (and `?napwalk=0`) goes each way by a cut
instead: the picture dips to dark, and comes back with her in the other place.

Timings are in `nap-plan.js` (`NAP`): first nap 20 to 35 minutes into a visit, 30 to 50 minutes between naps, asleep
15 to 20. Test switches: `?nap=<seconds>`, `?napfor=<seconds>`, `?nap=0`, `?napwalk=0`.

## What the passes taught

- **Walk like a person, not a duck**: hips at straight-leg height (a leg 3 cm short of straight already bends the knee
  about 30 degrees), feet 5 cm either side of her line, strides near 0.65 m.
- **Stages overlap**: she turns as she steps, sits as she turns, leans toward the pillows before she is seated. A pose
  that settles before the next move starts reads as a robot. The limit: a step must not start before her hips are
  near standing height, or she steps out of a half squat.
- **Hands**: her right hand folds its half of the book shut before it leaves (the book must not close by itself); it
  rests on the outside of her thigh or her knee, never between her legs; asleep it lies along her side.
- **Asleep**: on her side, legs together and only a little bent, upper body on the pillows facing the camera (flat on
  her side, her knees hide her face from this camera).
- **Check every frame, not stills**: a hand that snapped 60 degrees in one frame and a book that jumped 7 cm at the
  hand-over were invisible in 15 fps previews. `web/tests/nap-walk.test.js` limits every bone's turn per frame in the
  shipped clips.
- **The chair's seat press** (`seat.js`) must follow her as she rises and let go once she is up.
- **Recording**: step the page on its own clock (replace `requestAnimationFrame` and `performance.now`, one picture
  per 1/30 s), or the clip stutters by itself.

Clips and stills from the passes are next to this file (local only, not in the repository).
