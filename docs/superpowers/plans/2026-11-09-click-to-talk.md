# Click to Talk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking Marycia while she quietly reads starts a short conversation: usually a warm line, about one time in three a caring question with 2–3 answer pills and a reply to the pick.

**Architecture:** New lines (`ask`, `reply`, `notice`, `letgo`) are written into `scripts/voice/lines.json` and voiced by the existing generator. Pure decisions (which conversation, when she is clickable) live in `web/src/voice/chat-plan.js`; `chat.js` drives one conversation (look up once, say lines in turn, show pills, reply or let go, ease back); `answers.js` draws the pills; `reach.js` finds her under the pointer and `glow.js` lights her faintly. `main.js` only wires them, as it does small talk.

**Tech Stack:** three.js + @pixiv/three-vrm, Web Audio (existing `speech.js`), plain DOM/CSS, `node --test`, Playwright, Python 3 `unittest` for the generator, VOICEVOX engine (owner's app on localhost:50021).

**Spec:** `docs/superpowers/specs/2026-11-09-click-to-talk-design.md` (approved 2026-11-09). Its tables are the source for every line, answer label, mood and face rule.

## Global Constraints

- Voice: VOICEVOX 冥鳴ひまり, query settings of the small-talk lines: `{"speedScale":0.78,"volumeScale":1.0,"intonationScale":1.15,"prePhonemeLength":0.05,"postPhonemeLength":0.2}`; sentence pauses lengthened as today (`SENTENCE_PAUSE`).
- Audio stays WAV in `web/public/voice/`; only what a conversation needs is downloaded (question at the click; its replies and one let-go line while she asks).
- Front end only; nothing is sent anywhere; answers are not stored (only which lines were heard, in `localStorage`).
- Works with mouse, touch and keyboard (pills), and on a 390×844 screen.
- Existing test hooks keep working; existing suites stay green: `cd web && npm test`, `cd web && PORT=5174 npx playwright test`, `python3 -m unittest discover -s scripts/voice -p 'test_*.py'`, `cd web && npm run build`.
- Code style of the surrounding files (compact, commented with why); new modules small and focused.
- Owner rule: **do not commit** unless the owner asks; record task ends in the ledger. Never deploy.
- Public repo: no private files (character, balcony, music) staged; nothing under `docs/` but text.

## Review Focus

1. Two clicks in the same moment (double click, a tap that also fires a click) → exactly one conversation. Test in Task 6.
2. The question's audio fails or is slow → she still speaks (late audio waits, it never starts part-way through a question), and a failed clip ends the conversation with her back on her book within the stuck backstop. Test in Task 5.
3. The phone rotates or the window resizes while pills are up → pills stay on screen, and on a narrow screen the subtitle stays hidden. Test in Task 5.
4. The pointer over her during a conversation, her break or small talk → no hand cursor, no glow. Test in Task 6.
5. `localStorage` blocked or holding junk → conversations still work and still avoid repeats within the visit. Test in Task 3.

---

### Task 1: Generator knows the new line kinds and can voice only new lines

**Files:**
- Modify: `scripts/voice/generate_lines.py` (`KINDS`, `check_line`, `generate`'s copied fields, `main`)
- Test: `scripts/voice/test_generate_lines.py`

**Interfaces:**
- Produces: line kinds `ask` (`mood` ∈ {light, dark}, `answers`: 2–3 items `{"label":{"ja","en"},"reply":"<id>"}`), `reply` (`of`: the ask id, `mood` ∈ {light, soft}), `notice`, `letgo`; `check_links(lines: list[dict]) -> None` (every answer's reply exists, is `kind: reply` and has `of` = that ask; every reply is used by exactly one answer); CLI flag `--new` (voice only lines with no entry in the existing `lines.json` index or no WAV, keeping the others as `--only` does). Generated entries carry `answers` and `of` alongside `to/about/mood`.

- [ ] **Step 1: Write the failing tests**: `test_check_line_accepts_click_kinds` (an ask with mood dark, a reply with mood soft, a notice, a letgo all pass); `test_check_line_rejects_bad_click_lines` (ask with 1 or 4 answers, reply with mood dark, ask answer without `label.en` → `SystemExit`); `test_check_links_rejects_missing_or_foreign_reply` (reply id absent; reply whose `of` names another ask; a reply no answer uses); `test_new_keeps_voiced_lines_and_lists_the_rest` (given an index with ids a, b and a manifest a, b, c where b's WAV is missing: to voice = [b, c], kept = {a}).
- [ ] **Step 2: Run** `python3 -m unittest discover -s scripts/voice -p 'test_*.py'`. Expected: the four new tests FAIL (unknown kind / missing function).
- [ ] **Step 3: Implement** the kinds, `check_links` (called from `main` after `check_line` on every line), the copied fields (`answers`, `of`), and `--new` via a helper `to_voice(manifest_ids: list[str], index: dict[str, dict], out: Path) -> tuple[list[str], dict[str, dict]]`.
- [ ] **Step 4: Run** the same command. Expected: all pass (30 + 4).

### Task 2: The lines

**Files:**
- Modify: `scripts/voice/lines.json`
- Test: `scripts/voice/test_generate_lines.py` (`ClickLinesManifest`)

**Interfaces:**
- Produces ids: asks `q-meal, q-shoulders, q-laugh, q-sleep, q-day, q-mind, q-stay, q-lonely, q-like-yourself, q-set-down, q-childhood` (spec #1–#11 in order); replies `<ask id>-a|b|c` in answer order (e.g. `q-meal-b` = まだ → 少しでいいから…); notices `notice-01`…`notice-20` (spec order); let-go `letgo-1`…`letgo-3`.
- Mood: asks marked *soft-heavy* in the spec (#3, #6, #8, #9, #10) → `"mood":"dark"`, others `"light"`; replies listed in the spec's face rule ("softer, smaller smile") → `"mood":"soft"`, others `"light"`.

- [ ] **Step 1: Write the failing test** `test_click_lines_are_complete`: load the manifest; assert 11 `ask`, 27 `reply`, 20 `notice`, 3 `letgo`; `check_links` passes; every ask has 2–3 answers; asks with mood dark are exactly the five ids above; the soft replies are exactly `q-laugh-b, q-sleep-b, q-sleep-c, q-day-c, q-mind-a, q-lonely-b, q-like-yourself-b, q-like-yourself-c, q-set-down-a, q-set-down-b, q-set-down-c`; no `subtitle.ja` contains a `？` in a notice or let-go line (they never ask).
- [ ] **Step 2: Run** it. Expected: FAIL (0 asks).
- [ ] **Step 3: Add the 61 lines**, copying text, subtitles and answer labels verbatim from the spec. `text` = the Japanese line; `subtitle` in parts (`ja` and `en` lists) split at each 。 for lines with more than one sentence, as the talk lines do; answer labels `{"ja":"食べたよ","en":"I did"}`; every line gets the Global Constraints `query`.
- [ ] **Step 4: Run** the Python tests. Expected: all pass.

### Task 3: Deciding a conversation (pure)

**Files:**
- Create: `web/src/voice/chat-plan.js`
- Test: `web/tests/chat-plan.test.js`

**Interfaces:**
- Consumes: `pickNext(lines,{heard,last,random})` from `talk-plan.js` (its "never two dark in a row" rule gives "never two heavy questions in a row").
- Produces:
  - `CHAT = {ask:1/3, wait:15, cooldown:20, answersAfter:.2, soft:.35, hold:90, key:'lofi-girlfriend.chat.heard'}` (s; `soft`: the gentler smile weight, against `TALK.smile` .7; `hold`: the attend hold, cancelled when the conversation ends).
  - `pickChat(lines, memory, random) -> {kind:'ask'|'notice', id:string|null, memory}`: `lines` are line objects (with `kind`, `mood`); ask when `random() < CHAT.ask` and the last conversation was not an ask; otherwise notice; each pool keeps its own round (`memory = {asks:{heard,last}, notices:{heard,last}, lastKind}`), returned as a new object.
  - `canStart({ready, started, greeting, talking, chatting, busy, frozen, since}) -> boolean` (`since`: s since the last conversation ended; false while any flag is set, while `!ready || !started`, or while `since < CHAT.cooldown`).
  - `loadChat(storage) -> memory`, `saveChat(storage, memory)` (same tolerance as `loadHeard`/`saveHeard`); `forgetChat(memory, id) -> memory` (a question not completed is unheard again).
- [ ] **Step 1: Write the failing tests**: mix ≈ 1/3 over 3000 seeded picks (within 0.30–0.36); never two asks in a row; no repeat within a pool until all are heard; never two dark asks in a row; `canStart` false for each flag alone and for `since` 19.9, true at 20; `loadChat` with throwing storage, junk JSON and missing keys returns a fresh memory; `forgetChat` removes only that id; `pickChat` never mutates its inputs.
- [ ] **Step 2: Run** `cd web && node --test tests/chat-plan.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `chat-plan.js` with the signatures above.
- [ ] **Step 4: Run** `cd web && npm test`. Expected: all pass.

### Task 4: Small talk steps aside for a conversation

**Files:**
- Modify: `web/src/voice/small-talk.js` (`update(dt,{greeting,chatting})`)
- Test: `web/tests/talk.test.js`

**Interfaces:**
- Produces: `smallTalk.update(dt,{greeting=false,chatting=false})`: while `chatting` no line starts; when `chatting` turns false a fresh wait (`nextDelay`) starts, as after the greeting.
- [ ] **Step 1: Write the failing test** `chatting holds small talk and restarts its wait`: with a fake voice/reader (as the file's existing tests build them) and `every:[10,10]`, advance 9 s, set chatting for 5 s, clear it, advance 9.9 s → no line; advance 0.2 s more → a line starts.
- [ ] **Step 2: Run** `cd web && node --test tests/talk.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** by treating `greeting||chatting` as the hold the greeting already uses.
- [ ] **Step 4: Run** `cd web && npm test`. Expected: all pass.

### Task 5: One conversation, its pills and the wiring

**Files:**
- Create: `web/src/voice/chat.js`, `web/src/voice/answers.js`, `web/src/voice/answers.css`
- Modify: `web/src/voice/subtitles.css` (class `.subtitles.lifted` raises it by the pills' row height on wide screens), `web/src/viewer/main.js` (create the chat after the reader exists, call `chat.update(dt)` in `frame` after `talkFrame`, pass `chatting` to small talk, include chat speaking in `soundFrame`'s music dip, hooks)
- Test: `web/tests/chat.spec.js`

**Interfaces:**
- Consumes: `CHAT`, `pickChat`, `loadChat/saveChat/forgetChat` (Task 3); `voice.say/prefetch/line/ids/unlock`; `reader.attend/cancelAttend/talking/reading.holdReading`; `mouthKeys/mouthShape`, `applyFace`, `talkingHead/applyHead`, `subtitleAt`, `TALK`, `GREET.tilt`.
- Produces:
  - `mountAnswers(parent=document.body) -> {show(answers:[{ja,en}], onPick:(i)=>void), hide(), visible():boolean, labels():string[], unmount()}`: buttons (Tab, Enter/Space), clicks stop propagation, fade in/out (the picked pill stays highlighted while they fade); on `(max-width:600px)` they sit where the subtitle sits.
  - `createChat({voice, reader, vrm, subtitles, answers, target, store, random, now, narrow:()=>boolean, wait=CHAT.wait}) -> {start({ask?,notice?}?):boolean, pick(i):boolean, update(dt):void, active():boolean, speaking():boolean, endedAt():number, stop():void, state():object}`.
  - Sequence in `start`: choose (or the asked id); `voice.prefetch` it; `reader.attend({at:target, hold:CHAT.hold, ease:TALK.ease, tilt:GREET.tilt})`; `reader.talking=true`, `reading.holdReading(true)`; say the question once its audio has arrived and her look has eased in (never earlier than `TALK.ease` after the click); prefetch its replies and one let-go line; pills show `CHAT.answersAfter` s after the line ends (narrow: the subtitle is hidden as they show; wide: the subtitle gets `lifted`); a pick hides them and says the reply; no pick within `wait` s → hide and say a let-go line; after the last line `TALK.linger` s, then `cancelAttend()`, release the reader, clear face and subtitle. Face: ask light / notice / letgo / reply light → smile `TALK.smile`; ask dark → calm (relaxed .5, no smile); reply soft → smile `CHAT.soft`. Head presence and mouth as `talk.js` does while a line plays.
  - Ends early (quietly, pills removed, question `forgetChat`-ed) when `document.hidden` turns true or a line's clock stalls past `TALK.stuck`.
  - Hooks: `?chat=0` (no conversations), `?ask=<id>` / `?notice=<id>` (the first conversation), `?chatwait=<s>`, `?chatcool=<s>`; `lofiViewer.chat()` (state: `active, phase ('look'|'ask'|'answers'|'reply'|'letgo'|'done'), line, kind, answers, subtitle, smile, since`), `lofiViewer.poke(o)` (= `chat.start(o)` gated by `canStart`), `lofiViewer.answer(i)`.
- [ ] **Step 1: Write the failing browser tests** (each with `?intro=0&greet=0&talkevery=600&music=0` unless stated): `a question waits for its answer and replies to the pick` (`poke({ask:'q-meal'})`: pills hidden while `phase==='ask'`; then 3 pills with labels 食べたよ/まだ/お菓子だけ; `answer(1)` → subtitle shows 少しでいいから、何か食べてきて。; then `active` false, reader not attending); `a notice is just her line` (`poke({notice:'notice-05'})`, no pills ever, ends); `no answer lets it go gently` (`?chatwait=2`, a let-go subtitle, then done); `a dark question is asked without a smile and a soft reply smiles gently` (`q-mind`: smile 0 while asking; pick `ある` → max smile ≈ `CHAT.soft` ±.05); `keyboard picks an answer` (Tab to the first pill, Enter → reply); `on a phone the pills replace the subtitle and stay clear of the book` (390×844: subtitle hidden while pills visible; pill boxes do not intersect the book's screen box from a hook `lofiViewer.bookRect()`); `rotating with pills up keeps them on screen` (Review Focus 3: resize to 844×390 and back; pills inside the viewport, subtitle still hidden when narrow); `a failed question clip still ends with her back on her book` (Review Focus 2: route the question WAV to abort; within `TALK.stuck` + line length she is reading, pills never stuck on screen); `a hidden tab ends it quietly and the question stays unheard`; `she answers with the music paused` (`?music` on, paused → `poke` works).
- [ ] **Step 2: Run** `cd web && PORT=5174 npx playwright test tests/chat.spec.js`. Expected: FAIL (no `poke`).
- [ ] **Step 3: Implement** `answers.js/css`, `chat.js`, the `subtitles.css` class, the `main.js` wiring and hooks, and `bookRect()`.
- [ ] **Step 4: Run** `cd web && PORT=5174 npx playwright test tests/chat.spec.js tests/talk.spec.js tests/greeting.spec.js tests/viewer.spec.js` and `npm test`. Expected: all pass.

### Task 6: Clicking her, the hand cursor and the glow

**Files:**
- Create: `web/src/voice/reach.js`, `web/src/voice/glow.js`
- Modify: `web/src/viewer/main.js` (bind on the canvas; gate with `canStart`)
- Test: `web/tests/chat.spec.js` (more)

**Interfaces:**
- Consumes: `canStart` (Task 3), `chat.start`, `chat.active/endedAt` (Task 5).
- Produces:
  - `createReach({dom, camera, objects:()=>THREE.Object3D[]}) -> {hit(clientX, clientY):boolean, dispose()}`: a ray against her meshes and the book, at most once per animation frame for hover.
  - `setGlow(vrm, amount:number)`: 0..1, a very faint warm emissive lift on her materials (restores their own emissive at 0); eased by the caller over ~.25 s.
  - Behaviour: pointer over her while `canStart` → `cursor:pointer` on the canvas and glow up; otherwise default cursor, glow down. A `click` on her while `canStart` → `voice.unlock()`, `chat.start()`. Hooks: `lofiViewer.chat().glow`, `lofiViewer.chatPoint()` (screen x, y of her chest, for real clicks in tests).
- [ ] **Step 1: Write the failing browser tests**: `the pointer turns to a hand over her and not over the balcony` (mouse to `chatPoint()` → canvas cursor `pointer`, glow rises above 0; mouse to (60, 300) → `auto`, glow back to 0); `clicking her starts a conversation` (real `page.mouse.click` at `chatPoint()`); `she is not clickable while busy` (during the greeting with `?greet=1&line=okaeri`, during `lofiViewer.talk('basil')`, during her break with `?stretch=1`, and for `?chatcool=3` seconds after a conversation: cursor `auto`, click starts nothing) (Review Focus 4 includes the pointer over her during a conversation: cursor `auto`, glow 0); `a double click starts one conversation` (Review Focus 1: `dblclick` at `chatPoint()` → one conversation, `since` resets once).
- [ ] **Step 2: Run** `cd web && PORT=5174 npx playwright test tests/chat.spec.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** `reach.js`, `glow.js` and the canvas wiring.
- [ ] **Step 4: Run** the full suites from Global Constraints. Expected: all pass.

### Task 7: Voice the lines and document

**Files:**
- Create: 61 WAVs in `web/public/voice/` (generated)
- Modify: `web/public/voice/lines.json`, `web/public/voice/CREDITS.md` (generated), `web/README.md` (behaviour and hooks), `README.md` (one line), the spec's status line
- [ ] **Step 1: Check the engine:** `curl -s localhost:50021/version`. Expected: a version string. If not running, stop and ask the owner to open the VOICEVOX app.
- [ ] **Step 2: Voice:** `python3 scripts/voice/generate_lines.py --new`. Expected: 61 lines voiced, the 37 existing entries unchanged (`git diff --stat web/public/voice/*.wav` shows no modified existing WAV).
- [ ] **Step 3: Listen-check by test:** run Task 5's and Task 6's browser tests against the real clips (they were written against them). Expected: all pass; spot-check three lines in the page (`?ask=q-set-down`, `?notice=notice-14`, `?chatwait=2`).
- [ ] **Step 4: Docs:** web README paragraph (what clicking does, the 1-in-3 mix, the hooks), top README one line, spec status "built 2026-11-xx".
- [ ] **Step 5: Final run** of every suite in Global Constraints. Expected: all pass. Then ask the owner whether to commit.

### Task 8: Subtle motion variety (added 2026-11-09, owner approved)

**Files:**
- Modify: `web/src/voice/chat-plan.js` (`CHAT.motion`, `chatMotion`), `web/src/voice/chat.js` (offsets per frame, delayed look for "eyes first"), `web/src/viewer/main.js` (hook option `motion`)
- Test: `web/tests/chat-plan.test.js`, `web/tests/chat.spec.js`

**Interfaces:**
- Produces: `CHAT.motion = {tilt:4, tiltEase:.8, nod:2, nodTime:.6, lids:.45, slowEase:1.6, closeEyes:.5}` (degrees of head roll / pitch, s, lid weight); `chatMotion(line, {last, random}) -> 'look'|'midway'|'tilt'` (asks, replies, let-go: `look`; notices: one of the three, never `last` when another is allowed, `midway` only when `line.duration >= TALK.short`); `chat.start({ask?, notice?, motion?})`; state gains `motion` and `head: {roll, pitch}` (the conversation's own offsets) and `lids`.
- [ ] **Step 1: Write the failing tests**: unit `notices vary how she looks up` (no repeats of `last`, `midway` never for a short line, asks always `look`); browser `while she waits her head tilts a little, and she nods when you pick` (answers phase: |head.roll| ≥ 3 after 1 s; within .8 s of the pick head.pitch > 1; back under .3 when she lingers), `a reply to a harder answer lowers her eyes for a moment` (q-mind → ある: lids > .3 during the first sentence, < .05 by its end), `eyes first: she starts toward her book and looks up partway` (`poke({notice:'notice-19',motion:'midway'})`: away < .3 at her first word, > .7 later in the line), `with a tilt` (`motion:'tilt'`: |head.roll| ≥ 3 while speaking).
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** in `chat-plan.js` and `chat.js` (offsets applied with `applyHead` after the reader; lids through `reader.lids`, released at the end).
- [ ] **Step 4: Run** every suite in Global Constraints. Expected: all pass.

