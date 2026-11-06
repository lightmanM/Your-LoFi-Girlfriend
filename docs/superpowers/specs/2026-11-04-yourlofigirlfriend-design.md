# YourLofiGirlfriend — Design

Date: 2026-11-04
Status: draft, pending owner approval

## 1. What this is

A frontend-only web page that is an interactive lofi music player. The
visitor opens the page, performs one in-world action (for example, opening
the curtains), and a cozy 3D room wakes up with lofi music. A 3D anime girl
sits in the room working on her own thing. Clicking her triggers one short,
pre-scripted line or action. Scenes change on their own over time, and she
sometimes leaves the room and comes back.

Inspiration: the Lofi Girl YouTube channel (the mood, the looping
background presence) and the game Chill with You: Lo-Fi Story (a scripted
companion who talks on breaks, one-sided conversation, slow interaction).

It is not a game. There is no timer, no progression, no score, no AI. It is
a living music player you leave open in a tab.

## 2. Why

Lofi streams are a background presence, but they are flat: a looping video
you cannot touch. Chill with You proved people want a companion who feels
present while they work, but it is a paid desktop app with a Pomodoro loop.
This project is the free, open, in-browser middle: the companionship and
mood of Chill with You, the zero-friction "open a tab" access of a lofi
stream.

Success looks like: a visitor leaves the tab open for an hour, clicks her a
handful of times, smiles at something she said, and comes back tomorrow.

## 3. Goals, non-goals, anti-goals

### Goals

- Open the page, one click, music plays, the room is alive. No signup, no
  settings screen.
- The girl feels present: she does things with the objects around her,
  reacts when clicked, talks at natural break moments, and sometimes leaves.
- Multiple distinct scenes, each a lofi-flavored place, rotating on their
  own schedule.
- Runs well in a background tab for hours on an ordinary laptop. No fan
  noise, no memory creep.
- Adding a scene, an interaction, or a dialogue line is a content task
  (assets plus data files), not a code change.
- Open source. Others can contribute scenes and lines.

### Non-goals (for v1)

- Accounts, saved state across visits, progression, unlockables.
- Pomodoro or any timer.
- Voice acting. Lines are text bubbles. Every line must be able to carry an
  optional audio file later without redesign.
- User-chosen scenes, user-uploaded music, playlists.
- Multiple characters.
- Polished mobile experience. The page must not break on a phone, but
  desktop is the target.
- Ads at launch. One ad slot may be added later; the layout must leave a
  place for it.
- Localization. English only, but dialogue lives in data files so
  translation is possible.

### Anti-goals (would make it a failure even if it works)

- It feels like a game that wants something from you: prompts, streaks,
  notifications, pressure.
- Clicking is spammable. Rapid clicks produce rapid reactions.
- Any AI-generated or AI-driven dialogue at runtime.
- The scene is a static backdrop with a character pasted on top.
- It makes a laptop hot. If it drains the battery, people close it.
- Monetization that interrupts: pop-ups, unmutable ads, nag screens.
- A loading screen that feels like a game install.

## 4. Constraints

- Frontend only. Static hosting. No server, no database, no API keys.
- Browser autoplay policy: no sound before the visitor's first click, on
  any source. The entry action is that click.
- Music must be licensed for use on a site that may later carry ads or a
  tip jar (commercial use). Every track carries attribution.
- YouTube is not used as the music source in v1. Its embedded player must be
  visible, at least 200x200 px, and must never be overlapped by anything,
  which conflicts with a 3D room where the girl moves in front of objects.
  The music player is an interface so a YouTube "radio mode" can be added
  later as an alternative source.
- Open source with a private asset tier (owner's decision). The code, the
  scene and interaction definitions, the dialogue, and the render pipeline
  are public. The character model and any purchased assets are private:
  they are never committed and GitHub is not where they live. Music files
  and rendered media are hosted separately (see section 8, "Media
  hosting"). What exactly is opened for customization is decided per asset
  by the owner.

## 5. The experience

### 5.1 Entry

The page loads to a quiet, dim version of the first scene with a single
hinted affordance (a faintly lit curtain edge, a phone glowing on the desk).
There is no "Press to start" button. The visitor clicks the affordance.
Clicking it:

1. Starts music playback immediately at zero volume (inside the click
   handler, so Safari accepts it).
2. Plays the scene's entry animation (curtains open, light floods in, she
   looks up and gives a small greeting).
3. Fades the music in as the animation finishes.

Each scene defines its own entry action, so the first scene shown can vary
by time of day. The entry action must also be reachable by keyboard (Enter
or Space) for accessibility.

### 5.2 The girl

- An art student, roughly nineteen or twenty. Calm, a little dry, never
  cutesy. She is not performing for the visitor; the visitor is in her
  space.
- At the desk she draws on a tablet or in a sketchbook. This gives her hands
  something visible to do in idle loops.
- She has a cat that appears in some scenes.
- Her name is deliberately undecided. It will be chosen once the character
  model and first scene exist. Code and data use a neutral identifier
  (`girl`) and nothing user-visible depends on the name until then.
- Her lines are about: the drawing she is stuck on, the track that is
  playing, the weather outside the window, the hour ("it's past two, you
  know that right?"), the cat, whether the visitor has eaten or stretched.
  She asks questions the visitor cannot answer; that is the point.

### 5.3 Interaction model

- **One click, one response.** Clicking her triggers exactly one scripted
  interaction: an animation clip, a line, or both.
- **Locked while busy.** From the moment an interaction starts until its
  animation has finished, its line has been displayed for its full duration,
  and a short cooldown has passed (my call: two seconds), clicks on her are
  ignored. There is no queue. A subtle cursor change may indicate she is
  busy; nothing louder.
- **Autonomous actions also lock.** When she gets up to make tea on her own,
  she is equally unclickable until she is back and settled.
- **No player control of the scene.** No scene picker, no camera control.
  The only controls are music volume and mute, and the entry click.
- **Clicking elsewhere does nothing in v1.** A cat reaction is a stretch
  goal.

### 5.4 Dialogue

- Displayed as a speech bubble anchored near her head, rendered in the DOM
  over the canvas so text is crisp and selectable. Typewriter reveal.
- Display duration is derived from text length with a floor (my call: three
  seconds minimum, roughly 60 ms per character after that).
- Every line is a data record: id, text, optional audio path, weights, and
  conditions (time-of-day band, scene, whether she is leaving or returning,
  minimum minutes since the same line last played).
- Lines are chosen weighted-random among those whose conditions hold, with
  a no-repeat window so the same line is not heard twice in a session unless
  the pool is exhausted.
- Lines are grouped by trigger:
  - `click`: a reaction to being clicked.
  - `scene-enter`: said shortly after a scene change.
  - `leave` and `return`: said as she gets up, and as she sits back down.
  - `track-change`: occasionally said when a new track starts.
  - `idle`: rare unprompted remarks while she works.
  - `late-night`, `morning`: time-flavored variants of the above.

### 5.5 Scenes

A scene is a place, a time of day, a set of props she can use, and its own
ambient sound layer. Scenes are the unit of content.

Each scene contains:

- A 3D set with baked lighting.
- A camera framing (one fixed camera per scene; a second framing for
  portrait screens is a builder choice).
- An entry action and animation (used only if this is the first scene of a
  visit).
- An idle loop for the girl specific to the scene (drawing at the desk,
  sketching at the café table).
- Three to five click interactions that use the scene's props.
- Two to four autonomous actions on a random schedule.
- One leave/return pair: how she exits the frame and how she comes back.
  While she is away, the scene keeps playing music and ambience and may
  show secondary life (the cat, rain, a train passing).
- Its own dialogue file.

### 5.6 Scheduling (the "director")

- A scene lasts a random duration within a range (my call: 10 to 20
  minutes), then transitions to another scene. Transition is a slow fade
  through black with the music continuing uninterrupted.
- Scene choice is weighted by the visitor's local hour: night scenes are
  more likely at night. The same scene is not chosen twice in a row.
- Within a scene, autonomous actions fire at random intervals (my call: 90
  to 240 seconds between them).
- She leaves the scene roughly once per scene visit, for one to three
  minutes.
- Nothing in the schedule depends on the visitor. Leaving the tab open
  untouched produces a full, varied session.

### 5.7 Music

- A self-hosted playlist of royalty-free lofi tracks, 20 to 30 at launch,
  served as static files from the same host or a CDN.
- Playback is shuffle with no repeats until the playlist is exhausted, then
  reshuffle. Crossfade between tracks.
- A tiny "now playing" element shows track title and artist. A credits page
  lists every track with its license and link.
- Controls: volume slider and mute. Nothing else.
- Candidate sources with commercial-friendly licenses: Pixabay Music
  (Pixabay Content License) and Creative Commons BY tracks on Free Music
  Archive. Commissioned originals can be added later.
- The player is an interface (`play`, `pause`, `next`, `setVolume`,
  `onTrackChange`). The self-hosted implementation is the only one in v1.

### 5.8 Acting, sound, camera, gaze

These are content standards every clip is written against. They come from
how Chill with You's team directed Satone, and they are what separates a
character from a puppet. They cost direction, not technology.

**Acting rules (every animation clip):**

- Eyes move first, then the head, then the body. Never all at once.
- A small pre-beat before any expression: a breath, a glance, a pause,
  then the smile.
- No snapping back to idle. Every clip ends by looking away or down and
  settling into the idle posture over several frames.
- Shoulders and breathing continue during a line. She never freezes while
  text is on screen.
- Hands do something. Fingers are never flat. Idle hands hold the pen,
  rest on the tablet, or curl around the mug.
- Holds are allowed and encouraged. A two-second hold on a good pose reads
  better than continuous motion.

**Foley (every interaction):** each clip carries its own short sound
effect layer, mixed under the music: pen tap, cloth rustle, mug on wood,
chair creak, page turn, the cat's landing. Silence on a physical action is
a bug. Ambience (rain, café murmur) is per scene; foley is per clip.

**Camera direction (every clip):** each clip may use its own framing and a
slow camera move: a gentle push-in when she turns to the viewer, a slight
drift during an idle. Scenes define a home framing that idle loops return
to, so cuts between clips land on the same frame. One signature clip per
scene breaks the fourth wall physically, like her reaching toward the
camera to adjust it.

**Gaze over the session:** she warms up. In the first minutes of a visit,
reactions keep her eyes mostly on her work or glancing sideways. As the
tab stays open, direct looks at the viewer become more frequent and last
longer. This is a per-session curve driven by minutes elapsed; it needs
no account and resets on reload. Clips are tagged with a gaze level so the
director can pick the right variant.

### 5.9 Chrome (page UI)

Minimal and quiet. Bottom corner: now playing, volume, mute. Opposite
corner: a small link cluster for credits, source code, and a tip jar. An
in-scene tip jar on the desk that opens the same link is a stretch goal.
Nothing else on screen.

## 6. Launch content

There is no target date (owner's decision). Work is planned in phases
rather than against a deadline: the playable core with one greybox scene
first, then the bedroom scene with real assets, then the café. Each scene
ships with 4 click interactions, 3 autonomous actions, 1 leave/return
pair, and 40 to 60 dialogue lines.

1. **Bedroom desk, night.** Rain on the window. Desk lamp, tablet, mug, the
   cat on the bed. Entry: open the curtains (reveals city lights and rain).
   Click interactions: she stretches and yawns; sips from the mug; shows
   the tablet toward the camera; turns and says something. Autonomous: the
   cat jumps on the desk and she moves it; she changes a brush and sighs;
   she reaches up and turns the lamp down a notch. Leave: gets up for tea,
   returns with a fresh mug.
2. **Café window, afternoon.** Street outside, people passing (simple
   looping silhouettes), sketchbook and coffee on the table. Entry: pick up
   the ringing phone on the table (she waves at the camera as if on a
   call). Click interactions: she looks out the window and comments; flips
   a sketchbook page; taps the coffee cup; rests her chin on her hand.
   Autonomous: a barista sets down a refill; she watches someone walk past.
   Leave: goes to the counter, comes back with a pastry.
3. **(Stretch) Balcony, sunset.** Plants, string lights, laptop on a small
   table. Entry: switch on the string lights.

## 7. Production: who makes what

The owner decided: Claude produces the character, scenes, animations, and
dialogue, and the owner reviews and comments as the work progresses. This
section says what that means honestly, because an AI agent cannot sculpt
or hand-animate the way an artist can. Everything below is built through
code and iterated on against rendered screenshots and short clips the
owner comments on.

- **Scenes:** built procedurally with Blender's Python API, run headless
  from the command line (Blender is free and will be installed on the
  owner's machine). Aesthetic consequence: stylized low-poly cozy rooms,
  flat colors, baked soft lighting, in the vein of Chill Corner rather than
  hand-painted anime backgrounds. This fits lofi well and is what scripted
  modeling can reach with quality.
- **Animations:** two sources. Generic body motion (sit idle, stretch,
  stand, walk, sip) comes from CC0 clip libraries (Quaternius Universal
  Animation Library and similar), retargeted onto the VRM rig by script.
  Scene-specific prop interactions are keyframed in Blender Python
  (reach for mug, move the cat, turn the lamp). Expect them to be
  serviceable and charming, not studio-grade. Lip movement is a simple
  blendshape pulse while a line displays.
- **Character:** owner's decision: a premade, high-quality anime model
  is bought or licensed, Asian-looking, and customized. Because the model
  stays private, its license needs to allow commercial use on a website
  and modification; redistribution rights are not required. Candidates
  are sourced from BOOTH, VRoid Hub (per-model permissions), and similar
  creator markets; the license is recorded before purchase. Requirements
  for the model: a standard humanoid rig (VRM or Unity-humanoid bone
  names) so animation authored on the placeholder retargets cleanly,
  facial expression shape keys, and clean skinning around eyes and mouth.
  The lofi look still comes from our rendering, not the model's shipped
  shader. Earlier alternatives considered: building her in VRoid Studio
  (fallback if no suitable model is found), Blender Studio's Rain rig
  (not Asian-looking), image-to-3D generation (rough topology, no
  expressions, regional license limits).
- **Placeholder stand-in:** the repo ships a freely licensed stand-in
  model with the same rig and bone names (a VRoid sample or a self-made
  VRoid). Contributors author scenes and animations against the stand-in;
  the owner renders final clips with the real model.
- **Cat:** low-poly, built and animated by script. Simple on purpose.
- **Dialogue:** written by Claude in the persona in section 5.2, reviewed
  by the owner for voice.
- **Music:** selected by Claude from the licensed sources in section 5.7,
  with a credits file; the owner vetoes tracks they do not like.
- **Review loop:** every asset milestone produces a rendered image or a
  short turntable or clip committed under `docs/review/`, and the owner
  comments. Nothing moves to the next scene until the owner is happy with
  the current one.

## 8. Technical approach (owner handed these to me; all are my calls)

**Rendering architecture is an open decision.** Two candidates:

1. *Real-time three.js* (what the rest of this section describes): the
   character and scenes are loaded as glTF and animated in the browser.
   The first spike showed this reads as a figurine even with a lofi
   post-pass.
2. *Pre-rendered clips* (recommended, pending the Blender spike): every
   idle loop and interaction is rendered offline in Blender with toon
   shading and line art, and the web page plays video clips, swapping on
   click and cutting back to idle on a matching frame. Near-zero runtime
   cost, any scene interaction is possible, per-clip camera direction is
   free, and the private character model never leaves the owner's machine.
   The Blender spike's first still already reads as a drawn girl rather
   than a figurine. The cost is download size per scene and no dynamic
   camera.

If option 2 is chosen, the three.js material in this section reduces to a
video player, a click-region map, and the director logic; the Blender
pipeline in section 7 becomes the core of the project.

- **Language and build:** TypeScript, Vite. No UI framework; the DOM UI is
  a handful of elements.
- **Renderer:** three.js.
- **Character:** created in VRoid Studio, exported as VRM, loaded with
  `@pixiv/three-vrm`. VRM gives toon shading, expression blendshapes, and a
  standard humanoid rig.
- **Animation:** body clips from Mixamo retargeted to the VRM rig for
  generic motion (idle, stretch, stand, walk); scene-specific clips authored
  in Blender with the prop animated alongside her (mug, tablet, cat) and
  exported in the scene's glTF. Expressions driven by VRM blendshapes from
  the dialogue data (a line can name an expression).
- **Scenes:** modeled in Blender, exported as glTF with baked lightmaps and
  unlit or toon materials. No real-time shadows.
- **Lofi render pass:** the VRM's MToon materials are replaced with our own
  flat-shaded material (two-tone lighting at most, no specular, no rim
  glow), a muted warm color grade applied as a LUT, a thin soft outline on
  the character, and subtle film grain over the whole frame. Scene and
  character share the same grade so she sits in the room rather than on
  it. This pass is cheap (one full-screen shader) and is the single most
  important thing for the mood; it is validated by a spike before any
  scene art is made.
- **Content as data:** each scene is a folder containing its glTF, its
  dialogue JSON, its ambience audio, and a scene manifest JSON that lists
  entry action, idle clip, click interactions (clip name plus optional
  dialogue group), autonomous actions, leave/return clips, and camera.
  Adding a scene means adding a folder and registering it in one index.
- **Director:** a state machine that owns the session: `loading` →
  `waiting-for-entry` → `entering` → `live` → `transitioning` → `live` …
  Inside `live` the girl has her own machine: `idle` → `interacting` |
  `autonomous` | `leaving` → `away` → `returning` → `idle`. Clicks are
  accepted only in `idle`. All timing decisions live here and are pure
  functions of a seeded random source so they are unit-testable.
- **Picking:** raycast from pointer into the scene; hit test against named
  meshes (the girl's colliders, the entry affordance).
- **Speech bubble:** a DOM element positioned each frame by projecting her
  head bone to screen space.
- **Audio:** HTML `<audio>` for music (streamable, cheap), Web Audio
  `GainNode` for crossfade and ambience mix. First playback is initiated
  synchronously in the entry click handler.
- **Loading:** first scene and the character load before the entry
  affordance appears; other scenes lazy-load in the background after entry.
  Assets are compressed (Draco or Meshopt for geometry, KTX2 or WebP for
  textures).
- **Hosting:** static. Cloudflare Pages for the site (GitHub Pages is an
  acceptable fallback). Both are free at this scale.
- **Media hosting:** music is never committed to the repo. From day one it
  lives in a separate static bucket (Cloudflare R2, free tier is ample) that
  sends CORS headers, because an `<audio>` element from another origin
  routed through a Web Audio gain node is silent without them. The playlist
  file holds absolute URLs. The repo ships one or two CC0 placeholder tracks
  so a fresh clone plays something. Scene glTFs and the VRM are committed
  (they are made in-house and redistributable).
- **Animation clip sourcing:** scene-specific clips are authored in Blender
  and committed. Generic body motion comes from CC0 or in-house sources
  first; Mixamo is allowed for retargeted clips embedded in the project's
  own glTF (Adobe permits use in projects), but raw Mixamo FBX files are
  never committed.
- **Asset contract:** engineering must never wait on art. Day one of the
  build uses a greybox room and the stock VRoid sample avatar, with clip
  names, bone names, prop parenting, and export settings written down as a
  contract the real assets are delivered against.
- **Analytics:** none in v1.

### Performance budget

- Character ≤ 40k triangles, textures ≤ 2048 px.
- Scene ≤ 100k triangles, lightmaps ≤ 2048 px.
- First-scene download (scene + character + first track start) ≤ 15 MB.
- Frame rate capped at 30 fps. Rendering pauses when the tab is hidden;
  audio continues. Device pixel ratio capped at 1.5 and reduced further if
  the frame budget is missed.
- Target: smooth on a 2020 integrated-graphics laptop; usable on a mid-range
  phone.
- Respect `prefers-reduced-motion`: fewer autonomous actions, no camera
  drift.

### Testing

- The director, the girl's state machine, the dialogue picker, the scene
  scheduler, and the playlist are pure logic modules with unit tests
  (Vitest). These are where the "no spam" and "no repeat" guarantees live.
- A browser smoke test (Playwright) loads the page, performs the entry
  click, and asserts that audio is playing and the girl is clickable, then
  that a second click during an interaction is ignored.
- Rendering and animation are verified by eye, not by tests.

## 9. Open source and revenue

- Code license: MIT (my call; owner may override).
- Art assets (character, scenes, dialogue): CC BY-NC-SA 4.0 (my call; owner
  may override). This keeps the character from being lifted into a
  commercial clone while letting people remix and contribute. The repo
  states both licenses clearly.
- Public: code, scene manifests, dialogue, scene `.blend` sources
  (Git LFS), the placeholder stand-in model, the render scripts, and the
  foley and ambience files when their licenses allow.
- Private: the character model, purchased assets, music files, and the
  rendered clips that contain the character (served from the media bucket,
  not the repo). The owner decides per asset what is opened for
  customization.
- Contributing scenes: a contributor adds dialogue lines and scene
  manifest entries with a text editor, and authors new scenes or
  animations in Blender against the placeholder stand-in. A render of
  their contribution with the stand-in is the review artifact; the owner
  renders the final clips with the real model. A one-command reproducible
  export pipeline is post-launch (my call).
- Revenue: a tip jar (Ko-fi, Buy Me a Coffee, or GitHub Sponsors, owner's
  choice) linked from the page. One optional ad slot may be added later in
  the bottom bar; off at launch. No paid tier, ever.

## 10. Left to the builder

- Exact JSON schemas for the scene manifest, dialogue file, and playlist.
- Retargeting pipeline details (Mixamo → VRM), and whether to store clips
  as VRMA or glTF animations.
- Speech bubble styling, typewriter speed, fonts.
- Crossfade and fade-in durations.
- How the busy cursor looks.
- Portrait camera framing.
- Repo layout, CI, deploy pipeline.
- Which specific tracks, subject to the license rule in section 4.

## 11. Open questions for the owner

Answers change what gets built, so these are not builder calls.

None outstanding.

Resolved:

- Who makes the art: Claude, with the owner reviewing (section 7). Nothing
  exists yet.
- Character: a premade model is acceptable because it stays private
  (sections 4, 7, 9). Selecting and buying it is the owner's step.

Still open:

- Rendering architecture: real-time three.js versus pre-rendered Blender
  clips (section 8). Decided after the Blender spike's idle loop is
  reviewed.

- Target date: none. Planned by phases (section 6).
- Name: deferred until the materials exist (section 5.2).
- Art license: CC BY-NC-SA 4.0, my call (section 8).
