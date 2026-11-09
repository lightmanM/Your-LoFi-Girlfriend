"""Full-quality balcony scene for the web plate, from the original source scene, with the reading edits.
Runs inside the live Blender via MCP. Re-runnable: removes only what it made before ('(Claude)' / 'Plate •').
Source objects are copied (mesh data shared, never edited), so 'Balcony • Bounded preview' and every Codex scene stay as they are.
"""
import bpy, math
from mathutils import Vector
SRC = 'Balcony • Bounded preview'; NAME = 'Balcony • Plate (Claude)'
ENV, CHAR = 'Plate • environment (Claude)', 'Plate • character (Claude)'
TRAY = {'moxing1025', 'moxing1028', 'moxing1029', 'moxing1020', 'moxing1021', 'moxing1023', 'moxing1024', '细分曲面_4', '细分曲面_1'}
FOREGROUND = {'moxing0035'}                                    # the blurry leaves 0.9 m from the camera
YAW, PITCH, MARGIN = 2.5, 1.5, 0.5                             # matches FixedCamera look limits, plus a safety margin (degrees)
PLATE_W = 2560
if NAME in bpy.data.scenes: bpy.data.scenes.remove(bpy.data.scenes[NAME])
for cn in (ENV, CHAR, 'Plate • light link (Claude)'):
    if cn in bpy.data.collections:
        c = bpy.data.collections[cn]
        for o in list(c.objects): bpy.data.objects.remove(o)
        bpy.data.collections.remove(c)
for ng in [g for g in bpy.data.node_groups if g.name.startswith('Plate • compositor')]: bpy.data.node_groups.remove(ng)
src = bpy.data.scenes[SRC]
P = src.copy(); P.name = NAME
for c in list(P.collection.children): P.collection.children.unlink(c)
for o in list(P.collection.objects): P.collection.objects.unlink(o)
env = bpy.data.collections.new(ENV); P.collection.children.link(env)
copies = {}
for o in src.objects:
    if o.type not in {'MESH', 'EMPTY', 'LIGHT', 'CAMERA'}: continue
    c = o.copy(); env.objects.link(c); copies[o] = c; c['source_name'] = o.name
for o, c in copies.items():
    if o.parent in copies: c.parent = copies[o.parent]; c.matrix_parent_inverse = o.matrix_parent_inverse.copy()
# Light linking: rebuild the receiver set with the copies.
for o, c in copies.items():
    ll = getattr(o, 'light_linking', None)
    if ll and ll.receiver_collection:
        rc = bpy.data.collections.new('Plate • light link (Claude)')
        for ob, co in zip(rc_src := list(ll.receiver_collection.objects), ll.receiver_collection.collection_objects):
            if ob in copies: rc.objects.link(copies[ob]); rc.collection_objects[-1].light_linking.link_state = co.light_linking.link_state
        c.light_linking.receiver_collection = rc
# Compositor: same glare as the source, but reading this scene (the copied group pointed at another scene).
ng = src.compositing_node_group.copy(); ng.name = 'Plate • compositor (Claude)'
for n in ng.nodes:
    if n.type == 'R_LAYERS': n.scene = P
P.compositing_node_group = ng; P.render.use_compositing = True; P.render.use_sequencer = False
# Reading edits: tray and its props off the chair; chair at the fitted size used by the reading pose.
removed = []
for o, c in list(copies.items()):
    if o.name in TRAY: removed.append(o.name); bpy.data.objects.remove(c); del copies[o]
fitted = {o['source_name']: o.matrix_world.copy() for o in bpy.data.collections['Balcony • reading environment'].objects if o.name.startswith('Reading chair')}
for o, c in copies.items():
    if o.name in fitted: c.matrix_world = fitted[o.name]
# Character: copy of the approved reading pose (v2), invisible to the camera but casting shadows and bounce light.
ch = bpy.data.collections.new(CHAR); P.collection.children.link(ch); cc = {}
for o in bpy.data.collections['Balcony • reading v2 character (Claude)'].objects:
    if o.type == 'CAMERA': continue
    c = o.copy(); ch.objects.link(c); cc[o] = c
for o, c in cc.items():
    if o.parent in cc: c.parent = cc[o.parent]; c.matrix_parent_inverse = o.matrix_parent_inverse.copy()
    for m in c.modifiers:
        if m.type == 'ARMATURE' and m.object in cc: m.object = cc[m.object]
# Cameras: the display camera (source framing) and a wider plate camera at the same eye for the look offset.
disp = copies[src.camera]; disp.name = 'Plate • display camera'; disp.data = src.camera.data.copy()
if disp.data.dof.focus_object in copies: disp.data.dof.focus_object = copies[disp.data.dof.focus_object]
disp.data.sensor_fit = 'HORIZONTAL'
hfov = 2 * math.atan(disp.data.sensor_width / 2 / disp.data.lens); vfov = 2 * math.atan(math.tan(hfov / 2) * 9 / 16)
wh = hfov + math.radians(2 * (YAW + MARGIN)); wv = vfov + math.radians(2 * (PITCH + MARGIN))
plate = disp.copy(); plate.data = disp.data.copy(); plate.name = 'Plate • wide camera'; env.objects.link(plate)
plate.data.lens = disp.data.sensor_width / 2 / math.tan(wh / 2)
PLATE_H = int(round(PLATE_W * math.tan(wv / 2) / math.tan(wh / 2) / 2) * 2)
P.camera = disp
P['plate'] = {'width': PLATE_W, 'height': PLATE_H, 'hfov_deg': math.degrees(wh), 'vfov_deg': math.degrees(wv), 'display_hfov_deg': math.degrees(hfov), 'display_vfov_deg': math.degrees(vfov), 'lens': plate.data.lens}
print({'scene': P.name, 'env_objects': len(copies), 'removed': removed, 'chair_fitted': list(fitted), 'character_objects': len(cc), 'plate': dict(P['plate']), 'focus': disp.data.dof.focus_object.name if disp.data.dof.focus_object else None})
