# LoFi browser MVP and character studio

A local Three.js + three-vrm companion with the purchased Marycia working conversion and a CC0 Vivi comparison model.

## Run

From this directory, with Node 22.12+ (verified here on Node 25.8.2):

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/room.html** for the full scene MVP. **Play action** runs the selected supplied expression or finger pose (20 face clips and 10 finger poses from the package, plus the authored stretch) and blends back to Marycia’s supplied facial idle and sitting pose. **Demonstrate transition** runs two queued actions and opens the blend inspector. Finger poses retain the seated arms and still need contact/arm-placement polish. Pause/resume, half-speed inspection, a fixed camera with small pointing adjustments and local VRM replacement are included.

**Golden-hour mood:** warm lamps, a sunset window view, restrained bloom, grain and dust. The camera position is locked; drag permits at most 2.5° yaw / 1.5° pitch, then returns to center. Wheel/pinch cannot zoom the 3D camera. Use Behind the scene → Lighting to compare with the original lighting.

The character studio opens Marycia at http://127.0.0.1:5173/?character=marycia; the original Vivi studio remains at http://127.0.0.1:5173. Drag to orbit, zoom, switch Body/Face, and try expressions and diagnostic poses. These poses are rig checks, not finished character actions.

**Load a VRM** accepts a self-contained local VRM 0.x or 1.x up to 64 MiB. Files are parsed locally without upload. Invalid replacements preserve the previous character. **Restore Vivi** returns to the bundled sample. FBX, Unity packages and plain GLB are not accepted directly.

Marycia is the room default. Her converted VRM and source-motions.json are local and git-ignored; regenerate both from the purchased package when setting up a new checkout. See [Marycia conversion and verification](../docs/marycia/README.md). Behind the scene → Load Marycia restores her after a swap.

## Structure

- `src/character-adapter.js`: normalized humanoid bones and semantic expression controls. Scene code should use this interface rather than asset-specific node names.
- `src/character-contract.js`: minimum bone requirements and optional facial/finger capabilities.
- `src/main.js`: renderer, framing, loading, replacement and GPU disposal.
- `public/models/vivi/`: original CC0 asset, provenance and audit.

The original studio adapter remains a diagnostic tool. The room uses `src/companion/character.js` as its single pose owner, with `source-motion.js` for supplied curve playback and `interaction.js` for blend timing. Do not run the diagnostic adapter and the room pose owner on the same character. See [current motion conversion](../docs/marycia-source-motions/README.md). See [scene MVP notes](../docs/scene-mvp/README.md) for the separate environment, motion, character-profile and state interfaces.

## Verify

```sh
npm test
npm run test:browser
npm run build
```

Browser tests use installed Google Chrome and start/reuse the local development server. To check another licensed local model:

```sh
VRM_SECOND_MODEL=/absolute/path/character.vrm npm run test:browser
```

The optional test expects smile support and checks an actual replacement's relaxed arm pose. Browser reports and screenshots are saved in `../docs/character-baseline/`. They are development evidence, not performance benchmarks.

See [selection and migration notes](../docs/character-baseline/README.md) before selecting a BOOTH avatar.
