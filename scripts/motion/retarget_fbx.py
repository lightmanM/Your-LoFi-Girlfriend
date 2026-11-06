"""Transfer upper-body motion from a mocap FBX (Rokoko Studio / Mixamo bone names) onto Marycia,
on top of her supplied seated pose, and export a runtime clip.

  Blender -b marycia-working.blend --python retarget_fbx.py -- --fbx clip.fbx --motions source-motions.json --out clip.json [--name stretch --shots dir]

Each mapped bone receives the source bone's world rotation change from its own rest pose (both
rigs rest in a T-pose facing -Y), so bone rolls and proportions do not matter. The actor is
yawed so the hips face -Y on average. Legs, hips and fingers keep the supplied seated pose.
"""
import bpy, sys, json, math, pathlib, argparse
import numpy as np
from mathutils import Quaternion, Vector, Matrix
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import blender_bridge as br

ROKOKO = {'Spine1': 'spine', 'Spine4': 'chest', 'Neck': 'neck', 'Head': 'head',
          'Shoulder': 'Shoulder', 'Arm': 'UpperArm', 'ForeArm': 'LowerArm', 'Hand': 'Hand'}
MIXAMO = {'Spine': 'spine', 'Spine2': 'chest', 'Neck': 'neck', 'Head': 'head',
          'Shoulder': 'Shoulder', 'Arm': 'UpperArm', 'ForeArm': 'LowerArm', 'Hand': 'Hand'}
UPPER = ['hips', 'spine', 'chest', 'neck', 'head', 'leftShoulder', 'rightShoulder',
         'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand']

def source_map(bone_names):
    """{vrm bone: source bone} for the torso chain and both arms."""
    table = ROKOKO if 'Spine4' in bone_names else MIXAMO
    prefix = 'mixamorig:' if any(n.startswith('mixamorig:') for n in bone_names) else ''
    out = {}
    for src, vrm in table.items():
        if vrm[0].islower(): out[vrm] = prefix + src; continue
        for side in ('Left', 'Right'): out[side.lower() + vrm] = prefix + side + src
    missing = [s for s in out.values() if s not in bone_names]
    if missing: raise SystemExit('source bones not found: ' + ', '.join(missing))
    return out

def world_delta(arm, name):
    return (br.pose_world_q(arm, name) @ br.rest_world_q(arm, name).inverted()).normalized()

def yaw_fix(src, hips, frames):
    """Rotation about Z that makes the actor's mean hips facing -Y."""
    facing = Vector((0, 0, 0))
    for f in frames:
        bpy.context.scene.frame_set(f); bpy.context.view_layer.update()
        d = world_delta(src, hips) @ Vector((0, -1, 0)); facing += Vector((d.x, d.y, 0))
    angle = math.atan2(-1, 0) - math.atan2(facing.y, facing.x)
    return Matrix.Rotation(angle, 4, 'Z').to_quaternion(), math.degrees(angle)

def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    p = argparse.ArgumentParser(); p.add_argument('--fbx', required=True); p.add_argument('--motions', required=True); p.add_argument('--out', required=True)
    p.add_argument('--name', default='clip'); p.add_argument('--shots'); p.add_argument('--save'); p.add_argument('--blink-rise', type=float, default=0.18); p.add_argument('--skip', type=int, default=1, help='leading frames to drop (mocap exports often start on a rest pose)')
    a = p.parse_args(argv)
    arm = br.armature(); mapping = br.humanoid_map(); inv = {v: k for k, v in mapping.items()}
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=a.fbx, automatic_bone_orientation=False, use_anim=True)
    src = next(o for o in set(bpy.data.objects) - before if o.type == 'ARMATURE')
    smap = source_map({b.name for b in src.data.bones})
    action = src.animation_data.action; start, end = (int(round(v)) for v in action.frame_range)
    frames = list(range(start + a.skip, end + 1)); start += a.skip; scene = bpy.context.scene; fps = scene.render.fps
    motions = json.loads(pathlib.Path(a.motions).read_text())
    seated = {}; seated.update(br.clip_frame(motions['clips']['sit'], 0)); seated.update(br.clip_frame(motions['clips']['handsIdle'], 0))
    parent = {vrm: inv.get(br.humanoid_parent(arm, inv, raw)) for vrm, raw in mapping.items()}
    def seated_world(vrm):
        q = Quaternion((1, 0, 0, 0))
        while vrm: x, y, z, w = seated.get(vrm, (0, 0, 0, 1)); q = Quaternion((w, x, y, z)) @ q; vrm = parent[vrm]
        return q.normalized()
    hips_src = next(b.name for b in src.data.bones if b.name.endswith('Hips'))
    fix, fix_deg = yaw_fix(src, hips_src, frames[::10])
    tracks = {v: [] for v in UPPER}; times = []; blink = []
    for f in frames:
        scene.frame_set(f); bpy.context.view_layer.update()
        world = {v: seated_world(v) for v in UPPER}
        for vrm, sb in smap.items(): world[vrm] = br.q_to_gltf(fix @ world_delta(src, sb))
        for vrm in UPPER:
            local = world[vrm] if parent[vrm] is None else (world[parent[vrm]].inverted() @ world[vrm]).normalized()
            tracks[vrm].extend(round(x, 7) for x in (local.x, local.y, local.z, local.w))
        times.append(round((f - start) / fps, 6))
        head = (src.matrix_world @ src.pose.bones[smap['head']].matrix).to_translation()
        hands = [(src.matrix_world @ src.pose.bones[smap[s + 'Hand']].matrix).to_translation().z for s in ('left', 'right')]
        blink.append(1.0 if max(hands) - head.z > a.blink_rise else 0.0)
    r = 6; k = np.ones(2 * r + 1) / (2 * r + 1); bl = np.convolve(np.pad(np.array(blink), r, mode='edge'), k, mode='valid')
    clip = {'name': a.name, 'duration': times[-1], 'times': times, 'tracks': [{'bone': v, 'rotations': tracks[v]} for v in UPPER],
            'face': {'eyeBlinkLeft': [round(float(v), 4) for v in bl], 'eyeBlinkRight': [round(float(v), 4) for v in bl]},
            'source': f'mocap FBX retarget ({pathlib.Path(a.fbx).name}) in Blender {bpy.app.version_string}', 'fps': fps}
    pathlib.Path(a.out).write_text(json.dumps(clip, separators=(',', ':')))
    if a.shots: render_shots(a.shots, arm, mapping, src, clip, seated)
    if a.save: bpy.ops.wm.save_as_mainfile(filepath=a.save)
    print('@@JSON@@', json.dumps({'out': a.out, 'frames': len(frames), 'duration': times[-1], 'fps': fps, 'yawFixDeg': round(fix_deg, 1), 'sourceBones': smap}))

def render_shots(folder, arm, mapping, src, clip, seated):
    out = pathlib.Path(folder); out.mkdir(parents=True, exist_ok=True); scene = bpy.context.scene
    src.hide_render = True
    for o in bpy.data.objects:
        if o.parent == src or o.type == 'EMPTY': o.hide_render = True
    cam = bpy.data.objects.new('ShotCam', bpy.data.cameras.new('ShotCam')); scene.collection.objects.link(cam); scene.camera = cam
    cam.location = (1.35, -1.6, 1.0); cam.rotation_euler = (math.radians(82), 0, math.radians(40)); cam.data.lens = 50
    scene.render.engine = 'BLENDER_WORKBENCH'; scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'TEXTURE'
    scene.render.resolution_x = 480; scene.render.resolution_y = 540; scene.render.image_settings.file_format = 'PNG'
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
    n = len(clip['times'])
    for f in range(0, n, max(1, n // 9)):
        br.apply_deltas(arm, mapping, {k: v for k, v in seated.items() if k not in UPPER} | br.clip_frame(clip, f))
        scene.render.filepath = str(out / f'r{f:04d}.png'); bpy.ops.render.render(write_still=True)

if __name__ == '__main__':
    main()
