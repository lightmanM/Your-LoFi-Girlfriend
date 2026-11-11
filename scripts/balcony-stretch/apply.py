"""Show one moment of the shot on the live rig (nothing keyed), or bake the whole shot to keys."""
import bpy
import rig as R
import stretch as ST

SCENE = 'Balcony • Stretch anim (Claude)'
NAMES = dict(arm='Stretch anim • armature', book='Stretch anim • book', face='Stretch anim • bn0010_Face.020')


def objects():
    return tuple(bpy.data.objects[NAMES[k]] for k in ('arm', 'book', 'face'))


def book_world(arm, c, b3):
    """Location and rotation for the book object (its scale stays -1: its frame is mirrored)."""
    aw = arm.matrix_world
    return aw @ c, (aw.to_3x3().normalized() @ (b3 * -1.0)).to_quaternion()


def show(t):
    arm, book, face = objects()
    shot = ST.Shot(arm, book, face)
    out = shot.pose(t)
    R.write_pose(arm, shot.rg)
    book.rotation_mode = 'QUATERNION'
    book.location, book.rotation_quaternion = book_world(arm, *out['book'])
    book.scale = (-1, -1, -1)
    kb = face.data.shape_keys.key_blocks
    for k, v in out['face'].items():
        kb[k].value = v
    bpy.context.view_layer.update()
    return shot, out


ACTION = 'Stretch anim • reading break (Claude)'


def _curves(action, slot):
    from bpy_extras import anim_utils
    return anim_utils.action_ensure_channelbag_for_slot(action, slot).fcurves


def _write(fcurves, path, index, frames, values, group=None):
    fc = fcurves.new(path, index=index, group_name=group) if group else fcurves.new(path, index=index)
    fc.keyframe_points.add(len(frames))
    co = [x for pair in zip(frames, values) for x in pair]
    fc.keyframe_points.foreach_set('co', co)
    for kp in fc.keyframe_points:
        kp.interpolation = 'LINEAR'
    fc.update()


def bake(extra=None):
    """Key every frame of the shot (bones that move, the book, the face keys). `extra(shot, samples)` may add layers."""
    arm, book, face = objects()
    scene = bpy.data.scenes[SCENE]
    shot = ST.Shot(arm, book, face)
    count = int(round(ST.LENGTH * ST.FPS))
    frames = [float(f) for f in range(1, count + 1)]
    samples = []
    for f in frames:
        out = shot.pose((f - 1) / ST.FPS)
        out['q'] = shot.rg.snapshot()
        out['world'] = {'Head': shot.rg.m('Head').copy()}
        samples.append(out)
    if extra:
        extra(shot, samples)
    old = bpy.data.actions.get(ACTION)
    if old:
        bpy.data.actions.remove(old)
    act = bpy.data.actions.new(ACTION)
    act.use_fake_user = True
    # bones
    if not arm.animation_data: arm.animation_data_create()
    arm.animation_data.action = act
    slot = act.slots.new(id_type='OBJECT', name=arm.name)
    arm.animation_data.action_slot = slot
    fcs = _curves(act, slot)
    moved = []
    for n in shot.rg.names:
        qs = [s['q'][n] for s in samples]
        if max(qs[0].rotation_difference(q).angle for q in qs) < 1e-5 and qs[0].rotation_difference(shot.base_q[n]).angle < 1e-5:
            arm.pose.bones[n].rotation_quaternion = shot.base_q[n]
            continue
        moved.append(n)
        arm.pose.bones[n].rotation_mode = 'QUATERNION'
        for i in range(1, len(qs)):            # keep neighbouring keys on the same side of the quaternion sphere
            if qs[i].dot(qs[i - 1]) < 0: qs[i] = -qs[i]
        for c in range(4):
            _write(fcs, f'pose.bones["{n}"].rotation_quaternion', c, frames, [q[c] for q in qs], n)
    # book
    book.rotation_mode = 'QUATERNION'
    book.scale = (-1, -1, -1)
    if not book.animation_data: book.animation_data_create()
    book.animation_data.action = act
    bslot = act.slots.new(id_type='OBJECT', name=book.name)
    book.animation_data.action_slot = bslot
    bfc = _curves(act, bslot)
    pairs = [book_world(arm, *s['book']) for s in samples]
    for i in range(1, len(pairs)):
        if pairs[i][1].dot(pairs[i - 1][1]) < 0: pairs[i] = (pairs[i][0], -pairs[i][1])
    for c in range(3): _write(bfc, 'location', c, frames, [p[0][c] for p in pairs])
    for c in range(4): _write(bfc, 'rotation_quaternion', c, frames, [p[1][c] for p in pairs])
    # face
    keys = face.data.shape_keys
    if not keys.animation_data: keys.animation_data_create()
    keys.animation_data.action = act
    kslot = act.slots.new(id_type='KEY', name=keys.name)
    keys.animation_data.action_slot = kslot
    kfc = _curves(act, kslot)
    for k in sorted({k for s in samples for k in s['face']}):
        _write(kfc, f'key_blocks["{k}"].value', 0, frames, [s['face'].get(k, 0.0) for s in samples])
    scene.frame_start, scene.frame_end = 1, count
    scene.render.fps, scene.render.fps_base = ST.FPS, 1.0
    scene.frame_set(1)
    return {'frames': count, 'bones_keyed': len(moved), 'worst_reach_miss_mm': round(1000 * max(max(s['miss'].values()) for s in samples), 3)}


def analyse():
    """Numbers for judging the motion without watching it: speeds, jolts, clearances, grip."""
    import math
    arm, book, face = objects()
    shot = ST.Shot(arm, book, face)
    scale = arm.matrix_world.to_scale().x
    n = int(round(ST.LENGTH * ST.FPS))
    rows = []
    for i in range(n):
        t = i / ST.FPS
        out = shot.pose(t)
        rg = shot.rg
        c, b3 = out['book']
        bm = shot.book_m(c, b3)
        head_c = rg.head('Head') + rg.axis('Head', 1) * 0.07
        row = {'t': t, 'head': rg.m('Head').to_quaternion(), 'chest': rg.m('Chest').to_quaternion(), 'book': c.copy()}
        for sd in 'LR':
            wr = rg.head('Hand.' + sd)
            palm = wr + rg.axis('Hand.' + sd, 1) * 0.045
            row['wr' + sd] = wr
            row['head_gap' + sd] = (palm - head_c).length
            row['grip' + sd] = (wr - (bm @ shot.sides[sd]['grip']).translation).length
            up, lo = rg.axis('Upper_arm.' + sd, 1), rg.axis('Lower_arm.' + sd, 1)
            row['elbow' + sd] = math.degrees(up.angle(lo))
            row['clav' + sd] = rg.head('Upper_arm.' + sd).z
        rows.append(row)
    dt = 1 / ST.FPS
    def speed(key, i): return (rows[i + 1][key] - rows[i][key]).length / dt * scale
    def spin(key, i): return math.degrees(rows[i][key].rotation_difference(rows[i + 1][key]).angle) / dt
    rep = {}
    for key in ('wrL', 'wrR', 'book'):
        v = [speed(key, i) for i in range(n - 1)]
        a = [abs(v[i + 1] - v[i]) / dt for i in range(n - 2)]
        rep[key] = {'peak_m_s': round(max(v), 2), 'at': round(v.index(max(v)) * dt, 2), 'peak_accel_m_s2': round(max(a), 1), 'accel_at': round(a.index(max(a)) * dt, 2)}
    for key in ('head', 'chest'):
        v = [spin(key, i) for i in range(n - 1)]
        a = [abs(v[i + 1] - v[i]) / dt for i in range(n - 2)]
        rep[key] = {'peak_deg_s': round(max(v), 1), 'at': round(v.index(max(v)) * dt, 2), 'peak_accel_deg_s2': round(max(a)), 'accel_at': round(a.index(max(a)) * dt, 2)}
    for sd in 'LR':
        gaps = [r['head_gap' + sd] for r in rows]
        rep['hand_to_head_min_cm_' + sd] = (round(min(gaps) * scale * 100, 1), round(gaps.index(min(gaps)) * dt, 2))
        rep['straightest_elbow_deg_' + sd] = round(min(r['elbow' + sd] for r in rows), 1)
        rep['shoulder_rise_cm_' + sd] = round((max(r['clav' + sd] for r in rows) - rows[0]['clav' + sd]) * scale * 100, 1)
        carry = [r['grip' + sd] for r in rows if r['t'] < ST.LET_GO[0] or r['t'] > ST.GRIP[1] + 0.05]
        rep['grip_slip_mm_' + sd] = round(max(carry) * scale * 1000, 2)
    rep['table'] = [(round(r['t'], 1), round(speed('wrL', i), 2), round(speed('wrR', i), 2), round(spin('head', i)), round(r['elbowL']))
                    for i, r in enumerate(rows[:-1]) if i % 9 == 0]
    return rep
