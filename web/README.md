# Balcony scene (web)

One page: Marycia reading on a sunny balcony, like a video that never repeats. No controls, fixed camera. She reads
(eyes along the lines, page turns, look-ups, small posture shifts) and takes a short break every 4 to 8 minutes (book
down on her lap, two slow shoulder rolls, her head tilted to each side with her eyes closed, book back up). Every 5
to 15 minutes she stretches instead: book down on her lap, hands off it, both arms up over her head with her back
arched and her eyes shut, a small lean to each side, arms down, book back up (about 12 s). The two never run
together or within a minute of each other. The palm, roses, potted plants, ivy and the near leaves move in one wind.

## Run

From this directory, with Node 22.12+:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173/. Test hooks (not visible to visitors): `?seed=N`, `?stretch=<seconds>` (her calm break), `?reach=<seconds>` (her overhead stretch), `?tuck=<seconds>` (her hair tuck), `?nod=<seconds>` (her nod to the music), `?beat=<bpm>` (a steady beat without music), `?welcome=0`, `?away=<seconds>` (how long an absence gets a welcome back), `?nap=<seconds>` (her first nap; `?nap=0` turns naps off), `?napfor=<seconds>` (how long she sleeps), `?napwalk=0` (she goes to the daybed and back by a cut instead of walking), `?still=<seconds>`,
`?wind=0`, `?plantgain=<n>`, `?seat=0`, `?music=0`, `?musicstall=<seconds>`, `?hud=0`, `?intro=0`, `?greet=0`, `?line=<id>`, `?talk=0`, `?talkevery=<seconds>`,
`?chat=0`, `?ask=<id>`, `?notice=<id>`, `?chatwait=<seconds>`, `?chatcool=<seconds>`, `?standin=1`;
`window.lofiViewer` reports state (`greeting()` this visit's line, `voice()` the greeting as it plays, `greet()` starts
it, `hush()` stops it, `smallTalk()` her small talk, `talk(id?,{motion?})` says a line now, `chat()` a conversation's state, `poke({ask|notice}?)` starts one as a
click on her would, `answer(i)` picks an answer, `hold(true)` freezes her for close inspection).

The page opens out of focus with a "start" button. Pressing it (or Enter) pulls the camera into focus over about 3
seconds. Part-way through, the camera display powers on with a soft synthesised beep and an exposure flash: corners,
"rec", counter and music line wake one after another; the controls show for a couple of seconds, then fold. As the picture settles she looks up from her book at the camera, smiles and greets
you, with her mouth on the voice and subtitles in Japanese and English; then she goes back to reading. Each visit she
says one of five greetings at random, never the same as last visit (remembered in the browser; `?line=<id>` picks one):
`okaeri` おかえりなさい, `otsukare` おかえり。今日もおつかれさま, `kitekureta` あ、来てくれたんだ。うれしいな, `iitokoro`
おかえり。ちょうど、いいところだったの, `yukkuri` いらっしゃい。ゆっくりしていってね. Only that line's audio is downloaded.

While she reads, she now and then says something, every 1 to 2 minutes at random: to you (she looks up at the camera,
sometimes only partway through the line) or to herself (softer, with a murmur subtitle, her eyes on
the page, a glance aside, a look up into space, a small tilt or half-closed eyes). 32 lines: her small days on the
balcony, quiet thoughts, the philosophy book she is reading, and a few dark ones that sometimes turn back to calm. No
line repeats until she has said them all (remembered in the browser), and never two dark lines in a row. She waits for
anything else she is doing (the greeting, her break, a page turn, a glance) and skips when the tab is hidden, the music
is paused or sound is not yet allowed. To check it without waiting, open `?talkevery=20` (a line every 20 s); `?talk=0`
turns it off. The music dips a little while she speaks, and her voice follows the volume control and mute. Design:
[small talk](../docs/superpowers/specs/2026-11-08-small-talk-design.md).

Click her while she quietly reads and she talks with you (click to talk). The pointer turns to a hand over her and she
glows very faintly; she is not clickable while she greets, talks, turns a page, looks up, takes her break or stretches, or for 3 s
after a conversation. About two clicks in three she just says something warm (20 lines); about one in three she asks
how you are (11 questions), and two or three answers appear as soft pills under her words once she has finished (on a
phone they take the subtitle's place; held sideways, they stand at the left, clear of her and the book). Pick one (click, tap, or Tab and Enter) and she replies to it (27 replies); if
no answer comes within 15 s she lets it go gently. Never two questions in a row, never two heavier ones one after the
other, no repeats until each set has been heard (remembered in the browser; answers are not stored or sent anywhere).
Her next small talk waits a fresh while after a conversation. `?ask=q-meal` or `?notice=notice-05` picks the first
one, `?chatwait=2` and `?chatcool=3` shorten the waits, `?chat=0` turns it off. Design:
[click to talk](../docs/superpowers/specs/2026-11-09-click-to-talk-design.md).

The music
rises in behind it (`?intro=0` skips this; then the first click or tap
starts the music). The frame is light: corner marks, a blinking "rec", a counter since start, and the music line bottom-left ("tap for music", then level bars and "song · artist"). Moving the mouse,
tapping or pressing a key unfolds pause, next, mute, volume and the playlist (pick a track to play it; ⓘ opens its source page) for 3
seconds. Space plays or pauses, N skips, M mutes; phones and media keys also get the browser's own controls.

A fresh clone runs with stand-ins (top-level README): the shared balcony renders and `scene.json`, our book and reading
pose, and in `public/standin/` Vivi (CC0), a two-panel chair (`chair.json`, measured by
`scripts/standins/fit_chair.mjs`) and plant cards cut at runtime from the plant mask (`src/standin/`). The full site
also has local, git-ignored files: `public/models/marycia/marycia-web.vrm` and the scene's
`public/environment/balcony-toon/chair-visible.glb` and `plants.glb` (exported from the Balcony scene with
`scripts/balcony-web/` and `scripts/balcony-toon/export_plants.py`). Each missing one falls back to its stand-in;
`?standin=1` forces all of them.

Her voice lives in `public/voice/`: `lines.json` (each line's subtitle, mora timing and loudness), the WAV clips and
`CREDITS.md`, all tracked. Each line is a start greeting or small talk (`kind`; small talk also has `to`, `about`,
`mood`, and long lines subtitle `parts`). The voice is VOICEVOX's 冥鳴ひまり (free to use, credit "VOICEVOX:冥鳴ひまり" required). To
change or add a line, edit `scripts/voice/lines.json` and, with the VOICEVOX app running, run
`python3 scripts/voice/generate_lines.py` (`--only <id>` for one line).

Music lives in `public/music/`. `playlist.json` (track, duration, licence, loudness gain) and `CREDITS.md` are
tracked; the MP3s are git-ignored and rebuilt from the downloads in `assets/music/` with
`python3 scripts/music/prepare_music.py`. Licences are recorded in `scripts/music/tracks.json`; CC BY-ND tracks must
be credited and played unedited (no trims, loops or baked-in mixes, and no recording them into videos).

## Structure

- `index.html`, `src/viewer/`: the page, the picture layers and wind (`wind.js`), the live 3D plants (`plants.js`),
  her colour grade (`grade.js`).
- `src/balcony/`: her motion: reading and book grip (`reading.js`, `page-turn.js`), her calm break from reading
  (`unwind.js`), her overhead stretch (`overhead-stretch.js`, its timing curves in `tracks.js`), when the two happen
  (`breaks.js`, pure), arm and leg IK (`arm-ik.js`), seating on the chair (`seat.js`, `visible-chair.js`), all driven
  by `reader.js`.
- `src/music/`: background music: `player.js` (two audio decks through Web Audio: shuffle without repeats, 6 s
  equal-power crossfades, per-track loudness gain, preloading, skipping broken or stalled tracks, Media Session),
  `playlist.js` and `fades.js` (pure logic), `controls.js` (the stand-in keys and tap-to-start).
- `src/intro/`: the opening shot (blur, start button, focus pull) and the power-on beep (`beep.js`, Web Audio).
- `src/hud/`: the camera-frame overlay: `camera-frame.js` (corners, rec, counter), `music-line.js` (music line,
  controls, credits), `format.js` (pure helpers), `hud.css`, mounted by `hud.js`. Font: DM Mono (OFL, self-hosted).
- `src/voice/`: her voice and greeting: `speech.js` (plays lines through Web Audio and reports the position heard, so the
  mouth follows the sound), `lipsync.js` (mora timing to the five VRM vowel shapes, pure), `greeting-plan.js` (when she
  looks up, speaks, smiles and nods, pure), `greeting.js` (drives her head, face and the subtitle), `pick-line.js` (this
  visit's greeting, pure), `talk-plan.js` (small talk: when, which line, which motion, which subtitle part, pure),
  `talk.js` (one line with its motion), `small-talk.js` (the schedule), `face.js`, `gaze-report.js`, `level.js` (her
  volume against the music controls, pure), `subtitles.js`; click to talk: `chat-plan.js` (when she can be clicked, which
  conversation, pure), `chat.js` (one conversation), `answers.js` (the answer pills), `reach.js` (is she under the
  pointer), `glow.js` (her faint glow). `src/balcony/head-aim.js` aims her face at you and keeps
  her head from looking tilted as she looks at you (pure); `look-ease.js` the soft ease of every look away from the
  book (pure); `eye-range.js` widens her eye range for a moment.
- `src/companion/life.js` (breathing and idle life), `source-motion.js` (curve sampling).

Design notes: [docs/design/viewer](../docs/design/viewer/README.md), [reading motion](../docs/design/reading-motion/README.md).

## Verify

```sh
npm test
npm run test:browser
npm run build
python3 -m unittest discover -s ../scripts/voice -p 'test_*.py'
python3 -m unittest discover -s ../scripts/standins -p 'test_*.py'
python3 -m unittest discover -s ../scripts/balcony-stretch -p 'test_*.py'
../scripts/standins/clone_check.sh   # everything as a fresh clone would run it (no private files)
```

The browser suites that need the owner's character or the music skip when those files are missing
(`tests/owner-files.js`); `tests/standin.spec.js` covers the stand-in path everywhere.

## Deploy

`npm run build` writes a static site to `dist/`. Everything in `public/` is copied into it, so check `public/` first
and only publish what you may.

On **Cloudflare Pages**: connecting the Git repository builds the stand-in version (root directory `web`, build
command `npm ci && npm run build`, output `dist`, `NODE_VERSION=22`). The full site is built where the private files
are and uploaded directly: `npm run build && npx wrangler pages deploy dist --project-name <project>`. Never commit
`dist/` or the private files.
