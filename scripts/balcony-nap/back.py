"""Back from her nap: she wakes on the daybed, gets up with her book, walks back in through the door, sits down in
her chair and opens the book again.

Back(arm).pose(t) puts the pose at time t (seconds) into the rig, as nap.Shot does, and returns the book's world
matrix, how far it is shut and the face keys. Getting up from the daybed is her lying down (nap.py) played backwards,
which ends with her sitting on its edge; from there on the choreography is in this file. Places are world metres,
headings degrees from +x (the camera looks along -x); they keep counting down past -360 as she keeps turning right.
"""
import math
from mathutils import Vector, Matrix, Quaternion
import body as BD
import nap as N
from nap import Keys, sched, knots, line, smooth, smoother, floor_z, blink
from tracks import Track

FPS = N.FPS
rad = math.radians

# --- timeline (seconds) ---
EYES = Track(1.0).to(0.55, 0.5, 0.9).to(0.85, 0.9, 1.15).to(0.35, 1.2, 1.9).to(0.22, 2.6, 4.0)   # she comes round
# Nothing waits for anything else: she is leaning forward to get up before she has finished sitting up, takes her
# first step while she is still straightening, and is turning toward the door all the while.
UP = (1.2, 5.2)                   # up from the pillows onto the daybed's edge: her lying down, backwards
OUT = (N.LIE[1] + 0.75, N.SIT[1] - 0.05)      # the part of nap.py that is played backwards: from, to
FADE = 1.4                        # s over which that hands over to the tracks below, which have already begun
J = UP[1]                         # she would be sitting on the edge, were she not already getting up
STAND_UP = (J - 0.85, J + 0.8)
W0 = STAND_UP[0] + 1.25           # first step, as she comes upright: any sooner and she steps out of a half squat
FIRST = 0.55                      # her first step is a small one, turning: this share of a walking step's heel lift and height
STEPS_AT = ((0.00, 0.50), (0.60, 1.10), (1.22, 1.70), (1.84, 2.32), (2.46, 2.94), (3.06, 3.62), (3.74, 4.18))
W1 = W0 + 4.3                     # standing in front of her chair
SIT = (W0 + 3.4, W0 + 5.1)        # down onto the chair, from her last steps on
ON_BOOK = (SIT[1] - 1.0, SIT[1] + 0.05)      # her right hand comes to the shut book as she comes down
OPEN = (SIT[1] - 0.15, SIT[1] + 0.95)        # and opens it as she settles
LENGTH = OPEN[1] + 1.2
BLINKS = (2.3, 4.4, J + 0.9, W0 + 1.4, W0 + 3.3, SIT[1] + 0.1, OPEN[1] + 0.4)

# --- places ---
LINE = ((6.45, 24.69), (7.3, 24.74), (8.2, 24.85), (9.43, 25.45))      # nap.py's way, the other way round
ALONG = (('R', 0.30), ('L', 0.98), ('R', 1.62), ('L', 2.26), ('R', 2.88))    # footsteps: how far along it
BED_FEET = {'R': (6.56, 24.70, -252.0), 'L': (6.34, 24.69, -262.0)}    # where her feet are as she sits on its edge


def along(d):
    """The point d metres along LINE and the heading there (0 to -360: she has turned right to face this way)."""
    pts = [Vector(p) for p in LINE]
    run = 0.0
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        n = (b - a).length
        if d <= run + n or i == len(pts) - 2:
            return a.lerp(b, (d - run) / n), math.degrees(math.atan2((b - a).y, (b - a).x)) - 360.0
        run += n


class Back:
    def __init__(self, arm):
        self.out = out = N.Shot(arm)
        self.b = b = out.b
        k0 = self.k0 = out.read
        self.home_heading = k0['heading'] - 360.0             # as she reads, counted on from her turns
        # her footsteps: along the line, then onto the two spots her feet rest on as she reads
        feet = {sd: (k0['foot' + sd][0], k0['foot' + sd][1], k0['foot' + sd][3] - 360.0) for sd in 'LR'}
        places = []
        for sd, d in ALONG:
            p, h = along(d)
            side = BD.frame(h).col[1].to_2d() * (N.HALF if sd == 'L' else -N.HALF)
            places.append((sd, p.x + side.x, p.y + side.y, h))
        places += [('L',) + feet['L'], ('R',) + feet['R']]
        self.steps = {'L': [], 'R': []}
        path, stance, centre = [(0.0,) + LINE[0]], Vector(BED_FEET['L'][:2]), Vector(LINE[0])
        for (sd, x, y, h), (t0, t1) in zip(places, STEPS_AT):
            self.steps[sd].append((W0 + t0, W0 + t1, (x, y, floor_z(x), h), 1.0 if path[1:] else FIRST))
            path.append((t0 + 0.4 * (t1 - t0),) + tuple(centre.lerp(stance, 0.25)))
            stance = centre = Vector((x, y))            # at the middle of the next step her hips are over this foot
        path.append((W1 - W0,) + N.STAND)
        self.path, self.places = tuple(path), places

        # where the backwards part ends: sitting on the daybed's edge. The tracks start from there.
        c = out.controls(OUT[1])
        tk = Keys(dict(hx=c['hips'][0], hy=c['hips'][1], hz=c['hips'][2], heading=c['heading'], pitch=c['pitch'], roll=c['roll'], twist=c['twist'],
                       spine=c['spine'], chest=c['chest'], neck=c['neck'], head=c['head']))
        a, z = STAND_UP
        # up off the daybed: forward over her feet, then up, turning toward the door as she rises
        tk.to(dict(pitch=28.0), a, a + 0.8).to(dict(pitch=3.0), a + 0.7, z + 0.2)
        tk.to(dict(hx=LINE[0][0], hy=LINE[0][1] - 0.05), a, a + 1.0).to(dict(hx=LINE[0][0], hy=LINE[0][1]), a + 0.8, z, 'soft')
        tk.to(dict(hz=N.STAND_Z), a + 0.35, z, 'soft').to(dict(roll=0.0, twist=0.0), a, a + 0.8)
        tk.to(dict(spine=(0, 4, 0), chest=(0, 8, 0)), a, a + 0.8).to(dict(spine=(0, 0, 0), chest=(0, -2, 0)), a + 0.8, z)
        tk.to(dict(neck=(0, -8, 0), head=(0, -10, 0)), a, a + 0.8).to(dict(neck=(0, 0, 0), head=(0, 1, 0)), a + 0.8, z)
        tk.to(dict(heading=-354.0), a + 0.3, W0 + 1.3).to(dict(heading=-334.0), W0 + 1.6, W0 + 2.7)
        # round to her chair and down onto it: her hips go back and down under a forward lean, as she got up from it
        tk.to(dict(heading=self.home_heading), W0 + 3.0, W0 + 4.6)
        ox, oy = N.STAND[0] - LINE[0][0], N.STAND[1] - LINE[0][1]       # the walk is added on top of these curves
        a, z = SIT
        hx, hy, hz = k0['hips']
        tk.to(dict(pitch=28.0), a - 0.1, z - 0.8).to(dict(pitch=k0['pitch']), z - 0.8, z + 0.35)
        tk.to(dict(hx=9.14 - ox, hy=25.56 - oy, hz=0.75), a, z - 0.6).to(dict(hx=hx - ox, hy=hy - oy, hz=hz), z - 0.75, z)
        tk.to(dict(roll=k0['roll']), a + 0.5, z)
        tk.to(dict(spine=(0, 4, 0), chest=(0, 6, 0)), a, a + 0.8).to(dict(spine=k0['spine'], chest=k0['chest']), a + 0.8, z + 0.4)
        tk.to(dict(neck=(0, -6, 0), head=(0, -4, 0)), a, a + 0.8).to(dict(neck=k0['neck'], head=k0['head']), z - 0.5, OPEN[1])
        self.tk = tk

        # arms: her left carries the shut book and brings it up to read; her right pushes off the mattress, swings as
        # she walks, then comes to the book and opens it (on_book follows its half of the book as it opens)
        rel = k0['armL'][1]
        carry = dict(arm=('rel', (rel[0] + 0.02, rel[1] - 0.09, rel[2] - 0.05), k0['armL'][2]), handrel=k0['handrelL'], grip=1.0)
        self.armL = [carry, (dict(arm=k0['armL'], handrel=k0['handrelL'], grip=1.0), SIT[1] - 0.9, OPEN[0] + 0.5)]
        self.elbowR = k0['armR'][2]
        self.on_book = dict(arm=k0['armR'], handrel=k0['handrelR'], grip=1.0)
        self.armR = [dict(arm=('at', (N.SEAT[0] + 0.27, N.SEAT[1] + 0.06, 0.60), (0.6, 0.0, -1.0)), curl=0.45),
                     (self.swing, STAND_UP[0] + 0.3, STAND_UP[0] + 1.3),
                     (lambda t: self.on_book, *ON_BOOK)]

    # --- the walk ---
    def gait(self, t):
        steps = [(sd,) + at for (sd, *_), at in zip(self.places, STEPS_AT)]
        fade = smooth((t - W0) / 0.5) * (1 - smooth((t - (W1 - 0.5)) / 0.6))
        yaw = [(W0 - 0.2, 0.0)] + [(W0 + t1, 5.0 if sd == 'R' else -5.0) for sd, _, t1 in steps] + [(W1 + 0.3, 0.0)]
        mid = [(W0 - 0.3, 0.0)] + [(W0 + (t0 + t1) / 2, 2.5 if sd == 'R' else -2.5) for sd, t0, t1 in steps] + [(W1 + 0.3, 0.0)]
        sw = [(W0 - 0.2, 4.0)] + [(W0 + t1, -14.0 if sd == 'R' else 18.0) for sd, _, t1 in steps] + [(W1 + 0.4, 4.0)]
        return dict(yaw=knots(t, yaw) * fade, roll=knots(t, mid) * fade, swing=knots(t, sw))

    def swing(self, t):
        s = self.gait(t)['swing']
        return dict(arm=('hang', s, 7, 13 + max(0.0, s) * 0.7), curl=1.0)

    def way(self, t):
        """Her hips' way over the floor: the path's points joined and rounded off (as nap.path)."""
        taps = ((-0.24, 1), (-0.16, 3), (-0.08, 5), (0.0, 6), (0.08, 5), (0.16, 3), (0.24, 1))
        return sum((line(t - W0 + d, self.path) * w for d, w in taps), Vector((0, 0))) / sum(w for _, w in taps)

    def hips_xy(self, t, v=None):
        v = v or self.tk(t)
        return Vector((v['hx'], v['hy'])) + self.way(t) - Vector(LINE[0])

    def step_foot(self, sd, t):
        cur = (BED_FEET[sd][0], BED_FEET[sd][1], floor_z(BED_FEET[sd][0]), BED_FEET[sd][2])
        for t0, t1, to, g in self.steps[sd]:
            if t >= t1:
                cur = to
                if t < t1 + N.LAND:
                    return cur + (-N.STRIKE * g * (1 - smooth((t - t1) / N.LAND)), 0.0)
                continue
            if t <= t0 - N.HEEL_OFF:
                break
            heel, leave, top, flat = t0 - N.HEEL_OFF, t0 - N.LEAVE, t0 + 0.12 * (t1 - t0), t0 + 0.6 * (t1 - t0)
            if t < top: pitch = (N.TOE_OFF + 5) * smooth((t - heel) / (top - heel))
            elif t < flat: pitch = (N.TOE_OFF + 5) * (1 - smooth((t - top) / (flat - top)))
            else: pitch = -N.STRIKE * smooth((t - flat) / (t1 - flat))
            k = max(0.0, (t - leave) / (t1 - leave))
            e = smooth(k)
            return tuple(a + (b - a) * e for a, b in zip(cur, to)) + (pitch * g, N.LIFT * g * math.sin(math.pi * k))
        return cur + (0.0, 0.0)

    def foot(self, sd, t):
        """Her foot's control: on the floor it turns on the spot rather than point far from where she faces."""
        spec = self.step_foot(sd, t)
        off = (spec[3] - self.tk(t)['heading'] + 180) % 360 - 180
        return spec[:3] + (spec[3] + N.PIVOT * math.tanh(off / N.PIVOT) - off,) + spec[4:]

    def reach(self, t):
        v = self.tk(t)
        xy, left = self.hips_xy(t, v), BD.frame(v['heading']).col[1].to_2d()
        best = None
        for sd, k in (('L', 1), ('R', -1)):
            spec = self.foot(sd, t)
            ankle = self.b.foot_goal(spec)[0]
            flat = (ankle.to_2d() - (xy + left * (k * N.HIP_W))).length
            z = ankle.z + math.sqrt(max(N.LEG * N.LEG - flat * flat, 0.04)) + N.HIP_H + 1.2 * spec[5]
            best = z if best is None else min(best, z)
        return best

    def height(self, t, track):
        taps = tuple((d / 50, 7 - abs(d)) for d in range(-6, 7))
        z = sum(self.reach(t + d) * w for d, w in taps) / sum(w for _, w in taps)
        return z - math.log(1.0 + math.exp(-60.0 * (track - z))) / 60.0

    def controls(self, t):
        k0, v, g = self.k0, self.tk(t), self.gait(t)
        hx, hy = self.hips_xy(t, v)
        lead = max(-32.0, min(32.0, (self.tk(t + 0.4)['heading'] - v['heading']) * 0.55)) * (1 - smooth((t - SIT[0]) / 0.6))
        face = rad(v['heading'])
        # near her chair she cannot stand at full height inside the picture (nap.FRAME_TOP): she is already lowering
        head_x = hx + math.cos(face) * N.TORSO * math.sin(rad(v['pitch']))
        top = N.FRAME_TOP[0] + N.FRAME_TOP[1] * (N.FRAME_TOP[2] - head_x) - (N.TORSO * math.cos(rad(v['pitch'])) + N.HAIR)
        hz = self.height(t, v['hz'])
        hz = top - math.log(1.0 + math.exp(-40.0 * (hz - top))) / 40.0 if hz - top > -0.25 else hz
        c = dict(hips=(hx, hy, hz), heading=v['heading'] + g['yaw'], twist=v['twist'], pitch=v['pitch'], roll=v['roll'] + g['roll'],
                 spine=(v['spine'][0] - 0.7 * g['yaw'], v['spine'][1], v['spine'][2] - 0.6 * g['roll']),
                 chest=(v['chest'][0] - 0.9 * g['yaw'], v['chest'][1], v['chest'][2] - 0.4 * g['roll']),
                 neck=(v['neck'][0] + 0.4 * lead + 0.3 * g['yaw'], v['neck'][1], v['neck'][2]),
                 head=(v['head'][0] + 0.6 * lead + 0.3 * g['yaw'], v['head'][1], v['head'][2]))
        seated = smoother((t - (SIT[0] + 0.5)) / (SIT[1] + 0.3 - SIT[0] - 0.5))
        for sd in 'LR':
            c['foot' + sd] = self.foot(sd, t)
            c['kneemix' + sd] = (k0['knee' + sd], seated)        # her knees as they are when she reads
        c['armL'] = sched(t, self.armL)
        c['armR'] = sched(t, self.armR)
        return c

    def face(self, t):
        lids = max(EYES(t) * (1 - smooth((t - J) / 2.0)), max(blink(t, at) for at in BLINKS))
        smile = 0.25 * (1 - smooth((t - 0.8) / 2.0))
        return {'eyeBlinkLeft': lids, 'eyeBlinkRight': lids, 'jawOpen': 0.0, 'mouthSmileLeft': smile, 'mouthSmileRight': smile}

    def shut(self, t):
        return N.SHUT * (1 - smoother((t - OPEN[0]) / (OPEN[1] - OPEN[0])))

    def own(self, t):
        """The pose from the tracks in this file (from sitting on the daybed's edge on)."""
        b, rg, out = self.b, self.b.rg, self.out
        c = self.controls(t)
        miss = b.solve(c)
        shut = self.shut(t)
        if t > ON_BOOK[0]:
            half = b.aw @ rg.m('Hand.L') @ out.grip @ Matrix.Rotation(rad(2 * shut), 4, 'Y') @ out.gripR
            h3 = half.to_3x3().normalized()
            self.on_book = dict(arm=('at', tuple(half.translation), self.elbowR), hand=(tuple(h3.col[1]), tuple(h3.col[2])), grip=1.0)
            c['armR'] = sched(t, self.armR)
            miss['armR'] = b.arm_('R', c)
        # what the solver cannot reach of the reading pose (shoulders, forearm and thigh twist) comes back as she settles
        w = smoother((t - (SIT[1] - 0.6)) / 1.8)
        if w > 0:
            arms = {'L': w * smoother((t - self.armL[1][1]) / (self.armL[1][2] - self.armL[1][1])), 'R': w * smoother((t - (OPEN[1] - 0.4)) / 0.4)}
            for n, r in out.res.items():
                if r.angle > 1e-6:
                    k = arms[n[-1]] if ('arm' in n.lower() or n.startswith(('Hand', 'Shoulder'))) and n[-2:] in ('.L', '.R') else w
                    if k > 0:
                        rg.set(n, rg.q[n] @ Quaternion().slerp(r, k))
        return miss

    def pose(self, t):
        b, rg, out = self.b, self.b.rg, self.out
        if t < J:                                   # her lying down, backwards: eased in, and still moving at its end
            u = min(1.0, max(0.0, (t - UP[0]) / (UP[1] - UP[0])))
            u = u ** 1.15
            miss = out.pose(OUT[0] + (OUT[1] - OUT[0]) * u)['miss']
            if t > J - FADE:                        # handing over to the tracks: both poses, blended
                qa, la = rg.snapshot(), rg.loc['Hips'].copy()
                self.own(t)
                k = smoother((t - (J - FADE)) / FADE)
                for n in rg.names:
                    rg.q[n] = qa[n].slerp(rg.q[n], k)
                rg.loc['Hips'] = la.lerp(rg.loc['Hips'], k)
                rg._m.clear()
        else:
            miss = self.own(t)
        look = smoother((t - (OPEN[0] - 0.3)) / 1.2)               # her eyes go back to the page as the book opens
        for e in ('Eye.L', 'Eye.R'):
            rg.set(e, Quaternion().slerp(out.base[e], look))
        shut = self.shut(t)
        book = b.aw @ rg.m('Hand.L') @ out.grip @ Matrix.Rotation(rad(shut), 4, 'Y')
        return dict(book=book, shut=shut, face=self.face(t), miss=miss)


def show(t, shot=None):
    """Put one moment on the live rig (nothing keyed)."""
    import bpy
    import rig as R
    arm, book, face = (bpy.data.objects[N.NAMES[k]] for k in ('arm', 'book', 'face'))
    shot = shot or Back(arm)
    out = shot.pose(t)
    R.write_pose(arm, shot.b.rg)
    N.put_book(book, out['book'], out['shut'])
    kb = face.data.shape_keys.key_blocks
    for k in ('eyeBlinkLeft', 'eyeBlinkRight', 'jawOpen', 'mouthSmileLeft', 'mouthSmileRight'):
        kb[k].value = out['face'].get(k, 0.0)
    bpy.context.view_layer.update()
    return shot, {k: round(v * 1000) for k, v in out['miss'].items()}


ACTION = 'Nap walk • back (Claude)'


def bake():
    """Key every frame of the way back on the study's rig (for looking at it in Blender; nap.bake keys the way out)."""
    import bpy
    arm, book, face = (bpy.data.objects[N.NAMES[k]] for k in ('arm', 'book', 'face'))
    scene = bpy.data.scenes[N.SCENE]
    shot = Back(arm)
    rg = shot.b.rg
    count = int(round(LENGTH * FPS)) + 1
    frames = [float(f) for f in range(1, count + 1)]
    samples = []
    for f in frames:
        out = shot.pose((f - 1) / FPS)
        out['q'], out['hips'] = rg.snapshot(), rg.loc['Hips'].copy()
        samples.append(out)
    old = bpy.data.actions.get(ACTION)
    if old:
        bpy.data.actions.remove(old)
    act = bpy.data.actions.new(ACTION)
    act.use_fake_user = True
    fcs = N._slot(act, arm)
    for n in rg.names:
        qs = [s['q'][n] for s in samples]
        arm.pose.bones[n].rotation_mode = 'QUATERNION'
        for i in range(1, len(qs)):
            if qs[i].dot(qs[i - 1]) < 0: qs[i] = -qs[i]
        for c in range(4):
            N._write(fcs, f'pose.bones["{n}"].rotation_quaternion', c, frames, [q[c] for q in qs], n)
    for c in range(3):
        N._write(fcs, 'pose.bones["Hips"].location', c, frames, [s['hips'][c] for s in samples], 'Hips')
    bfc = N._slot(act, book)
    book.rotation_mode, book.scale = 'QUATERNION', (-1, -1, -1)
    rots = [(s['book'].to_3x3().normalized() * -1.0).to_quaternion() for s in samples]
    for i in range(1, len(rots)):
        if rots[i].dot(rots[i - 1]) < 0: rots[i] = -rots[i]
    for c in range(3): N._write(bfc, 'location', c, frames, [s['book'].translation[c] for s in samples])
    for c in range(4): N._write(bfc, 'rotation_quaternion', c, frames, [q[c] for q in rots])
    for ch in book.children:
        sign = -1 if ch.name.endswith('.004') else 1 if ch.name.endswith('.005') else 0
        if sign:
            ch.rotation_mode = 'XYZ'
            N._write(N._slot(act, ch), 'rotation_euler', 1, frames, [sign * rad(s['shut']) for s in samples])
    keys = face.data.shape_keys
    kfc = N._slot(act, keys, 'KEY')
    for k in sorted({k for s in samples for k in s['face']}):
        N._write(kfc, f'key_blocks["{k}"].value', 0, frames, [s['face'].get(k, 0.0) for s in samples])
    scene.frame_start, scene.frame_end = 1, count
    scene.frame_set(1)
    return {'frames': count}
