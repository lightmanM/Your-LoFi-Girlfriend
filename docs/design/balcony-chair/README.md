# Visible reading chair

The visitor viewer and balcony development page now use a visible chair GLB instead of a depth-only proxy. The chair keeps the fitted world transform from `Balcony • Reading v2 (Claude)` and uses its albedo maps at 1K resolution. Character and book cast dynamic directional shadows onto the chair. The background remains a fixed image; the rest of the environment is not converted to real-time geometry.

Export: run `scripts/balcony-web/export_visible_chair.py` through Blender MCP with `ROOT` set to this checkout. This creates local `web/public/environment/balcony-toon/chair-visible.glb` and its export manifest. The script copies and validates the chair meshes without changing source scene objects. It is a separate step after existing plate export scripts; the old depth proxy remains available but is no longer used by either page.

Measured export: two meshes, 20,552 triangles, two textures (1024×1024 and 1024×715), 1,387,320 bytes. Blender reimport confirmed mesh/material counts and bounds. Reading and stretching browser checks pass, as do the 22 unit tests and production build (existing large-bundle warning remains). Browser snapshots show the visible chair during reading and the stretch. Pose and motion code are unchanged; this is not a full animation/contact-polish pass.

Work is in the active Claude prototype checkout because its viewer and animation work have not yet been merged to main. Changes are uncommitted. Existing unrelated work is preserved.
