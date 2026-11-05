# Afternoon room MVP — asset credits

## Room furniture

Kenney, Furniture Kit 2.0, CC0 1.0 Universal.
https://kenney.nl/assets/furniture-kit
https://creativecommons.org/publicdomain/zero/1.0/

Downloaded free from Kenney on 2026-11-04. Used sofa, cushions, bookcase, books, lamps, coffee table, side table, laptop, radio, plants and rug. Furniture was repositioned, resized and recolored in Blender. The room shell, floorboards, curtain meshes, simple framed blocks, a static lap throw and scene composition were assembled for this project. The original furniture files and license are preserved in assets/vendor/kenney-furniture.

## Current animation clips

Marycia 1.5.1 supplied sitting/hand poses and facial curves, ©BeroarN. Converted with Unidot Importer’s Apache-2.0 humanoid decoder and project curve sampling. The room uses these clips, with project-authored blend timing. Exact Unity runtime parity is unverified.

## Historical animation clips (no longer played in the room)

Quaternius / Gonzalo Furnier, Universal Animation Library Standard (v3.0), CC0 1.0 Universal.
https://quaternius.com/packs/universalanimationlibrary.html
https://quaternius.itch.io/universal-animation-library

Downloaded the free Standard archive, not the paid Pro or Source tiers. Used Sitting_Idle_Loop and Sitting_Talking_Loop from UAL1_Standard.glb. Extracted rotation and pelvis data, normalized against A_TPose, converted to semantic humanoid tracks, closed near-identical loop endpoints, and retargeted in the earlier MVP. The action plays two conversational gesture cycles with a smooth entrance/exit. No voice audio or lip-sync is included.

## Current character: Marycia

Marycia / マリシア, ©BeroarN. Purchased source provided by the project owner; project licensing confirmed resolved on 2026-11-05. This character is not CC0. See [Marycia credits and conversion notes](/models/marycia/CREDITS.md).

## Comparison character: Vivi

Vivi / beta AvatarSample_2, pixiv Inc. (VRoid Project), CC0.
https://vroid.pixiv.help/hc/en-us/articles/360014900273

Original VRM file is unmodified. In the seated scene, Vivi-specific skirt springs are disabled at runtime so the existing thigh skinning drives them. Hair and sleeve springs remain active. A static lap throw is fitted to Vivi to cover remaining skirt clipping and is hidden for replacement avatars. Full clothing collision/cloth simulation is not implemented. This is a development placeholder, not the intended final character.

CC0 asset permissions are separate from future BOOTH licenses and application dependencies. Three.js and three-vrm retain their MIT licenses. The original room MVP used only the CC0 assets above; the current Marycia character is separately licensed.
