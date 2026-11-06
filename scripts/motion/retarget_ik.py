"""Proportion-aware retarget of a mocap FBX onto Marycia: torso by rotation, arms by position (IK).

  Blender -b marycia-working.blend --python retarget_ik.py -- --fbx clip.fbx --motions source-motions.json --out clip.json [--name x --shots dir]

Torso, neck, head and clavicles take the source bone's world rotation change from rest, as in
retarget_fbx.py (the clavicle shrug blended down, see --clavicle). Arms are placed by position:
  1. wrist targets: the actor's wrist offset from the shoulder scaled by the arm-length ratio far from
     the head, and the offset from the head centre (unscaled, the heads match) near it;
  2. targets and elbow hints are smoothed over time;
  3. wrist and palm are pushed out of a head sphere and a chest front plate, a two-bone IK places the elbow
     (hint from the actor's elbow), and both arm segments are pushed clear of the obstacles too;
  4. the solved elbows and wrists are smoothed again and the final IK is solved from them.
Arm bones keep the actor's roll (swing only). Hands are authored, because single-camera solvers deliver no
finger motion: a phase program on the wrist-height signal closes the fists as the arms rise and keeps them
through the hold, then relaxes to the supplied idle hand once the arms are down (see --hand-timing); with
--palms-up the fists open after the hold time instead (forearm roll toward --palm-dir, fingers to the
supplied "open" pose). The wrist is straight while the hands work and returns to the seated wrist at rest.
Legs, hips and fingers otherwise keep the supplied seated pose.
"""
import bpy, sys, json, math, pathlib, argparse
import numpy as np
from mathutils import Quaternion, Vector, Matrix
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import blender_bridge as br
from retarget_fbx import UPPER, source_map, world_delta, yaw_fix, render_shots

ARMS = {'left': ('leftUpperArm', 'leftLowerArm', 'leftHand'), 'right': ('rightUpperArm', 'rightLowerArm', 'rightHand')}
FORWARD = Vector((0, -1, 0))  # both rigs rest facing -Y, Z up
FINGER_KEYS = ('Thumb', 'Index', 'Middle', 'Ring', 'Little')

def closest_point(point, a, b):
    ab = b - a; t = max(0.0, min(1.0, (point - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return a + ab * t

def two_bone_ik(s, w, hint, a, b):
    """Elbow for shoulder s, wrist w, elbow hint, segment lengths a, b -> (elbow, wrist, clamped)."""
    d = w - s; dist = d.length; clamped = False
    if dist > (a + b) * 0.995: w = s + d / dist * (a + b) * 0.995; d = w - s; dist = d.length; clamped = True
    wn = d / dist
    p = (hint - s) - wn * (hint - s).dot(wn)
    if p.length < 1e-4: p = FORWARD - wn * FORWARD.dot(wn)
    cos_a = max(-1.0, min(1.0, (a * a + dist * dist - b * b) / (2 * a * dist)))
    e = s + a * (cos_a * wn + math.sin(math.acos(cos_a)) * p.normalized())
    return e, w, clamped

def smooth(values, r):
    """Box filter over frames; values is a list of floats or Vectors."""
    arr = np.array([list(v) if isinstance(v, Vector) else v for v in values], dtype=float)
    if r <= 0: return arr
    k = np.ones(2 * r + 1) / (2 * r + 1); pad = [(r, r)] + [(0, 0)] * (arr.ndim - 1)
    padded = np.pad(arr, pad, mode='edge')
    if arr.ndim == 1: return np.convolve(padded, k, mode='valid')
    return np.stack([np.convolve(padded[:, i], k, mode='valid') for i in range(arr.shape[1])], axis=1)

def weighted_verts(arm, raw_bones):
    out = []
    for ob in bpy.data.objects:
        if ob.type != 'MESH' or not any(m.type == 'ARMATURE' and m.object == arm for m in ob.modifiers): continue
        groups = {ob.vertex_groups[r].index for r in raw_bones if r in ob.vertex_groups}
        for v in ob.data.vertices:
            if any(g.group in groups and g.weight > 0.5 for g in v.groups): out.append(ob.matrix_world @ v.co)
    return out

def head_sphere(arm, mapping):
    """Head centre (rest) and a radius from the mesh weighted to the head bone."""
    verts = weighted_verts(arm, [mapping['head']]); centre = sum(verts, Vector()) / len(verts)
    return centre, sorted((v - centre).length for v in verts)[int(len(verts) * 0.9)]

def torso_front(arm, mapping, a, b):
    """90th-percentile forward depth and half width of spine/chest-weighted verts about the axis ab (rest)."""
    verts = weighted_verts(arm, [mapping['spine'], mapping['chest']]); rel = [v - closest_point(v, a, b) for v in verts]
    pick = lambda vals: sorted(vals)[int(len(vals) * 0.9)]
    return pick([r.dot(FORWARD) for r in rel]), pick([abs(r.x) for r in rel])

class Obstacles:
    """A head sphere and a chest front plate for one frame. depth > 0 means inside (with margin).
    The plate only acts in front of the chest and within its width: arms hanging at the sides and
    hands on the lap are left alone; an arm crossing in front of the chest is pushed forward."""
    def __init__(self, head_c, head_r, spine, neck, front, front_r, half_w):
        self.head = (head_c, head_r); self.torso = (spine, neck, front, front_r, half_w)
    FADE = 0.06
    def depth(self, p, margin, torso=True):
        c, r = self.head; n = p - c; best = (r + margin - n.length, n.normalized() if n.length > 1e-6 else FORWARD, 'head')
        if not torso: return best
        a, b, front, r, half_w = self.torso; axis = b - a; along = (p - a).dot(axis) / axis.length_squared
        v = p - closest_point(p, a, b); f = v.dot(front); lat = (v - front * f).length
        fade = lambda x: min(1.0, max(0.0, x / self.FADE))   # soft edges: no on/off flicker between frames
        k = fade(half_w + margin + self.FADE - lat) * fade(along + self.FADE) * fade(1 + self.FADE - along)
        if f >= 0 and (r + margin - f) * k > best[0]: best = ((r + margin - f) * k, front, 'torso')
        return best
    def push_point(self, p, margin):
        d, n, name = self.depth(p, margin)
        return (n * d, name) if d > 0 else (Vector((0, 0, 0)), None)
    def deepest_on_arm(self, s, e, w, margin, samples=6):
        """Both segments against the head; only the forearm against the chest (the upper arm's root is inside the body)."""
        best = (-1e9, FORWARD, None)
        for (p0, p1), torso in (((s, e), False), ((e, w), True)):
            for i in range(1, samples + 1):
                d, n, name = self.depth(p0.lerp(p1, i / samples), margin, torso)
                if d > best[0]: best = (d, n, name)
        return best

def ease(x): x = min(1.0, max(0.0, x)); return x * x * (3 - 2 * x)

def hand_program(h, fps, timing, lift, palms_up=False):
    """Fist and open weights per frame from the wrist-height signal h (m above the shoulder).
    Each stretch episode: fists as the arms rise and through the hold, relax once the arms are down.
    With palms_up, the fists open to palms up after the hold time instead and relax on the way down."""
    fist_in, hold, open_in, relax_min = (t * fps for t in timing); low, peak = lift
    n = len(h); f = np.zeros(n); o = np.zeros(n); episodes = []
    i = 0
    while i < n:
        if h[i] < low: i += 1; continue
        j = i
        while j < n and h[j] >= low: j += 1
        start, end = i, j; i = j
        top = max(h[start:end])
        if end - start < 0.5 * fps or top < peak: continue
        hold_idx = [k for k in range(start, end) if h[k] >= 0.8 * top]; hold_start, release = hold_idx[0], hold_idx[-1]
        if palms_up:
            open_at = int(min(hold_start + hold, max(hold_start, release - 0.3 * fps))); relax = max(relax_min, end - release)
            for k in range(max(0, int(start - 0.15 * fps)), min(n, int(end + relax))):
                f[k] = max(f[k], min(ease((k - start + 0.15 * fps) / fist_in), 1 - ease((k - open_at) / open_in)))
                o[k] = max(o[k], min(ease((k - open_at) / open_in), 1 - ease((k - release) / relax)))
        else:
            open_at = None; relax_at = end - 0.2 * fps   # arms are down: let go
            for k in range(max(0, int(start - 0.15 * fps)), min(n, int(relax_at + relax_min))):
                f[k] = max(f[k], min(ease((k - start + 0.15 * fps) / fist_in), 1 - ease((k - relax_at) / relax_min)))
        episodes.append({'start': round(start / fps, 2), 'hold': round(hold_start / fps, 2), 'open': open_at and round(open_at / fps, 2), 'release': round(release / fps, 2), 'end': round(end / fps, 2)})
    return f, o, episodes

def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:]
    p = argparse.ArgumentParser(); p.add_argument('--fbx', required=True); p.add_argument('--motions', required=True); p.add_argument('--out', required=True)
    p.add_argument('--name', default='clip'); p.add_argument('--shots'); p.add_argument('--skip', type=int, default=1); p.add_argument('--blink-rise', type=float, default=0.18)
    p.add_argument('--margin', type=float, default=0.04, help='clearance for hands around head and torso (m)')
    p.add_argument('--arm-margin', type=float, default=0.03, help='clearance for the arm segments (m)')
    p.add_argument('--near-head', type=float, nargs=2, default=(0.25, 0.45), help='actor hand-to-head distances (m) between which targets blend from head-relative to shoulder-relative')
    p.add_argument('--clavicle', type=float, default=0.3, help='share of the actor clavicle (shrug) rotation to keep')
    p.add_argument('--roll-split', type=float, default=0.5, help='share of the forearm palm roll also applied to the upper arm about its own axis (keeps the elbow from wringing)')
    p.add_argument('--symmetry', type=float, default=0.8, help='during a stretch episode, how much the two hands are pulled to the same depth (0 keeps the actor)')
    p.add_argument('--palms-up', action='store_true', help='open the fists to palms up after the hold time (default: fists until the arms are down)')
    p.add_argument('--hand-timing', type=float, nargs=4, default=(0.3, 1.2, 0.6, 0.5), help='seconds: fist close-in, hold before opening, open-in, minimum relax')
    p.add_argument('--palm-dir', type=float, nargs=3, default=(0, -0.35, 1), help='world direction the open palms face (Blender axes, -Y is forward)')
    p.add_argument('--open-amount', type=float, default=0.8, help='how much of the supplied open-hand pose to use at palms up'); p.add_argument('--hand-gap', type=float, nargs=2, default=(0.11, 0.2), help='minimum wrist-to-wrist distance (m) with hands closed and with fingers spread; closer hands are pushed apart'); p.add_argument('--lift', type=float, nargs=2, default=(0.1, 0.2), help='wrist height above the shoulder (m) that starts a stretch episode, and the peak it must reach')
    p.add_argument('--dump', help='write per-frame targets, hints, elbows and wrists to this JSON (debugging)'); p.add_argument('--smooth', type=int, nargs=2, default=(4, 3), help='box half-widths in frames: targets before the keep-outs, joints after')
    return p.parse_args(argv)

def main():
    a = parse_args()
    arm = br.armature(); mapping = br.humanoid_map(); inv = {v: k for k, v in mapping.items()}
    parent = {vrm: inv.get(br.humanoid_parent(arm, inv, raw)) for vrm, raw in mapping.items()}
    rest = {v: arm.matrix_world @ arm.data.bones[mapping[v]].head_local for v in UPPER}
    centre, head_r = head_sphere(arm, mapping); centre_offset = centre - rest['head']
    front_r, half_w = torso_front(arm, mapping, rest['spine'], rest['neck'])
    hand_vec = {side: arm.matrix_world.to_3x3() @ (arm.data.bones[mapping[ha]].tail_local - arm.data.bones[mapping[ha]].head_local) for side, (up, lo, ha) in ARMS.items()}
    seg = {side: ((rest[lo] - rest[up]).length, (rest[ha] - rest[lo]).length) for side, (up, lo, ha) in ARMS.items()}

    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=a.fbx, automatic_bone_orientation=False, use_anim=True)
    src = next(o for o in set(bpy.data.objects) - before if o.type == 'ARMATURE')
    smap = source_map({b.name for b in src.data.bones})
    action = src.animation_data.action; start, end = (int(round(v)) for v in action.frame_range)
    frames = list(range(start + a.skip, end + 1)); start += a.skip; scene = bpy.context.scene; fps = scene.render.fps
    hpos = lambda name: src.matrix_world @ src.pose.bones[name].head
    scene.frame_set(frames[0]); bpy.context.view_layer.update()
    actor_arm = (hpos(smap['leftLowerArm']) - hpos(smap['leftUpperArm'])).length + (hpos(smap['leftHand']) - hpos(smap['leftLowerArm'])).length
    ratio = sum(seg['left']) / actor_arm
    hips_src = next(b.name for b in src.data.bones if b.name.endswith('Hips'))
    fix, fix_deg = yaw_fix(src, hips_src, frames[::10])

    motions = json.loads(pathlib.Path(a.motions).read_text())
    seated = {}; seated.update(br.clip_frame(motions['clips']['sit'], 0)); seated.update(br.clip_frame(motions['clips']['handsIdle'], 0))
    def seated_world(vrm):
        q = Quaternion((1, 0, 0, 0))
        while vrm: x, y, z, w = seated.get(vrm, (0, 0, 0, 1)); q = Quaternion((w, x, y, z)) @ q; vrm = parent[vrm]
        return br.q_from_gltf(q.normalized())
    last = lambda key: br.clip_frame(motions['clips'][key], len(motions['clips'][key]['times']) - 1)
    fist, open_hand = last('fist'), last('open')
    fingers = sorted(b for b in fist if b in seated and b in open_hand and any(k in b for k in FINGER_KEYS))
    as_q = lambda v: Quaternion((v[3], *v[:3]))
    finger_q = {b: (as_q(seated[b]), as_q(fist[b]), as_q(open_hand[b])) for b in fingers}
    seated_wrist = {ha: br.q_from_gltf(as_q(seated.get(ha, (0, 0, 0, 1)))) for up, lo, ha in ARMS.values()}   # parent-local wrist of the sit pose
    clavicles = ('leftShoulder', 'rightShoulder'); arm_bones = {b for arms in ARMS.values() for b in arms}
    rot_bones = [v for v in smap if v not in arm_bones and v not in clavicles]

    # Pass 1: torso by rotation; raw wrist targets and elbow hints per frame.
    per = []; head_rel = []
    for f in frames:
        scene.frame_set(f); bpy.context.view_layer.update()
        wb = {v: seated_world(v) for v in UPPER}
        for vrm in rot_bones: wb[vrm] = fix @ world_delta(src, smap[vrm])
        for vrm in clavicles: wb[vrm] = wb[vrm].slerp(fix @ world_delta(src, smap[vrm]), a.clavicle)
        def fk(vrm): return rest[vrm] if parent[vrm] is None else fk(parent[vrm]) + wb[parent[vrm]] @ (rest[vrm] - rest[parent[vrm]])
        head_c = fk('head') + wb['head'] @ centre_offset
        chest_src = world_delta(src, smap['chest']).inverted(); chest_m = wb['chest']
        hb = src.pose.bones[smap['head']]; a_head = src.matrix_world @ (hb.head + (hb.tail - hb.head) * 0.6)
        fr = {'wb': wb, 'obstacles': Obstacles(head_c, head_r, fk('spine'), fk('neck'), (chest_m @ FORWARD).normalized(), front_r, half_w), 'head_c': head_c, 'sides': {}}
        for side, (up, lo, ha) in ARMS.items():
            s = fk(up); a_hand = hpos(smap[ha]); a_shoulder = hpos(smap[up])
            near, far = a.near_head; k = min(1.0, max(0.0, (far - (a_hand - a_head).length) / (far - near))); head_rel.append(k)
            w_shoulder = s + chest_m @ (chest_src @ (a_hand - a_shoulder)) * ratio
            w_head = head_c + chest_m @ (chest_src @ (a_hand - a_head))
            fr['sides'][side] = {'s': s, 'w': w_shoulder.lerp(w_head, k), 'hint': s + chest_m @ (chest_src @ (hpos(smap[lo]) - a_shoulder)) * ratio,
                                 'actor': {b: fix @ world_delta(src, smap[b]) for b in (up, lo, ha)}}
        head = (src.matrix_world @ hb.matrix).to_translation()
        fr['blink'] = 1.0 if max(hpos(smap[s + 'Hand']).z for s in ('left', 'right')) - head.z > a.blink_rise else 0.0
        per.append(fr)

    def set_arm(fr, side, e, w):
        """Arm bone rotations from the solved elbow and wrist: direction from IK, roll from the actor."""
        up, lo, ha = ARMS[side]; d = fr['sides'][side]; wb = fr['wb']
        for bone, child, target in ((up, lo, e - d['s']), (lo, ha, w - e)):
            actor = d['actor'][bone]; axis = (rest[child] - rest[bone]).normalized()
            wb[bone] = ((actor @ axis).rotation_difference(target.normalized()) @ actor).normalized()
        d['wrist'] = w; d['elbow'] = e; d['final'] = (e, w)   # the wrist itself is authored by the hand program

    # Pass 2: smooth targets, keep-outs + IK, smooth joints, final IK -> arm rotations.
    stats = {'pushedOut': {'left': 0, 'right': 0}, 'armMoved': {'left': 0, 'right': 0}, 'reachClamped': {'left': 0, 'right': 0}, 'hitTorso': 0, 'hitHead': 0, 'handsSeparated': 0}
    r1, r2 = a.smooth
    for side, (up, lo, ha) in ARMS.items():
        ws = smooth([fr['sides'][side]['w'] for fr in per], r1); hints = smooth([fr['sides'][side]['hint'] for fr in per], r1)
        solved = []
        for i, fr in enumerate(per):
            d = fr['sides'][side]; ob = fr['obstacles']; s = d['s']; w = Vector(ws[i]); hint = Vector(hints[i])
            palm = d['actor'][ha] @ hand_vec[side]; pushed = False
            for point in (Vector((0, 0, 0)), palm):
                shift, name = ob.push_point(w + point, a.margin)
                if name: w += shift; pushed = True; stats['hit' + name.capitalize()] += 1
            stats['pushedOut'][side] += pushed
            e, w, clamped = two_bone_ik(s, w, hint, *seg[side]); stats['reachClamped'][side] += clamped
            for _ in range(4):
                depth, normal, name = ob.deepest_on_arm(s, e, w, a.arm_margin)
                if depth <= 0: break
                w += normal * depth * 1.2; hint += normal * depth * 2.0   # nudge, never replace: a replaced hint flips the elbow
                e, w, clamped = two_bone_ik(s, w, hint, *seg[side]); stats['armMoved'][side] += 1
            solved.append((e, w)); d['raw'] = (Vector(ws[i]), Vector(hints[i]), e, w)
        es = smooth([e for e, w in solved], r2); wsm = smooth([w for e, w in solved], r2)
        for i, fr in enumerate(per):
            d = fr['sides'][side]; e, w, clamped = two_bone_ik(d['s'], Vector(wsm[i]), Vector(es[i]), *seg[side])
            set_arm(fr, side, e, w)
    # Pass 2b: the hand program on the wrist-height signal.
    height = smooth([max(d['wrist'].z - d['s'].z for d in fr['sides'].values()) for fr in per], 3)
    fist_w, open_w, episodes = hand_program(height, fps, a.hand_timing, a.lift, a.palms_up)
    # The hands must not pass through each other (the actor clasped hers): keep the wrists apart sideways,
    # more so while the fingers are spread, so the hands end up side by side rather than one behind the other.
    amounts = []; depths = []
    for i, fr in enumerate(per):   # only while the hand program is active (arms up), never during a cross-body reach
        active = max(float(fist_w[i]), float(open_w[i])); gap = active * (a.hand_gap[0] + (a.hand_gap[1] - a.hand_gap[0]) * float(open_w[i]))
        lateral = Vector((1, 0, 0)); front = FORWARD   # room axes, not the chest's: a torso twist must not tilt the hands or the palms away from the camera
        L, R = fr['sides']['left'], fr['sides']['right']; diff = L['wrist'] - R['wrist']
        amounts.append(max(0.0, gap - diff.dot(lateral)) / 2); depths.append(-diff.dot(front) / 2 * active * a.symmetry)
        fr['lateral'] = lateral; fr['front'] = front
    amounts = smooth(amounts, 4); depths = smooth(depths, 4)
    for i, fr in enumerate(per):
        if abs(amounts[i]) < 1e-4 and abs(depths[i]) < 1e-4: continue
        push = fr['lateral'] * float(amounts[i]) + fr['front'] * float(depths[i]); stats['handsSeparated'] += int(amounts[i] > 1e-4)
        for side, sign in (('left', 1), ('right', -1)):
            d = fr['sides'][side]; e, w, clamped = two_bone_ik(d['s'], d['wrist'] + push * sign, d['elbow'], *seg[side]); set_arm(fr, side, e, w)
    # Arm roll while the hands work: palms face each other across the room while the fists are closed (the actor's
    # forearm roll is a single-camera guess and shows once the wrist is straight), --palm-dir while open. The roll the
    # forearm needs about its own axis is measured against the fixed target, unwrapped per stretch, weighted by the
    # hand program, applied to the forearm and (in part) the upper arm, then quaternion-smoothed.
    palm_dir = Vector(a.palm_dir).normalized(); palm_rest = Vector((0, 0, -1))   # T-pose palms face down
    def qsmooth(qs, r):
        out = []
        for i in range(len(qs)):
            acc = Quaternion((0, 0, 0, 0))
            for j in range(max(0, i - r), min(len(qs), i + r + 1)):
                q = qs[j] if qs[j].dot(qs[i]) >= 0 else -qs[j]; acc = Quaternion((acc.w + q.w, acc.x + q.x, acc.y + q.y, acc.z + q.z))
            out.append(acc.normalized())
        return out
    for side, (up, lo, ha) in ARMS.items():
        other = 'right' if side == 'left' else 'left'
        inward = Vector((-1, 0, 0)) if side == 'left' else Vector((1, 0, 0))   # room lateral: a torso twist must not tilt the palms
        angles = []; weights = []
        for i, fr in enumerate(per):   # roll the forearm needs about its own axis to bring the palm onto the target
            d = fr['sides'][side]; axis = (d['wrist'] - d['elbow']).normalized(); n = fr['wb'][lo] @ palm_rest
            target = (inward * float(fist_w[i]) + palm_dir * float(open_w[i])); weight = max(float(fist_w[i]), float(open_w[i]))
            n_p = n - axis * n.dot(axis); t_p = target - axis * target.dot(axis)
            weight *= min(1.0, max(0.0, (t_p.length - 0.15) / 0.25))   # fades out when the forearm points along the target (roll undefined)
            angles.append(math.atan2(n_p.cross(t_p).dot(axis), n_p.dot(t_p)) if weight > 0 and n_p.length > 1e-4 else (angles[-1] if angles else 0.0)); weights.append(weight)
        # Unwrap within each active stretch only, starting fresh at its first frame: unwrapping across the idle
        # frames in between carried a 360° offset into the ramp and produced a 100° pop.
        angles = np.array(angles); i = 0
        while i < len(angles):
            if weights[i] <= 0: i += 1; continue
            j = i
            while j < len(angles) and weights[j] > 0: j += 1
            angles[i:j] = np.unwrap(angles[i:j]); i = j
        for i, fr in enumerate(per):
            d = fr['sides'][side]; roll = float(angles[i]) * weights[i]
            # The upper arm carries a share of the same roll about its own axis, so the elbow is not wrung.
            fr['wb'][up] = (Quaternion((d['elbow'] - d['s']).normalized(), roll * a.roll_split) @ fr['wb'][up]).normalized()
            fr['wb'][lo] = (Quaternion((d['wrist'] - d['elbow']).normalized(), roll) @ fr['wb'][lo]).normalized()
            d['roll'] = (round(math.degrees(float(angles[i])), 1), round(weights[i], 2))
        for bone in (up, lo):
            smoothed = qsmooth([fr['wb'][bone] for fr in per], 4)
            for i, fr in enumerate(per): fr['wb'][bone] = smoothed[i]
        for i, fr in enumerate(per):
            d = fr['sides'][side]; wb = fr['wb']
            if fist_w[i] > 0.9:   # how far the palm still is from facing the other hand (diagnostic)
                n = wb[lo] @ palm_rest; t = inward
                stats.setdefault('palmResidualDeg', {}).setdefault(side, []).append(math.degrees(math.acos(max(-1.0, min(1.0, n.dot(t))))))
            active = max(float(fist_w[i]), float(open_w[i]))   # straight wrist while the hands work, the seated wrist at rest
            wb[ha] = (wb[lo] @ seated_wrist[ha].slerp(Quaternion((1, 0, 0, 0)), active)).normalized()
            d['palm'] = {'normal': [round(x, 2) for x in (wb[lo] @ palm_rest)], 'inward': [round(x, 2) for x in (fr['sides'][other]['wrist'] - d['wrist']).normalized()], 'fist': round(float(fist_w[i]), 2), 'upperAxis': [round(x, 2) for x in (d['elbow'] - d['s']).normalized()], 'foreAxis': [round(x, 2) for x in (d['wrist'] - d['elbow']).normalized()]}

    # Pass 3: tracks, fingers, blink.
    tracks = {v: [] for v in UPPER}; times = []
    for i, fr in enumerate(per):
        world = {v: br.q_to_gltf(fr['wb'][v]) for v in UPPER}
        for vrm in UPPER:
            local = world[vrm] if parent[vrm] is None else (world[parent[vrm]].inverted() @ world[vrm]).normalized()
            tracks[vrm].extend(round(x, 7) for x in (local.x, local.y, local.z, local.w))
        times.append(round((frames[i] - start) / fps, 6))
    bl = smooth([fr['blink'] for fr in per], 6)
    for b in fingers:
        idle, closed, opened = finger_q[b]
        tracks[b] = [round(x, 7) for i in range(len(per)) for q in [idle.slerp(closed, float(fist_w[i])).slerp(opened, float(open_w[i]) * a.open_amount)] for x in (q.x, q.y, q.z, q.w)]
    clip = {'name': a.name, 'duration': times[-1], 'times': times, 'tracks': [{'bone': v, 'rotations': tracks[v]} for v in UPPER + fingers],
            'face': {'eyeBlinkLeft': [round(float(v), 4) for v in bl], 'eyeBlinkRight': [round(float(v), 4) for v in bl]},
            'source': f'mocap FBX, torso by rotation + arms by IK ({pathlib.Path(a.fbx).name}) in Blender {bpy.app.version_string}', 'fps': fps}
    pathlib.Path(a.out).write_text(json.dumps(clip, separators=(',', ':')))
    if a.dump:
        rows = [{'f': i, **{side: {'target': list(d['raw'][0]), 'hint': list(d['raw'][1]), 'e1': list(d['raw'][2]), 'w1': list(d['raw'][3]), 'e': list(d['final'][0]), 'w': list(d['final'][1]), 's': list(d['s']), 'palm': d.get('palm'), 'roll': d.get('roll')} for side, d in fr['sides'].items()}} for i, fr in enumerate(per)]
        pathlib.Path(a.dump).write_text(json.dumps(rows))
    if a.shots: render_shots(a.shots, arm, mapping, src, clip, seated)
    if 'palmResidualDeg' in stats: stats['palmResidualDeg'] = {k: {'mean': round(sum(v) / len(v), 1), 'max': round(max(v), 1)} for k, v in stats['palmResidualDeg'].items()}
    print('@@JSON@@', json.dumps({'out': a.out, 'frames': len(frames), 'duration': times[-1], 'fps': fps, 'yawFixDeg': round(fix_deg, 1), 'armRatio': round(ratio, 3),
                                  'headRadius': round(head_r, 3), 'chestFront': round(front_r, 3), 'chestHalfWidth': round(half_w, 3), 'headRelativeShare': round(sum(head_rel) / len(head_rel), 2), 'handEpisodes': episodes, **stats}))

if __name__ == '__main__':
    main()
