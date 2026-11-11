"""Reading break: she lays the book on her lap, stretches both arms up, picks the book up and reads on.

Shot(arm, book, face).pose(t) puts the pose at time t (seconds) into the rig and returns the book pose and face keys.
Times, angles and positions of the choreography are all in this file. Lengths are armature units (the character is
scaled 1.4); vectors given as (l, u, f) are along the chest's left, up and forward, with l mirrored for her right arm.
"""
import json
import math
from mathutils import Vector, Matrix, Quaternion
import rig as R
from tracks import Track, pulse, blink, smooth, smoother

FPS = 30
LENGTH = 15.5
K = 1 / 1.4
LEFT, UP, FWD = Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, -1, 0))
V = lambda *a: Vector(a)
rad, deg = math.radians, math.degrees

# --- timeline (seconds) ---
DOWN = (1.5, 3.7)          # the book travels to her lap, landing on its far edge
FLAT = (3.55, 4.3)         # it is laid flat
TILT_DOWN, TILT_UP = 20.0, 16.0   # degrees its near edge is still up at touch-down / lifted first at pick-up
LET_GO = (3.75, 4.6)       # hands slide out from under the cover and rest on the pages
FREE = (4.85, 5.4)         # hands leave the book
BACK = (10.2, 10.9)        # hands come back to it
GRIP = (10.9, 11.6)        # fingers go under the cover again
EDGE_UP = (11.25, 11.85)
UP_T = (11.7, 13.5)        # the book is lifted back to reading height
RIGHT_LAG = 0.07           # her right arm runs this much behind her left

# stretch amount: a small dip first (anticipation), up, a little further at the top, a slump on the breath out
S = Track(0.0).to(-0.15, 4.45, 5.05).to(1.0, 5.05, 6.7).to(1.1, 6.7, 7.6, 'soft').to(-0.22, 8.5, 9.8).to(0.0, 9.8, 11.1)
SIDE = Track(0.0).to(4.5, 6.75, 7.5).to(-3.5, 7.55, 8.35).to(0.0, 8.4, 9.2)       # lean to her left (+), then right
SHRUG = Track(0.0).to(-2.0, 4.45, 5.0).to(5.0, 5.6, 6.8).to(7.0, 6.8, 7.6, 'soft').to(-3.0, 8.5, 9.7).to(0.0, 9.7, 10.8)
HEAD_UP = (Track(0.0).to(27.0, 2.5, 3.6, 'back').to(22.0, 4.35, 4.95).to(46.0, 5.3, 6.7).to(50.0, 6.7, 7.6, 'soft')
           .to(8.0, 8.45, 9.9).to(-9.0, 10.3, 11.15).to(0.0, 11.85, 13.25))
HEAD_YAW = Track(0.0).to(9.0, 2.6, 3.7).to(3.0, 5.2, 6.4).to(-2.0, 8.6, 9.9).to(0.0, 10.4, 11.2)      # + to her left
HEAD_ROLL = Track(0.0).to(-3.0, 2.6, 3.7).to(5.0, 6.7, 7.5).to(-4.0, 7.55, 8.35).to(0.0, 8.45, 9.4)   # + to her left
EYES_UP = Track(0.0).to(1.0, 2.42, 2.62, 'soft').to(0.0, 10.23, 10.45, 'soft')   # 1: looking ahead, 0: at the book
LIDS = Track(0.0).to(1.0, 5.55, 6.0).to(0.0, 9.1, 9.7)                           # closed through the stretch
BLINKS = (1.32, 2.5, 4.4, 10.3, 12.55, 14.4)

# --- hands on the flat book (book metres along its x, y, normal; x mirrored) ---
# The open book is a shallow V: each half rises 12 degrees to its outer edge, where the page surface is 4 cm up.
PAGE_N = V(-0.19, 0.0, 0.98)                       # the way a page faces
REST_WRIST = V(0.122, -0.100, 0.071)
REST_FDIR, REST_DORSAL = V(-0.30, 0.95, -0.03), V(-0.07, 0.0, 1.0)   # thumb side a little up
LIFT_OFF = 0.04                                    # the hands come up off the page this far (armature units) as they leave it
# Between the grip and the rest the hand goes round the book's outer edge: (wrist, fingers, back of hand) for
# sliding the fingers out from under the cover, then over the edge with the palm turning down.
SLIDE = (V(0.207, -0.092, 0.057), V(-0.03, 1.0, -0.08), V(0.92, 0.0, -0.38))
OVER = (V(0.196, -0.108, 0.092), V(-0.12, 1.0, -0.04), V(0.70, 0.0, 0.71))
ROUND = ((0.0, 0.42), (0.26, 0.72), (0.56, 1.0))   # the three legs (slide out, over, down), as parts of the whole move
OPEN_BY = 0.3                                      # the fingers are open by this part of it

# --- free arm: wrist from the shoulder, elbow direction, hand (fingers, back of hand); (l, u, f), time windows ---
def arm_tracks(p0, b0, f0, d0, lag):
    """Up: gather in front of the ribs, elbows out with the fists outside the shoulders, up into an open V, reach.
    Down: the V opens, the elbows drop with the hands trailing above them, the forearms come down to her lap."""
    w = lambda a, b: (a + lag, b + lag)
    r = lambda a, b: (a + 2.5 * lag, b + 2.5 * lag)        # her right arm lets go a little later still
    A1, A2, A3, A4 = w(4.9, 5.6), w(5.3, 6.1), w(5.75, 6.65), w(6.6, 7.5)
    R1, R2, R3 = r(8.5, 9.25), r(8.85, 10.0), r(9.65, 10.5)
    wrist = (Track(p0).to(V(0.10, -0.12, 0.16), *A1).to(V(0.20, 0.12, 0.04), *A2).to(V(0.15, 0.30, -0.01), *A3)
             .to(V(0.132, 0.319, -0.03), *A4, 'soft')
             .to(V(0.21, 0.26, 0.0), *R1).to(V(0.18, -0.06, 0.11), *R2).to(V(0.07, -0.19, 0.17), *R3))
    bend = (Track(b0).to(V(0.75, -0.55, -0.35), *A1).to(V(0.85, -0.5, 0.15), *A2).to(V(0.9, 0.0, -0.45), *A3)
            .to(V(0.9, -0.3, -0.3), *R1).to(V(0.3, -0.95, -0.1), *R2).to(V(0.55, -0.4, -0.75), *R3))
    fdir = (Track(f0).to(V(-0.25, -0.45, 0.86), *A1).to(V(-0.3, 0.75, 0.55), *A2).to(V(0.2, 0.9, -0.35), *w(6.0, 6.75))
            .to(V(0.3, 0.82, -0.48), *A4, 'soft')
            .to(V(0.45, 0.85, -0.25), *R1).to(V(0.0, 0.7, 0.7), *r(9.1, 10.0)).to(V(-0.2, -0.3, 0.93), *r(9.75, 10.55)))
    dors = (Track(d0).to(V(0.25, 0.85, 0.45), *A1).to(V(0.8, 0.15, -0.55), *A2).to(V(0.6, -0.25, -0.75), *w(6.0, 6.75))
            .to(V(0.55, -0.45, -0.7), *A4, 'soft')
            .to(V(0.5, -0.3, -0.8), *R1).to(V(0.2, 0.6, -0.75), *r(9.1, 10.0)).to(V(0.1, 0.9, 0.4), *r(9.75, 10.55)))
    return wrist, bend, fdir, dors

# loose fists going up, open at the top, limp on the way down
FIST = Track(0.0).to(0.8, 4.6, 5.6).to(0.1, 6.75, 7.4).to(0.42, 8.5, 9.4).to(0.15, 10.1, 10.7)
FINGERS = {'Index': 0.9, 'Middle': 1.0, 'Ring': 1.0, 'Little': 1.05}
CURL_OPEN = {'Proximal': -10.0, 'Intermediate': -14.0, 'Distal': -9.0}
CURL_FIST = {'Proximal': -62.0, 'Intermediate': -80.0, 'Distal': -48.0}


def frame3(y, z):
    """Rotation with Y along `y` and Z as near `z` as possible."""
    y = Vector(y).normalized()
    z = Vector(z); z = (z - y * z.dot(y)).normalized()
    return Matrix((y.cross(z), y, z)).transposed()


class Shot:
    def __init__(self, arm, book, face):
        self.base = json.loads(arm['stretch_base_pose'])
        self.base_keys = json.loads(face['stretch_base_keys'])
        self.rg = rg = R.Rig(arm)
        rg.load(self.base)
        self.base_q = rg.snapshot()
        inv = arm.matrix_world.inverted()
        bm = inv @ Matrix(json.loads(book['stretch_base_matrix']))
        self.read_c = bm.translation.copy()
        self.read_b = Matrix([c.to_3d().normalized() for c in (bm.col[0], bm.col[1], bm.col[2])]).transposed()
        lp = json.loads(book['stretch_lap'])
        self.lap_c = Vector(lp['c'])
        self.lap_b = Matrix((lp['x'], lp['y'], lp['n'])).transposed()
        self.far_edge = self.lap_c + self.lap_b.col[1] * (K * 0.105)
        self.sides = {}
        chest3 = rg.m('Chest').to_3x3()
        for sd, sgn in (('L', 1), ('R', -1)):
            sh, el, wr = rg.head('Upper_arm.' + sd), rg.head('Lower_arm.' + sd), rg.head('Hand.' + sd)
            ax = (wr - sh).normalized()
            bend = el - sh; bend = (bend - ax * bend.dot(ax)).normalized()
            grip = self.book_m(self.read_c, self.read_b).inverted() @ rg.m('Hand.' + sd)
            side = lambda v: Vector((sgn * v.x, v.y, v.z))
            rest_p, rest_f, rest_d = side(REST_WRIST) * K, side(REST_FDIR), side(REST_DORSAL)
            way = [(side(p) * K, side(f), side(dr)) for p, f, dr in (SLIDE, OVER)] + [(rest_p, rest_f, rest_d)]
            # the free tracks start from the hand resting on the flat book, seen from the chest
            wr0 = self.lap_c + self.lap_b @ rest_p
            to_chest = lambda v: (lambda c: Vector((sgn * c.x, c.y, c.z)))(chest3.inverted() @ v)
            p0 = to_chest(wr0 - sh)
            b_lap = Vector((sgn * 0.6, 0.7, -0.4))
            f0, d0 = to_chest(self.lap_b @ rest_f), to_chest(self.lap_b @ rest_d)
            self.sides[sd] = dict(sgn=sgn, grip=grip, way=way, bend_read=bend, bend_lap=b_lap,
                                  tracks=arm_tracks(p0, to_chest(b_lap), f0, d0, 0.0 if sd == 'L' else RIGHT_LAG))
        self.eye_base = {e: self.base_q[e].copy() for e in ('Eye.L', 'Eye.R')}

    # --- book ---
    @staticmethod
    def book_m(c, b3):
        m = b3.to_4x4(); m.translation = c
        return m

    def tilted(self, degrees):
        """The flat lap pose with the near edge raised about the far edge."""
        q = Quaternion(self.lap_b.col[0], rad(degrees)).to_matrix()
        return self.far_edge + q @ (self.lap_c - self.far_edge), q @ self.lap_b

    def between(self, u, c1, b1):
        """From the reading pose (u=0) to pose (c1, b1) (u=1); u may pass 1 a little."""
        q = (b1 @ self.read_b.inverted()).to_quaternion()
        axis, angle = (-q if q.w < 0 else q).to_axis_angle()        # the short way round
        c = self.read_c.lerp(c1, u) + FWD * 0.03 * math.sin(math.pi * min(max(u, 0.0), 1.0))
        return c, Quaternion(axis, angle * u).to_matrix() @ self.read_b

    def book(self, t):
        from tracks import EASE
        if t < FLAT[0]:
            c1, b1 = self.tilted(TILT_DOWN)
            return self.between(EASE['down']((t - DOWN[0]) / (DOWN[1] - DOWN[0])), c1, b1)
        if t < EDGE_UP[0]:
            # the last of the carry and the laying flat overlap, so the book never stops on its edge
            u = EASE['down']((t - DOWN[0]) / (DOWN[1] - DOWN[0]))
            c1, b1 = self.tilted(TILT_DOWN * (1 - smoother((t - FLAT[0]) / (FLAT[1] - FLAT[0]))))
            return self.between(u, c1, b1)
        c1, b1 = self.tilted(TILT_UP * smooth((t - EDGE_UP[0]) / (EDGE_UP[1] - EDGE_UP[0])))
        return self.between(1 - EASE['back']((t - UP_T[0]) / (UP_T[1] - UP_T[0])), c1, b1)

    # --- body ---
    def torso(self, t):
        rg = self.rg
        s, side = S(t), SIDE(t)
        breath = math.sin(2 * math.pi * t / 3.7 - 0.6) * (1 - 0.7 * smooth(s))
        lean = 2.5 * pulse(t, 1.7, 2.9, 3.7, 4.7) + 2.0 * pulse(t, 10.65, 11.35, 11.95, 12.85)    # toward the book on her lap
        rg.turn('Spine', LEFT, -3.5 * s + lean + 0.25 * breath)
        rg.turn('Chest', LEFT, -9.0 * s - 0.7 * breath)
        rg.turn('Spine', FWD, -0.6 * side)
        rg.turn('Chest', FWD, -0.4 * side)

    def head(self, t):
        rg = self.rg
        up, yaw, roll = HEAD_UP(t), HEAD_YAW(t), HEAD_ROLL(t)
        yaw += 1.3 * self.scan(t - 0.25)[0] / 4.0 * (1 - smooth(abs(up) / 8))
        for n, share in (('Neck', 0.38), ('Head', 0.62)):
            rg.turn(n, UP, yaw * share)
            rg.turn(n, rg.axis('Head', 0), -up * share)
            rg.turn(n, rg.axis('Head', 2), -roll * share)

    @staticmethod
    def scan(t):
        """Eye yaw and pitch (degrees) while reading: fixations along a line, then a sweep back to the next one."""
        line, per = 2.7, 7
        k = (t % line) / line
        step = min(per - 1, int(k * per / 0.9))
        x = step + smooth((k * per / 0.9 - step) / 0.25) - 1 if k < 0.9 else (per - 1) * (1 - smooth((k - 0.9) / 0.1))
        return 4.0 - 8.0 * max(0.0, x) / (per - 1), 0.5 * (int(t // line) % 3)

    def eyes(self, t):
        rg = self.rg
        ahead = EYES_UP(t)
        yaw, pitch = self.scan(t)
        down = 9.0 * pulse(t, 10.25, 10.55, 11.75, 12.85)          # further down while the book is on her lap
        for e in ('Eye.L', 'Eye.R'):
            rg.set(e, self.eye_base[e].slerp(Quaternion(), 0.85 * ahead))
            rg.turn(e, rg.axis(e, 1), yaw * (1 - ahead))
            rg.turn(e, rg.axis(e, 0), (pitch + down) * (1 - ahead))

    def face(self, t):
        ahead, closed = EYES_UP(t), LIDS(t)
        squeeze = pulse(t, 6.2, 6.8, 7.9, 8.6)                   # eyes pressed shut at the top of the stretch
        lid = max(self.base_keys.get('eyeBlinkLeft', 0.2) * (1 - 0.8 * ahead), closed * (1 - squeeze), *(blink(t, b) for b in BLINKS))
        hum = pulse(t, 6.3, 6.9, 7.7, 8.5)                       # mouth a little open on the long breath
        smile = 0.3 * pulse(t, 2.9, 3.7, 4.4, 5.3) + 0.6 * pulse(t, 8.5, 9.4, 10.6, 12.4)
        return {'eyeBlinkLeft': lid, 'eyeBlinkRight': lid, 'はぅ': squeeze, 'browInnerUp': 0.5 * squeeze,
                'jawOpen': 0.24 * hum, 'mouthFunnel': 0.18 * hum, 'にこり': smile}

    def arm(self, t, sd, book_m):
        rg, d = self.rg, self.sides[sd]
        sgn, tl = d['sgn'], t - (0.0 if sd == 'L' else RIGHT_LAG)
        up_arm, lo_arm, hand = 'Upper_arm.' + sd, 'Lower_arm.' + sd, 'Hand.' + sd
        b3 = book_m.to_3x3()
        # on the book: gripping it, or resting on its pages
        rest = smoother((tl - LET_GO[0]) / (LET_GO[1] - LET_GO[0])) * (1 - smoother((tl - GRIP[0]) / (GRIP[1] - GRIP[0])))
        gm = book_m @ d['grip']
        wrist, hq = gm.translation, gm.to_3x3().to_quaternion()
        last = wrist
        for (p, f, dr), (a, b) in zip(d['way'], ROUND):       # round the book's edge; the legs overlap, so no corner
            k = smooth((rest - a) / (b - a))
            nxt = book_m @ p
            wrist = wrist + (nxt - last) * k
            hq = hq.slerp(frame3(b3 @ f, b3 @ dr).to_quaternion(), k)
            last = nxt
        carried = smooth((t - DOWN[0]) / 1.6) * (1 - smooth((t - UP_T[0] - 0.4) / 1.4))
        bend = d['bend_read'].lerp(d['bend_lap'], carried)
        # free of the book
        free = smoother((tl - FREE[0]) / (FREE[1] - FREE[0])) * (1 - smoother((tl - BACK[0]) / (BACK[1] - BACK[0])))
        on_book = wrist
        c3 = rg.m('Chest').to_3x3()
        from_chest = lambda v: c3 @ Vector((sgn * v.x, v.y, v.z))
        if free > 0:
            tw, tb, tf, td = (tr(t) for tr in d['tracks'])
            lift = b3.col[2] * (LIFT_OFF * math.sin(math.pi * free))
            wrist = on_book.lerp(rg.head(up_arm) + from_chest(tw), free) + lift
            bend = bend.lerp(from_chest(tb.normalized()), free)
            hq = hq.slerp(frame3(from_chest(tf), from_chest(td)).to_quaternion(), free)
        # shoulder girdle follows the arm: lifts as the arm rises past 35 degrees, comes forward a little when it is up in front
        cu, cf = c3.col[1].normalized(), c3.col[2].normalized()
        rg.limb(up_arm, lo_arm, hand, wrist, bend, sgn)
        aim = rg.axis(up_arm, 1)                      # where the upper arm points with the shoulder not yet moved
        raise_ = deg(math.acos(max(-1.0, min(1.0, -aim.dot(cu)))))
        rg.turn('Shoulder.' + sd, cf, sgn * (min(34.0, max(0.0, (raise_ - 35.0) * 0.27)) + SHRUG(t) * free))
        rg.turn('Shoulder.' + sd, cu, -sgn * 9.0 * smooth((raise_ - 50.0) / 60.0) * max(0.0, aim.dot(cf)))
        if free > 0:      # the free target is measured from the shoulder joint, which has just moved
            wrist = on_book.lerp(rg.head(up_arm) + from_chest(tw), free) + lift
        miss = rg.limb(up_arm, lo_arm, hand, wrist, bend, sgn)
        # the forearm takes the hand's roll (up to 75 degrees), the wrist only bends
        ld = (rg.head(hand) - rg.head(lo_arm)).normalized()
        nz, want = rg.axis(lo_arm, 2), hq.to_matrix().col[2]
        want = (want - ld * want.dot(ld)).normalized()
        ang = nz.angle(want)
        rg.orient(lo_arm, ld, nz.slerp(want, min(1.0, rad(75.0) / ang) if ang > 1e-6 else 1.0))
        rg.aim(lo_arm, hand, wrist)
        rg.set_rot(hand, hq.to_matrix())
        # fingers: the grip, opened flat on the pages, or a loose fist
        hold = 1 - smooth(rest / OPEN_BY) if free <= 0 else 0.0
        fist = FIST(tl) * free
        for f, k in FINGERS.items():
            for seg in CURL_OPEN:
                n = f'{f} {seg}.{sd}'
                q = Quaternion((1, 0, 0), rad(k * (CURL_OPEN[seg] + (CURL_FIST[seg] - CURL_OPEN[seg]) * fist)))
                rg.set(n, q.slerp(self.base_q[n], hold))
        for seg, relax in (('Proximal', 0.55), ('Intermediate', 0.7), ('Distal', 0.7)):
            n = f'Thumb {seg}.{sd}'
            flat = rest * (1 - free)                      # on the page the thumb lies out beside the palm
            rg.set(n, self.base_q[n].slerp(Quaternion(), (relax + (0.95 - relax) * flat) * (1 - hold) * (1 - 0.6 * fist)))
        return miss

    def pose(self, t):
        rg = self.rg
        rg.load(self.base_q)
        self.torso(t)
        self.head(t)
        self.eyes(t)
        c, b3 = self.book(t)
        bm = self.book_m(c, b3)
        miss = {sd: self.arm(t, sd, bm) for sd in 'LR'}
        return {'book': (c, b3), 'face': self.face(t), 'miss': miss}
