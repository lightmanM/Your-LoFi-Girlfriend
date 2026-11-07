"""Render the afternoon toon look as web layers, from the live Blender via MCP:
  exec(open('spike/balcony-toon/render_web_plate.py').read(), {'ROOT': '<repo root>', 'OUT': '<folder>'})
Writes <OUT>/plate.png (scene without her, the book and the near leaves), <OUT>/leaves.png (the near leaves alone, on
transparent), and <OUT>/scene.json (camera, light for the live character). 2560x1440, the display camera's framing.
For the wind (STEPS includes 'wind'): <OUT>/plate-clean.png (the swaying plants removed, their shadows kept),
<OUT>/plant-mask.png (R palm, G ivy, B roses, A balcony plants: which pixels belong to each), <OUT>/plant-flex.png (R:
0 at each plant's anchor to 1 at its tips, so the page can bend tips and keep bases still).
Steps run on timers and report to <OUT>/progress.json."""
import bpy, json, math, pathlib, time
from mathutils import Vector, Matrix
ROOT = pathlib.Path(globals().get('ROOT', '.')); OUT = pathlib.Path(globals()['OUT']); OUT.mkdir(parents=True, exist_ok=True)
W, H, SCALE = 2560, 1440, 2560 / 1600            # compositor pixel settings were authored at 1600x900
LEAVES = {'moxing0035'}
# swaying plants, by source object name; ivy hangs from the top, the others grow up from their base
WIND = {'palm': {'moxing0042'}, 'ivy': {'moxing1015', 'moxing1016', 'moxing1019'}, 'roses': {'moxing0043'},
        'pots': {'moxing1064', 'moxing1066', 'moxing1067', 'moxing1068', 'moxing1071', 'moxing1072', 'moxing1073', 'moxing1074',
                 'moxing1075', 'moxing1076', 'moxing1077', 'moxing1079', 'moxing1080', 'moxing0035_1', 'moxing1083', 'moxing1084',
                 'moxing1087', 'moxing1088', 'moxing1089', 'moxing1090', 'moxing1091', 'moxing1092', 'moxing1093', 'moxing1094', 'moxing1095'}}
HANGING = {'ivy'}
STEPS = list(globals().get('STEPS', ['plate', 'leaves']))
NO_LINES = {'窗帘', 'moxing0035', 'moxing0035_1', 'moxing0042', 'moxing0043', 'moxing1015', 'moxing1016', 'moxing1064', 'moxing1066', 'moxing1090'}
prog = OUT / 'progress.json'
def report(**k): prog.write_text(json.dumps(k))

ns = {'__name__': 'toon'}; exec((ROOT / 'spike/balcony-toon/build_toon.py').read_text(), ns); info = ns['build']()
T = bpy.data.scenes[ns['NAME']]; env = bpy.data.collections[ns['ENV']]; ch = bpy.data.collections[ns['CHAR']]
group = bpy.data.node_groups[ns['GROUP']]
af = {'ROOT': str(ROOT)}; exec((ROOT / 'spike/balcony-toon/afternoon.py').read_text(), af); info.update(af['apply'](T, env, lambda m: ns['toon'](m, group), group))
os_ = {}; exec((ROOT / 'spike/balcony-toon/outside.py').read_text(), os_); feats = {'facade', 'dapple', 'rim'}
info.update(os_['apply'](T, env, group, feats))
# framing (spike/balcony-toon/framing.json): camera, near leaves moved with it, chair and her moved along the floor
FRAMING = json.loads((ROOT / 'spike/balcony-toon/framing.json').read_text()) if (ROOT / 'spike/balcony-toon/framing.json').exists() else None
cam_old = T.camera.matrix_world.copy()
leaves = [o for o in env.objects if o.get('source_name') in LEAVES]
from bpy_extras.object_utils import world_to_camera_view as w2c


def px_from_world(p):
    c = w2c(T, T.camera, p); return Vector((c.x * W, c.y * H))       # pixels, y up from the bottom


def world_on_plane(px, cam_matrix, plane_x):
    tr, br, bl, tl = [cam_matrix @ v for v in T.camera.data.view_frame(scene=T)]
    u, v = px[0] / W, 1 - px[1] / H; q = tl.lerp(tr, u).lerp(bl.lerp(br, u), v); o = cam_matrix.translation; d = (q - o).normalized()
    return o + d * ((plane_x - o.x) / d.x)


extra = {}
if FRAMING:
    T.render.resolution_x, T.render.resolution_y, T.render.resolution_percentage = W, H, 100
    M = Matrix(FRAMING['camera_matrix']); right = (M.to_3x3() @ Vector((1, 0, 0))).normalized()
    leaf_old = {o.name: o.matrix_world.copy() for o in leaves}
    T.camera.matrix_world = M
    fwd = (M.to_3x3() @ Vector((0, 0, -1))).normalized()      # the near leaves can also sit farther from the camera
    shift = right * FRAMING['leaves_offset_right_m'] + fwd * FRAMING.get('leaves_back_m', 0.0)
    for o in leaves: o.matrix_world = Matrix.Translation(shift) @ M @ cam_old.inverted() @ leaf_old[o.name]
    off = Vector(FRAMING['sit_offset_blender'])
    for o in env.objects:
        if o.get('source_name') in ('moxing1022', 'moxing1026'): o.matrix_world = Matrix.Translation(off) @ o.matrix_world
    for o in ch.objects:
        if o.parent is None or o.parent.name not in ch.objects: o.matrix_world = Matrix.Translation(off) @ o.matrix_world
    bpy.context.view_layer.update()
    palm = next(o for o in env.objects if o.get('source_name') == 'moxing0042')
    pts = [palm.matrix_world @ Vector(c) for c in palm.bound_box]
    base = Vector((sum(q.x for q in pts) / 8, sum(q.y for q in pts) / 8, min(q.z for q in pts)))
    pb = px_from_world(base); extra['palm_pivot'] = [round(pb.x, 1), round(H - pb.y, 1)]   # y from the top, as wind.js uses
    lo = leaves[0]; lp = px_from_world(lo.matrix_world.translation)
    T.camera.matrix_world = cam_old; lp0 = px_from_world(leaf_old[lo.name].translation); T.camera.matrix_world = M
    extra['leaves_pivot_shift'] = [round(lp.x - lp0.x, 1), round(-(lp.y - lp0.y), 1)]
    extra['character_offset'] = [off.x, off.z, -off.y]                                          # three.js axes
look = dict(ink_env=0.4, ink_her=0.85, ink=(0.38, 0.24, 0.16, 1.0), warm=(1.0, 0.96, 0.90, 1.0), sat=1.10, contrast=6.0,
            bloom=0.55, bloom_threshold=0.8, bloom_size=0.75, vignette=0.25, speck=1.5 * SCALE)
shade = dict(os_['look'](feats)['facade_shade']); shade['through'] = tuple(v * SCALE for v in shade['through']); shade['soft'] *= SCALE
if FRAMING:      # the facade's shade line: through the same two points on the facade, seen from the new camera
    x0, y0 = shade['through']; k = shade['slope']; plane = FRAMING['facade_plane_x']
    a = world_on_plane((x0, y0), cam_old, plane); b = world_on_plane((x0 + 400, y0 + 400 * k), cam_old, plane)
    pa, pb2 = px_from_world(a), px_from_world(b)
    shade['through'] = (pa.x, pa.y); shade['slope'] = (pb2.y - pa.y) / (pb2.x - pa.x)
    extra['facade_line'] = [round(pa.x, 1), round(pa.y, 1), round(shade['slope'], 3)]
look['facade_shade'] = shade
cs = {}; exec((ROOT / 'spike/balcony-toon/compositor.py').read_text(), cs)
cs['build'](T, p=look, no_lines=[o.name for o in env.objects if o.get('source_name') in NO_LINES], character=[])
T.render.resolution_x, T.render.resolution_y, T.render.resolution_percentage = W, H, 100
# her and the book stay out of the picture (she is drawn live); her shadow is not baked, since she moves
# (per-object hiding is overridden by visibility keys carried over from the source scene, so exclude the collection)
for lc in T.view_layers[0].layer_collection.children:
    if lc.collection == ch: lc.exclude = True
probe = bpy.data.objects['Toon • indoor light probe']

def scene_json():
    cam = T.camera; C = Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0)))
    p = C @ cam.matrix_world.translation; q = (C.to_4x4() @ cam.matrix_world).to_quaternion()
    hf = 2 * math.atan(cam.data.sensor_width / 2 / cam.data.lens); vf = 2 * math.atan(math.tan(hf / 2) * H / W)
    sun = next(o for o in env.objects if o.type == 'LIGHT' and o.data.type == 'SUN' and not o.hide_render and not o.name.startswith('Toon • out'))
    d = C @ (sun.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()
    return {'camera': {'position': list(p), 'quaternion': [q.x, q.y, q.z, q.w], 'hfov_deg': math.degrees(hf), 'vfov_deg': math.degrees(vf)},
            'plate': 'plate.webp', 'leaves': 'leaves.webp', 'size': [W, H],
            'sun': {'direction': list(d), 'color': list(sun.data.color), 'blender_energy': sun.data.energy}}

def step_bake():
    try:
        win = bpy.context.window_manager.windows[0]; win.scene = T
        with bpy.context.temp_override(window=win, scene=T, view_layer=T.view_layers[0], active_object=probe, object=probe, selected_objects=[probe]):
            bpy.ops.object.lightprobe_cache_bake(subset='ACTIVE')
        report(stage='baked'); next_step()
    except Exception as e: report(stage='error', err=repr(e))

def step_plate():
    try:
        t = time.time()
        for o in leaves: o.hide_render = True
        T.render.film_transparent = False; T.render.use_compositing = True
        T.render.filepath = str(OUT / 'plate.png'); T.render.image_settings.file_format = 'PNG'; T.render.image_settings.color_mode = 'RGB'
        bpy.ops.render.render(write_still=True)
        report(stage='plate', sec=round(time.time() - t, 1)); next_step()
    except Exception as e: report(stage='error', err=repr(e))

def step_leaves():
    try:
        t = time.time(); hidden = []
        for o in T.objects:
            if o.type == 'MESH' and o not in leaves and not o.hide_render: o.hide_render = True; hidden.append(o)
        for o in leaves: o.hide_render = False
        T.render.film_transparent = True; T.render.use_compositing = False
        T.render.filepath = str(OUT / 'leaves.png'); T.render.image_settings.color_mode = 'RGBA'
        bpy.ops.render.render(write_still=True)
        for o in hidden: o.hide_render = False
        T.render.film_transparent = False; T.render.use_compositing = True
        old = json.loads((OUT / 'scene.json').read_text()) if (OUT / 'scene.json').exists() else {}
        new = scene_json(); old.update({k: new[k] for k in ('camera', 'size', 'sun')}); old.update(framing=extra)
        (OUT / 'scene.json').write_text(json.dumps(old, indent=1))
        report(stage='leaves', sec=round(time.time() - t, 1)); next_step()
    except Exception as e: report(stage='error', err=repr(e))

def wind_objects(group): return [o for o in env.objects if o.get('source_name') in WIND[group] and o.type == 'MESH']


def step_clean():
    """The plate with the swaying plants removed (hidden from the camera, still casting shadows)."""
    try:
        t = time.time(); objs = [o for g in WIND for o in wind_objects(g)]
        for o in leaves: o.hide_render = True
        for o in objs: o.visible_camera = False
        T.render.film_transparent = False; T.render.use_compositing = True; T.render.image_settings.color_mode = 'RGB'
        T.render.filepath = str(OUT / 'plate-clean.png'); bpy.ops.render.render(write_still=True)
        for o in objs: o.visible_camera = True
        report(stage='clean', sec=round(time.time() - t, 1)); next_step()
    except Exception as e: report(stage='error', err=repr(e))


def step_mask():
    """Which visible pixels belong to each group: cryptomatte mattes packed into R, G, B, A."""
    try:
        t = time.time(); keep = T.compositing_node_group
        for o in leaves: o.hide_render = True
        tree = bpy.data.node_groups.new('Toon • plant mask (Claude)', 'CompositorNodeTree'); L = tree.links
        tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        rl = tree.nodes.new('CompositorNodeRLayers'); rl.scene = T; out = tree.nodes.new('NodeGroupOutput')
        T.view_layers[0].use_pass_cryptomatte_object = True
        comb = tree.nodes.new('CompositorNodeCombineColor')
        for ch, g in zip(('Red', 'Green', 'Blue', 'Alpha'), ('palm', 'ivy', 'roses', 'pots')):
            cm = tree.nodes.new('CompositorNodeCryptomatteV2'); cm.source = 'RENDER'; cm.scene = T
            cm.layer_name = T.view_layers[0].name + '.CryptoObject'; cm.matte_id = ','.join(o.name for o in wind_objects(g))
            L.new(cm.outputs['Matte'], comb.inputs[ch])
        L.new(comb.outputs['Image'], out.inputs['Image'])
        T.compositing_node_group = tree; T.render.use_compositing = True; T.render.film_transparent = False
        vs = T.view_settings; saved = (vs.view_transform, vs.look, vs.exposure); vs.view_transform = 'Raw'
        T.render.image_settings.color_mode = 'RGBA'; T.render.filepath = str(OUT / 'plant-mask.png'); bpy.ops.render.render(write_still=True)
        vs.view_transform, vs.look, vs.exposure = saved; T.compositing_node_group = keep; bpy.data.node_groups.remove(tree)
        report(stage='mask', sec=round(time.time() - t, 1)); next_step()
    except Exception as e: report(stage='error', err=repr(e))


def flex_material(hanging):
    m = bpy.data.materials.new('Toon • plant flex' + (' hanging' if hanging else '')); N, L = m.node_tree.nodes, m.node_tree.links
    for n in list(N): N.remove(n)
    out = N.new('ShaderNodeOutputMaterial'); em = N.new('ShaderNodeEmission'); tc = N.new('ShaderNodeTexCoord'); sep = N.new('ShaderNodeSeparateXYZ')
    L.new(tc.outputs['Generated'], sep.inputs['Vector'])
    z = sep.outputs['Z']
    if hanging:
        inv = N.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0; L.new(z, inv.inputs[1]); z = inv.outputs[0]
    L.new(z, em.inputs['Color']); L.new(em.outputs['Emission'], out.inputs['Surface']); return m


def step_flex():
    """0 at each plant's anchor (base, or top for hanging ivy) to 1 at its far end, from object-space height."""
    try:
        t = time.time(); swapped = []
        mats = {False: flex_material(False), True: flex_material(True)}
        for o in leaves: o.hide_render = True
        for g in WIND:
            for o in wind_objects(g):
                for sl in o.material_slots: swapped.append((sl, sl.link, sl.material)); sl.link = 'OBJECT'; sl.material = mats[g in HANGING]
        vs = T.view_settings; saved = (vs.view_transform, vs.look, vs.exposure); vs.view_transform = 'Raw'
        T.render.use_compositing = False; T.render.film_transparent = True; T.render.image_settings.color_mode = 'RGBA'
        T.render.filepath = str(OUT / 'plant-flex.png'); bpy.ops.render.render(write_still=True)
        vs.view_transform, vs.look, vs.exposure = saved; T.render.use_compositing = True; T.render.film_transparent = False
        for sl, link, m in swapped: sl.link = link; sl.material = m
        for m in mats.values(): bpy.data.materials.remove(m)
        report(stage='flex', sec=round(time.time() - t, 1)); next_step()
    except Exception as e: report(stage='error', err=repr(e))


DEPTH_RANGE = 64.0   # depth.png stores log2(distance)/log2(64): 1 m .. 64 m in 8 bits (about 1.6 % steps)


def step_depth():
    """Distance from the camera to the first surface, with the swaying plants and the near leaves hidden (so the
    page can hide plant parts that move behind something nearer, like a door frame). Glass is see-through here."""
    try:
        t = time.time(); keep = T.compositing_node_group; objs = [o for g in WIND for o in wind_objects(g)] + leaves
        for o in objs: o.visible_camera = False
        tree = bpy.data.node_groups.new('Toon • depth (Claude)', 'CompositorNodeTree'); L = tree.links
        tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        rl = tree.nodes.new('CompositorNodeRLayers'); rl.scene = T; out = tree.nodes.new('NodeGroupOutput')
        T.view_layers[0].use_pass_z = True
        lg = tree.nodes.new('ShaderNodeMath'); lg.operation = 'LOGARITHM'; lg.inputs[1].default_value = DEPTH_RANGE
        L.new(rl.outputs['Depth'], lg.inputs[0])
        cl = tree.nodes.new('ShaderNodeMath'); cl.operation = 'MAXIMUM'; cl.inputs[1].default_value = 0.0; cl.use_clamp = True
        L.new(lg.outputs[0], cl.inputs[0]); L.new(cl.outputs[0], out.inputs['Image'])
        T.compositing_node_group = tree; T.render.use_compositing = True; T.render.film_transparent = False
        vs = T.view_settings; saved = (vs.view_transform, vs.look, vs.exposure); vs.view_transform = 'Raw'
        T.render.image_settings.color_mode = 'BW'; T.render.filepath = str(OUT / 'depth.png'); bpy.ops.render.render(write_still=True)
        vs.view_transform, vs.look, vs.exposure = saved; T.compositing_node_group = keep; bpy.data.node_groups.remove(tree)
        for o in objs: o.visible_camera = True
        for o in leaves: o.hide_render = True
        report(stage='depth', sec=round(time.time() - t, 1)); next_step()
    except Exception as e: report(stage='error', err=repr(e))


FULL_GROUPS = ('palm', 'ivy', 'roses', 'pots')
OVERSCAN = 1.08      # the palm layer is rendered 4 % wider on each side, so fronds swinging in from past the edge exist


def step_full():
    """Each swaying group alone, whole (everything else hidden from the camera but still casting shadows and light),
    through the same compositor, on transparent: plant-full-<group>.png. The page colours the parts of a plant that a
    door frame or the picture edge hid at rest from these, so nothing is cut off when the plant moves."""
    try:
        t = time.time(); g = full_todo.pop(0); grp = set(wind_objects(g)); hidden = []
        for o in leaves: o.hide_render = True
        for o in T.objects:
            if o.type == 'MESH' and o not in grp and o.visible_camera: o.visible_camera = False; hidden.append(o)
        cam = T.camera.data; sw = cam.sensor_width
        if g == 'palm': cam.sensor_width = sw * OVERSCAN; T.render.resolution_x, T.render.resolution_y = round(W * OVERSCAN), round(H * OVERSCAN)
        T.render.film_transparent = True; T.render.use_compositing = True; T.render.image_settings.color_mode = 'RGBA'
        T.render.filepath = str(OUT / f'plant-full-{g}.png'); bpy.ops.render.render(write_still=True)
        cam.sensor_width = sw; T.render.resolution_x, T.render.resolution_y = W, H
        for o in hidden: o.visible_camera = True
        T.render.film_transparent = False; T.render.image_settings.color_mode = 'RGB'
        report(stage='full-' + g, sec=round(time.time() - t, 1))
        if full_todo: bpy.app.timers.register(step_full, first_interval=0.5)
        else: next_step()
    except Exception as e: report(stage='error', err=repr(e))


SHEER = {'窗帘'}


def depth_tree(name, with_alpha=False):
    tree = bpy.data.node_groups.new(name, 'CompositorNodeTree'); L = tree.links
    tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    rl = tree.nodes.new('CompositorNodeRLayers'); rl.scene = T; out = tree.nodes.new('NodeGroupOutput')
    lg = tree.nodes.new('ShaderNodeMath'); lg.operation = 'LOGARITHM'; lg.inputs[1].default_value = DEPTH_RANGE
    L.new(rl.outputs['Depth'], lg.inputs[0])
    cl = tree.nodes.new('ShaderNodeMath'); cl.operation = 'MAXIMUM'; cl.inputs[1].default_value = 0.0; cl.use_clamp = True
    L.new(lg.outputs[0], cl.inputs[0])
    comb = tree.nodes.new('CompositorNodeCombineColor'); L.new(cl.outputs[0], comb.inputs['Red'])
    if with_alpha: L.new(rl.outputs['Alpha'], comb.inputs['Green'])
    L.new(comb.outputs['Image'], out.inputs['Image']); return tree


def step_cover():
    """What covers each pixel, for hiding plant parts that move behind something: cover-opaque.png (R: distance to the
    first opaque surface, plants, leaves and the sheer curtain hidden) and cover-sheer.png (R: distance to the sheer
    curtain, G: how much of the pixel the sheer covers). Distances as log2(d)/log2(64)."""
    try:
        t = time.time(); keep = T.compositing_node_group; plants = [o for g in WIND for o in wind_objects(g)] + leaves
        sheer = [o for o in env.objects if o.get('source_name') in SHEER and o.type == 'MESH']
        T.view_layers[0].use_pass_z = True
        vs = T.view_settings; saved = (vs.view_transform, vs.look, vs.exposure); vs.view_transform = 'Raw'
        for o in plants + sheer: o.visible_camera = False
        tree = depth_tree('Toon • cover (Claude)'); T.compositing_node_group = tree; T.render.use_compositing = True
        T.render.film_transparent = False; T.render.image_settings.color_mode = 'RGB'; T.render.image_settings.color_depth = '16'
        T.render.filepath = str(OUT / 'cover-opaque.png'); bpy.ops.render.render(write_still=True)
        bpy.data.node_groups.remove(tree)
        hidden = [o for o in T.objects if o.type == 'MESH' and o not in sheer and o.visible_camera]
        for o in hidden: o.visible_camera = False
        for o in sheer: o.visible_camera = True
        tree = depth_tree('Toon • cover sheer (Claude)', True); T.compositing_node_group = tree; T.render.film_transparent = True
        T.render.filepath = str(OUT / 'cover-sheer.png'); bpy.ops.render.render(write_still=True)
        for o in hidden + plants: o.visible_camera = True
        for o in leaves: o.hide_render = True
        vs.view_transform, vs.look, vs.exposure = saved; T.compositing_node_group = keep; bpy.data.node_groups.remove(tree)
        T.render.film_transparent = False; T.render.image_settings.color_depth = '8'
        report(stage='cover', sec=round(time.time() - t, 1)); next_step()
    except Exception as e: report(stage='error', err=repr(e))


full_todo = list(FULL_GROUPS)
QUEUE = {'plate': step_plate, 'leaves': step_leaves, 'wind': None}
order = [k for k in ('plate', 'leaves') if k in STEPS] + (['clean', 'mask', 'flex'] if 'wind' in STEPS else []) + (['depth'] if 'depth' in STEPS else []) + [k for k in ('full', 'cover') if k in STEPS]
funcs = {'plate': step_plate, 'leaves': step_leaves, 'clean': step_clean, 'mask': step_mask, 'flex': step_flex, 'depth': step_depth, 'full': step_full, 'cover': step_cover}
todo = list(order)


def next_step():
    if not todo: report(stage='done', steps=order, **{k: v for k, v in info.items() if isinstance(v, (int, float, str))}); return
    bpy.app.timers.register(funcs[todo.pop(0)], first_interval=0.5)


report(stage='built'); bpy.app.timers.register(step_bake, first_interval=0.5)
