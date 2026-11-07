# Balcony scene (web)

One page: Marycia reading on a sunny balcony, like a video that never repeats. No controls, fixed camera. She reads
(eyes along the lines, page turns, look-ups, small posture shifts) and takes a stretch break every 4 to 8 minutes; the
palm, roses, potted plants, ivy and the near leaves move in one wind.

## Run

From this directory, with Node 22.12+:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173/. Test hooks (not visible to visitors): `?seed=N`, `?stretch=<seconds>`, `?still=<seconds>`,
`?wind=0`, `?plantgain=<n>`, `?seat=0`, `?music=0`, `?musicstall=<seconds>`; `window.lofiViewer` reports state.

Music starts on the first click or tap (browsers block sound before a gesture). Until the player UI is designed
nothing is drawn: Space plays or pauses, N skips, M mutes; phones and media keys get the browser's own controls.

The page needs local, git-ignored files that are never committed: `public/models/marycia/` (`marycia-web.vrm`,
`reading-balcony.json`, `stretch-break.json`) and `public/environment/balcony-toon/` (rendered from the Balcony scene
with `spike/balcony-toon/render_web_plate.py`, `wind_fields.py` and `export_plants.py`).

Music lives in `public/music/`. `playlist.json` (track, duration, licence, loudness gain) and `CREDITS.md` are
tracked; the MP3s are git-ignored and rebuilt from the downloads in `assets/music/` with
`python3 scripts/music/prepare_music.py`. Licences are recorded in `scripts/music/tracks.json`; CC BY-ND tracks must
be credited and played unedited (no trims, loops or baked-in mixes, and no recording them into videos).

## Structure

- `index.html`, `src/viewer/`: the page, the picture layers and wind (`wind.js`), the live 3D plants (`plants.js`),
  her colour grade (`grade.js`).
- `src/balcony/`: her motion: reading and book grip (`reading.js`, `page-turn.js`), the stretch clip
  (`clip-player.js`), arm and leg IK (`arm-ik.js`), shoulders and torso (`body-coupling.js`), seating on the chair
  (`seat.js`, `visible-chair.js`), all driven by `reader.js`.
- `src/music/`: background music: `player.js` (two audio decks through Web Audio: shuffle without repeats, 6 s
  equal-power crossfades, per-track loudness gain, preloading, skipping broken or stalled tracks, Media Session),
  `playlist.js` and `fades.js` (pure logic), `controls.js` (the stand-in keys and tap-to-start).
- `src/companion/life.js` (breathing and idle life), `source-motion.js` (curve sampling).

Design notes: [docs/design/viewer](../docs/design/viewer/README.md), [reading motion](../docs/design/reading-motion/README.md).

## Verify

```sh
npm test
npm run test:browser
npm run build
```

The build (`dist/`) contains the purchased character and the unlicensed scene files: keep it local, do not deploy it.
