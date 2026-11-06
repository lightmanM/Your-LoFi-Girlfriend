"""Transfer upper-body motion from a tracked reference video (MediaPipe pose JSON)
onto Marycia, on top of her supplied seated pose, and export a runtime clip.

  Blender -b marycia-working.blend --python retarget_reference.py -- --pose pose.json --motions source-motions.json --out clip.json [--start s --end s] [--shots dir]

Torso lean/twist and head turns are transferred as rotations relative to the
subject's first frames; arms are transferred as bone directions in the torso frame.
Legs and hips keep the seated pose. Fingers keep the supplied relaxed hands.
"""
import bpy, sys, json, math, pathlib, argparse
import numpy as np
from mathutils import Quaternion, Matrix, Vector
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import blender_bridge as br

argv = sys.argv[sys.argv.index('--') + 1:]
p = argparse.ArgumentParser(); p.add_argument('--pose', required=True); p.add_argument('--motions', required=True); p.add_argument('--out', required=True)
p.add_argument('--start', type=float, default=0); p.add_argument('--end', type=float); p.add_argument('--smooth', type=float, default=2.0)
p.add_argument('--shots'); p.add_argument('--name', default='stretch'); p.add_argument('--save')
a = p.parse_args(argv)

pose = json.loads(pathlib.Path(a.pose).read_text()); L = {n: i for i, n in enumerate(pose['landmarks'])}
frames = [f for f in pose['frames'] if f['world'] and a.start <= f['t'] <= (a.end if a.end is not None else 1e9)]
fps = pose['fps']
W = np.array([f['world'] for f in frames])              # (n, 33, 3) MediaPipe world: x right, y down, z away
# Gaussian smoothing along time.
if a.smooth > 0:
    r = int(3 * a.smooth); k = np.exp(-0.5 * (np.arange(-r, r + 1) / a.smooth) ** 2); k /= k.sum()
    pad = np.pad(W, ((r, r), (0, 0), (0, 0)), mode='edge')
    W = np.stack([np.apply_along_axis(lambda s: np.convolve(s, k, mode='valid'), 0, pad[:, j, :]) for j in range(W.shape[1])], axis=1)
# MediaPipe (x right, y down, z away from camera) -> Blender (X = subject's left, Y = away from camera, Z = up)
B = np.stack([W[..., 0], W[..., 2], -W[..., 1]], axis=-1)
def pt(f, name): return Vector(B[f, L[name]])
def mid(f, n1, n2): return (pt(f, n1) + pt(f, n2)) * .5
def basis(right, up):
    right = right.normalized(); forward = right.cross(up).normalized(); up = forward.cross(right).normalized()
    return Matrix((right, up, forward)).transposed()        # columns: right, up, forward
def torso_basis(f): return basis(pt(f, 'LEFT_SHOULDER') - pt(f, 'RIGHT_SHOULDER'), mid(f, 'LEFT_SHOULDER', 'RIGHT_SHOULDER') - mid(f, 'LEFT_HIP', 'RIGHT_HIP'))
def head_basis(f):
    right = pt(f, 'LEFT_EAR') - pt(f, 'RIGHT_EAR'); forward = pt(f, 'NOSE') - mid(f, 'LEFT_EAR', 'RIGHT_EAR')
    right = right.normalized(); up = forward.cross(right).normalized(); forward = right.cross(up).normalized()
    return Matrix((right, up, forward)).transposed()
rest_n = min(10, len(frames))
def mean_basis(fn):
    ms = [fn(f) for f in range(rest_n)]; q = ms[0].to_quaternion()
    for m in ms[1:]: q = q.slerp(m.to_quaternion(), 1 / len(ms))
    return q.to_matrix()
B0, H0 = mean_basis(torso_basis), mean_basis(head_basis)
M0 = Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0))).transposed()   # columns: right +X, up +Z, forward -Y (Marycia faces -Y)
to_m = lambda d: (M0 @ (B0.inverted() @ d)).normalized()       # subject world direction -> Marycia world direction
def rel_rot(cur, rest): return M0 @ (B0.inverted() @ (cur @ rest.inverted()) @ B0) @ M0.inverted()

scene = bpy.context.scene; scene.render.fps = round(fps); arm = br.armature(); mapping = br.humanoid_map()
motions = json.loads(pathlib.Path(a.motions).read_text())
seated = {}; seated.update(br.clip_frame(motions['clips']['sit'], 0)); seated.update(br.clip_frame(motions['clips']['handsIdle'], 0))
for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
Bn = lambda vrm: arm.pose.bones[mapping[vrm]]
def world_m(pb): return arm.matrix_world @ pb.matrix
def rotate_world_m(pb, R):
    bpy.context.view_layer.update(); m = world_m(pb); head = m.to_translation()
    pb.matrix = arm.matrix_world.inverted() @ (Matrix.Translation(head) @ R.to_4x4() @ Matrix.Translation(-head) @ m); bpy.context.view_layer.update()
def aim(pb, direction):
    bpy.context.view_layer.update(); m = world_m(pb); head = m.to_translation()
    cur = (m @ Vector((0, pb.bone.length, 0)) - head).normalized()
    rotate_world_m(pb, cur.rotation_difference(direction.normalized()).to_matrix())

tracks = {v: [] for v in mapping}; times = []; blink = []
for f in range(len(frames)):
    br.apply_deltas(arm, mapping, seated)
    Rt = rel_rot(torso_basis(f), B0); qt = Rt.to_quaternion()
    rotate_world_m(Bn('spine'), qt.slerp(Quaternion(), .55).to_matrix()); rotate_world_m(Bn('chest'), qt.slerp(Quaternion(), .45).to_matrix())
    Rh = rel_rot(head_basis(f), H0) @ Rt.inverted(); qh = Rh.to_quaternion()     # head relative to the torso
    rotate_world_m(Bn('neck'), qh.slerp(Quaternion(), .7).to_matrix()); rotate_world_m(Bn('head'), qh.slerp(Quaternion(), .3).to_matrix())
    for side, S in (('left', 'LEFT'), ('right', 'RIGHT')):
        sh, el, wr = pt(f, S + '_SHOULDER'), pt(f, S + '_ELBOW'), pt(f, S + '_WRIST'); hand = (pt(f, S + '_INDEX') + pt(f, S + '_PINKY')) * .5
        aim(Bn(side + 'UpperArm'), to_m(el - sh)); aim(Bn(side + 'LowerArm'), to_m(wr - el)); aim(Bn(side + 'Hand'), to_m(hand - wr))
    sample = br.sample_pose(arm, mapping)
    for v in mapping: tracks[v].extend(round(x, 7) for x in sample[v])
    times.append(round(frames[f]['t'] - frames[0]['t'], 6))
    up = max(pt(f, 'LEFT_WRIST').z, pt(f, 'RIGHT_WRIST').z) - pt(f, 'NOSE').z
    blink.append(1.0 if up > .05 else 0.0)
keep = ['hips', 'spine', 'chest', 'neck', 'head', 'leftShoulder', 'rightShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand']
# Eyes close while the arms are overhead (smoothed step).
bl = np.array(blink); r = 6; k = np.ones(2 * r + 1) / (2 * r + 1); bl = np.convolve(np.pad(bl, r, mode='edge'), k, mode='valid')
clip = {'name': a.name, 'duration': times[-1], 'times': times, 'tracks': [{'bone': v, 'rotations': tracks[v]} for v in keep],
        'face': {'eyeBlinkLeft': [round(float(v), 4) for v in bl], 'eyeBlinkRight': [round(float(v), 4) for v in bl]},
        'source': 'reference video retarget (MediaPipe pose) in Blender ' + bpy.app.version_string, 'fps': fps}
pathlib.Path(a.out).write_text(json.dumps(clip, separators=(',', ':')))
if a.shots:
    out = pathlib.Path(a.shots); out.mkdir(parents=True, exist_ok=True)
    cam = bpy.data.objects.new('ShotCam', bpy.data.cameras.new('ShotCam')); scene.collection.objects.link(cam); scene.camera = cam
    cam.location = (1.35, -1.6, 1.0); cam.rotation_euler = (math.radians(82), 0, math.radians(40)); cam.data.lens = 50
    scene.render.engine = 'BLENDER_WORKBENCH'; scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'TEXTURE'
    scene.render.resolution_x = 480; scene.render.resolution_y = 540; scene.render.image_settings.file_format = 'PNG'
    for f in range(0, len(frames), max(1, len(frames) // 9)):
        br.apply_deltas(arm, mapping, {b['bone']: b['rotations'][f*4:f*4+4] for b in clip['tracks']} | {k: v for k, v in seated.items() if k not in keep})
        scene.render.filepath = str(out / f'r{f:04d}.png'); bpy.ops.render.render(write_still=True)
print('@@JSON@@', json.dumps({'out': a.out, 'frames': len(frames), 'duration': times[-1], 'fps': fps}))
