# Closer camera framings (2026-11-06)

Stills of the Afternoon v1 toon scene rendered in Blender with her in the reading pose, for choosing a closer camera.
[framing-options.png](framing-options.png): now, 15 % closer (0.97 m) and 30 % closer (1.94 m).

Each closer camera moves forward along its view and turns slightly so she stays where she sits in today's frame; the
near leaf branch moves with the camera, so it keeps its place at the right edge and stays out of focus. Moving straight
forward without turning pushed her down and right behind the leaves ([straight-30-rejected.png](straight-30-rejected.png)).

Choosing one means re-rendering the web layers from that camera (picture, plant-free picture, masks, wind maps, depth,
leaves) and re-checking her colour match and the 3D plants at rest.

30 % closer moved left ([framing-30-left.png](framing-30-left.png)): 40 cm and 80 cm, still turned to keep her in
place. Moving left brings more of the palm in and swings the view through the door to the right: the window across the
street slides toward the left door frame, and the neighbour's balustrade comes into view.

30 % closer turned left without moving ([framing-30-turn.png](framing-30-turn.png)): 3° brings the palm in and centres
the window across the street in the door; she moves right and the near leaves start to overlap her side. At 6° she is
mostly behind the leaves.

Turned 3° left with the leaf branch 2.5 cm to the camera's right (7 cm and more pushed it out of frame), then the chair
and her moved left together along the floor ([framing-sit-left.png](framing-sit-left.png)): at 15 cm she is clear of
the leaves and still right of the door frame, the window stays open; at 25 cm her book and knees start to cross the
door frame into the view through the door. Camera and offsets are stored next to the renders in the session
scratchpad (`r30-pan3*.json`) for rebuilding the web layers.
