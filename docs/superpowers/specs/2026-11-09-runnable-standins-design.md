# A runnable public repo: stand-ins — design

Date: 2026-11-09 (updated 2026-11-10). Status: draft for the owner's approval.

## Intent

The public repo should run: anyone who clones it and runs `npm ci && npm run dev` sees the balcony scene working —
someone reading on the balcony, page turns, her break, the greeting, small talk, click to talk, wind in the picture.
Today a clone shows "The balcony could not load", because the character and the scene's 3D files are private. The
owner's words: "that way we can share in repo so people can at least have a similar runnable. We can specify in readme
about those stand-ins and just contact me if you need those resources for serious contribution."

## What is shared, rebuilt or replaced (owner-approved direction)

| Today (private) | In the public repo | Why |
| --- | --- | --- |
| Rendered balcony layers: `plate.webp`, `plate-clean.webp`, `cover.webp`, `leaves.webp`, `palm-full.webp`, `plants-full.webp`, `plant-mask.webp`, `wind-field.webp` (≈3.8 MB) | **Shared as they are**, for this project only (below) | Flat renders; the owner approved sharing them (2026-11-10) |
| `scene.json` (camera, layer names, light, character placement, wind) | **Shared** | Our numbers |
| `book.glb` (our own book, 792 triangles) | **Shared** | Ours |
| Her reading pose `reading-balcony.json` (bone angles) | **Shared** | Ours |
| `chair-visible.glb` (the scene's chair, with a Megascans texture) | **Rebuilt**: a plain seat and back of our own, shaped to the chair's outline in the picture, no textures | The page colours the chair from the picture anyway |
| `plants.glb` (decimated copies of the scene's plant models) | **Rebuilt**: flat cards cut to each plant's outline in `plant-mask.webp`, pivoting at the stem | Our own geometry; same sway, a little flatter up close |
| Marycia `marycia-web.vrm` (purchased, BOOTH) | **Replaced** by Vivi (pixiv VRoid beta AvatarSample_2, CC0), compressed, fitted to the chair and the book | No redistribution of Marycia |
| Music MP3s | **Not shipped** (as now); the page stays quiet when they are missing | CC BY-ND tracks are not redistributed in the repo |

The owner's full files always win: the page uses them when present and falls back to the stand-ins only when they
are missing, so the owner's checkout and the deployed site look exactly as now.

## Goals

- A fresh clone runs with no private files: everything listed above loads, no console errors, no "could not load".
- Vivi sits on the chair, holds the book in both hands the way Marycia does, turns pages, takes her break, looks up
  at the camera for the greeting, small talk and click to talk, without her hands passing through the book or her
  body through the chair.
- The README explains the stand-ins plainly and says how to ask for the full resources: email
  **lightman.miao@gmail.com** (the owner's choice; it is published in the README).
- `CREDITS.md` lists Vivi (CC0, pixiv) and states the terms of the shared balcony renders and the README screenshot
  (owner's choice): *© the project owner; included so this project runs; you may use them to run and develop this
  project, not reuse them elsewhere or redistribute them separately; not covered by the MIT licence.* The repo copy of
  `web/public/environment/CREDITS.md` says the same (it currently says the files stay local).

## A proper README (added by the owner)

"make it a very proper README, maybe even include the screenshot and the deploy link (yourlofigirl.com) so people can
clearly know what is this project about. And we should have a clear instruction about how to deploy, and what areas
can be contributed (characters replacement, motion/animations, scripts, multi scenes support, etc). and also include
those stand-ins info."

The top-level `README.md` becomes the project's front page:

- **What it is**, in a few lines, with a **screenshot** of the live page (a frame of the real scene with Marycia,
  taken from the page; renders are shareable) and the **live site: https://yourlofigirl.com**.
- **Features**: reading motion, page turns and her break, greeting, small talk, click to talk with answers,
  VOICEVOX voice with lip sync and subtitles, the camera HUD and music player, wind in the picture.
- **Quick start**: clone, `npm ci`, `npm run dev`, what you will see (the stand-ins), Node version.
- **Stand-ins**: what in the repo is a stand-in and what the full version uses, why (licences), and how to ask for
  the full resources for serious contribution: lightman.miao@gmail.com.
- **Deploy** on **Cloudflare Pages** (the owner's host for yourlofigirl.com): build command, output folder, Node
  version. Two ways, stated plainly: connecting the Git repo builds the **stand-in** version (the private files are
  not in Git); the owner's full site is built locally, where the private files are, and uploaded as a direct upload
  (for example `npx wrangler pages deploy web/dist`). Plus the licence rule: only deploy assets you have the right to
  publish, and check `public/` before building (everything in it is published).
- **Contributing**: areas with pointers to the code and docs: character replacement (bring your own VRM: the stand-in
  description shows how), motion and animation (reading, break, gestures, looks), voice lines (the generator and the
  VOICEVOX terms), scripts (the Blender pipelines), multi-scene support (what `scene.json` describes today and what a
  second scene needs), music, accessibility, performance; how to run the tests; how to propose changes.
- **Layout**, **Credits and licence** (MIT code; the character, scene renders, voice and music under their own terms).

## Non-goals

- Making Vivi look like Marycia, or matching Marycia's exact pose quality; she is a stand-in.
- Rebuilding the balcony itself in 3D; the background stays the rendered picture.
- Shipping music.

## Anti-goals

- Any purchased asset (Marycia, the scene's chair or plant meshes, their textures) entering the repo or its history.
- The stand-ins changing anything on the owner's own page or deployed site.
- A clone that "runs" but shows obvious breakage: floating book, hands through the book, a character half inside the
  chair, broken pills or subtitles.

## How it fits together

- **Fallback, file by file:** the page asks for the owner's file first; if it is missing (404), it loads the stand-in.
  Stand-ins live apart from the private files (for example `public/standin/`), and the private file names stay
  git-ignored. A small stand-in description (Vivi's file, scale, seat placement, book offset, any pose corrections)
  sits beside them, so nothing about Vivi is hard-coded in the page.
- **Vivi's fit** is data, not code: placement, scale and pose corrections in that description, tuned until the checks
  in "Tests" pass. Expressions (smile, relaxed, blink, the five mouth shapes) come from her VRM presets, as with
  Marycia.
- **Chair and plant cards** are made by scripts in `scripts/` from files already in the repo (the picture, the plant
  mask, `scene.json`), so anyone can rebuild them; their outputs are committed.
- **Size:** Vivi compressed (target ≤ 6 MB with `scripts/marycia/repack_vrm.py`), cards and chair small; the repo
  grows by about 10 MB.

## Builder's-check calls (mine, for the owner to check)

- **Existing browser suites** are tuned to Marycia (seat drop, hands within 3 cm of the book through her break, head
  ranges). On a clone they **skip**, as they do today without her, now keyed on her VRM being absent rather than on
  `scene.json` (which becomes public). Their assertions do not change. A **new stand-in suite** runs on a clone with
  the fit checks below, so Vivi does not have to meet Marycia's exact limits.
- **The screenshot** for the README is a frame of the real scene with Marycia, under the same project-only terms as
  the renders.

## Tests the owner expects

- A browser test run with the private files hidden (the stand-in path) that loads the page, plays the greeting, a
  small-talk line, a click-to-talk question with an answer and a page turn, with no console errors.
- Fit checks for Vivi: each hand within a few centimetres of its grip on the book, no hand inside the book, her seat
  on the chair (not floating, not sunk), her face reaching the camera when she looks up.
- The existing suites, unchanged, with the owner's files present (her page is untouched).

## Left to the builder

- File names and folder for the stand-ins; how the fallback is detected (a HEAD request or a failed load).
- How the chair outline and plant cards are cut and placed (depth from `scene.json`'s depth range, pivots at the base).
- Which of Vivi's settings need tuning, and how.
- The README wording, within the facts above.
