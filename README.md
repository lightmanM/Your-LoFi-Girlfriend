# Your LoFi Girlfriend

A lofi web page that plays like a video that never repeats: Marycia reads on a sunny balcony in a toon afternoon look,
the plants move in the wind, and the music plays on. She turns pages, looks up, and every 4 to 8 minutes rests from her
book (shoulder rolls, a head tilt each way with her eyes closed). When you press start she looks up and greets you
with one of five lines, lip-synced to a VOICEVOX voice (冥鳴ひまり) with subtitles; while she reads she says something
now and then, to you or to herself. No controls but the music; the camera stays still.

Front end only: three.js and three-vrm, no server.

## Layout

| Path | What |
| --- | --- |
| [`web/`](web/README.md) | The page: run, test, build, deploy |
| [`scripts/voice/`](scripts/voice/) | Her lines (`lines.json`) and the VOICEVOX generator for `web/public/voice/` |
| [`scripts/music/`](scripts/music/) | Track list with licences, and the encoder for `web/public/music/` |
| [`scripts/marycia/`](docs/marycia/README.md) | Converting the purchased character package to the web VRM |
| `scripts/balcony-pose/`, `scripts/balcony-web/`, `scripts/balcony-toon/` | Blender scripts that pose her on the chair and render and export the balcony plate, chair, book, plants and wind |
| `scripts/motion/` | Blender bridge and motion-retargeting tools used by the exports |
| [`docs/`](docs/README.md) | Design notes, specs and plans |

## Run

```sh
cd web
npm ci
npm run dev
```

The page needs local files that are not in this repository (the purchased character and the balcony scene's exports;
see [CREDITS.md](CREDITS.md)); without them it cannot load her or the scene. With them, open http://127.0.0.1:5173/.

## Credits and licence

Code: [MIT](LICENSE). Character: Marycia ©BeroarN. Voice: VOICEVOX:冥鳴ひまり. Music: Lao Ban (CC0) and VibeDepot
(CC BY-ND 4.0) via Free Music Archive. Those keep their own terms: see [CREDITS.md](CREDITS.md).
