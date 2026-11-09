"""Reading pose revision on the copy made by setup_v2.py. Re-runnable: every run resets to the Codex pose first.
Fixes, in order: spine hinge, head droop, wrist twist (forearm takes the roll), backwards-bent fingers, magazine -> book held up.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
ROOT = Path(globals().get('ROOT', '.'))   # the repo root (pass ROOT when running from elsewhere)
h = (ROOT / 'scripts/balcony-pose/refine_rest_poses.py').read_text(); exec(h[h.index('def update():'):h.index('def clone_collection(')])
P = dict(spine=10.0, chest=-3.0, gaze=45.0, dist=0.35, book_lat=0.0, book_roll=-4.0, head_share=0.62, neck_share=0.35, head_tilt=4.0,
         W=0.145, H=0.21, T=0.010, alpha=12.0, grip_y=-0.04, dorsal_front=45.0, finger_back=20.0, hand_in=0.15, hand_off=0.012, hand_back=0.012,
         palm_len=0.05, max_roll=75.0, eye_max=25.0, blink=0.2, shoulder_drop=3.0, close=0.75, drop=0.0, slide=0.0, tilt=0.0, seat_only=False)
P.update(globals().get('OVR', {}))
s = bpy.data.scenes['Balcony • Reading v2 (Claude)']; bpy.context.window.scene = s
col = bpy.data.collections['Balcony • reading v2 character (Claude)']
a = bpy.data.objects['Reading v2 • armature']; ref = bpy.data.objects['Armature_bn0010.017']
for p in a.pose.bones:
    p.rotation_mode = 'QUATERNION'; p.matrix_basis = ref.pose.bones[p.name].matrix_basis.copy()
root = a.parent
if 'base_loc' not in root: root['base_loc'] = list(root.location)
root.location = Vector(root['base_loc']); update()
face = next(o for o in col.objects if 'Face' in o.name)
for k in ('eyeBlinkLeft', 'eyeBlinkRight'): face.data.shape_keys.key_blocks[k].value = P['blink']
update()
M = a.matrix_world; Minv = M.inverted(); R = M.to_3x3().normalized()
fwd = R @ Vector((0, -1, 0)); left = R @ Vector((1, 0, 0)); up = Vector((0, 0, 1))
LEFT, UP, FWD = (1, 0, 0), (0, 0, 1), (0, -1, 0)
Wp = lambda n: M @ a.pose.bones[n].head
Lc = lambda v: Minv @ v
A3 = lambda v: (Minv.to_3x3() @ v).normalized()
rad, deg = math.radians, math.degrees
rep = {'params': P}
# 0. Seat: drop the pelvis onto the seat (and optionally slide it back); legs re-solved so the feet stay planted.
from mathutils.bvhtree import BVHTree
feet = {sd: (M @ a.pose.bones['Foot.' + sd].matrix).copy() for sd in 'LR'}; knees = {sd: Wp('Lower_leg.' + sd) for sd in 'LR'}
root.location = Vector(root['base_loc']) + Vector((0, 0, -P['drop'])) - fwd * P['slide']; update()
M = a.matrix_world; Minv = M.inverted()
turn(a, 'Hips', LEFT, -P['tilt']); turn(a, 'Spine', LEFT, P['tilt'])   # pelvis back, torso orientation kept
for sd, sg in (('L', 1), ('R', -1)):
    fm = feet[sd]; limb(a, 'Upper_leg.' + sd, 'Lower_leg.' + sd, 'Foot.' + sd, Lc(fm.translation), Lc(knees[sd] + fwd * 0.3), sg, True)
    pf = a.pose.bones['Foot.' + sd]; mm = Minv @ fm; mm.translation = head(a, pf.name); pf.matrix = mm; update()
    rep['foot_drift_mm_' + sd] = round(((M @ a.pose.bones['Foot.' + sd].head) - fm.translation).length * 1000, 1)
def seat_contact():
    dg = bpy.context.evaluated_depsgraph_get(); trees = []
    for c in [o for o in s.objects if o.name.startswith('Reading chair')]:
        e = c.evaluated_get(dg); me = e.to_mesh(); trees.append(BVHTree.FromPolygons([e.matrix_world @ v.co for v in me.vertices], [tuple(p.vertices) for p in me.polygons])); e.to_mesh_clear()
    body = []
    for o in col.objects:
        if o.type == 'MESH' and any(k in o.name for k in ('SkinBody', 'CosA', 'Underwear')):
            e = o.evaluated_get(dg); me = e.to_mesh(); body += [e.matrix_world @ v.co for v in me.vertices]; e.to_mesh_clear()
    hp = Wp('Hips'); cells = {}
    for v in body:
        if v.z > hp.z or v.z < 0.25: continue
        f = (v - hp).dot(fwd); l = (v - hp).dot(left)
        if -0.16 < f < 0.30 and abs(l) < 0.14:
            k = (int((f + 0.16) // 0.03), int((l + 0.14) // 0.04))
            if k not in cells or v.z < cells[k].z: cells[k] = v
    butt, thigh = [], []
    for (i, j), v in cells.items():
        zs = [hit[0].z for t in trees for hit in [t.ray_cast(v + Vector((0, 0, 0.05)), Vector((0, 0, -1)), 0.6)] if hit[0] is not None]
        if not zs: continue
        g = (v.z - max(zs)) * 100; (butt if (v - hp).dot(fwd) < -0.01 else thigh).append(g)
    butt.sort(); thigh.sort()
    return {'buttock_gap_cm_min': round(butt[0], 1), 'buttock_gap_cm_median': round(butt[len(butt) // 2], 1), 'thigh_gap_cm_min': round(thigh[0], 1), 'thigh_gap_cm_median': round(thigh[len(thigh) // 2], 1)}
rep['seat'] = seat_contact()
class _Stop(Exception): pass
if P['seat_only']: print(json.dumps(rep)); raise _Stop()
# 1. Spine: straighten the lumbar slump and the chest hinge. Pelvis and legs untouched.
turn(a, 'Spine', LEFT, P['spine']); turn(a, 'Chest', LEFT, P['chest'])
turn(a, 'Shoulder.L', FWD, -P['shoulder_drop']); turn(a, 'Shoulder.R', FWD, P['shoulder_drop'])
def eyes(): return (Wp('Eye.L') + Wp('Eye.R')) / 2
def book_centre():
    d = fwd * math.cos(rad(P['gaze'])) - up * math.sin(rad(P['gaze']))
    return eyes() + d * P['dist'] + left * P['book_lat']
def aim_head(target, share):
    hz0 = a.pose.bones['Head'].matrix.to_3x3().col[2].normalized(); t = (Lc(target) - head(a, 'Head')).normalized()
    axis, ang = hz0.rotation_difference(t).to_axis_angle(); want = Quaternion(axis, ang * share) @ hz0
    turn(a, 'Neck', axis, deg(ang * share) * P['neck_share'])
    hz = a.pose.bones['Head'].matrix.to_3x3().col[2].normalized(); axis2, ang2 = hz.rotation_difference(want).to_axis_angle()
    turn(a, 'Head', axis2, deg(ang2))
# 2. Head: provisional aim so the eyes settle, then place the book from the settled eyes.
aim_head(book_centre(), P['head_share']); C = book_centre()
n = (eyes() - C).normalized(); y = (up - n * up.dot(n)).normalized(); x = n.cross(y).normalized()
if x.dot(left) < 0: x = -x
q = Quaternion(n, rad(P['book_roll'])); x = q @ x; y = q @ y
# 3. Book: two page blocks in a shallow V, hard cover, spine, printed lines.
for o in [o for o in col.objects if o.name.startswith('Reading v2 • book')]: bpy.data.objects.remove(o)
def mat(name, rgb, rough=0.85):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    bsdf = next(nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED'); bsdf.inputs['Base Color'].default_value = (*rgb, 1); bsdf.inputs['Roughness'].default_value = rough
    return m
paper, cover, ink = mat('Reading v2 • paper', (.83, .79, .69), .9), mat('Reading v2 • cover', (.17, .25, .32), .6), mat('Reading v2 • ink', (.28, .25, .22))
book = bpy.data.objects.new('Reading v2 • book', None); col.objects.link(book)
Wd, Hd, T, ta, N = P['W'], P['H'], P['T'], math.tan(rad(P['alpha'])), 14
zt = lambda u: u * ta + T * min(1.0, u / 0.03) ** 0.5 + 0.003 * math.sin(math.pi * u / Wd)
zb = lambda u: u * ta
def mesh_obj(name, verts, faces, m, smooth=False):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    for p in me.polygons: p.use_smooth = smooth
    o = bpy.data.objects.new(name, me); col.objects.link(o); o.parent = book; me.materials.append(m); return o
for sgn in (1, -1):
    xs = [Wd * i / N for i in range(N + 1)]; vi = lambda L, i, j: L * (N + 1) * 2 + j * (N + 1) + i
    verts = [(sgn * u, yv, (zt if L == 0 else zb)(u)) for L in (0, 1) for yv in (-Hd / 2, Hd / 2) for u in xs]
    faces = []
    for i in range(N):
        faces += [(vi(0, i, 0), vi(0, i + 1, 0), vi(0, i + 1, 1), vi(0, i, 1)), (vi(1, i, 1), vi(1, i + 1, 1), vi(1, i + 1, 0), vi(1, i, 0)),
                  (vi(0, i, 1), vi(0, i + 1, 1), vi(1, i + 1, 1), vi(1, i, 1)), (vi(1, i, 0), vi(1, i + 1, 0), vi(0, i + 1, 0), vi(0, i, 0))]
    faces.append((vi(0, N, 0), vi(1, N, 0), vi(1, N, 1), vi(0, N, 1)))
    if sgn < 0: faces = [tuple(reversed(f)) for f in faces]
    mesh_obj('Reading v2 • book pages', verts, faces, paper)
    cx = [(Wd + 0.004) * i / N for i in range(N + 1)]; cy = Hd / 2 + 0.005
    cv = [(sgn * u, yv, u * ta - 0.0004) for yv in (-cy, cy) for u in cx]
    cf = [(i, i + 1, N + 2 + i, N + 1 + i) for i in range(N)]
    if sgn < 0: cf = [tuple(reversed(f)) for f in cf]
    co = mesh_obj('Reading v2 • book cover', cv, cf, cover); sm = co.modifiers.new('Board', 'SOLIDIFY'); sm.thickness = 0.0025; sm.offset = -1
    lv, lf = [], []
    for k in range(16):
        y0 = Hd / 2 - 0.022 - k * 0.0085; x1 = Wd - 0.014 - (0.04 if k % 6 == 5 else 0)
        us = [0.022 + (x1 - 0.022) * t / 5 for t in range(6)]; b0 = len(lv)
        lv += [(sgn * u, yy, zt(u) + 0.0007) for yy in (y0, y0 + 0.0026) for u in us]
        lf += [(b0 + t, b0 + t + 1, b0 + 7 + t, b0 + 6 + t) for t in range(5)]
    if sgn < 0: lf = [tuple(reversed(f)) for f in lf]
    mesh_obj('Reading v2 • book print', lv, lf, ink)
sv = [(dx, dy, dz) for dz in (-0.009, -0.001) for dy in (-Hd / 2 - 0.005, Hd / 2 + 0.005) for dx in (-0.006, 0.006)]
mesh_obj('Reading v2 • book spine', sv, [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)], cover)
Bm = Matrix((x, y, n)).transposed().to_4x4(); Bm.translation = C; book.matrix_world = Bm; update()
Binv = book.matrix_world.inverted()
# 4. Arms: two-bone IK to the outer page edges, elbows down by the waist; the forearm takes the roll so the wrist only bends.
ca, sa = math.cos(rad(P['alpha'])), math.sin(rad(P['alpha']))
def place_arm(side, sgn):
    B3 = book.matrix_world.to_3x3().normalized()
    outward = (B3 @ Vector((sgn * ca, 0, sa))).normalized(); ns = (B3 @ Vector((-sgn * sa, 0, ca))).normalized(); yb = (B3 @ Vector((0, 1, 0))).normalized()
    G = book.matrix_world @ Vector((sgn * Wd, P['grip_y'], Wd * ta + T * 0.5))
    be, ga = rad(P['dorsal_front']), rad(P['finger_back'])
    dorsal = (outward * math.cos(be) - ns * math.sin(be)).normalized()
    hdir = (yb * math.cos(ga) - ns * math.sin(ga) - outward * P['hand_in']).normalized(); hdir = (hdir - dorsal * hdir.dot(dorsal)).normalized()
    wrist = G + dorsal * P['hand_off'] - ns * P['hand_back'] - hdir * P['palm_len']
    pole = Wp('Upper_arm.' + side) - up * 0.35 - fwd * 0.10 + left * sgn * 0.12
    r = limb(a, 'Upper_arm.' + side, 'Lower_arm.' + side, 'Hand.' + side, Lc(wrist), Lc(pole), sgn)
    lo = 'Lower_arm.' + side; ld = (head(a, 'Hand.' + side) - head(a, lo)).normalized()
    nz = a.pose.bones[lo].matrix.to_3x3().col[2].normalized(); want = A3(dorsal); want = (want - ld * want.dot(ld)).normalized()
    ang = nz.angle(want); k = min(1.0, rad(P['max_roll']) / ang) if ang > 1e-6 else 1.0
    orient(a, lo, ld, nz.slerp(want, k)); orient(a, 'Hand.' + side, A3(hdir), A3(dorsal))
    return r, deg(ang), G, ns
FING = {'Index': 0.8, 'Middle': 0.9, 'Ring': 1.0, 'Little': 1.1}; CURL = {'Proximal': -32.0, 'Intermediate': -40.0, 'Distal': -20.0}
def abduction(side, f):
    # Rest-pose fan: swing each finger toward the middle finger about its own Z (dorsal) axis.
    if f == 'Middle': return 0.0
    hz = a.data.bones['Hand.' + side].matrix_local.to_3x3().col[2].normalized()
    def ydir(bn): v = a.data.bones[bn].matrix_local.to_3x3().col[1]; return (v - hz * v.dot(hz)).normalized()
    mid, me = ydir(f'Middle Proximal.{side}'), ydir(f'{f} Proximal.{side}'); th = me.angle(mid)
    z = a.data.bones[f'{f} Proximal.{side}'].matrix_local.to_3x3()
    best = min((s_ * th * P['close'] for s_ in (1, -1)), key=lambda ab: ((z @ (Quaternion((0, 0, 1), ab) @ Vector((0, 1, 0)))) - hz * 0).normalized().angle(mid))
    return best
def fit_finger(side, f):
    bones = [a.pose.bones[f'{f} {g}.{side}'] for g in CURL]; best = None; ab = abduction(side, f)
    for m in [0.2 + 0.1 * i for i in range(17)]:
        for b, g in zip(bones, CURL): b.rotation_quaternion = Quaternion((1, 0, 0), rad(CURL[g] * FING[f] * m))
        bones[0].rotation_quaternion = Quaternion((0, 0, 1), ab) @ bones[0].rotation_quaternion
        update(); tip = Binv @ (M @ bones[2].tail); u = abs(tip.x)
        err = (tip.z - (u * ta - 0.003 - 0.008)) if u < Wd else 0.02
        score = abs(err) + (3 * err if err > 0 else 0)
        if best is None or score < best[0]: best = (score, m, err)
    for b, g in zip(bones, CURL): b.rotation_quaternion = Quaternion((1, 0, 0), rad(CURL[g] * FING[f] * best[1]))
    bones[0].rotation_quaternion = Quaternion((0, 0, 1), ab) @ bones[0].rotation_quaternion
    update(); return round(best[1], 1), round(best[2] * 1000, 1), round(deg(ab), 1)
for side, sgn in (('L', 1), ('R', -1)):
    r, roll, G, ns = place_arm(side, sgn); rep['wrist_ik_mm_' + side] = round(r * 1000, 1); rep['forearm_roll_' + side] = round(roll, 1)
    rep['fingers_' + side] = {f: fit_finger(side, f) for f in FING}
    tp = a.pose.bones['Thumb Proximal.' + side]; end = a.pose.bones['Thumb Distal.' + side].tail.copy(); st = head(a, tp.name)
    u = Wd - 0.03; tt = Lc(book.matrix_world @ Vector((sgn * u, P['grip_y'] + 0.035, zt(u) + 0.007)))
    qq = (end - st).rotation_difference(tt - st); mm = tp.matrix.copy(); tp.matrix = Matrix.Translation(st) @ qq.to_matrix().to_4x4() @ Matrix.Translation(-st) @ mm; update()
# 5. Head final aim at the upper half of the page, small tilt; eyes take the rest.
look = book.matrix_world @ Vector((0, 0.02, 0)); aim_head(look, P['head_share'])
hz = a.pose.bones['Head'].matrix.to_3x3().col[2].normalized(); turn(a, 'Head', hz, P['head_tilt'])
for e in ('Eye.L', 'Eye.R'):
    ez = a.pose.bones[e].matrix.to_3x3().col[2].normalized(); t = (Lc(look) - head(a, e)).normalized()
    axis, ang = ez.rotation_difference(t).to_axis_angle(); turn(a, e, axis, min(deg(ang), P['eye_max']))
# 6. Report.
def lean(a_, b_):
    d = Wp(b_) - Wp(a_); return round(deg(math.atan2(d.dot(fwd), d.dot(up))), 1)
def rel(parent, child):
    qd = (a.data.bones[parent].matrix_local.to_quaternion().inverted() @ a.data.bones[child].matrix_local.to_quaternion()).inverted() @ (a.pose.bones[parent].matrix.to_quaternion().inverted() @ a.pose.bones[child].matrix.to_quaternion())
    sw, tw = qd.to_swing_twist('Y'); return {'twist': round(deg(tw), 1), 'bend': round(deg(sw.angle), 1)}
hzw = (M @ a.pose.bones['Head'].matrix).to_3x3().normalized().col[2]
rep['segments_fwd_deg'] = {f'{p}->{c}': lean(p, c) for p, c in (('Hips', 'Spine'), ('Spine', 'Chest'), ('Chest', 'Neck'), ('Neck', 'Head'))}
rep['head_pitch_down_deg'] = round(deg(math.asin(-hzw.z)), 1); rep['book_from_eyes_m'] = round((C - eyes()).length, 3)
rep['gaze_below_head_deg'] = round(deg(hzw.angle((look - (M @ a.pose.bones['Head'].head)).normalized())), 1)
for side in 'LR': rep['wrist_' + side] = rel('Lower_arm.' + side, 'Hand.' + side); rep['elbow_' + side] = rel('Upper_arm.' + side, 'Lower_arm.' + side)
dg = bpy.context.evaluated_depsgraph_get(); vs = []
for o in col.objects:
    if o.type == 'MESH' and any(k in o.name for k in ('SkinBody', 'CosA')):
        e = o.evaluated_get(dg); me = e.to_mesh(); vs += [e.matrix_world @ v.co for v in me.vertices]; e.to_mesh_clear()
bottom = [book.matrix_world @ Vector((u, -Hd / 2, 0)) for u in (-0.1, 0, 0.1)]
rep['book_bottom_to_body_mm'] = [round(min((v - b).length for v in vs) * 1000) for b in bottom]
hips, chest, neck = Wp('Hips'), Wp('Chest'), Wp('Neck')
band = [v for v in vs if chest.z - 0.02 < v.z < neck.z + 0.02 and abs((v - chest).dot(left)) < 0.12]
chairs = [o for o in s.objects if o.name.startswith('Reading chair')]; cvs = [o.matrix_world @ v.co for o in chairs for v in o.data.vertices]
br = [v for v in cvs if chest.z - 0.05 < v.z < neck.z + 0.1 and abs((v - hips).dot(left)) < 0.12]
rep['backrest_gap_m'] = round(min((v - hips).dot(fwd) for v in band) - max((v - hips).dot(fwd) for v in br), 3)
print(json.dumps(rep))
