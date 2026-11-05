# Video companion spike

Goal: evaluate pre-rendered clips as the frontend-only companion, without changing existing Blender work.

Scope authorized by the user's request for a spike. Execute inline in the existing worktree; no deployment, purchases, or new subscriptions. No original-character AI clips are available, so distinguish playback evidence from unresolved character-quality evidence.

- [x] Prepare three six-second excerpts of licensed Sintel footage at native 1080p and downsampled 720p. Record file sizes, codec, bitrate and attribution. Do not present these as AI or project-character footage.
- [x] Build a standalone static playback lab: two video elements, click-to-start, idle/reaction/return behavior, hard-cut/crossfade choice, bounded lazy clip cache, pause, local-file import, measurements and report export.
- [x] Verify real browser playback, return to idle, no eager library download, bounded video elements/cache, failure recovery, mobile layout and reduced-motion behavior. Run cold/warm/slow-network scenarios; save observed metrics.
- [x] Report measured delivery costs separately from bandwidth estimates. Include a reusable character generation recipe and visual acceptance rubric. Explain finite prerecorded interaction versus realtime 3D.

Acceptance: sample playback works, selecting a reaction returns to idle, no more than two video elements exist, unselected clips are not fetched by default, local files never upload, errors preserve the previous scene, benchmark reports are reproducible. Character identity, realistic interaction continuity, physical mobile battery performance, and production CDN behavior remain unvalidated until tested with actual clips/devices.
