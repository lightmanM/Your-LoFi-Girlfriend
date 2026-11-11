"""Where the open book lies on her lap: ray casts onto the posed body give the thigh surface under the book."""
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

K = 1 / 1.4            # book metres -> armature units (the character is scaled 1.4)
W, H, ALPHA_TAN = 0.145, 0.21, 0.2126      # page width, page height (book metres), tan of the 12 degree page spread


def body_tree(arm, meshes):
    dg = bpy.context.evaluated_depsgraph_get()
    inv = arm.matrix_world.inverted()
    verts, polys = [], []
    for o in meshes:
        e = o.evaluated_get(dg)
        me = e.to_mesh()
        m = inv @ o.matrix_world
        base = len(verts)
        verts += [m @ v.co for v in me.vertices]
        polys += [tuple(base + i for i in p.vertices) for p in me.polygons]
        e.to_mesh_clear()
    return BVHTree.FromPolygons(verts, polys)


def fit(tree, hip_y, knee_y, margin=0.002):
    """Returns the flat book pose in armature space: centre and unit axes x (her left), y (to her knees), n (up)."""
    def top(x, y):
        hit = tree.ray_cast(Vector((x, y, 1.0)), Vector((0, 0, -1)), 0.6)
        return hit[0].z if hit[0] is not None else None
    # belly: the first surface met coming from the knees at lap height
    z_lap = max(z for z in (top(sx * 0.06, (hip_y + knee_y) / 2) for sx in (-1, 1)) if z is not None)
    belly = tree.ray_cast(Vector((0, knee_y, z_lap + 0.035)), Vector((0, 1, 0)), 0.6)[0]
    near = belly.y - 0.022                       # the book's near edge, clear of her belly
    cy = near - K * H / 2
    pts = []
    for i in range(-6, 7):
        for j in range(-5, 6):
            x, y = i / 6 * K * W, cy + j / 5 * K * H / 2
            z = top(x, y)
            if z is not None and z < z_lap + 0.05:
                pts.append((x, y, z))
    p = np.array(pts)
    # plane through the upper surface: fit, then keep the points on or above it and fit again (the gap between thighs drops out)
    sel = p
    for _ in range(3):
        a = np.c_[sel[:, 0], sel[:, 1], np.ones(len(sel))]
        coef, *_ = np.linalg.lstsq(a, sel[:, 2], rcond=None)
        res = p[:, 2] - (p[:, 0] * coef[0] + p[:, 1] * coef[1] + coef[2])
        sel = p[res > -0.004]
    nrm = Vector((-coef[0], -coef[1], 1)).normalized()
    x = Vector((1, 0, 0)); x = (x - nrm * x.dot(nrm)).normalized()
    y = x.cross(nrm)                              # toward her knees; left-handed like the book's own frame (x cross y = -n)
    c = Vector((0, cy, coef[1] * cy + coef[2]))
    # lift until every point of the book's underside clears the body
    worst = -1.0
    for px, py, pz in pts:
        d = Vector((px, py, pz)) - c
        u, v = d.dot(x), d.dot(y)
        if abs(u) > K * W or abs(v) > K * H / 2: continue
        under = abs(u) * ALPHA_TAN - K * 0.004 if abs(u) > K * 0.012 else -K * 0.010   # cover board; spine block in the middle
        worst = max(worst, d.dot(nrm) - under)
    c = c + nrm * (worst + margin)
    return {'c': list(c), 'x': list(x), 'y': list(y), 'n': list(nrm), 'belly_y': belly.y, 'z_lap': z_lap, 'points': len(pts)}
