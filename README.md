# Your-LoFi-Girlfriend

Original anime character for a frontend-only lofi experience, with reusable outfits and scripted scenes.

## Current: balcony scene

One web page: Marycia reading on a sunny balcony in a toon afternoon look, with page turns, look-ups, a short break
(shoulder rolls and head tilts with the book on her lap) every 4 to 8 minutes, and plants moving in the wind. When you press start she looks up and greets you with one of five
lines at random ("おかえりなさい", welcome back, and others), lip-synced to a VOICEVOX voice (冥鳴ひまり), with subtitles; while she reads she
says something now and then, to you or to herself. No controls, fixed camera.

- [Run it](web/README.md) — local URL: http://127.0.0.1:5173/
- [Viewer design notes](docs/design/viewer/README.md) · [reading motion](docs/design/reading-motion/README.md) · [toon look](docs/design/balcony-toon/README.md)
- The character and the balcony scene are purchased or not yet licensed for the web: their files stay local, and the
  build must not be deployed.

Earlier pages (the furnished room MVP, the character studio and the Vivi sample character) were removed on
2026-11-07; their notes remain in [docs/scene-mvp](docs/scene-mvp/README.md) and [docs/character-baseline](docs/character-baseline/README.md).

## Earlier Blender studies

- [First editable head study and limitations](docs/head-study-v004.md)
- [Three-quarter render](renders/head-study-v004/three-quarter.png) · [Front](renders/head-study-v004/front.png) · [Profile](renders/head-study-v004/profile.png)
- [Blender source](assets/character/head-study-v004.blend)
- [Character reference and modeling brief](references/character-v1/brief.md)
- [Original reference image](references/character-v1/target.jpg)
- [Verified Blender setup](docs/blender-setup.md)

These are rough head-and-hair visual prototypes. The original character likeness remains unfinished; browser development now uses the rigged placeholder above.

## Alternative: video companion spike

- [Measured findings and limitations](docs/video-spike-findings.md)
- [Standalone playback lab and run instructions](spikes/video-companion/README.md)
- [Actual-character AI video quality test brief](docs/video-generation-test.md)

The lab tests lazy loading, cached reactions and transitions using attributed animation footage. It does not yet establish AI-generated quality for our character.
