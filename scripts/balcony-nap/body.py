"""Whole-body posing for the nap study: world-space controls in, bone rotations out.

Built on the stretch study's Rig (scripts/balcony-stretch/rig.py). The armature object never moves: she travels by
her hips bone, as the page does it. A pose is a flat dict of controls (see REST), so a shot is a set of timing curves
over those controls and the feet stay where they are planted.

World axes (Blender): z up. Headings are degrees, 0 = +x, 90 = +y. The page's camera looks along -x (heading 180)
and +y is screen right. A body frame has columns forward, left, up; pitch > 0 leans forward, roll > 0 leans to her
right, yaw > 0 turns to her left.
"""
import math
from mathutils import Vector, Matrix, Quaternion
import rig as R

rad = math.radians
A0T = Matrix(((0, -1, 0), (1, 0, 0), (0, 0, 1)))        # rows: her forward, left, up at rest, in armature space
ANKLE, BALL, HEEL = 0.093, 0.077, 0.035                 # armature units: ankle height, ball ahead of / heel behind it
FINGERS = {'Index': 0.85, 'Middle': 1.0, 'Ring': 1.1, 'Little': 1.2}
CURL = {'Proximal': -22.0, 'Intermediate': -30.0, 'Distal': -18.0}


def frame(heading, pitch=0.0, roll=0.0):
    return (Matrix.Rotation(rad(heading), 3, 'Z') @ Matrix.Rotation(rad(pitch), 3, 'Y') @ Matrix.Rotation(rad(roll), 3, 'X'))


def step(f, yaw=0.0, pitch=0.0, roll=0.0):
    """The next body frame up the spine: `f` turned by yaw, pitch, roll in its own axes."""
    return f @ frame(yaw, pitch, roll)


class Body:
    def __init__(self, arm):
        self.arm = arm
        self.rg = R.Rig(arm)
        self.base = R.read_pose(arm)
        self.rg.load(self.base)
        self.aw = arm.matrix_world.copy()
        self.awi = self.aw.inverted()
        self.a3 = self.aw.to_3x3().normalized()
        self.a3i = self.a3.inverted()
        self.s = self.aw.to_scale().x

    # --- helpers ---
    def pt(self, p):
        return self.awi @ Vector(p)

    def vec(self, d):
        return self.a3i @ Vector(d)

    def world(self, bone):
        return self.aw @ self.rg.head(bone)

    def set_frame(self, bone, f):
        """Give a bone the orientation it has at rest, carried into the world body frame `f`."""
        self.rg.set_rot(bone, (self.a3i @ f) @ A0T @ self.rg.rest[bone].to_3x3())

    def frame_of(self, bone):
        """The world body frame a bone is in now (the inverse of set_frame)."""
        return self.a3 @ self.rg.m(bone).to_3x3().normalized() @ self.rg.rest[bone].to_3x3().inverted() @ A0T.transposed()

    # --- parts ---
    def torso(self, c):
        rg = self.rg
        f = step(frame(c['heading'], c['pitch'], c['roll']), c.get('twist', 0.0))   # twist: about her own long axis
        self.set_frame('Hips', f)
        rest = rg.rest['Hips']
        rg.loc['Hips'] = rest.to_3x3().inverted() @ (self.pt(c['hips']) - rest.translation)
        rg._m.clear()
        self.hipf = f
        cf = c.get('chestf')            # the chest's own frame (heading, pitch, roll): the spine goes halfway to it
        for bone, key in (('Spine', 'spine'), ('Chest', 'chest'), ('Neck', 'neck'), ('Head', 'head')):
            if cf is not None and bone == 'Spine':
                f = f.to_quaternion().slerp(frame(*cf).to_quaternion(), 0.5).to_matrix()
            elif cf is not None and bone == 'Chest':
                f = frame(*cf)
            else:
                f = step(f, *c[key])
            self.set_frame(bone, f)
            if bone == 'Chest':
                self.chest = f
        self.hipf = step(frame(c['heading'], c['pitch'], c['roll']), c.get('twist', 0.0))

    def foot_goal(self, spec):
        """(ankle, foot frame, toes kept flat on the floor) for a foot control.

        On the floor: (x, y, floor z, heading, pitch, lift), the point being under the ankle with the foot flat.
        Off it: ('free', ankle, (heading, pitch, roll))."""
        s = self.s
        if spec[0] == 'free':
            return Vector(spec[1]), (spec[2] if isinstance(spec[2], Matrix) else frame(*spec[2])), None
        x, y, z, heading, pitch, lift = spec
        flat = frame(heading)
        fwd, up = flat.col[0], Vector((0, 0, 1))
        base = Vector((x, y, z + lift))
        if pitch >= 0:        # heel up: the ball of the foot stays down
            piv, r = base + fwd * (BALL * s), (-BALL * s, ANKLE * s)
        else:                 # toes up: the heel stays down
            piv, r = base - fwd * (HEEL * s), (HEEL * s, ANKLE * s)
        cp, sp = math.cos(rad(pitch)), math.sin(rad(pitch))
        ankle = piv + (fwd * cp - up * sp) * r[0] + (up * cp + fwd * sp) * r[1]
        return ankle, frame(heading, pitch), (flat if pitch > 0 else None)

    def leg(self, sd, c):
        rg, s = self.rg, self.s
        up = Vector((0, 0, 1))
        ankle, ff, toes = self.foot_goal(c['foot' + sd])
        upper, lower, foot, toe = (n + '.' + sd for n in ('Upper_leg', 'Lower_leg', 'Foot', 'Toe'))
        h, t = rg.head(upper), self.pt(ankle)
        l1, l2 = rg.length(upper, lower), rg.length(lower, foot)
        delta = t - h
        d = max(abs(l1 - l2) + 1e-4, min(delta.length, (l1 + l2) * 0.999))
        ax = delta.normalized()
        kn = c.get('knee' + sd)
        if kn is None:                                      # the knee points between where her hips and her foot face
            kd = self.hipf.col[0] if c['foot' + sd][0] == 'free' else (self.hipf.col[0] + ff.col[0] * 1.0).normalized()
        elif len(kn) == 3:                                  # a world direction
            kd = Vector(kn)
        else:                                               # along this heading, lifted by [1] degrees
            kd = frame(kn[0]).col[0] * math.cos(rad(kn[1])) + up * math.sin(rad(kn[1]))
        mix = c.get('kneemix' + sd)                           # ((heading, lift), share): partly toward a set direction
        if mix:
            k2 = frame(mix[0][0]).col[0] * math.cos(rad(mix[0][1])) + up * math.sin(rad(mix[0][1]))
            kd = Vector(kd).lerp(k2, mix[1])
        b = self.vec(kd)
        b = (b - ax * b.dot(ax)).normalized()
        along = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
        knee = h + ax * along + b * math.sqrt(max(0.0, l1 * l1 - along * along))
        hinge = b.cross(ax)
        rg.orient(upper, knee - h, hinge, 'X'); rg.aim(upper, lower, knee)
        goal = h + ax * d
        rg.orient(lower, goal - rg.head(lower), hinge, 'X'); rg.aim(lower, foot, goal)
        self.set_frame(foot, ff)
        if toes is not None:
            self.set_frame(toe, toes)
        else:
            rg.set(toe, Quaternion())
        return (rg.head(foot) - t).length * s

    def arm_goal(self, sd, a):
        """World wrist target, elbow hint and hand directions (or None) for one arm pose.

        a: dict(arm=spec, hand=(fingers, back of hand) world, handrel=the same from the chest, curl=1, grip=0)."""
        rg, s, sgn = self.rg, self.s, (1 if sd == 'L' else -1)
        upper, lower, hand = (n + '.' + sd for n in ('Upper_arm', 'Lower_arm', 'Hand'))
        ch = self.chest
        local = lambda v: ch @ Vector((v[2], sgn * v[0], v[1]))     # (out, up, forward) from the chest, mirrored
        sh = self.aw @ rg.head(upper)
        spec = a['arm']
        l1, l2 = rg.length(upper, lower) * s, rg.length(lower, hand) * s
        if spec[0] == 'hang':       # swing forward, out from her side, elbow bend (degrees)
            _, swing, out, bend = spec
            d1 = Vector((math.sin(rad(out)), -math.cos(rad(out)) * math.cos(rad(swing)), math.cos(rad(out)) * math.sin(rad(swing))))
            d2 = Vector((math.sin(rad(out * .5)), -math.cos(rad(out * .5)) * math.cos(rad(swing + bend)), math.cos(rad(out * .5)) * math.sin(rad(swing + bend))))
            target = sh + local(d1) * l1 + local(d2) * l2
            hint = local((0.25, 0.0, -1.0))
        elif spec[0] == 'at':       # a world point, elbow hint (out, up, forward)
            target, hint = Vector(spec[1]), local(spec[2])
        elif spec[0] == 'thigh':    # on her own thigh: how far along it (0 hip, 1 knee), metres above the bone
            hipj, knee = self.aw @ rg.head('Upper_leg.' + sd), self.aw @ rg.head('Lower_leg.' + sd)
            out = self.hipf.col[1] * (sgn * (spec[4] if len(spec) > 4 else 0.0))      # [4]: metres to the outside
            target, hint = hipj.lerp(knee, spec[1]) + Vector((0, 0, spec[2])) + out, local(spec[3])
        elif spec[0] == 'hip':      # (forward, to her own side, up) metres from the hips, in the hips' frame
            f, o, u = spec[1]
            target, hint = self.aw @ rg.head('Hips') + self.hipf @ Vector((f, sgn * o, u)), local(spec[2])
        else:                       # 'rel': (out, up, forward) metres from the shoulder
            target, hint = sh + local(spec[1]), local(spec[2])
        hf, hr = a.get('hand'), a.get('handrel')
        if hr is not None:
            hf = (local(hr[0]), local(hr[1]))
        return target, hint.normalized(), hf

    def arm_(self, sd, c):
        rg, s, sgn = self.rg, self.s, (1 if sd == 'L' else -1)
        upper, lower, hand = (n + '.' + sd for n in ('Upper_arm', 'Lower_arm', 'Hand'))
        a = c['arm' + sd]
        if isinstance(a, dict):
            mix = [(a, 1.0)]
        elif a[0] == 'mix':         # ('mix', pose A, pose B, how far from A to B)
            mix = [(a[1], 1.0 - a[3]), (a[2], a[3])]
        else:
            mix = [(dict(arm=a, hand=c.get('hand' + sd), handrel=c.get('handrel' + sd),
                         curl=c.get('curl' + sd, 1.0), grip=c.get('grip' + sd, 0.0)), 1.0)]
        rg.set('Shoulder.' + sd, Quaternion())
        goals = [(self.arm_goal(sd, p), p, w) for p, w in mix]
        target = sum((g[0] * w for g, _, w in goals), Vector())
        hint = sum((g[1] * w for g, _, w in goals), Vector())
        miss = rg.limb(upper, lower, hand, self.pt(target), self.vec(hint), sgn)
        rg.set(hand, Quaternion((1, 0, 0), rad(-6.0)))
        loose = rg.m(hand).to_3x3().to_quaternion()
        q = None
        for (_, _, hf), _, w in goals:
            if hf is None:
                h = loose
            else:
                y = self.vec(hf[0]).normalized(); z = self.vec(hf[1]); z = (z - y * z.dot(y)).normalized()
                h = Matrix((y.cross(z), y, z)).transposed().to_quaternion()
            q = h if q is None else q.slerp(h, w)       # two poses at most: w is the second one's share
        if any(g[2] is not None for g, _, _ in goals):
            # the forearm takes the hand's roll (up to 75 degrees), so the wrist only bends
            along = (rg.head(hand) - rg.head(lower)).normalized()
            now, want = rg.axis(lower, 2), q.to_matrix().col[2]
            want = want - along * want.dot(along)
            if want.length > 1e-4:
                ang = now.angle(want.normalized())
                rg.orient(lower, along, now.slerp(want.normalized(), min(1.0, rad(75.0) / ang) if ang > 1e-6 else 1.0))
                rg.aim(lower, hand, self.pt(target))
        rg.set_rot(hand, q.to_matrix())
        k = sum(p.get('curl', 1.0) * w for _, p, w in goals)
        grip = sum(p.get('grip', 0.0) * w for _, p, w in goals)     # grip 1: the fingers as in the reading pose
        for f, w in FINGERS.items():
            for seg, ang in CURL.items():
                n = f'{f} {seg}.{sd}'
                rg.set(n, Quaternion((1, 0, 0), rad(ang * w * k)).slerp(Quaternion(self.base[n]), grip))
        for seg in ('Proximal', 'Intermediate', 'Distal'):
            n = f'Thumb {seg}.{sd}'
            rg.set(n, Quaternion(self.base[n]).slerp(Quaternion(), 0.6 * (1 - grip)))
        return miss * s

    def solve(self, c):
        self.rg.load(self.base)
        self.rg.loc = {n: Vector() for n in self.rg.names}
        self.torso(c)
        miss = {'leg' + sd: self.leg(sd, c) for sd in 'LR'}
        miss.update({'arm' + sd: self.arm_(sd, c) for sd in 'LR'})
        return miss

    def show(self, c):
        miss = self.solve(c)
        R.write_pose(self.arm, self.rg)
        return {k: round(v * 1000) for k, v in miss.items()}


def standing(x, y, floor, heading, s=1.4):
    """Controls for standing straight at a spot, feet under the hips."""
    f = frame(heading)
    left = f.col[1]
    hip = Vector((x, y, floor + 0.735 * s))
    c = dict(hips=tuple(hip), heading=heading, pitch=0.0, roll=0.0,
             spine=(0, 0, 0), chest=(0, 0, 0), neck=(0, 0, 0), head=(0, 0, 0),
             kneeL=(heading + 6, 0), kneeR=(heading - 6, 0),
             armL=('hang', 4, 7, 12), armR=('hang', 4, 7, 12))
    for sd, k in (('L', 1), ('R', -1)):
        p = Vector((x, y, floor)) + left * (k * 0.062 * s)
        c['foot' + sd] = (p.x, p.y, floor, heading + k * 7, 0.0, 0.0)
    return c


def angles(f):
    """(heading, pitch, roll) of a body frame, or (yaw, pitch, roll) of a step between two."""
    e = f.to_euler('XYZ')
    return (math.degrees(e.z), math.degrees(e.y), math.degrees(e.x))


def extract(b, floor=0.0):
    """Controls that give (nearly) the pose the rig is in now. Arms come back as chest-relative targets."""
    rg, s = b.rg, b.s
    c = {}
    f = b.frame_of('Hips')
    c['heading'], c['pitch'], c['roll'] = angles(f)
    c['hips'] = tuple(b.world('Hips'))
    for bone, key in (('Spine', 'spine'), ('Chest', 'chest'), ('Neck', 'neck'), ('Head', 'head')):
        g = b.frame_of(bone)
        c[key] = angles(f.inverted() @ g)
        f = g
        if bone == 'Chest':
            ch = g
    for sd, sgn in (('L', 1), ('R', -1)):
        ff = b.frame_of('Foot.' + sd)
        heading, pitch, _ = angles(ff)
        ankle = b.world('Foot.' + sd)
        c['foot' + sd] = (ankle.x, ankle.y, floor, heading, 0.0, ankle.z - ANKLE * s - floor)
        hip, knee = b.world('Upper_leg.' + sd), b.world('Lower_leg.' + sd)
        ax = (ankle - hip).normalized()
        k = knee - hip
        k = (k - ax * k.dot(ax)).normalized()
        c['knee' + sd] = (math.degrees(math.atan2(k.y, k.x)), math.degrees(math.asin(max(-1, min(1, k.z)))))
        to_local = lambda v: (lambda w: (sgn * w.y, w.z, w.x))(ch.inverted() @ Vector(v))
        sh, el, wr = b.world('Upper_arm.' + sd), b.world('Lower_arm.' + sd), b.world('Hand.' + sd)
        ax = (wr - sh).normalized()
        e = el - sh
        e = (e - ax * e.dot(ax)).normalized()
        c['arm' + sd] = ('rel', to_local(wr - sh), to_local(e))
        hm = b.a3 @ rg.m('Hand.' + sd).to_3x3().normalized()
        c['handrel' + sd] = (to_local(hm.col[1]), to_local(hm.col[2]))
        c['grip' + sd] = 1.0
    return c
