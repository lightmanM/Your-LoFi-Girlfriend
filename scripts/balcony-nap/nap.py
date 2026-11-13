"""The nap: she closes her book, gets up, walks out to the daybed, sits on its edge, lies down on her side with her
legs together and falls asleep.

Shot(arm).pose(t) puts the pose at time t (seconds) into the rig and returns the book's world matrix, how far it is
closed and the face keys. Everything about the choreography (times, places, angles) is in this file. Places are world
metres in the balcony scene: the page's camera looks along -x, +y is screen right, headings are degrees from +x.
"""
import json
import math
from mathutils import Vector, Matrix, Quaternion
import body as BD
import rig as R
from tracks import Track, smooth, smoother, pulse, blink

FPS = 30
rad = math.radians

# --- timeline (seconds) ---
YAWN = (0.6, 1.2, 1.9, 2.6)       # a small yawn over the book: rises, holds, fades
CLOSE = (1.7, 2.95)               # her right hand folds its half of the book over onto the half in her left
HAND_OFF = (CLOSE[1] + 0.05, CLOSE[1] + 0.95)   # then that hand leaves the shut book for her thigh
RISE = (3.0, 4.9)                 # forward over her feet and up
W0 = 4.35                         # first step, while she is still coming upright: rising runs into walking
W1 = W0 + 3.8                     # standing at the daybed
# From her last two steps on, nothing waits for anything else: she turns as she steps, sits as she turns, reaches for
# the mattress as she sits, and is already leaning toward the pillows as she lands.
ARRIVE = W0 + 2.46                # her last two steps begin
SIT = (ARRIVE + 0.7, ARRIVE + 1.95)   # her hips go down to the daybed's edge
LIE = (ARRIVE + 1.5, ARRIVE + 4.5)    # her lean toward the pillows, her legs coming up, round onto her side
LENGTH = LIE[1] + 3.6
LIDS = Track(0.0).to(0.3, LIE[1] - 0.2, LIE[1] + 0.4).to(0.12, LIE[1] + 0.4, LIE[1] + 0.7).to(1.0, LIE[1] + 0.9, LIE[1] + 1.8)
BLINKS = (0.35, 3.3, 5.6, ARRIVE + 0.9, LIE[0] + 1.0, LIE[1] - 0.3)

# --- places ---
STAND = (9.43, 25.45)             # over her feet in front of the chair
SEAT = (6.45, 24.31, 0.665)       # her hips sitting on the daybed's edge
BED = (5.97, 24.12, 0.69)         # her hips lying down
STAND_Z = 1.085                   # above what her legs allow: standing and walking, her leg length sets the height
# the picture's top edge: its height at the camera's x, the rise per metre away from it, the camera's x; then how far
# her head is above her hips along her spine, and her hair above that, with a little room
FRAME_TOP, TORSO, HAIR = (1.3266, 0.1102, 13.42), 0.50, 0.29
LEG, HIP_W, HIP_H = 0.994 * 0.792, 0.092, 0.129     # a nearly straight leg; hip joint out from and below the hips bone
# her way over the floor: out of the chair, through the door, along the daybed
LINE = ((9.43, 25.45), (8.2, 24.85), (7.3, 24.74), (6.45, 24.69))
HALF = 0.05                       # each foot lands this far off that line: close, but her legs do not cross seen from behind
PIVOT = 34.0                      # degrees a foot on the floor may point away from where her hips face: past it, it turns on the spot
# footsteps on the line: (side, start, end) from W0 and how far along it; then the last two, placed to sit down
WALK = (('R', 0.00, 0.50, 0.30, -122), ('L', 0.60, 1.10, 0.98, None), ('R', 1.22, 1.70, 1.66, None), ('L', 1.84, 2.32, 2.34, None))
LAST = (('R', 2.46, 2.96, 6.56, 24.70, -252), ('L', 3.10, 3.62, 6.34, 24.69, -262))
HEEL_OFF, LEAVE, LAND, STRIKE, TOE_OFF, LIFT = 0.30, 0.08, 0.10, 14.0, 52.0, 0.07   # the heel is well up before the foot leaves: the knee bends first
# lying: ankles, and the way the feet point (heading, pitch, roll); when each leg comes up
# (her legs lie together, one on the other, only a little bent: the owner asked for them closer and flatter, 2026-11-12)
BED_FEET = {'L': ((6.556, 24.187, 0.60), (70, 20, -78), LIE[0] + 1.0, LIE[0] + 2.35), 'R': ((6.628, 24.153, 0.705), (70, 20, -78), LIE[0] + 0.75, LIE[0] + 2.05)}
BOOK_REST = ((5.62, 24.43, 0.527), (1, 0, 0))     # where its spine lies on the mattress by the pillow, and the way it runs
# asleep, her right hand on her hip: (forward, to her right, toward her head) from her hips in metres, and the way the
# elbow bends (out, up, forward from her chest)
REST_R = ((0.07, 0.185, 0.02), (1.0, -0.2, -0.4))
SHUT = 74.0                                       # degrees each half turns to close


def on_line(d):
    """The point d metres along LINE and the heading there (eased round the corners)."""
    pts = [Vector(p) for p in LINE]
    segs = [(a, b, (b - a).length, math.degrees(math.atan2((b - a).y, (b - a).x))) for a, b in zip(pts, pts[1:])]
    heads = [h if h < 0 else h - 360 for *_, h in segs]
    run = 0.0
    for i, (a, b, n, _) in enumerate(segs):
        if d <= run + n or i == len(segs) - 1:
            k = (d - run) / n
            h = heads[i]
            if i + 1 < len(segs) and run + n - d < 0.3: h += (heads[i + 1] - h) * 0.5 * smooth(1 - (run + n - d) / 0.3)
            if i > 0 and d - run < 0.3: h += (heads[i - 1] - h) * 0.5 * smooth(1 - (d - run) / 0.3)
            return a.lerp(b, k), h
        run += n


def _steps():
    """STEPS: (side, start, end, x, y, heading); PATH: her hips over the standing foot at the middle of each step."""
    steps, path = [], [(0.0,) + STAND]
    stance = Vector((9.481, 25.481))                       # her left foot, where it is as she reads
    centre = Vector(STAND)
    for sd, t0, t1, d, h in WALK:
        p, hd = on_line(d)
        side = BD.frame(hd).col[1].to_2d() * (HALF if sd == 'L' else -HALF)
        path.append((t0 + 0.4 * (t1 - t0),) + tuple(centre.lerp(stance, 0.25)))
        steps.append((sd, t0, t1, p.x + side.x, p.y + side.y, hd if h is None else h))
        stance, centre = Vector((p.x + side.x, p.y + side.y)), p
    for sd, t0, t1, x, y, h in LAST:
        path.append((t0 + 0.4 * (t1 - t0),) + tuple(centre.lerp(stance, 0.25)))
        steps.append((sd, t0, t1, x, y, h))
        stance, centre = Vector((x, y)), Vector((x - 0.02, y - 0.01))
    path.append((W1 - W0,) + LINE[-1])
    return tuple(steps), tuple(path)


STEPS, PATH = _steps()


def floor_z(x):
    return 0.0 if x > 8.27 else 0.03 if x > 8.0 else 0.022 if x > 7.59 else 0.032


def knots(t, pts):
    """Eased curve through (time, value) points, flat outside them."""
    if t <= pts[0][0]: return pts[0][1]
    for (a, va), (b, vb) in zip(pts, pts[1:]):
        if t <= b:
            return va + (vb - va) * smooth((t - a) / (b - a))
    return pts[-1][1]


def line(t, pts):
    if t <= pts[0][0]: return Vector(pts[0][1:])
    for p, q in zip(pts, pts[1:]):
        if t <= q[0]:
            return Vector(p[1:]).lerp(Vector(q[1:]), (t - p[0]) / (q[0] - p[0]))
    return Vector(pts[-1][1:])


def path(t):
    """Her hips' way over the floor: the PATH points joined and rounded off, so she never stops between steps."""
    taps = ((-0.24, 1), (-0.16, 3), (-0.08, 5), (0.0, 6), (0.08, 5), (0.16, 3), (0.24, 1))
    return sum((line(t - W0 + d, PATH) * w for d, w in taps), Vector((0, 0))) / sum(w for _, w in taps)


class Keys:
    """Controls on timing curves: .to({name: value}, start, end, ease) adds a move; calling it gives the values at t."""

    def __init__(self, start):
        self.tr = {k: [Track(x) for x in (v if isinstance(v, (tuple, list)) else (v,))] for k, v in start.items()}
        self.scalar = {k for k, v in start.items() if not isinstance(v, (tuple, list))}

    def to(self, values, a, b, ease='io'):
        for k, v in values.items():
            for tr, x in zip(self.tr[k], v if isinstance(v, (tuple, list)) else (v,)):
                tr.to(x, a, b, ease)
        return self

    def __call__(self, t):
        return {k: (trs[0](t) if k in self.scalar else tuple(tr(t) for tr in trs)) for k, trs in self.tr.items()}


def sched(t, poses):
    """poses: first pose, then (pose, start, end) in order. Poses may be functions of t. -> ('mix', A, B, k)."""
    get = lambda p: p(t) if callable(p) else p
    cur = poses[0]
    for p, a, b in poses[1:]:
        if t >= b:
            cur = p
        elif t > a:
            return ('mix', get(cur), get(p), smoother((t - a) / (b - a)))
        else:
            break
    return ('mix', get(cur), get(cur), 0.0)


class Shot:
    def __init__(self, arm):
        self.arm = arm
        self.b = b = BD.Body(arm)
        self.base = {k: Quaternion(v) for k, v in json.loads(arm['nap_base_pose']).items()}
        b.base = {k: tuple(v) for k, v in self.base.items()}
        rg = b.rg
        rg.load(self.base); rg.loc = {n: Vector() for n in rg.names}; rg.loc['Hips'] = Vector(arm['nap_base_hips']); rg._m.clear()
        self.read = k0 = BD.extract(b)
        for sd in 'LR':                                  # feet flat on the floor
            f = k0['foot' + sd]
            k0['foot' + sd] = (f[0], f[1], 0.0, f[3], 0.0, 0.0)
        self.grip = Matrix(json.loads(arm['nap_book_grip']))
        self.gripR = (b.aw @ rg.m('Hand.L') @ self.grip).inverted() @ (b.aw @ rg.m('Hand.R'))   # her right hand, from its half of the book
        # what the solver cannot reach of the reading pose (shoulders, forearm and thigh twist): faded out as she rises
        b.solve(self.controls(0.0))
        self.res = {n: rg.q[n].inverted() @ self.base[n] for n in rg.names}

        hx, hy, hz = k0['hips']
        tk = Keys(dict(hx=hx, hy=hy, hz=hz, heading=k0['heading'], pitch=k0['pitch'], roll=k0['roll'], twist=0.0, lean=0.0,
                       spine=k0['spine'], chest=k0['chest'], neck=k0['neck'], head=k0['head']))
        # the yawn: head back a little, then down to the book as it closes
        tk.to(dict(neck=(-2, 9, 0), head=(-2, 4, 6)), YAWN[0], YAWN[1], 'soft')
        tk.to(dict(neck=(-3, 13, 0), head=(-2, 15, 8)), YAWN[2] + 0.1, CLOSE[1] - 0.2)
        # up from the chair: forward over her feet, then up
        tk.to(dict(pitch=36.0), RISE[0], RISE[0] + 0.95).to(dict(pitch=13.0), RISE[0] + 0.85, RISE[1]).to(dict(pitch=1.5), W0 + 0.45, W0 + 1.5)   # she is still coming upright through her first step (FRAME_TOP)
        tk.to(dict(hx=9.14, hy=25.56, hz=0.75), RISE[0], RISE[0] + 0.8)
        tk.to(dict(hx=STAND[0], hy=STAND[1], hz=STAND_Z), RISE[0] + 0.6, RISE[1], 'soft')
        tk.to(dict(spine=(0, 4, 0), chest=(0, 8, 0)), RISE[0], RISE[0] + 0.9).to(dict(spine=(0, 0, 0), chest=(0, -2, 0)), RISE[0] + 0.9, RISE[1])
        tk.to(dict(neck=(0, -10, 0), head=(0, -12, 0)), RISE[0], RISE[0] + 0.9).to(dict(neck=(0, 0, 0), head=(0, 1, 0)), RISE[0] + 0.9, RISE[1])
        tk.to(dict(roll=0.0), RISE[0], RISE[1])
        # the walk: the way she faces (her hips' place comes from PATH)
        # she starts to turn toward the door while she is still getting up, not on the spot once she stands
        tk.to(dict(heading=-150.0), RISE[0] + 0.8, W0 + 1.1).to(dict(heading=-172.0), W0 + 1.05, W0 + 1.9)
        tk.to(dict(heading=-180.0), W0 + 1.9, W0 + 2.5).to(dict(heading=-270.0), ARRIVE + 0.05, ARRIVE + 1.8)
        ox, oy = PATH[-1][1] - STAND[0], PATH[-1][2] - STAND[1]      # the walk is added on top of these curves
        # down onto the daybed's edge while she still turns: the forward lean of sitting never comes back upright, it
        # goes over into the lean toward the pillows
        tk.to(dict(pitch=24.0), SIT[0] - 0.1, SIT[0] + 0.7).to(dict(pitch=0.0), SIT[0] + 0.6, SIT[1] + 0.5)
        tk.to(dict(hy=SEAT[1] - oy, hx=SEAT[0] - ox), SIT[0], SIT[1] - 0.1).to(dict(hz=SEAT[2]), SIT[0] + 0.05, SIT[1], 'down')
        tk.to(dict(spine=(0, 5, 0), chest=(0, 7, 0)), SIT[0] + 0.2, SIT[1])
        # toward the pillows (lean: degrees toward them, whichever way she faces), round onto her side, legs following
        a, z = LIE
        tk.to(dict(lean=64.0), a, z - 0.9).to(dict(heading=-360.0), a + 0.7, z - 0.5).to(dict(twist=76.0), a + 1.1, z - 0.2)
        tk.to(dict(hx=BED[0] - ox, hy=BED[1] - oy), a - 0.15, z - 0.9).to(dict(hz=BED[2]), a + 0.5, z - 0.9)   # sliding along it as she lands
        tk.to(dict(spine=(-25, 8, 0), chest=(-26, 10, 0)), a + 1.2, z)
        tk.to(dict(neck=(-4, 2, 0), head=(-8, -4, 0)), a + 0.1, a + 1.4).to(dict(neck=(6, 10, -6), head=(14, 8, -10)), z - 1.0, z + 0.7)
        self.tk = tk

        # feet
        self.steps = {'L': [], 'R': []}
        for sd, t0, t1, x, y, h in STEPS:
            self.steps[sd].append((W0 + t0, W0 + t1, (x, y, floor_z(x), h)))
        # arms
        o, along = BOOK_REST
        rel = k0['armL'][1]
        self.armL = [dict(arm=k0['armL'], handrel=k0['handrelL'], grip=1.0),
                     (dict(arm=('rel', (rel[0] + 0.02, rel[1] - 0.09, rel[2] - 0.05), k0['armL'][2]), handrel=k0['handrelL'], grip=1.0), CLOSE[1] - 0.4, RISE[0] + 1.0),
                     (None, LIE[0] + 0.1, LIE[0] + 1.9)]      # filled in below: her hand lays the book down by the pillows, and she leans on it
        # her right hand holds its half of the book until the book is shut (on_book follows that half as it closes),
        # then goes to her thigh to push herself up
        self.elbowR = k0['armR'][2]
        self.on_book = dict(arm=k0['armR'], handrel=k0['handrelR'], grip=1.0)
        self.armR = [lambda t: self.on_book,
                     (dict(arm=('thigh', 0.62, 0.085, (0.9, 0.2, -0.6), 0.04), curl=0.45), *HAND_OFF),
                     (self.swing, RISE[0] + 0.72, RISE[0] + 1.7),
                     # her right hand finds the mattress beside her as she comes down, and stays on it until she is nearly lying
                     (dict(arm=('at', (SEAT[0] + 0.27, SEAT[1] + 0.06, 0.60), (0.6, 0.0, -1.0)), curl=0.45), SIT[0] + 0.35, SIT[0] + 1.05),
                     # asleep it lies along her side, the hand on her hip (over her front it ran through her chest)
                     (dict(arm=('hip',) + REST_R, curl=0.7), LIE[0] + 0.6, LIE[0] + 2.2)]
        # the book at rest: flat on the mattress in front of her, spine away from her; her left hand goes where that puts it
        dx, dy = Vector((0, 0, 1)), Vector(along).normalized()
        m = Matrix.Identity(4)
        for i, col in enumerate((dx, dy, -(dx.cross(dy)))):
            for r in range(3): m[r][i] = col[r]
        m.translation = Vector(o)
        hand = m @ (self.grip @ Matrix.Rotation(rad(SHUT), 4, 'Y')).inverted()
        h3 = hand.to_3x3().normalized()
        # Both hands end fixed in the room, but on the way there her chest turns right round under them. So each hand's
        # last pose is given from her chest as it lies at the end (and the elbow keeps the side it has): blending it
        # with the pose before, also from her chest, never passes through a half turn, where a hand would snap.
        final = self.controls(LENGTH + 1.0)
        b.rg.load(self.base); b.torso(final)
        chest = b.chest.inverted()
        seen = lambda v, sgn: (lambda w: (sgn * w.y, w.z, w.x))(chest @ Vector(v))
        self.armL[2] = (dict(arm=('at', tuple(hand.translation), k0['armL'][2]), handrel=(seen(h3.col[1], 1), seen(h3.col[2], 1)), grip=1.0),) + self.armL[2][1:]
        self.book_rest = m

    # --- gait ---
    def gait(self, t):
        """Layers on the walk: pelvis turn and tilt, the dip at each footfall, her free arm."""
        fade = smooth((t - W0) / 0.5) * (1 - smooth((t - (W1 - 0.5)) / 0.6))
        yaw = [(W0 - 0.2, 0.0)] + [(W0 + t1, 5.0 if sd == 'R' else -5.0) for sd, _, t1, *_ in STEPS] + [(W1 + 0.3, 0.0)]
        mid = [(W0 - 0.3, 0.0)] + [(W0 + (t0 + t1) / 2, 2.5 if sd == 'R' else -2.5) for sd, t0, t1, *_ in STEPS] + [(W1 + 0.3, 0.0)]
        sw = [(W0 - 0.2, 4.0)] + [(W0 + t1, -14.0 if sd == 'R' else 18.0) for sd, _, t1, *_ in STEPS] + [(W1 + 0.4, 4.0)]
        return dict(yaw=knots(t, yaw) * fade, roll=knots(t, mid) * fade, swing=knots(t, sw))

    def hips_xy(self, t, v=None):
        v = v or self.tk(t)
        return Vector((v['hx'], v['hy'])) + path(t) - Vector(STAND)

    def reach(self, t):
        """How high her hips can be with a nearly straight leg on each foot on the floor (None: she has left it)."""
        v = self.tk(t)
        xy, left = self.hips_xy(t, v), BD.frame(v['heading']).col[1].to_2d()
        best = None
        for sd, k in (('L', 1), ('R', -1)):
            spec = self.foot(sd, t)
            if spec[0] == 'free':
                continue
            ankle = self.b.foot_goal(spec)[0]
            flat = (ankle.to_2d() - (xy + left * (k * HIP_W))).length
            # a foot in the air holds her hips less the higher it is: the hold comes on as it lands, not all at once
            z = ankle.z + math.sqrt(max(LEG * LEG - flat * flat, 0.04)) + HIP_H + 1.2 * spec[5]
            best = z if best is None else min(best, z)
        return best

    def height(self, t, track):
        """Her hips' height: the curve's, or as high as her legs reach if that is lower (rounded off in time)."""
        taps = tuple((d / 50, 7 - abs(d)) for d in range(-6, 7))      # every 0.02 s over a quarter of a second: no step left in it
        got = [(self.reach(t + d), w) for d, w in taps]
        got = [(z, w) for z, w in got if z is not None]
        if not got:
            return track
        z = sum(z * w for z, w in got) / sum(w for _, w in got)
        a = 60.0
        return z - math.log(1.0 + math.exp(-a * (track - z))) / a      # a soft minimum of the two

    def swing(self, t):
        s = self.gait(t)['swing']
        return dict(arm=('hang', s, 7, 13 + max(0.0, s) * 0.7), curl=1.0)

    def foot(self, sd, t):
        """Her foot's control at t. On the floor it turns on the spot rather than point far from where she faces."""
        spec = self.step_foot(sd, t)
        w = 1 - smooth((t - SIT[0]) / 0.5)                  # while she walks; sitting down her feet stay as they are
        if spec[0] == 'free' or w <= 0:
            return spec
        off = (spec[3] - self.tk(t)['heading'] + 180) % 360 - 180
        held = PIVOT * math.tanh(off / PIVOT)
        return spec[:3] + (spec[3] + (held - off) * w,) + spec[4:]

    def step_foot(self, sd, t):
        k0 = self.read['foot' + sd]
        cur = (k0[0], k0[1], 0.0, k0[3])
        for t0, t1, to in self.steps[sd]:
            if t >= t1:
                land = -STRIKE * (1 - smooth((t - t1) / LAND))
                cur = to
                if t < t1 + LAND:
                    return cur + (land, 0.0)
                continue
            if t <= t0 - HEEL_OFF:
                break
            # One move from the heel coming up to the foot landing. The heel is still rising when the toes leave the
            # ground (LEAVE before the step's own start), so the foot never pauses between the two.
            heel, leave, top, flat = t0 - HEEL_OFF, t0 - LEAVE, t0 + 0.12 * (t1 - t0), t0 + 0.6 * (t1 - t0)
            if t < top: pitch = (TOE_OFF + 5) * smooth((t - heel) / (top - heel))
            elif t < flat: pitch = (TOE_OFF + 5) * (1 - smooth((t - top) / (flat - top)))
            else: pitch = -STRIKE * smooth((t - flat) / (t1 - flat))
            k = max(0.0, (t - leave) / (t1 - leave))
            e = smooth(k)
            return tuple(a + (b - a) * e for a, b in zip(cur, to)) + (pitch, LIFT * math.sin(math.pi * k))
        spec = cur + (0.0, 0.0)
        ankle, angles, a, z = BED_FEET[sd]
        if t <= a:
            return spec
        p0, f0, _ = self.b.foot_goal(spec)
        k = smoother((t - a) / (z - a))
        pos = p0.lerp(Vector(ankle), k) + Vector((0, 0, 0.13 * math.sin(math.pi * k)))
        return ('free', tuple(pos), f0.to_quaternion().slerp(BD.frame(*angles).to_quaternion(), k).to_matrix())

    # --- the whole body ---
    def controls(self, t):
        if not hasattr(self, 'tk'):                     # the reading pose, before the tracks exist
            c = dict(self.read)
            c['armL'] = dict(arm=c['armL'], handrel=c['handrelL'], grip=1.0)
            c['armR'] = dict(arm=c['armR'], handrel=c['handrelR'], grip=1.0)
            return c
        v = self.tk(t)
        g = self.gait(t)
        hx, hy = self.hips_xy(t, v)
        lead = max(-32.0, min(32.0, (self.tk(t + 0.4)['heading'] - v['heading']) * 0.55)) * (1 - smooth((t - LIE[0]) / 0.5))
        face = rad(v['heading'])                        # her lean is toward the pillows (-x): back or sideways as she faces
        pitch = v['pitch'] - v['lean'] * math.cos(face)
        # by her chair she is too near the camera to stand at full height inside the picture: her hips stay as low as
        # keeps her hair under its top edge, so she finishes straightening as her first step takes her away from it
        head_x = hx + math.cos(face) * TORSO * math.sin(rad(pitch))
        top = FRAME_TOP[0] + FRAME_TOP[1] * (FRAME_TOP[2] - head_x) - (TORSO * math.cos(rad(pitch)) + HAIR)
        hz = self.height(t, v['hz'])
        hz = top - math.log(1.0 + math.exp(-40.0 * (hz - top))) / 40.0 if hz - top > -0.25 else hz
        c = dict(hips=(hx, hy, hz), heading=v['heading'] + g['yaw'], twist=v['twist'],
                 pitch=pitch, roll=v['roll'] + g['roll'] - v['lean'] * math.sin(face),
                 spine=(v['spine'][0] - 0.7 * g['yaw'], v['spine'][1], v['spine'][2] - 0.6 * g['roll']),
                 chest=(v['chest'][0] - 0.9 * g['yaw'], v['chest'][1], v['chest'][2] - 0.4 * g['roll']),
                 neck=(v['neck'][0] + 0.4 * lead + 0.3 * g['yaw'], v['neck'][1], v['neck'][2]),
                 head=(v['head'][0] + 0.6 * lead + 0.3 * g['yaw'], v['head'][1], v['head'][2]))
        y = pulse(t, *YAWN)
        c['neck'] = (c['neck'][0], c['neck'][1] - 5 * y, c['neck'][2])
        c['head'] = (c['head'][0], c['head'][1] - 9 * y, c['head'][2])
        for sd in 'LR':
            c['foot' + sd] = self.foot(sd, t)
        c['armL'] = sched(t, self.armL)
        c['armR'] = sched(t, self.armR)
        return c

    def face(self, t):
        y = pulse(t, *YAWN)
        drowsy = 0.28 * smooth((t - YAWN[2]) / 1.6)        # after the yawn her eyes stay a little heavy all the way
        lids = max(LIDS(t), drowsy, 0.85 * y, max(blink(t, at) for at in BLINKS))
        asleep = smooth((t - (LIE[1] + 0.9)) / 1.5)
        return {'eyeBlinkLeft': lids, 'eyeBlinkRight': lids, 'jawOpen': 0.5 * y, 'mouthFunnel': 0.35 * y,
                'browInnerUp': 0.5 * y, 'eyeSquintLeft': 0.4 * y, 'eyeSquintRight': 0.4 * y,
                'mouthSmileLeft': 0.25 * asleep, 'mouthSmileRight': 0.25 * asleep}

    def pose(self, t):
        b, rg = self.b, self.b.rg
        c = self.controls(t)
        miss = b.solve(c)
        shut = SHUT * smoother((t - CLOSE[0]) / (CLOSE[1] - CLOSE[0]))
        if hasattr(self, 'tk') and t < HAND_OFF[1]:
            # her right hand is on its half of the book: now that her left hand (and so the book) is placed, it goes
            # where that half is, turning over with it as the book shuts, and ends flat on the cover
            half = b.aw @ rg.m('Hand.L') @ self.grip @ Matrix.Rotation(rad(2 * shut), 4, 'Y') @ self.gripR
            h3 = half.to_3x3().normalized()
            self.on_book = dict(arm=('at', tuple(half.translation), self.elbowR), hand=(tuple(h3.col[1]), tuple(h3.col[2])), grip=1.0)
            c['armR'] = sched(t, self.armR)
            miss['armR'] = b.arm_('R', c)
        w = 1 - smoother((t - (CLOSE[1] - 0.6)) / 1.8)
        if w > 0:
            # an arm's share goes as that arm leaves its reading pose
            arms = {'L': w * (1 - smoother((t - self.armL[1][1]) / (self.armL[1][2] - self.armL[1][1]))),
                    'R': w * (1 - smoother((t - CLOSE[0]) / 0.4))}       # her right hand turns over with the book from here
            for n, r in self.res.items():
                if r.angle > 1e-6:
                    k = arms[n[-1]] if ('arm' in n.lower() or n.startswith(('Hand', 'Shoulder'))) and n[-2:] in ('.L', '.R') else w
                    if k > 0:
                        rg.set(n, rg.q[n] @ Quaternion().slerp(r, k))
        up = smooth((t - YAWN[0]) / 0.5) * (1 - pulse(t, CLOSE[0] - 0.3, CLOSE[0], CLOSE[1] - 0.3, CLOSE[1]) * 0.8)
        for e in ('Eye.L', 'Eye.R'):
            rg.set(e, self.base[e].slerp(Quaternion(), up))
        book = b.aw @ rg.m('Hand.L') @ self.grip @ Matrix.Rotation(rad(shut), 4, 'Y')
        return dict(book=book, shut=shut, face=self.face(t), miss=miss)


# --- on the live rig ---
NAMES = dict(arm='Nap walk • armature', book='Nap walk • book', face='Nap walk • bn0010_Face.020')


def put_book(book, m, shut):
    book.rotation_mode = 'QUATERNION'
    book.location = m.translation
    book.rotation_quaternion = (m.to_3x3().normalized() * -1.0).to_quaternion()      # its frame is mirrored
    book.scale = (-1, -1, -1)
    for ch in book.children:
        ch.rotation_mode = 'XYZ'
        if ch.name.endswith('.004'): ch.rotation_euler = (0, -rad(shut), 0)
        elif ch.name.endswith('.005'): ch.rotation_euler = (0, rad(shut), 0)


def show(t, shot=None):
    import bpy
    arm, book, face = (bpy.data.objects[NAMES[k]] for k in ('arm', 'book', 'face'))
    shot = shot or Shot(arm)
    out = shot.pose(t)
    R.write_pose(arm, shot.b.rg)
    put_book(book, out['book'], out['shut'])
    kb = face.data.shape_keys.key_blocks
    for k, v in out['face'].items():
        kb[k].value = v
    bpy.context.view_layer.update()
    return shot, {k: round(v * 1000) for k, v in out['miss'].items()}


ACTION = 'Nap walk • nap (Claude)'
SCENE = 'Balcony • Nap walk (Claude)'


def _curves(action, slot):
    from bpy_extras import anim_utils
    return anim_utils.action_ensure_channelbag_for_slot(action, slot).fcurves


def _write(fcurves, path, index, frames, values, group=None):
    fc = fcurves.new(path, index=index, group_name=group) if group else fcurves.new(path, index=index)
    fc.keyframe_points.add(len(frames))
    fc.keyframe_points.foreach_set('co', [x for pair in zip(frames, values) for x in pair])
    for kp in fc.keyframe_points:
        kp.interpolation = 'LINEAR'
    fc.update()


def _slot(act, idb, id_type='OBJECT'):
    if not idb.animation_data: idb.animation_data_create()
    idb.animation_data.action = act
    slot = act.slots.new(id_type=id_type, name=idb.name)
    idb.animation_data.action_slot = slot
    return _curves(act, slot)


def bake(start=0.0, end=LENGTH):
    """Key every frame of the shot: bones, her hips' place, the book and its two halves, the face."""
    import bpy
    arm, book, face = (bpy.data.objects[NAMES[k]] for k in ('arm', 'book', 'face'))
    scene = bpy.data.scenes[SCENE]
    shot = Shot(arm)
    rg = shot.b.rg
    f0, f1 = int(round(start * FPS)) + 1, int(round(end * FPS)) + 1
    frames = [float(f) for f in range(f0, f1 + 1)]
    samples, worst = [], 0.0
    for f in frames:
        out = shot.pose((f - 1) / FPS)
        out['q'] = rg.snapshot()
        out['hips'] = rg.loc['Hips'].copy()
        worst = max(worst, max(out['miss'].values()))
        samples.append(out)
    old = bpy.data.actions.get(ACTION)
    if old:
        bpy.data.actions.remove(old)
    act = bpy.data.actions.new(ACTION)
    act.use_fake_user = True
    fcs = _slot(act, arm)
    for n in rg.names:
        qs = [s['q'][n] for s in samples]
        arm.pose.bones[n].rotation_mode = 'QUATERNION'
        if max(qs[0].rotation_difference(q).angle for q in qs) < 1e-5:
            arm.pose.bones[n].rotation_quaternion = qs[0]
            continue
        for i in range(1, len(qs)):                 # neighbouring keys on the same side of the quaternion sphere
            if qs[i].dot(qs[i - 1]) < 0: qs[i] = -qs[i]
        for c in range(4):
            _write(fcs, f'pose.bones["{n}"].rotation_quaternion', c, frames, [q[c] for q in qs], n)
    for c in range(3):
        _write(fcs, 'pose.bones["Hips"].location', c, frames, [s['hips'][c] for s in samples], 'Hips')
    bfc = _slot(act, book)
    book.rotation_mode = 'QUATERNION'
    book.scale = (-1, -1, -1)
    rots = [(s['book'].to_3x3().normalized() * -1.0).to_quaternion() for s in samples]
    for i in range(1, len(rots)):
        if rots[i].dot(rots[i - 1]) < 0: rots[i] = -rots[i]
    for c in range(3): _write(bfc, 'location', c, frames, [s['book'].translation[c] for s in samples])
    for c in range(4): _write(bfc, 'rotation_quaternion', c, frames, [q[c] for q in rots])
    for ch in book.children:
        sign = -1 if ch.name.endswith('.004') else 1 if ch.name.endswith('.005') else 0
        if sign:
            ch.rotation_mode = 'XYZ'
            _write(_slot(act, ch), 'rotation_euler', 1, frames, [sign * rad(s['shut']) for s in samples])
    keys = face.data.shape_keys
    kfc = _slot(act, keys, 'KEY')
    for k in sorted({k for s in samples for k in s['face']}):
        _write(kfc, f'key_blocks["{k}"].value', 0, frames, [s['face'].get(k, 0.0) for s in samples])
    scene.frame_start, scene.frame_end = f0, f1
    scene.render.fps, scene.render.fps_base = FPS, 1.0
    scene.frame_set(f0)
    return {'frames': len(frames), 'worst_reach_miss_mm': round(worst * 1000, 1)}
