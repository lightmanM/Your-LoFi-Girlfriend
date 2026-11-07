"""Copy the Codex reading scene for a pose revision. Runs inside the live Blender via MCP.
Nothing in 'Balcony • Reading by the window' is modified; everything made here carries '(Claude)' or 'Reading v2 •'.
"""
import bpy, math
from mathutils import Vector
SRC = 'Balcony • Reading by the window'; NAME = 'Balcony • Reading v2 (Claude)'; SIDE = 'Balcony • Reading v2 side (Claude)'
COLN = 'Balcony • reading v2 character (Claude)'
for n in (NAME, SIDE):
    if n in bpy.data.scenes: bpy.data.scenes.remove(bpy.data.scenes[n])
if COLN in bpy.data.collections:
    c = bpy.data.collections[COLN]
    for o in list(c.objects): bpy.data.objects.remove(o)
    bpy.data.collections.remove(c)
for o in [o for o in bpy.data.objects if o.name.startswith('Reading v2 •')]: bpy.data.objects.remove(o)
source = bpy.data.scenes[SRC]
s = source.copy(); s.name = NAME; s.render.use_compositing = False; s.render.use_sequencer = False; s.compositing_node_group = None
oldcol = bpy.data.collections['Balcony • reading character and magazine']; s.collection.children.unlink(oldcol)
col = bpy.data.collections.new(COLN); s.collection.children.link(col); copies = {}
for old in oldcol.objects:
    if old.name.startswith('Reading •'): continue            # the Codex magazine; replaced by a book
    o = old.copy()
    if old.data: o.data = old.data.copy()
    col.objects.link(o); copies[old] = o
for old, o in copies.items():
    if old.parent in copies: o.parent = copies[old.parent]
    for m in o.modifiers:
        if m.type == 'ARMATURE' and m.object in copies: m.object = copies[m.object]
s.camera = copies[source.camera]
a = next(o for o in col.objects if o.type == 'ARMATURE'); a.name = 'Reading v2 • armature'
M = a.matrix_world; R = M.to_3x3().normalized(); fwd = R @ Vector((0, -1, 0)); left = R @ Vector((1, 0, 0)); up = Vector((0, 0, 1))
focus = M @ Vector((0, -0.10, 0.80))                          # between face and hands
def add_cam(name, direction, dist, lens, scene):
    c = bpy.data.objects.new(name, bpy.data.cameras.new(name)); scene.collection.objects.link(c)
    c.location = focus + direction.normalized() * dist; c.rotation_euler = (focus - c.location).to_track_quat('-Z', 'Y').to_euler(); c.data.lens = lens
    return c
to_main = (s.camera.matrix_world.translation - focus).normalized()
add_cam('Reading v2 • close camera', to_main, 1.5, 50, s)
add_cam('Reading v2 • right close camera', Vector((-left.x * 0.6 + fwd.x, -left.y * 0.6 + fwd.y, 0.25)), 1.4, 50, s)
side = bpy.data.scenes.new(SIDE); side.render.engine = s.render.engine; side.cycles.device = s.cycles.device
side.world = bpy.data.worlds.new('Reading v2 diagnostic world'); side.world.use_nodes = True
next(n for n in side.world.node_tree.nodes if n.type == 'BACKGROUND').inputs['Color'].default_value = (.18, .18, .18, 1)
side.collection.children.link(col)
for o in s.objects:
    if o.name.startswith('Reading chair'): side.collection.objects.link(o)
sc = bpy.data.objects.new('Reading v2 • side camera', bpy.data.cameras.new('Reading v2 side')); side.collection.objects.link(sc)
sc.data.type = 'ORTHO'; sc.data.ortho_scale = 1.7; c0 = M @ Vector((0, -.07, .72)); sc.location = c0 + left * 3
sc.rotation_euler = (c0 - sc.location).to_track_quat('-Z', 'Y').to_euler(); side.camera = sc
li = bpy.data.objects.new('Reading v2 • softbox', bpy.data.lights.new('Reading v2 diagnostic', 'AREA')); side.collection.objects.link(li)
li.location = c0 + Vector((2, -2, 3)); li.rotation_euler = (c0 - li.location).to_track_quat('-Z', 'Y').to_euler(); li.data.energy = 400; li.data.shape = 'DISK'; li.data.size = 4
side.render.resolution_x = 900; side.render.resolution_y = 1100; side.cycles.samples = 20; side.cycles.use_denoising = True
face = next(o for o in col.objects if 'Face' in o.name)
src_face = next(o for o in oldcol.objects if 'Face' in o.name)
print('scene', s.name, 'objects', len(col.objects), 'face keys copied', face.data.shape_keys is not None and face.data.shape_keys != src_face.data.shape_keys)
