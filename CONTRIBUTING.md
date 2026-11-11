# Contributing

Issues and pull requests are welcome. The README lists [places to start](README.md#contributing); this page is the
rules that go with them.

## Run and check

- **Run it**: [web/README.md](web/README.md#run). A fresh clone runs with the stand-ins, so you need no private files.
- **Check it**: the commands under [Verify](web/README.md#verify) in the same file. `scripts/standins/clone_check.sh`
  runs all of them as a fresh clone would: the stand-in suite should pass, and the suites that need the owner's
  files skip.
- **CI** runs the unit tests, the build and the Python unit tests on every pull request
  ([ci.yml](.github/workflows/ci.yml)). It does not run the browser suite, so run `npm run test:browser` or the clone
  check yourself when you change the page.

Add or update tests with the behaviour you change. Most of the page's logic is in small pure modules with unit tests
in `web/tests/`.

## Assets: only what may be redistributed

This is the rule that matters most here. The live site uses a purchased character and a purchased scene; neither may
be redistributed, and the repository is built so that it never holds them.

**Never commit:**

- The character Marycia (©BeroarN) in any form: the package, a VRM, textures, or anything converted from them.
- The balcony scene's 3D files: its meshes, textures, `.blend` files and exports such as `chair-visible.glb` or
  `plants.glb`.
- Music files. `web/public/music/` holds the playlist and credits only; the MP3s stay local.
- Any other file you do not have the right to redistribute, and `web/dist/`.

`.gitignore` already keeps these paths out. Do not work around it (no `git add -f`, no renamed copies), and do not
loosen it in a pull request without saying why.

**When you add an asset** (a model, texture, image, audio clip, font):

- Add it only if its licence lets this repository redistribute it (your own work, CC0, CC BY and similar).
- State its source and licence in the pull request, and record them in the `CREDITS.md` next to the file and in the
  table in [CREDITS.md](CREDITS.md).
- If a licence has conditions (credit, no edits, no commercial use), say so; they may decide whether it can be used.

**Things already here that have their own terms:**

- The balcony renders (`web/public/environment/balcony-toon/*.webp`) and the README screenshot are shared for this
  project only. Use them to run and develop it; do not reuse them elsewhere or add edited copies.
- Her voice is VOICEVOX:冥鳴ひまり. New or changed lines are written in `scripts/voice/lines.json`, voiced with
  `scripts/voice/generate_lines.py`, and must stay within
  [冥鳴ひまり's terms of use](https://meimeihimari.wixsite.com/himari/terms-of-use), both in what she is made to say
  and in keeping the credit. Do not add clips from another voice without its source and licence.
- Music is credited and played unedited (`scripts/music/tracks.json` records each track's licence). A new track goes
  in as an entry there with its source page and licence; `scripts/music/prepare_music.py` writes the playlist and
  credits. Never as an audio file.

If you are unsure whether a file may be included, open an issue and ask before you add it.

## Commit messages

```
<type>: <description>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`. Lower case, present tense, no full stop:
`fix: keep the subtitle clear of the answer pills on phones`. Add a body when the reason is not obvious.

## Pull requests

Changes reach `main` only through pull requests.

1. Fork the repository and make a branch from `main`.
2. Keep the pull request to one change; say what it does and why, and fill in the checklist.
3. Give it a title in the commit format above: pull requests are squash-merged, and the title becomes the commit.
4. CI must pass before it is merged. On a first contribution the checks wait for the maintainer's approval to run.

The code and docs you contribute are released under the repository's [MIT licence](LICENSE).
