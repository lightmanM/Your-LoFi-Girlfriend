# Small Talk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While she reads, she says one of 32 pre-generated lines every 5 to 10 minutes, to the visitor or to herself,
with varied subtle motion, lip sync, subtitles, a music dip and volume/mute that follow the music controls.

**Architecture:** Lines are written in `scripts/voice/lines.json` and generated with VOICEVOX into
`web/public/voice/` (extended with kind, addressee, mood and subtitle parts). Pure modules decide timing, order, motion,
loudness and subtitle part (`talk-plan.js`, `level.js`); a runner (`talk.js`) plays one line with one motion through the
reader's new motion hooks; a scheduler (`small-talk.js`) decides when, and `main.js` wires it like the greeting.

**Tech Stack:** plain ES modules, three.js + @pixiv/three-vrm, Web Audio, Python 3 (generator), node --test,
Playwright (channel chrome), VOICEVOX engine 0.26.1 at 127.0.0.1:50021.

**Spec:** `docs/superpowers/specs/2026-11-08-small-talk-design.md` (read it with this plan; the line tables live there).

## Global Constraints

- Voice: VOICEVOX 冥鳴ひまり ノーマル (id 14); credit "VOICEVOX:冥鳴ひまり" stays in `web/public/voice/CREDITS.md`.
- Lines to you: speedScale 0.85, volumeScale 1.0; lines to herself: speedScale 0.82, volumeScale 0.75. Both:
  intonationScale 1.15, prePhonemeLength 0.05, postPhonemeLength 0.2.
- Audio stays WAV (first sample = start of the clip; lip sync depends on it). Only the line about to be said is fetched.
- Timing: a random wait of 300 to 600 s before each line; a 3 s breath after anything she was busy with.
- Subtle motion: apart from looks at the camera, head turns at most 15°; motions ease in and out over about 1 s
  (0.9 s); hands and book do not move.
- Never: two dark lines in a row; a line repeating before all 32 have played (remembered in `localStorage`).
- Music dip about −6 dB (gain ×0.5) eased over 0.4 s; voice level = music volume / 0.7, capped at 1; muted or volume 0
  → voice silent, subtitles and mouth continue.
- Commits only when the owner asks: every task ends in a checkpoint (all tests green), not a commit.
- Run browser tests against this worktree's server: `PORT=5175 npx playwright test …` from `web/` (port 5173 is
  another checkout).

## Review Focus

1. **A stretch, page turn or random glance starting partway through a line.** She must finish the line first. → Task 5
   (reader `talking` blocks the stretch; `holdReading` freezes page turns and glances), test in Task 7.
2. **The tab hidden or the music paused partway through a line.** The line finishes normally and the next one is
   scheduled; nothing sticks (subtitle on, reading held). → test in Task 7.
3. **Stale or corrupt memory in `localStorage`** (ids no longer in the manifest, bad JSON, storage blocked). → ignored,
   fresh round; unit tests in Task 3.
4. **A line falling due during the greeting** (e.g. `?talkevery=1`). → waits for the greeting to end plus the breath;
   test in Task 7.
5. **Volume or mute changed partway through a line or the greeting.** → voice level follows within about 0.2 s; test in
   Task 4.

---

### Task 1: Manifest and generator: kinds, subtitle parts, the 32 lines

**Files:**
- Modify: `scripts/voice/generate_lines.py`, `scripts/voice/test_generate_lines.py`, `scripts/voice/lines.json`
- Modify: `web/src/voice/speech.js` (`ids(filter)`), `web/src/viewer/main.js` (greetings only),
  `web/tests/speech.test.js`, `web/tests/greeting.spec.js` (ids = greeting lines)
- Generated: `web/public/voice/` (37 WAVs, `lines.json`, `CREDITS.md`)

**Interfaces:**
- Produces (web index, every line): existing fields plus `kind: 'greeting'|'talk'`; talk lines also
  `to: 'you'|'self'`, `about: 'life'|'thought'|'book'`, `mood: 'light'|'dark'`; split lines
  `parts: [{ja, en, start}]` (start: s into the audio) with `subtitle: {ja, en}` the joined whole.
- Produces: `voice.ids(filter?: (line) => boolean): string[]`.

- [ ] **Step 1: Write failing Python tests** in `test_generate_lines.py`:
  `test_check_line_accepts_greeting_and_talk`, `test_check_line_rejects_unknown_values` (SystemExit naming the line id
  and field), `test_split_subtitle_joins_and_returns_parts` (`{"ja":["あ。","い"],"en":["A.","B."]}` →
  `({"ja":"あ。い","en":"A. B."}, [{"ja":"あ。","en":"A."},{"ja":"い","en":"B."}])`; a plain `{ja,en}` → parts `None`),
  `test_split_subtitle_rejects_mismatched_parts`, `test_part_starts` (moras `ア 、(pau) イ ウ` with counts `[1,2]` →
  `[start of ア, start of イ]`), `test_part_starts_rejects_count_mismatch`.
- [ ] **Step 2:** `python3 -m unittest test_generate_lines` (in `scripts/voice/`) → the new tests fail.
- [ ] **Step 3: Implement** in `generate_lines.py`: `check_line(line: dict) -> None`,
  `split_subtitle(subtitle: dict) -> tuple[dict, list[dict] | None]` (ja joined with `""`, en with `" "`),
  `spoken_count(moras: list[dict]) -> int` (moras whose vowel is not `pau`),
  `part_starts(moras: list[dict], counts: list[int]) -> list[float]` (part k starts at the first spoken mora after
  `sum(counts[:k])` spoken moras; SystemExit if `sum(counts) != spoken_count(moras)`). In `generate()`: call
  `check_line`; for split lines query each Japanese part's text with `/audio_query` to get its spoken count, attach
  `parts` with `start`; copy `kind`, `to`, `about`, `mood` into the index.
- [ ] **Step 4:** tests pass (all generator tests).
- [ ] **Step 5: Write the manifest:** add `"kind": "greeting"` to the 5 greetings; add the 32 talk lines from the spec's
  tables (ids, Japanese, English, `to`, `about`, `mood`), with the per-addressee `query` from Global Constraints. Split
  subtitles (arrays, Japanese part 1 ends with its `。`, English split after the first sentence) for exactly: basil,
  sparrows, train, river, short-life, woods, enough, last-thing, forgotten, afternoon, stone.
- [ ] **Step 6: Generate:** with VOICEVOX running, `python3 scripts/voice/generate_lines.py` → 37 lines printed, no
  duration mismatch. Check: `web/public/voice/lines.json` has 5 `greeting` + 32 `talk`, 16 `you`, 16 `self`, 7 `dark`,
  11 with `parts` whose second `start` lies inside the audio.
- [ ] **Step 7: Greetings only:** failing test in `speech.test.js` (`ids(l=>l.id==='a')` → `['a']`); implement
  `ids(filter)`; in `main.js` pick from `voice.ids(l=>l.kind==='greeting')` (also in the unknown-`?line=` warning); in
  `greeting.spec.js` compare `g.ids` with the greeting lines of `LINES`, and loop the per-line greeting test over
  greeting lines only.
- [ ] **Step 8: Checkpoint:** `node --test tests/*.test.js`, `PORT=5175 npx playwright test tests/greeting.spec.js`,
  generator tests → all pass.

### Task 2: Owner listening checkpoint

**Files:** `scripts/voice/lines.json` (only if the owner asks for changes), regenerated `web/public/voice/`.

- [ ] **Step 1:** Send the owner the 32 talk WAVs (SendUserFile), grouped: to you light, to you dark, to herself light,
  to herself dark; ask them to flag any line that sounds unnatural, the murmur level/speed (0.82, 0.75), and the
  `ふふ` in useless-tree.
- [ ] **Step 2:** Continue with Tasks 3 to 6 meanwhile; **do not start Task 7 until the owner has answered.**
- [ ] **Step 3:** Apply their answers in the manifest (drop words, change a line's `query`), regenerate only the
  changed lines (`--only <id>`), rerun the generator tests.

### Task 3: Talk plan (pure): when, which line, which motion, which subtitle part

**Files:**
- Create: `web/src/voice/talk-plan.js`, `web/tests/talk-plan.test.js`

**Interfaces:**
- Produces:
  - `TALK` (frozen): `{every:[300,600], breath:3, prefetch:20, short:4.5, linger:1, ease:.9, subtitleLead:.1,
    key:'lofi-girlfriend.talk.heard', aside:{yaw:-14,pitch:-4}, up:{yaw:5,pitch:-9}, tilt:{roll:6},
    lids:{weight:.5,from:.2,to:.8}, eyes:{share:.4}, smile:.7, nod:1.8}`
  - `nextDelay(random=Math.random, every=TALK.every): number`
  - `pickNext(lines: {id,mood}[], {heard=[], last=null, random=Math.random}): {id: string|null, heard: string[]}`
  - `pickMotion(line: {to,about,mood,duration}, {last=null, random=Math.random}): string` — to herself:
    `'page'|'aside'|'up'|'tilt'|'lids'`; to you: `'look'|'midway'|'eyes'`
  - `talkPlan(line, motion, o=TALK): {speak:number, look:number|null, end:number}` (s from the start of the talk)
  - `subtitleAt(line, t: number, lead=TALK.subtitleLead): {ja,en}` (t: s into the audio)
  - `loadHeard(storage): {heard:string[], last:string|null}`, `saveHeard(storage, {heard,last}): void`

- [ ] **Step 1: Write failing tests** (use a seeded LCG for `random`):
  - `nextDelay` always in [300, 600]; `every` override `[2,2]` → 2.
  - `pickNext`: over 20 consecutive rounds of the 32 spec lines (7 dark), every round contains each id exactly once
    and no two dark ids are ever adjacent, including across round boundaries; resumes from a given `heard`
    (never returns a heard id until all are heard); ignores ids in `heard`/`last` that are not in `lines`;
    `[]` → `{id:null}`; returns a new `heard` array (input not mutated).
  - `pickMotion`: to-herself light never `'lids'`; dark can be `'lids'`; to-you lines ≥ 4.5 s never `'eyes'`, < 4.5 s
    never `'midway'`; never equals `last` when another motion is allowed; over 600 picks a book line to herself gets
    `'page'` more than any other motion and a thought line gets `'up'` more than `'tilt'`.
  - `talkPlan`: `look` is `null` for to-herself motions; `'look'` and `'eyes'` → `look` = 0 and `speak` = `ease`
    (0.9); `'midway'` → `speak` = 0.3, `look` = `speak + parts[1].start - ease` for split lines, otherwise
    `speak + duration/3 - ease`; `end` = `speak + duration + linger + ease`.
  - `subtitleAt`: no parts → the whole subtitle; with parts → part 1 before `parts[1].start - lead`, part 2 from then.
  - `loadHeard`: missing, bad JSON, throwing storage → `{heard:[], last:null}`; round-trips with `saveHeard`;
    `saveHeard` on throwing storage does not throw.
- [ ] **Step 2:** `node --test tests/talk-plan.test.js` → fails (module missing).
- [ ] **Step 3: Implement** `talk-plan.js`. `pickNext` algorithm (the tests do not fully fix it):
  ```
  known = ids of lines; heard = heard ∩ known; last = last ∈ known ? last : null
  left = lines not in heard; if left is empty: heard = [], left = lines minus last
  D = dark in left, L = light in left, lastDark = last is dark
  if lastDark: candidates = light in left (if none: light lines of the whole set minus last)
  elif D > 0 and D >= L + 1: candidates = dark in left     // otherwise a later dark pair is unavoidable
  else: candidates = left
  id = candidates[floor(random() * len)]; return {id, heard: [...heard, id]}
  ```
  `pickMotion` weights: to herself `page` 3 if book else 1, `aside` 1, `up` 2 if thought else 1, `tilt` 1, `lids` 1 if
  dark else 0; to you `look` 2, `midway` 1 if duration ≥ `short`, `eyes` 1 if duration < `short`; drop `last`
  when something else remains; weighted random.
- [ ] **Step 4:** tests pass. **Checkpoint:** `node --test tests/*.test.js` green.

### Task 4: Sound: music dip, voice level following volume and mute

**Files:**
- Create: `web/src/voice/level.js`, `web/tests/level.test.js`
- Modify: `web/src/music/player.js`, `web/src/voice/speech.js`, `web/src/viewer/main.js`, `web/tests/speech.test.js`,
  `web/tests/music.spec.js`, `web/tests/greeting.spec.js`

**Interfaces:**
- Produces: `voiceLevel(music: {volume:number, muted:boolean}|null, base=MUSIC.volume): number`;
  `music.duck(on: boolean): void` and `music.state().ducked`, `music.state().level` (current target gain);
  `voice.setLevel(level: number): void` and `voice.state().level`.

- [ ] **Step 1: Failing tests:** `level.test.js`: null → 1; `{volume:.7,muted:false}` → 1; `.35` → .5; `1` → 1;
  `0` → 0; muted → 0. `speech.test.js`: `setLevel(.4)` before any audio context does not throw and
  `state().level === .4`. `music.spec.js`: after the music plays, `duck(true)` → `state().ducked` true and
  `state().level` = volume × 0.5; `duck(false)` → back to volume; muted → level 0 either way.
- [ ] **Step 2:** run → fail.
- [ ] **Step 3: Implement:** `MUSIC.duck=.5`, `MUSIC.duckFade=.4`; `audible()` = `muted ? 0 : volume*(ducked?duck:1)`;
  `duck(on)` ramps the master gain with `toLevel` over `duckFade` when playing; `state()` adds `ducked`, `level`.
  `level.js` exports `voiceLevel`. `speech.js`: `VOICE.levelFade=.15`; `setLevel` stores the level and, if the context
  exists, ramps `out.gain` to it; a new context starts at the stored level. `main.js`, every frame (after the greeting
  update): `voice?.setLevel(voiceLevel(music?.state()??null))` when the value changed, and
  `music?.duck(speaking)` when `speaking` (greeting `speech==='speaking'`; Task 7 adds small talk) changed.
- [ ] **Step 4: Browser test** in `greeting.spec.js` (Review Focus 5): during a greeting with music on, the music is
  ducked while she speaks and not after; pressing `m` mid-line sets `lofiViewer.greeting().level` to 0 within 0.3 s
  while the subtitle stays on.
- [ ] **Step 5:** tests pass. **Checkpoint:** `node --test tests/*.test.js`, `PORT=5175 npx playwright test` green.

### Task 5: Reader motion hooks: hold reading, glance, wider eyes, lids, talking

**Files:**
- Create: `web/src/balcony/eye-range.js`, `web/tests/eye-range.test.js`
- Modify: `web/src/balcony/reading.js`, `web/src/balcony/reader.js`, `web/src/viewer/main.js` (test hooks),
  `web/tests/viewer.spec.js`

**Interfaces:**
- Produces on `ReadingMotion`:
  - `holdReading(on: boolean): void` — while on, the reading schedule is frozen (shift `lineStart`, `lineEnd`,
    `pageHold`, `events` by `dt` as the `pause` branch does, but **not** `lookUp.start`, and without raising `away`),
    so no line progress, page turn, random glance or settle starts; eyes rest where they are.
  - `glance({yaw, pitch, roll=0, hold, ease=.9, eyes='away'}): void` — a look-up with no gaze point: head by
    yaw/pitch/roll (degrees, + yaw = her left); `eyes:'page'` keeps the gaze on the page.
  - `lookUpAt(...)` gains `aim=false` (exact head aim only when true) and `widen=false`.
- Produces on `Reader`: `attend({at, hold, ease, tilt, share=1})` (share < 1: yaw/pitch × share, `aim:false`,
  `widen:true`; share 1: as today with `aim:true`); `lids: number` (0..1, joins the blink max); `talking: boolean`
  (no stretch starts while true); `busy(): boolean` (stretch active, page turn, any look-up, or a pending attend).
- Produces: `widenEyes(applier, k: number, wide=EYES.wide): void` with `EYES.wide={inputMaxValue:20,outputScale:20}`;
  rest values captured per applier on first call (WeakMap), lerped by `k`; `k=0` restores them exactly.

- [ ] **Step 1: Failing tests:** `eye-range.test.js` with a fake applier (four maps at `{inputMaxValue:90,
  outputScale:10}`): k=1 → all `{20,20}`; k=.5 → halfway; k=0 after k=1 → exactly `{90,10}`; a missing applier does not
  throw. `viewer.spec.js`: `lofiViewer.glance({yaw:-14,pitch:-4,hold:1})` → `lofiViewer.reader().busy` true, the
  reported head yaw moves by ≤ 15°, and she is back on the book (`away < .05`) within 4 s; with
  `lofiViewer.talking(true)` and `?stretch=1`, no stretch starts for 3 s, then one starts after `talking(false)`.
- [ ] **Step 2:** run → fail.
- [ ] **Step 3: Implement** as in Interfaces. `headRoll` adds `(lookUp.roll??0)*away` for look-ups without a tilt
  limit. `aimHead` runs only when `lookUp.aim`. When `lookUp.widen`, call `widenEyes(vrm.lookAt?.applier, away)` each
  frame, and `widenEyes(…, 0)` once after it ends. Reader blink: `Math.max(pose.blink, r0.blink(), st.face(...),
  this.lids)`. Test hooks in `main.js`: `glance:o=>state.reader?.reading.glance(o)`,
  `talking:on=>{if(state.reader)state.reader.talking=!!on;}`, and `busy` in `lofiViewer.reader()`.
- [ ] **Step 4:** tests pass; the greeting tests still pass (attend keeps `aim:true`).
  **Checkpoint:** `node --test tests/*.test.js`, `PORT=5175 npx playwright test` green.

### Task 6: Face and subtitles for small talk

**Files:**
- Create: `web/src/voice/face.js`, `web/src/voice/gaze-report.js`, `web/tests/face.test.js`
- Modify: `web/src/voice/greeting.js` (use `applyFace` and `gazeReport`), `web/src/voice/subtitles.js`,
  `web/src/voice/subtitles.css`

**Interfaces:**
- Produces: `FACE` (moved from `greeting.js`, unchanged values) and
  `applyFace(em, {smile=0, relaxed=0, mouth}, o=FACE): void` — visemes from `mouth`, `happy = smile*o.happy*
  (1-o.talkingEase*open)`, `relaxed` as given (the greeting passes `smile*FACE.relaxed`).
- Produces: `subtitles.set(visible, subtitle, {murmur=false}={})` — toggles class `murmur` on the root.
- Produces: `gazeReport(vrm, target): {lean: number|null, aim: {face:{yaw,pitch}, eyes:{asked,turned,type}}|null}` —
  greeting.js's `lean()` and `aim()` moved unchanged, so the greeting and small talk report gaze the same way.

- [ ] **Step 1: Failing tests:** `face.test.js` with a fake `em` recording `setValue`: mouth weights pass through;
  `happy` falls as the mouth opens (open mouth 0.6 → happy × 0.3); `em` null does nothing.
- [ ] **Step 2:** run → fail. **Step 3:** implement; `greeting.js` calls `applyFace(em,{smile, relaxed:
  smile*FACE.relaxed, mouth})`. CSS: `.subtitles.murmur .ja{font-size:.82em;opacity:.72}`,
  `.subtitles.murmur .en{opacity:.6}` (relative to the current sizes).
- [ ] **Step 4:** tests pass; greeting tests unchanged and green. **Checkpoint.**

### Task 7: Small talk: one line with its motion, the scheduler, wiring

Starts only after the owner answered Task 2.

**Files:**
- Create: `web/src/voice/talk.js`, `web/src/voice/small-talk.js`, `web/tests/talk.spec.js`
- Modify: `web/src/viewer/main.js`

**Interfaces:**
- Consumes: Task 1 index fields, Task 3 `TALK`/`pickNext`/`pickMotion`/`talkPlan`/`subtitleAt`/`loadHeard`/
  `saveHeard`, Task 4 `music.duck`, Task 5 reader hooks, Task 6 `applyFace` and murmur subtitles, `voice.say`,
  `voice.prefetch`, `mouthKeys`/`mouthShape`, `screenTilt`/`aimTurn` (for reporting).
- Produces: `startTalk({reader, vrm, voice, line, motion, target, subtitles, random}) → {update(): boolean, stop():
  void, state(): object}` and `createSmallTalk({voice, reader, vrm, subtitles, target, music, store, random, every})
  → {update(dt: number, {greeting: boolean}): void, say(id?: string, {motion?: string}): boolean, state(): object,
  dispose(): void}`.

- [ ] **Step 1: Failing browser tests** in `talk.spec.js` (`?intro=0&music=0` unless stated; trigger lines with
  `lofiViewer.talk(id,{motion})`, read `lofiViewer.smallTalk()`, which reports `{line, motion, to, speech, t, clip,
  subtitle, murmur, text, mouth, away, lean, aim, head, lids, next, skipped, heard}`):
  1. `river` with `look`: faces the camera (aim miss ≤ 3°) while speaking, non-murmur subtitle shows part 1 then part
     2 at `parts[1].start - 0.1` (±1 frame), back on the book after.
  2. `river` with `midway`: aim miss > 20° before `look`, ≤ 3° from `look + ease` to the end of the line.
  3. `seasons` with `eyes`: head yaw ≤ 45% of the full-look yaw for the same moment; the eyes' turned angle ≥ 80% of
     the asked angle (wide eyes) while looking, and the range maps back at rest after.
  4. `wind` with `aside`: murmur subtitle; aim miss > 20°; head turns toward the daybed side of the picture, ≤ 15°;
     reading resumes after. `warmth` with `tilt`: |lean| changes by 4° to 8°. `pages` with `lids`: `lids` ≥ .4 in the
     middle of the line, 0 after.
  5. Scheduler with `?talkevery=2`: a line starts within 3 s; with `document.hidden` forced true it is skipped with
     `skipped:'hidden'` and rescheduled; music paused (`?music` on, paused) → `skipped:'paused'`; before any click (no
     unlocked audio) → `skipped:'locked'`.
  6. Review Focus 1 and 4: `?talkevery=1` with the intro → no line before the greeting has finished + 3 s; a stretch
     due mid-line (`?stretch=<s>`) waits until the line ends.
  7. Review Focus 2: hide the tab mid-line → the line finishes, subtitle off, reading resumes, `next` set.
  8. Memory: say three lines, reload → `heard` still holds them and the next line is not one of them.
  9. Every talk line plays through (one test per line, looped over the talk lines of `public/voice/lines.json`, as the
     greeting's per-line tests do, motion `page` for lines to herself and `look` for lines to you): its subtitle (whole
     or both parts) shows, the mouth opens, and the mouth stays shut through the middle of each pause.
- [ ] **Step 2:** run → fail.
- [ ] **Step 3: Implement `talk.js`** (one line): at start `reader.talking=true`, `reader.reading.holdReading(true)`,
  `speech = voice.say(line.id, {delay: plan.speak})`; clock = `speech.time() + plan.speak`. Per motion:
  `look` → `reader.attend({at:target, hold, ease, tilt:GREET.tilt})` at `plan.look`; `midway` → same at `plan.look`;
  `eyes` → same with `share: TALK.eyes.share`; `aside` → `reading.glance({...TALK.aside, hold, ease, eyes:'away'})`;
  `up` → `glance({yaw: ±TALK.up.yaw (random sign), pitch: TALK.up.pitch, ...})`; `tilt` → `glance({yaw:0, pitch:0,
  roll: ±TALK.tilt.roll, eyes:'page'})`; `page` → hold only; `lids` → hold, `reader.lids` = `TALK.lids.weight` eased
  over the `from`..`to` share of the line. `hold` = from the motion's start to `speak + duration + linger`. Face:
  to-you light → `applyFace({smile: s*TALK.smile, relaxed: s*FACE.relaxed, mouth})` with `s` timed as the greeting's
  smile (`s` rises over `GREET.smile.rise` from `GREET.smile.lead` before `speak` and falls over `GREET.smile.fall`
  after the linger), plus a `TALK.nod`-degree nod over the end of the line (as the greeting's, smaller); to-you dark and all to-herself → `smile 0, relaxed .5`. Subtitle:
  `subtitles.set(on, subtitleAt(line, clip), {murmur: line.to==='self'})` from `speak - subtitleLead` to the end of
  the audio. End: release everything set (lids 0, holdReading false, talking false, cancelAttend if attended,
  subtitle off, face neutral).
  **Check the aside sign with a frame capture**: her face must turn toward the daybed side (left of the picture); flip
  `TALK.aside.yaw` if it turns toward the curtain.
- [ ] **Step 4: Implement `small-talk.js`** (scheduler): `memory = loadHeard(store)` once at creation and kept in the
  page (so blocked storage still gives a full round per visit); `next` = now + `nextDelay`; `prefetch` s before `next`
  pick the line (`pickNext` with `memory`, update `memory`, then `saveHeard(store, memory)`) and `voice.prefetch` it; at `next`: if
  `greeting || reader.busy() || active` → wait until free for `TALK.breath` s; then skip and reschedule when
  `document.hidden` (`'hidden'`), music paused (`'paused'`), or `voice.state().context !== 'running'` (`'locked'`);
  else `startTalk` with `pickMotion(line, {last: lastMotion})`. A skipped line stays unheard (remove it from `heard`).
  `say(id, {motion})` starts a line now if not active (test hook).
- [ ] **Step 5: Wire `main.js`:** created when `voice` exists and `?talk!=='0'`; `?talkevery=<s>` → `every:[s,s]`;
  `target: camera.position`; `store` as for the greeting; `update` after `greetingFrame()` with
  `{greeting: !!state.greeting && !state.greetingDone()}`; first `pointerdown`/`keydown` on the page calls
  `voice.unlock()`; `speaking` for the music dip includes small talk; hooks `talk:(id,o)=>smallTalk?.say(id,o)`,
  `smallTalk:()=>smallTalk?.state()??null`; dispose on HMR.
- [ ] **Step 6:** tests pass. **Checkpoint:** all suites green.

### Task 8: Docs, frames for the owner, full verification and review

**Files:** `web/README.md`, `README.md`.

- [ ] **Step 1:** README: small talk (what she does, how often, `?talk=0`, `?talkevery=<s>`, `lofiViewer.talk()`,
  `lofiViewer.smallTalk()`), the music dip and volume/mute rule, new modules in the structure list.
- [ ] **Step 2:** Frame captures (scratch script like the greeting's `inspect.mjs`) of each motion mid-line; send to the
  owner.
- [ ] **Step 3:** Run everything: `node --test tests/*.test.js`, `PORT=5175 npx playwright test`, generator and music
  Python tests, `npm run build` → all green.
- [ ] **Step 4:** Code review (fresh reviewer on the whole change); fix critical and high findings; rerun everything.
