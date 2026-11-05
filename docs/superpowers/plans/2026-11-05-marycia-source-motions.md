# Marycia supplied-motion replacement

User direction: convert and try the purchased package's own clips; drop the current MVP postures/actions. Retain the room and fixed camera. Do not use Quaternius as a hidden fallback.

Design: parse source Unity float curves, preserve Hermite interpolation, decode humanoid muscle curves using the existing Apache-2.0 Unidot converter, normalize against Godot's standard humanoid reference, and retarget those rotations through our VRM semantic bones. Transfer facial morph curves by name, retaining the needed morphs in the working VRM. Layer source hand poses and facial presets over the supplied sitting pose; the only new motion is the smooth transition between supplied poses. Preserve original files and record provenance/limitations.

- [x] Extract and convert sitting, standing, hand idle/peace/thumbs-up/heart, AFK and selected facial clips.
- [x] Validate quaternion coordinates, supplied pose coverage, facial channels and interpolation; expand the working VRM morph set as required.
- [x] Replace the runtime motion library, remove procedural facial idle/current greeting, and expose a small selector of supplied interactions.
- [x] Visually test pose fit, hands, face and transition entry/exit on desktop/mobile; correct seat placement without inventing replacement body postures.
- [x] Test action timing, queue, pause, model swaps and no old motion requests. Record a fresh demo and source-motion notes.

Unity-runtime pixel/pose parity is not claimed: the portable converter is checked against the actual source curves and visually inspected on Marycia. If a clip is unsuitable for a sofa, keep it converted but do not silently substitute another motion.
