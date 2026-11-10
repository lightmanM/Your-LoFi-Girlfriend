# Stand-ins

Files that let a fresh clone run without the project's private character and scene files. When those files are
present, the page uses them instead (see the top-level README).

## Vivi (stand-in character)

- **Model:** Vivi, VRoid beta AvatarSample_2, by pixiv Inc. (VRoid Project).
- **Licence:** Creative Commons CC0 1.0 Universal. "To the extent possible under law, pixiv Inc. has waived all
  copyright and related or neighboring rights to this model." Official model licence:
  https://vroid.pixiv.help/hc/en-us/articles/360014900273 · CC0 legal text:
  https://creativecommons.org/publicdomain/zero/1.0/legalcode.en (the embedded VRM metadata also says `licenseName: CC0`).
- **Source:** https://github.com/madjin/vrm-samples/blob/e16eb187100149a315ad92c3c9968f1d5baa6c7d/vroid/beta/Vivi.vrm
  (sha256 of the original file: `eaf902e041a7a810f1423599ae75682f61184ab6ef0206da9a8ed9caa8ec3a9d`).
- **Changes** (by `scripts/standins/compress_vivi.py`): textures re-encoded as WebP (quality 85, at most 2048 px),
  and the scene wrapped in one node (`LofiFacesForward`) turned half a turn about Y so she faces forward like a VRM 1.0
  model; her mesh, bones, materials and expressions are otherwise unchanged.
- A temporary stand-in, not a character made for this project and not an endorsement by pixiv.

## Chair, plant cards, reading pose

Made for this project (MIT, like the code). The chair (`chair.json`) is two woven panels, a seat and a back, built at
runtime from two outlines measured from the scene's chair (numbers only, no mesh). The plant cards are cut at runtime
from the shared plant mask. The reading pose is bone angles authored for this project.
