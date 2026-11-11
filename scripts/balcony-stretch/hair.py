"""Hair after the body is posed: strands hang a little toward the ground when her head tips, and lag behind its turns.

Pass `layer` to apply.bake as `extra`. Each strand bone gets an extra turn about its own root, so tips move most.
"""
import math
from mathutils import Quaternion, Vector
from stretch import FPS as ST_FPS

FREQ, DAMP, SUBSTEPS = 7.5, 0.35, 4        # the follower: rad/s, damping ratio
# name prefix -> (share of hanging to the ground, share of the lag); checked in order
GROUPS = (('Hair_Ahoge', (0.0, 0.8)), ('HairF', (0.0, 0.22)), ('Hair_Bottom', (0.14, 0.3)), ('Hair_Ribbon', (0.3, 0.55)),
          ('HairA', (0.2, 0.4)), ('HairB', (0.24, 0.42)), ('HairC', (0.24, 0.42)), ('Hair_Tail', (0.26, 0.5)),
          ('HairD', (0.26, 0.45)), ('HairE', (0.26, 0.45)))


def strands(rig):
    out = []
    for n in rig.names:                      # armature order: parents come first
        if n.endswith('_e') or '_e.' in n or n in ('Hair_Root', 'Ribbon_Root'): continue
        for prefix, shares in GROUPS:
            if n.startswith(prefix):
                out.append((n, shares)); break
    return out


def power(q, k):
    if q.w < 0: q = -q                       # the short way round
    axis, angle = q.to_axis_angle()
    return Quaternion(axis, angle * k)


def layer(shot, samples):
    rig = shot.rg
    names = strands(rig)
    rig.load(shot.base_q)
    h0 = rig.m('Head').to_quaternion()
    follow, w = samples[0]['world']['Head'].to_quaternion(), Vector((0, 0, 0))
    dt = 1 / (ST_FPS * SUBSTEPS)
    for s in samples:
        h = s['world']['Head'].to_quaternion()
        for _ in range(SUBSTEPS):
            axis, angle = (h @ follow.inverted()).to_axis_angle()
            if angle > math.pi: angle -= 2 * math.pi
            w += (Vector(axis) * angle * FREQ * FREQ - w * 2 * DAMP * FREQ) * dt
            if w.length > 1e-9:
                follow = Quaternion(w.normalized(), w.length * dt) @ follow
        hang, lag = h0 @ h.inverted(), follow @ h.inverted()
        rig.load(s['q'])
        for n, (k, a) in names:
            extra = power(lag, a) @ power(hang, k)
            rig.set_rot(n, extra.to_matrix() @ rig.m(n).to_3x3())
            s['q'][n] = rig.q[n].copy()
