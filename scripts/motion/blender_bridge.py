"""Move humanoid poses between the runtime motion JSON and a Blender armature.

Runtime frame ("normalized VRM1"): per humanoid bone, the rotation relative to the
T-pose rest, expressed in glTF axes (Y up, right-handed, character facing +Z), made
local to the nearest mapped humanoid ancestor's delta. This matches the clips in
web/public/models/marycia/source-motions.json and web/src/companion/character.js.

Run inside Blender with the working file open, e.g.
  Blender -b marycia-working.blend --python blender_bridge.py -- import --motions source-motions.json --clips sit,handsIdle --frame 1
  Blender -b authored.blend --python blender_bridge.py -- export --out clip.json --start 1 --end 180
  Blender -b marycia-working.blend --python blender_bridge.py -- roundtrip --motions source-motions.json
"""
import bpy, json, sys, argparse, math, pathlib
from mathutils import Quaternion, Matrix, Vector

HERE = pathlib.Path(__file__).resolve().parent
EXPORT_REPORT = HERE.parent.parent / 'assets/characters/marycia/marycia-working.export.json'

def vrm_name(unity_name):
    name = unity_name.replace(' ', '')
    name = name[0].lower() + name[1:]
    if 'ThumbProximal' in name: return name.replace('ThumbProximal', 'ThumbMetacarpal')
    if 'ThumbIntermediate' in name: return name.replace('ThumbIntermediate', 'ThumbProximal')
    return name

def humanoid_map(report_path=EXPORT_REPORT):
    """{vrm bone name: blender bone name}"""
    report = json.loads(pathlib.Path(report_path).read_text())
    return {vrm_name(unity): raw for raw, unity in report['humanoidMapping']}

# Blender (Z up, -Y forward) -> glTF (Y up, +Z forward): (x, y, z) -> (x, z, -y)
def q_to_gltf(q): return Quaternion((q.w, q.x, q.z, -q.y))
def q_from_gltf(q): return Quaternion((q.w, q.x, -q.z, q.y))

def armature():
    return next(o for o in bpy.data.objects if o.type == 'ARMATURE')

def humanoid_parent(arm, mapping_inv, blender_bone):
    b = arm.data.bones[blender_bone].parent
    while b is not None and b.name not in mapping_inv: b = b.parent
    return b.name if b else None

def rest_world_q(arm, name):
    return (arm.matrix_world @ arm.data.bones[name].matrix_local).to_quaternion().normalized()

def pose_world_q(arm, name):
    return (arm.matrix_world @ arm.pose.bones[name].matrix).to_quaternion().normalized()

def sample_pose(arm, mapping):
    """Current pose -> {vrm bone: parent-local delta quaternion [x,y,z,w] in glTF frame}."""
    inv = {v: k for k, v in mapping.items()}
    deltas_world = {}
    for vrm, raw in mapping.items():
        deltas_world[raw] = q_to_gltf(pose_world_q(arm, raw) @ rest_world_q(arm, raw).inverted()).normalized()
    out = {}
    for vrm, raw in mapping.items():
        parent = humanoid_parent(arm, inv, raw)
        d = deltas_world[raw]
        if parent: d = (deltas_world[parent].inverted() @ d).normalized()
        out[vrm] = [d.x, d.y, d.z, d.w]
    return out

def apply_deltas(arm, mapping, deltas):
    """{vrm bone: [x,y,z,w]} parent-local glTF deltas -> Blender pose (parents first)."""
    inv = {v: k for k, v in mapping.items()}
    order = [b.name for b in arm.data.bones if b.name in inv]  # armature order is parent-first
    world = {}
    bpy.context.view_layer.update()
    for raw in order:
        vrm = inv[raw]
        parent = humanoid_parent(arm, inv, raw)
        local = Quaternion((1, 0, 0, 0))
        if vrm in deltas:
            x, y, z, w = deltas[vrm]; local = Quaternion((w, x, y, z)).normalized()
        d = (world[parent] @ local).normalized() if parent else local
        world[raw] = d
        target = (q_from_gltf(d) @ rest_world_q(arm, raw)).normalized()
        pb = arm.pose.bones[raw]
        head = (arm.matrix_world @ pb.matrix).to_translation()
        pb.matrix = arm.matrix_world.inverted() @ (Matrix.Translation(head) @ target.to_matrix().to_4x4())
        bpy.context.view_layer.update()

def clip_frame(clip, index):
    return {t['bone']: t['rotations'][index * 4:index * 4 + 4] for t in clip['tracks']}

def angle_deg(a, b):
    qa = Quaternion((a[3], a[0], a[1], a[2])); qb = Quaternion((b[3], b[0], b[1], b[2]))
    d = (qa.inverted() @ qb).normalized(); return math.degrees(2 * math.acos(min(1, abs(d.w))))

def cmd_import(a):
    arm = armature(); mapping = humanoid_map(); motions = json.loads(pathlib.Path(a.motions).read_text())
    deltas = {}
    for key in a.clips.split(','): deltas.update(clip_frame(motions['clips'][key], 0))
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
    apply_deltas(arm, mapping, deltas)
    if a.frame is not None:
        bpy.context.scene.frame_set(a.frame)
        for raw in mapping.values(): arm.pose.bones[raw].keyframe_insert('rotation_quaternion', frame=a.frame)
    if a.save: bpy.ops.wm.save_as_mainfile(filepath=a.save)
    print('@@JSON@@', json.dumps({'applied': len(deltas), 'saved': a.save}))

def cmd_export(a):
    arm = armature(); mapping = humanoid_map(); scene = bpy.context.scene
    fps = scene.render.fps; frames = list(range(a.start, a.end + 1))
    times = [round((f - a.start) / fps, 6) for f in frames]
    tracks = {vrm: [] for vrm in mapping}
    for f in frames:
        scene.frame_set(f); bpy.context.view_layer.update()
        for vrm, q in sample_pose(arm, mapping).items(): tracks[vrm].extend(round(v, 7) for v in q)
    keep = a.bones.split(',') if a.bones else [v for v in mapping if not all(abs(angle_deg(tracks[v][i*4:i*4+4], tracks[v][0:4])) < 1e-4 for i in range(len(frames))) or v in ('hips',)]
    clip = {'name': a.name, 'duration': times[-1], 'times': times, 'face': {},
            'tracks': [{'bone': v, 'rotations': tracks[v]} for v in keep],
            'source': 'authored in Blender ' + bpy.app.version_string, 'fps': fps}
    pathlib.Path(a.out).write_text(json.dumps(clip, separators=(',', ':')))
    print('@@JSON@@', json.dumps({'out': a.out, 'frames': len(frames), 'bones': len(keep), 'duration': times[-1]}))

def cmd_roundtrip(a):
    arm = armature(); mapping = humanoid_map(); motions = json.loads(pathlib.Path(a.motions).read_text())
    worst = {}
    for key in ['sit', 'handsIdle', 'peace', 'stand']:
        deltas = clip_frame(motions['clips'][key], 0)
        for pb in arm.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.rotation_mode = 'QUATERNION'
        bpy.context.view_layer.update()
        apply_deltas(arm, mapping, deltas)
        back = sample_pose(arm, mapping)
        errs = {b: angle_deg(deltas[b], back[b]) for b in deltas}
        worst[key] = max(errs.items(), key=lambda kv: kv[1])
        hand = (arm.matrix_world @ arm.pose.bones[mapping['rightHand']].matrix).to_translation()
        worst[key] = {'bone': worst[key][0], 'deg': round(worst[key][1], 5), 'rightHandWorld': [round(v, 3) for v in hand]}
    print('@@JSON@@', json.dumps(worst))

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser(); sub = p.add_subparsers(dest='cmd', required=True)
    i = sub.add_parser('import'); i.add_argument('--motions', required=True); i.add_argument('--clips', default='sit,handsIdle'); i.add_argument('--frame', type=int); i.add_argument('--save')
    e = sub.add_parser('export'); e.add_argument('--out', required=True); e.add_argument('--start', type=int, default=1); e.add_argument('--end', type=int, required=True); e.add_argument('--name', default='clip'); e.add_argument('--bones')
    r = sub.add_parser('roundtrip'); r.add_argument('--motions', required=True)
    a = p.parse_args(argv)
    {'import': cmd_import, 'export': cmd_export, 'roundtrip': cmd_roundtrip}[a.cmd](a)
