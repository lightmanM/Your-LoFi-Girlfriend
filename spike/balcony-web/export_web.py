"""Export the balcony web assets from the live Blender: reading pose (runtime clip format), book GLB, chair depth
occluder GLB and balcony.json (camera, plate coverage, character placement, light, gaze target).
Coordinates: Blender (x, y, z) -> three.js (x, z, -y)."""
import bpy, json, math, sys, importlib
from pathlib import Path
from mathutils import Matrix, Vector, Quaternion
MINE = Path('<checkout>/.claude/worktrees/yourlofigirlriend-planning-c5484e')
WEB = MINE / 'web/public/environment/balcony-plate'; POSE = MINE / 'web/public/models/marycia/reading-balcony.json'
sys.path.insert(0, str(MINE / 'scripts/motion')); import blender_bridge as br; importlib.reload(br)
C = Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0)))
pt = lambda v: [round(x, 5) for x in (C @ Vector(v))]
P = bpy.data.scenes['Balcony • Plate (Claude)']; info = dict(P['plate'])
disp = bpy.data.objects['Plate • display camera']
q = (C @ disp.matrix_world.to_3x3().normalized()).to_quaternion()
a = bpy.data.objects['Reading v2 • armature']; root = a.parent
# Transforms only refresh for the scene being evaluated: work in the scene that owns this armature.
bpy.context.window.scene = bpy.data.scenes['Balcony • Reading v2 (Claude)']; bpy.context.view_layer.update()
# Pose: sample with the placement yaw removed so the deltas are in the character's own frame.
# The yaw can sit on the armature or on its parent, so strip it from the armature's world matrix itself.
loc, rot, sca = a.matrix_world.decompose(); saved = a.matrix_basis.copy()
a.matrix_world = Matrix.LocRotScale(loc, Quaternion(), sca); bpy.context.view_layer.update()
deltas = br.sample_pose(a, br.humanoid_map())
a.matrix_basis = saved; bpy.context.view_layer.update()
Mw = a.matrix_world; R3 = Mw.to_3x3().normalized()
yaw = math.degrees(math.atan2(R3[1][0], R3[0][0])); tilt = math.degrees(math.acos(max(-1, min(1, R3[2][2]))))
tracks = [{'bone': b, 'rotations': [round(v, 7) for v in d]} for b, d in deltas.items() if b not in ('leftEye', 'rightEye')]
face = next(o for o in bpy.data.collections['Balcony • reading v2 character (Claude)'].objects if 'Face' in o.name)
blink = face.data.shape_keys.key_blocks['eyeBlinkLeft'].value
POSE.write_text(json.dumps({'name': 'readingBalcony', 'duration': 0, 'times': [0], 'tracks': tracks, 'face': {}, 'blink': round(blink, 3),
                            'source': 'Blender scene Balcony • Reading v2 (Claude), spike/balcony-pose/pose_v2.py'}, separators=(',', ':')))
book = bpy.data.objects['Reading v2 • book']; look = book.matrix_world @ Vector((0, 0.02, 0))
sun = next(o for o in P.objects if o.type == 'LIGHT' and o.data.type == 'SUN')
to_sun = (sun.matrix_world.to_3x3().normalized() @ Vector((0, 0, 1))).normalized()
# Temporary export scene with copies: the book, and a decimated chair used only to write depth.
TMP = 'Plate • export (Claude)'
if TMP in bpy.data.scenes: bpy.data.scenes.remove(bpy.data.scenes[TMP])
T = bpy.data.scenes.new(TMP); made = []
def dup(o, parent=None):
    c = o.copy(); T.collection.objects.link(c); made.append(c)
    if parent: c.parent = parent; c.matrix_parent_inverse = o.matrix_parent_inverse.copy()
    return c
bk = dup(book)
for ch in book.children: dup(ch, bk)
chairs = []
for o in bpy.data.collections['Balcony • reading environment'].objects:
    if o.name.startswith('Reading chair'):
        c = dup(o); c.data = o.data.copy(); c.data.materials.clear(); d = c.modifiers.new('Occluder', 'DECIMATE'); d.ratio = 0.1; chairs.append(c)
win = bpy.context.window; prev = win.scene; win.scene = T
def export(objs, path):
    for o in T.objects: o.select_set(o in objs)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, use_active_scene=True, export_apply=True,
                              export_cameras=False, export_lights=False, export_animations=False, export_yup=True)
export([bk] + list(bk.children), WEB / 'book.glb'); export(chairs, WEB / 'chair-occluder.glb')
occ_tris = 0
dg = bpy.context.evaluated_depsgraph_get()
for c in chairs:
    e = c.evaluated_get(dg); m = e.to_mesh(); occ_tris += sum(len(p.vertices) - 2 for p in m.polygons); e.to_mesh_clear()
win.scene = prev
for o in made: bpy.data.objects.remove(o)
bpy.data.scenes.remove(T)
data = {
    'camera': {'position': pt(disp.matrix_world.translation), 'quaternion': [round(v, 7) for v in (q.x, q.y, q.z, q.w)],
               'display_hfov_deg': info['display_hfov_deg'], 'display_vfov_deg': info['display_vfov_deg']},
    'plate': {'image': 'plate-reading.webp', 'width': info['width'], 'height': info['height'], 'hfov_deg': info['hfov_deg'], 'vfov_deg': info['vfov_deg']},
    'foreground': {'image': 'foreground.webp'},
    'occluder': 'chair-occluder.glb', 'book': 'book.glb',
    'pose': '/models/marycia/reading-balcony.json', 'vrm': '/models/marycia/marycia.vrm',
    'character': {'hips': pt(Mw @ a.pose.bones['Hips'].head), 'yaw_deg': round(yaw, 3), 'scale': round(Mw.to_scale().x, 4)},
    'look_target': pt(look),
    'light': {'direction': [round(v, 4) for v in (C @ to_sun)], 'color': [1.0, 0.9, 0.78], 'intensity': 2.2, 'sky': [0.95, 0.9, 0.82], 'ground': [0.55, 0.42, 0.32], 'ambient': 1.1},
    'source': 'Blender scene Balcony • Plate (Claude); spike/balcony-web/build_plate.py, export_web.py'}
(WEB / 'balcony.json').write_text(json.dumps(data, indent=1))
print(json.dumps({'tracks': len(tracks), 'yaw': round(yaw, 2), 'armature_tilt_deg': round(tilt, 3), 'occluder_tris': occ_tris, 'blink': blink, 'hips': data['character']['hips'], 'camera': data['camera']}))
