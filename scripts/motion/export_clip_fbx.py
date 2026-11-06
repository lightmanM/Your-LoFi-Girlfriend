"""Bake a runtime clip onto Marycia's armature as keyframes and export an FBX (mesh + skeleton + animation),
e.g. to inspect or edit the motion in Cascadeur.
  Blender -b marycia-working.blend --python export_clip_fbx.py -- --clip stretch --motions authored-motions.json --seat source-motions.json --out stretch.fbx [--save stretch.blend]
"""
import bpy, sys, json, pathlib, argparse
from mathutils import Quaternion
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import blender_bridge as br
argv = sys.argv[sys.argv.index('--') + 1:]
p = argparse.ArgumentParser(); p.add_argument('--clip', required=True); p.add_argument('--motions', required=True); p.add_argument('--seat', required=True); p.add_argument('--out', required=True); p.add_argument('--save'); p.add_argument('--every', type=int, default=1)
a = p.parse_args(argv)
clip = json.loads(pathlib.Path(a.motions).read_text())['clips'][a.clip]; seat_lib = json.loads(pathlib.Path(a.seat).read_text())
seated = {}; seated.update(br.clip_frame(seat_lib['clips']['sit'], 0)); seated.update(br.clip_frame(seat_lib['clips']['handsIdle'], 0))
arm = br.armature(); mapping = br.humanoid_map(); scene = bpy.context.scene
fps = round(clip.get('fps') or (len(clip['times']) - 1) / max(clip['duration'], 1e-6)); scene.render.fps = fps
n = len(clip['times']); scene.frame_start = 1; scene.frame_end = n
for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
last = {}
for i in range(0, n, a.every):
    frame = i + 1; scene.frame_set(frame)
    deltas = dict(seated); deltas.update(br.clip_frame(clip, i))
    br.apply_deltas(arm, mapping, deltas)
    for raw in mapping.values():
        pb = arm.pose.bones[raw]; q = pb.rotation_quaternion.copy()
        if raw in last and q.dot(last[raw]) < 0: q = Quaternion((-q.w, -q.x, -q.y, -q.z)); pb.rotation_quaternion = q
        last[raw] = q.copy(); pb.keyframe_insert('rotation_quaternion', frame=frame)
if a.save: bpy.ops.wm.save_as_mainfile(filepath=a.save)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.fbx(filepath=a.out, use_selection=True, add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False, bake_anim_simplify_factor=0.0, mesh_smooth_type='OFF', path_mode='COPY', embed_textures=True, apply_scale_options='FBX_SCALE_ALL')
print('@@JSON@@', json.dumps({'out': a.out, 'frames': n, 'fps': fps, 'bytes': pathlib.Path(a.out).stat().st_size}))
