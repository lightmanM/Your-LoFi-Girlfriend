# Runnable Stand-ins and README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fresh clone of the public repo runs the balcony page with stand-ins (shared renders, our book and pose, a rebuilt chair and plant cards, Vivi), and the README is the project's front page.

**Architecture:** Each private file is asked for first; a missing one (a 404, or anything that is not the expected file type, since static hosts may answer with the page itself) falls back to its stand-in, described by `web/public/standin/standin.json`. `?standin=1` forces every stand-in so the path can be tested on the owner's machine. The chair and plants are rebuilt at runtime from small committed descriptions (chair panels as numbers, plant cards cut from the shared plant mask).

**Tech Stack:** three.js + @pixiv/three-vrm, `node --test`, Playwright, Python 3 (VRM repack, file checks), ffmpeg (WebP textures).

**Spec:** `docs/superpowers/specs/2026-11-09-runnable-standins-design.md` (approved 2026-11-10).

## Global Constraints

- Never commit: `marycia-web.vrm` or any Marycia file, `chair-visible.glb`, `plants.glb`, `stretch-break.json`, music MP3s, anything under `assets/`. Shared: the eight `.webp` layers, `scene.json`, `book.glb`, the reading pose, stand-in files.
- The owner's files always win; with them present the page is unchanged (existing suites green on the owner's machine).
- Terms for the shared renders and the README screenshot, verbatim: *© the project owner; included so this project runs; you may use them to run and develop this project, not reuse them elsewhere or redistribute them separately; not covered by the MIT licence.*
- Contact for the full resources: **lightman.miao@gmail.com**. Live site: **https://yourlofigirl.com**. Host: **Cloudflare Pages**.
- Vivi: pixiv VRoid beta AvatarSample_2, CC0 (record kept with the file); compressed to ≤ 6 MB.
- Do not commit unless the owner asks; never deploy.

## Review Focus

1. Only some private files present (e.g. the owner's checkout without `plants.glb`) → each file falls back on its own. Test in Task 2.
2. A static host answering a missing file with the page itself (HTTP 200, `text/html`) → still treated as missing; stand-ins load. Test in Task 2.
3. Vivi is a VRM 0.x model → her smile, blink and five mouth shapes still work through three-vrm's preset names. Test in Task 5.
4. A phone-sized screen with Vivi → she stays in frame and clickable. Test in Task 5.
5. A stand-in file that fails to load → the existing "could not load" message, not a hang. Test in Task 2.

---

### Task 1: Vivi, compressed, with her licence record

**Files:**
- Create: `scripts/standins/compress_vivi.py`, `scripts/standins/test_standins.py`, `web/public/standin/vivi.vrm`, `web/public/standin/CREDITS.md`
- **Interfaces — Produces:** `web/public/standin/vivi.vrm` (VRM 0.x, WebP textures via `EXT_texture_webp`), `CREDITS.md` (author pixiv Inc. / VRoid Project, CC0 1.0, the official licence URL, SHA-256 of the original file).
- [ ] **Step 1: Failing test** `test_vivi_standin_is_small_and_whole`: the file exists, ≤ 6 MB, is glTF binary with a `VRM` extension, every image is `image/webp`, mesh and skin counts equal the original's (original taken from git: `git show e150a8b:web/public/models/vivi/vivi.vrm`, skipped when unavailable).
- [ ] **Step 2: Run** `python3 -m unittest discover -s scripts/standins -p 'test_*.py'`. Expected: FAIL (no file).
- [ ] **Step 3: Implement** `compress_vivi.py <in.vrm> <out.vrm>`: extract each image, encode WebP with ffmpeg (quality 85, longest side ≤ 2048), then call `scripts/marycia/repack_vrm.py`.
- [ ] **Step 4: Run** the test. Expected: PASS; report the size.

### Task 2: Stand-in fallback, the shared files, and `?standin=1`

**Files:**
- Create: `web/src/standin/resolve.js`, `web/public/standin/standin.json`, `web/public/standin/reading-balcony.json` (copy of the owner's pose), `web/tests/resolve.test.js`, `web/tests/standin.spec.js`
- Modify: `web/src/viewer/main.js` (`load()` uses the resolver; hook `lofiViewer.standin()`), `.gitignore` (commit the shared balcony files, keep the private ones out), `web/public/environment/balcony-toon/scene.json` (pose path → `/standin/reading-balcony.json`; drop the unused `occluder` and `authored` keys)
- **Interfaces — Produces:**
  - `isFile(response, kind:'glb'|'json') -> Promise<boolean>`: ok status **and** the right content (glTF magic `glTF` / JSON that parses to an object), never `text/html`.
  - `resolveAssets(scene, standin, {probe:(url,kind)=>Promise<boolean>, force:boolean}) -> Promise<{vrm, pose, chair:{standin:boolean,url}, plants:{standin:boolean,url}, character:{hips,yaw_deg,scale}, book:{offset:[x,y,z]}, using:string[]}>` (`using` lists the stand-ins in use).
  - `standin.json`: `{vrm:'/standin/vivi.vrm', pose:'/standin/reading-balcony.json', character:{hips,yaw_deg,scale}, poseFix:{}, book:{offset:[0,0,0]}, chair:'/standin/chair.json'}` (fit values come in Task 5).
  - `lofiViewer.standin() -> {using:string[]}`.
- [ ] **Step 1: Failing tests:** unit `each missing file falls back on its own` (probe false only for the plants → `using` = `['plants']`), `force uses every stand-in`, `an HTML page answered for a missing file counts as missing` (Review Focus 2), `owner files present → no stand-ins`; browser `?standin=1` loads with Vivi (`standin().using` includes `character`), no page errors; `a stand-in that fails to load shows the could-not-load message` (route `/standin/vivi.vrm` to abort; Review Focus 5); `a host answering missing files with the page itself still runs` (route the private VRM to 200 `text/html`).
- [ ] **Step 2: Run** `cd web && node --test tests/resolve.test.js` and `PORT=5174 npx playwright test tests/standin.spec.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the resolver and wiring; chair and plants keep their private files until Tasks 3–4 (their stand-in flags are reported but not yet used).
- [ ] **Step 4: Run** the unit tests, the new spec, and `tests/viewer.spec.js` (owner path unchanged). Expected: PASS; `git status` shows the webp layers, `scene.json`, `book.glb` and the pose added, and no private file.

### Task 3: The stand-in chair

**Files:**
- Create: `web/src/standin/chair.js`, `scripts/standins/fit_chair.mjs`, `web/public/standin/chair.json`, `web/tests/standin-chair.test.js`
- Modify: `web/src/balcony/visible-chair.js` (export the existing panel fit as `chairPanels(root) -> {seat:{corners:[[x,y,z]×4],thickness}, back:{…}}`), `web/src/viewer/main.js` (dev hook `lofiViewer.chairPanels()`; load the stand-in chair when `chair.standin`)
- **Interfaces — Produces:** `standinChair(spec) -> THREE.Group` with a mesh named `Chair weave panel` (the seat, as `seat.js` expects) and a back panel, in world space; `chair.json` = `chairPanels()` measured once from the owner's chair by `fit_chair.mjs` (Playwright against the dev server).
- [ ] **Step 1: Failing tests:** unit `the stand-in chair has the seat seat.js looks for` (a mesh named `Chair weave panel`; its top within 1 mm of the spec's seat top; two panels); browser (in `standin.spec.js`) `on the stand-in chair she is seated` (`?standin=1`: `lofiViewer.seat().drop` between 0 and 0.15 m; `contactRadii` defined).
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement**; run `node scripts/standins/fit_chair.mjs` on this machine to write `chair.json` (numbers only).
- [ ] **Step 4: Run** the tests. Expected: PASS; the owner path still uses `chair-visible.glb` (viewer suite green).

### Task 4: Plant cards from the plant mask

**Files:**
- Create: `web/src/standin/plant-cards.js`, `web/tests/plant-cards.test.js`
- Modify: `web/src/viewer/main.js` (when `plants.standin`, build cards instead of loading `plants.glb`)
- **Interfaces — Produces:** `cardsFromMask({width,height,data}, channel:number, {step=4, minArea=60}) -> {x0,y0,x1,y1}[]` (pure: connected regions of one mask channel on a coarse grid, in pixels); `plantCards(maskImage, coverImage, camera, depthRange) -> THREE.Group` (one subdivided card per region, named `ivy:card-N` / `roses:card-N` / `pots:card-N` for `livePlants`, placed at the depth the cover map gives at the region's base, at rest covering exactly its region on screen).
- [ ] **Step 1: Failing tests:** unit `two separate blobs make two cards`, `regions smaller than minArea are dropped`, `a card covers its region on screen at rest` (project the four corners with a test camera: within 1 px); browser `with plant cards the plants sway` (`?standin=1`: the live plants group has cards for ivy, roses and pots; a hook `lofiViewer.plants()` reports their count and a bend angle that changes over 2 s).
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** (channels as `PLANTS3D`: G ivy, B roses, A pots).
- [ ] **Step 4: Run** the tests. Expected: PASS; owner path unchanged.

### Task 5: Fit Vivi

**Files:**
- Modify: `web/public/standin/standin.json` (placement, `poseFix`, `book.offset`), `web/src/viewer/main.js` (apply `poseFix` and `book.offset` when using the stand-in)
- Test: `web/tests/standin.spec.js` (fit checks)
- **Interfaces — Consumes:** Task 2's resolver output; `lofiViewer.grips()/hands()/seat()/chatPoint()`, `chat()`, `greeting`/`voice()` gaze reports.
- [ ] **Step 1: Failing tests** (`?standin=1`): `her hands hold the book` (each hand within 4 cm of its grip, sampled over 10 s of reading and a page turn); `no hand inside the book` (wrist points outside the book's box shrunk by 1 cm); `her face reaches the camera when she looks up` (greeting gaze miss ≤ 5°); `her face works` (Review Focus 3: during a light click-to-talk line `smile` > .3 and some mouth shape > .3); `on a phone she stays in frame and clickable` (Review Focus 4: 390×844, `chatPoint()` inside the viewport, a click starts a conversation); `her break runs and she reads on`.
- [ ] **Step 2: Run** them. Expected: FAIL (untuned).
- [ ] **Step 3: Tune** `standin.json` (scale and hips to her proportions on the chair, book offset to her hands, small `poseFix` turns) until the tests pass; screenshot each round for a visual check (no hands through the book, nothing through the chair).
- [ ] **Step 4: Run** `tests/standin.spec.js` and the viewer suite. Expected: PASS.

### Task 6: No music, quietly

**Files:**
- Modify: `web/src/music/player.js`, `web/src/hud/music-line.js` (or `format.js`)
- Test: `web/tests/music.spec.js`
- **Interfaces — Produces:** player status `unavailable` when the playlist loads but its first track is missing (HEAD or a failed load); taps then do not retry; the HUD music line reads `no music in this copy` and its controls stay folded.
- [ ] **Step 1: Failing test** `with no tracks the music stays quiet`: route every `/music/*.mp3` to 404; after start `music().status === 'unavailable'` within 10 s, the HUD line shows the text, three more taps make no new `/music/` requests.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `tests/music.spec.js` and `tests/hud.spec.js`. Expected: PASS.

### Task 7: The suites on a clone

**Files:**
- Modify: every browser spec's scene check (`sceneReady` and the like) to also require the owner's VRM (`/models/marycia/marycia-web.vrm` is a glTF binary), so Marycia-tuned suites skip on a clone
- Create: `scripts/standins/clone_check.sh`
- **Interfaces — Produces:** `clone_check.sh`: clones this commit into a scratch folder, `npm ci`, `npm test`, `npm run build`, runs `tests/standin.spec.js` against the clone's dev server, and runs the full browser suite there (expected: stand-in suite passes, Marycia suites skip).
- [ ] **Step 1: Run** `clone_check.sh` before the change. Expected: the Marycia suites FAIL on the clone (they run against Vivi).
- [ ] **Step 2: Change** the checks.
- [ ] **Step 3: Run** `clone_check.sh` again. Expected: stand-in suite PASS, the rest skip; and on this checkout every suite still PASSES.

### Task 8: README, credits, licence, deploy notes

**Files:**
- Create: `scripts/standins/screenshot.mjs`, `.github/readme/screenshot.jpg` (≤ 400 KB, 1600×900, the real scene with Marycia mid-greeting with subtitles)
- Modify: `README.md`, `CREDITS.md`, `LICENSE` (the not-covered note names the shared renders), `web/public/environment/CREDITS.md`, `web/README.md` (Deploy section → Cloudflare Pages)
- [ ] **Step 1: Write the README** to the spec's outline: what it is + screenshot + https://yourlofigirl.com; features; quick start (Node 22.12+, `cd web && npm ci && npm run dev`, what you will see); stand-ins table (shared / rebuilt / replaced, why) and contact lightman.miao@gmail.com; deploy on Cloudflare Pages (Git-connected build: root `web`, build `npm run build`, output `dist`, `NODE_VERSION=22` → the stand-in version; the full site: build locally then `npx wrangler pages deploy web/dist`; check `public/` first); contributing areas with pointers (character replacement via `standin.json`, motion `web/src/balcony/`, voice lines `scripts/voice/` + VOICEVOX terms, Blender scripts `scripts/balcony-*`, multi-scene support via `scene.json`, music `scripts/music/`, accessibility, performance; tests to run); layout; credits and licence (terms verbatim).
- [ ] **Step 2: Check:** every relative link in the READMEs resolves to a tracked file (a small script in `clone_check.sh`); the screenshot exists and is ≤ 400 KB; `git ls-files` contains none of the never-commit files.
- [ ] **Step 3: Final run:** `npm test`, generator and stand-in Python tests, `npm run build`, the full browser suite here, and `clone_check.sh`. Expected: all pass. Then ask the owner whether to commit and push.
