"""How far her hands sink into the book (and into her lap), measured on the deformed skin.

scan(times) poses each moment, takes the skin vertices that follow the hand and finger bones and reports, per side:
  the vertices inside the book's solid (between its page surface and the underside of its cover), by hand part,
  'over': how far the lowest hand vertex over the book is above the page surface (0: touching),
  'lap': the deepest hand vertex under the surface of her body and clothes.
Lengths are millimetres. Run inside Blender with the stretch scene in the window:
  import overlap; overlap.table(overlap.scan(times))             # the baked keys
  import overlap; overlap.table(overlap.scan(times, live=True))  # stretch.py as it is now, nothing keyed
"""
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import apply

SKIN, CLOTHES = 'Stretch anim • bn0010_SkinBody.020', 'Stretch anim • bn0010_CosA.020'
PARTS = ('Thumb', 'Index', 'Middle', 'Ring', 'Little', 'Hand')
ARM = PARTS + ('Lower_arm', 'Upper_arm', 'Shoulder')
HALF_W, HALF_H = 0.149, 0.11
UP, DOWN_ = Vector((0, 0, 1)), Vector((0, 0, -1))
SKIN_DEEP = 0.0005          # shallower than this is contact, not overlap
LAP_DEEP = 0.06             # a hand is looked for at most this far under her body's surface


def book_tree(book):
    """The book's faces in the book empty's own space."""
    inv = book.matrix_world.inverted()
    verts, polys = [], []
    for ch in book.children:
        if ch.type != 'MESH' or 'print' in ch.name:
            continue
        m = inv @ ch.matrix_world
        base = len(verts)
        verts += [m @ v.co for v in ch.data.vertices]
        polys += [[base + i for i in p.vertices] for p in ch.data.polygons]
    return BVHTree.FromPolygons(verts, polys)


def strongest(ob):
    """Each vertex's strongest bone name ('' when it has none)."""
    names = [g.name for g in ob.vertex_groups]
    return [names[max(v.groups, key=lambda g: g.weight).group] if v.groups else '' for v in ob.data.vertices]


def hand_verts(skin):
    """{side: {part: [vertex indices]}} by each vertex's strongest bone."""
    out = {'L': {}, 'R': {}}
    for i, n in enumerate(strongest(skin)):
        part = next((p for p in PARTS if n.startswith(p)), None)
        if part and n[-2:] in ('.L', '.R'):
            out[n[-1]].setdefault(part, []).append(i)
    return out


def body_faces(ob):
    """Faces of a body mesh that do not belong to her arms or hands."""
    arm = [n.startswith(ARM) for n in strongest(ob)]
    return [tuple(p.vertices) for p in ob.data.polygons if not any(arm[i] for i in p.vertices)]


def coords(ob, dg):
    """World positions of the deformed vertices."""
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co)
    ev.to_mesh_clear()
    m = np.array(ev.matrix_world)
    return co.reshape(-1, 3) @ m[:3, :3].T + m[:3, 3]


def depth(tree, p):
    """(how deep point p (book space) is inside the book, through which face it is nearest, its height over the page)."""
    if abs(p.x) >= HALF_W or abs(p.y) >= HALF_H:
        return 0.0, '', None
    top = tree.ray_cast(Vector((p.x, p.y, 1.0)), DOWN_)[0]
    bot = tree.ray_cast(Vector((p.x, p.y, -1.0)), UP)[0]
    if top is None or bot is None:
        return 0.0, '', None
    over = p.z - top.z if p.z >= top.z else None
    if not bot.z < p.z < top.z:
        return 0.0, "", over
    d, way = min(((top.z - p.z, 'top'), (p.z - bot.z, 'under'), (HALF_W - abs(p.x), 'side'), (HALF_H - abs(p.y), 'end')))
    return d, way, None


def scan(times, live=False, fps=30):
    scene = bpy.data.scenes[apply.SCENE]
    arm, book, face = apply.objects()
    skin, clothes = bpy.data.objects[SKIN], bpy.data.objects[CLOTHES]
    groups = hand_verts(skin)
    tree = book_tree(book)
    faces = body_faces(skin), body_faces(clothes)
    n_skin = len(skin.data.vertices)
    polys = list(faces[0]) + [tuple(i + n_skin for i in f) for f in faces[1]]
    rows = []
    keep = scene.frame_current
    for t in times:
        if live:
            apply.show(t)
        else:
            scene.frame_set(round(t * fps) + 1)
        dg = bpy.context.evaluated_depsgraph_get()
        co = coords(skin, dg)
        body = BVHTree.FromPolygons([Vector(v) for v in np.vstack((co, coords(clothes, dg)))], polys)
        to_book = book.evaluated_get(dg).matrix_world.inverted()
        row = {'t': t}
        for sd in 'LR':
            over, lap = None, 0.0
            for part, idx in groups[sd].items():
                worst, n = (0.0, ''), 0
                for i in idx:
                    w = Vector(co[i])
                    d, way, o = depth(tree, to_book @ w)
                    if d > SKIN_DEEP:
                        n += 1
                    worst = max(worst, (d, way))
                    if o is not None and d <= SKIN_DEEP:
                        over = o if over is None else min(over, o)
                    hit = body.ray_cast(w + UP * LAP_DEEP, DOWN_)[0]      # the first surface within reach above it
                    if hit is not None and hit.z > w.z:
                        lap = max(lap, hit.z - w.z)
                if n:
                    row[f'{part}.{sd}'] = (round(worst[0] * 1000, 1), worst[1], n)
            row['over.' + sd] = None if over is None else round(over * 1000, 1)
            row['lap.' + sd] = round(lap * 1000, 1)
        rows.append(row)
    if not live:
        scene.frame_set(keep)
    return rows


def worst(rows):
    """The deepest overlap with the book in the rows (mm)."""
    return max((v[0] for r in rows for k, v in r.items() if isinstance(v, tuple)), default=0.0)


def table(rows):
    for r in rows:
        cells = '  '.join(f'{k} {v[0]}{v[1]} x{v[2]}' for k, v in r.items() if isinstance(v, tuple))
        print(f"{r['t']:6.2f}  over {r['over.L']}/{r['over.R']}  lap {r['lap.L']}/{r['lap.R']}  {cells}")
