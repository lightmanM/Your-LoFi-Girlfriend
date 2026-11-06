# Your-LoFi-Girlfriend

Original anime character for a frontend-only lofi experience, with reusable outfits and scripted scenes.

## Current: cozy scene MVP

Latest: [Motion spike: procedural life layer, a reference-video stretch, the same stretch through Rokoko Vision, and proportion-aware IK arms](docs/motion-spike/README.md); every iteration and its lesson in the [motion learning log](docs/motion-learning-log.md). Earlier: [Marycia supplied poses and expressions](docs/marycia-source-motions/README.md).

A seated Marycia in a furnished afternoon room, with her supplied facial idle, expressions and finger poses. Actions blend back to idle. The previous placeholder motions are removed from playback. Furniture is CC0; character and current motions come from the purchased Marycia package.

- [Run the browser MVP](web/README.md) — local URL: http://127.0.0.1:5173/room.html
- [Architecture, sources, verification and limitations](docs/scene-mvp/README.md)
- [Actual browser demonstration](docs/marycia-source-motions/demo.mp4)
- [Editable room source](assets/environment/afternoon-room/afternoon-room.blend)

## Replaceable character baseline

The room now uses a working conversion of **Marycia**, the purchased BOOTH character. [Conversion notes and demonstration](docs/marycia/README.md). **Vivi**, the original CC0 VRoid sample, remains available for comparison. It includes mapped humanoid controls, facial expressions, and local VRM replacement. Vivi is a technical placeholder; her appearance and proportions are not the final design.

- [Run the character studio](web/README.md)
- [Asset selection, compatibility evidence, and BOOTH migration](docs/character-baseline/README.md)
- [Studio preview](docs/character-baseline/studio-preview.png)

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
