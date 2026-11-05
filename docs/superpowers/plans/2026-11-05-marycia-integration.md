# Marycia browser integration

Goal: replace the temporary room character with the purchased Marycia asset, preserving the existing scene and continuous idle/greeting controller.

Authorization: the user confirmed project licensing resolved and explicitly instructed proceeding. This is local integration; no hosted deployment or source-asset redistribution is part of this task.

Approach: export a separate human-ear, clothed working copy to GLB and add VRM1 humanoid/expression/MToon/spring metadata. Preserve the original package and complete morph-rich source. Use existing Quaternius motions through semantic humanoid retargeting. A direct FBX loader would duplicate our character contract; Unity runtime integration would add unnecessary browser dependencies.

- [x] Prepare reproducible Blender conversion in scripts/marycia; bake T-pose and chosen appearance, retain useful expressions, select/rescale textures, export source and GLB outside tracked assets.
- [x] Package VRM1 metadata with validated bone and morph references; keep the converted binary ignored in git and locally served by Vite.
- [x] Add browser regression coverage for Marycia capabilities, successful startup, continuous transition, pause/queue, local replacement and reset.
- [x] Make Marycia the room default, retain Vivi as an explicit fallback/comparison, update visible name and credits, and tune character-specific framing/material response only where visual evidence requires it.
- [x] Validate GLB reimport, VRM structure, unit tests, browser behavior, production build and desktop/mobile screenshots. Record a transition demo and document measured results and remaining material/physics limitations.

Success: Marycia appears clothed with human ears, has working blink/smile/finger controls, sits in the existing room, and returns smoothly from greeting to idle without network loads during interaction. Camera stays constrained. Hair springs are an approximation, not a claim of identical VRChat PhysBone behavior. No need to recreate Unity menus or every supplied animation to establish this integration.
