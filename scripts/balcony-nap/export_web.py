"""Export where the nap ends, for the page: her sleeping pose (the page's pose format), where her hips lie, and where
the closed book rests. Run in the live Blender after setup.py, with ROOT (the checkout to write into) and REPORT (the
character's export report, assets/characters/marycia/marycia-working.export.json) set in the namespace.

Coordinates: Blender (x, y, z) -> three.js (x, z, -y).
"""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Quaternion
import nap
import rig as R

ROOT = Path(globals().get('ROOT', '.'))
sys.path.insert(0, str(ROOT / 'scripts/motion'))
import blender_bridge as br  # noqa: E402

C = Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0)))
OUT = ROOT / 'web/public/environment/balcony-toon/nap.json'


def export():
    arm = bpy.data.objects[nap.NAMES['arm']]
    bpy.context.window.scene = bpy.data.scenes[nap.SCENE]
    shot = nap.Shot(arm)
    out = shot.pose(nap.LENGTH)
    R.write_pose(arm, shot.b.rg)
    bpy.context.view_layer.update()
    hips = arm.matrix_world @ arm.pose.bones['Hips'].head
    # the pose in her own frame: sampled with the placement's turn taken off the armature, as the reading pose was
    loc, _, sca = arm.matrix_world.decompose()
    saved = arm.matrix_world.copy()
    arm.matrix_world = Matrix.LocRotScale(loc, Quaternion(), sca)
    bpy.context.view_layer.update()
    deltas = br.sample_pose(arm, br.humanoid_map(globals()['REPORT']))
    arm.matrix_world = saved
    bpy.context.view_layer.update()
    tracks = [{'bone': b, 'rotations': [round(v, 7) for v in d]} for b, d in deltas.items() if b not in ('leftEye', 'rightEye')]
    c4 = C.to_4x4()
    book = c4 @ out['book'] @ c4.inverted()
    data = {'name': 'napBalcony', 'duration': 0, 'times': [0], 'tracks': tracks, 'blink': 1,
            'hips': [round(v, 5) for v in (C @ hips)],
            'book': {'matrix': [round(book[r][c], 6) for c in range(4) for r in range(4)], 'shut': nap.SHUT},
            'source': 'Blender scene ' + nap.SCENE + ', scripts/balcony-nap/nap.py'}
    OUT.write_text(json.dumps(data, separators=(',', ':')))
    return {'tracks': len(tracks), 'hips': data['hips'], 'file': str(OUT)}


WALK = ROOT / 'web/public/environment/balcony-toon/nap-walk.json'
BACK = ROOT / 'web/public/environment/balcony-toon/nap-back.json'
FAR = 1e6       # "never", for a mark that has no end


def export_clip(shot, length, path, name, marks, blend):
    """A whole shot, a pose every frame, for the page to play (web/src/balcony/nap-walk.js).

    Bone rotations are in her own frame as in the pose files (from the rig's own maths: no scene updates), her hips'
    place and the book's shut angle beside them, and three expressions the page's characters all have.
    marks (seconds): seated [from, to]: her weight on the chair's seat goes from all at `from` to none at `to` (either
    order in time); cover [from, to]: while the picture's door frame and furniture may cover her; shadow
    [in from, in to, out from, out to]: her shadow on the picture. blend: seconds the page takes to ease in from
    the pose she is in, and out to her reading."""
    arm = bpy.data.objects[nap.NAMES['arm']]
    rg = shot.b.rg
    mapping = {v: raw for v, raw in br.humanoid_map(globals()['REPORT']).items() if v not in ('leftEye', 'rightEye')}
    inv = {raw: v for v, raw in mapping.items()}
    parent = {raw: br.humanoid_parent(arm, inv, raw) for raw in mapping.values()}
    count = int(round(length * nap.FPS)) + 1
    rot = {v: [] for v in mapping}
    hips, shut, face = [], [], {'blink': [], 'aa': [], 'relaxed': []}
    for i in range(count):
        out = shot.pose(i / nap.FPS)
        world = {raw: br.q_to_gltf(rg.m(raw).to_quaternion() @ rg.rest[raw].to_quaternion().inverted()).normalized() for raw in mapping.values()}
        for v, raw in mapping.items():
            d = world[raw] if not parent[raw] else (world[parent[raw]].inverted() @ world[raw]).normalized()
            if rot[v] and rot[v][-1].dot(d) < 0:
                d = -d                                   # neighbouring frames on the same side of the quaternion sphere
            rot[v].append(d)
        hips.append(C @ shot.b.world('Hips'))
        shut.append(out['shut'])
        f = out['face']
        face['blink'].append(f['eyeBlinkLeft'])
        face['aa'].append(f['jawOpen'])
        face['relaxed'].append(f['mouthSmileLeft'])
    bones = {}
    for v, qs in rot.items():
        still = max(qs[0].rotation_difference(q).angle for q in qs) < 1e-4
        bones[v] = [round(x, 5) for q in (qs[:1] if still else qs) for x in (q.x, q.y, q.z, q.w)]
    data = {'name': name, 'fps': nap.FPS, 'frames': count, 'bones': bones,
            'hips': [round(x, 4) for p in hips for x in p], 'shut': [round(x, 2) for x in shut],
            'face': {k: [round(x, 3) for x in v] for k, v in face.items()},
            'marks': {k: [round(x, 3) for x in v] for k, v in marks.items()}, 'blend': blend,
            'source': 'Blender scene ' + nap.SCENE + ', scripts/balcony-nap'}
    path.write_text(json.dumps(data, separators=(',', ':')))
    moving = sum(1 for v in bones.values() if len(v) > 4)
    return {'frames': count, 'bones': len(bones), 'moving': moving, 'kb': round(path.stat().st_size / 1024), 'file': str(path)}


def export_walk():
    """Her walk out to the daybed (nap.py)."""
    shot = nap.Shot(bpy.data.objects[nap.NAMES['arm']])
    up = nap.RISE[0] + 1.3
    return export_clip(shot, nap.LENGTH, WALK, 'napWalk', blend={'in': 0.8, 'out': 0},
                       marks={'seated': [nap.RISE[0] + 0.5, up], 'cover': [nap.W0 + 0.6, FAR], 'shadow': [up, up + 0.8, FAR, FAR + 1]})


def export_back():
    """Her way back to her chair (back.py). Near the chair (x past 8.95 on her way in) the picture stops covering her."""
    import back
    shot = back.Back(bpy.data.objects[nap.NAMES['arm']])
    near = next(i / nap.FPS for i in range(int(back.W0 * nap.FPS), int(back.LENGTH * nap.FPS))
                if (shot.pose(i / nap.FPS), shot.b.world('Hips').x)[1] > 8.95)
    return export_clip(shot, back.LENGTH, BACK, 'napBack', blend={'in': 1.0, 'out': 1.2},
                       marks={'seated': [back.SIT[1], back.SIT[1] - 0.75], 'cover': [-1, near], 'shadow': [-2, -1, near - 0.3, near + 0.5]})
