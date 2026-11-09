"""Warm afternoon variant of the toon look test, no lamp: a low golden sun through the door, a sky with warm ground
bounce, a hidden warm bounce light where the sun lands, a light haze so the sun draws beams, soft shading.
Applied to 'Balcony • Toon test (Claude)' after build_toon.build(). Everything it adds is named 'Toon • pm …'."""
import bpy, math
from mathutils import Vector

SUN_AZ, SUN_EL, SUN_COLOR, SUN_ENERGY = 230.0, 38.0, (1.0, 0.74, 0.48), 4.5
SKY, GROUND, SKY_STRENGTH = (0.62, 0.70, 0.84), (0.50, 0.46, 0.42), 1.0
BOUNCE = dict(at=(8.7, 25.0, 0.06), size=(2.2, 1.4), colour=(1.0, 0.70, 0.45), watts=70.0)
HAZE = dict(centre=(9.0, 25.0, 1.4), size=(4.5, 3.4, 2.8), density=0.018, colour=(1.0, 0.86, 0.70))
SOFT = ((0.40, 0.0), (0.80, 1.0))          # stops mapped -6..+2: eased ramp from shadow colour to full light
ENV_SHADOW, SKIN_SHADOW = (0.50, 0.38, 0.30), (0.80, 0.52, 0.48)


def sun(env) -> None:
    a, e = math.radians(SUN_AZ), math.radians(SUN_EL)
    d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
    for o in env.objects:
        if o.type == 'LIGHT' and o.data.type == 'SUN':
            o.hide_render = False; o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = d.to_track_quat('Z', 'Y')
            o.data.color, o.data.energy, o.data.angle = SUN_COLOR, SUN_ENERGY, math.radians(2.0)


def sky_with_bounce(T) -> None:
    """World: sky colour above the horizon, warm ground colour below, so downward faces pick up warm bounce."""
    w = T.world; N, L = w.node_tree.nodes, w.node_tree.links
    bg = next(n for n in N if n.type == 'BACKGROUND')
    tc = N.new('ShaderNodeTexCoord'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Generated'], sep.inputs['Vector'])
    mr = N.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = -0.25; mr.inputs['From Max'].default_value = 0.35
    L.new(sep.outputs['Z'], mr.inputs['Value'])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.inputs['A'].default_value = (*GROUND, 1); mix.inputs['B'].default_value = (*SKY, 1)
    L.new(mr.outputs['Result'], mix.inputs['Factor']); L.new(mix.outputs['Result'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = SKY_STRENGTH


def bounce(env) -> None:
    li = bpy.data.lights.new('Toon • pm bounce', 'AREA'); li.shape = 'RECTANGLE'; li.size, li.size_y = BOUNCE['size']
    li.color, li.energy = BOUNCE['colour'], BOUNCE['watts']; li.use_shadow = False
    o = bpy.data.objects.new('Toon • pm bounce', li); env.objects.link(o); o.location = BOUNCE['at']
    o.rotation_euler = (math.pi, 0, 0)          # area lights face -Z; flip to shine up from the sunlit floor


def haze(T, env) -> None:
    me = bpy.data.meshes.new('Toon • pm haze'); import bmesh; bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('Toon • pm haze', me); env.objects.link(o); o.location = HAZE['centre']; o.scale = HAZE['size']
    m = bpy.data.materials.new('Toon • pm haze'); N, L = m.node_tree.nodes, m.node_tree.links
    for n in list(N): N.remove(n)
    out = N.new('ShaderNodeOutputMaterial'); vol = N.new('ShaderNodeVolumePrincipled')
    vol.inputs['Density'].default_value = HAZE['density']; vol.inputs['Color'].default_value = (*HAZE['colour'], 1)
    L.new(vol.outputs['Volume'], out.inputs['Volume']); me.materials.append(m)
    for k, v in (('volumetric_tile_size', '4'), ('use_volumetric_shadows', True), ('volumetric_end', 40.0)):
        try: setattr(T.eevee, k, v)
        except Exception: pass


def soft_shading(group) -> None:
    st = group.nodes['Stops']; st.inputs['From Min'].default_value = -6.0; st.inputs['From Max'].default_value = 2.0
    cr = group.nodes['Bands'].color_ramp; cr.interpolation = 'EASE'
    while len(cr.elements) > 2: cr.elements.remove(cr.elements[-1])
    for e, (pos, v) in zip(cr.elements, SOFT): e.position = pos; e.color = (v, v, v, 1)
    group.nodes['Tint'].inputs['Factor'].default_value = 0.65
    for m in bpy.data.materials:
        if not m.name.startswith('Toon • ') or not m.node_tree: continue
        for n in m.node_tree.nodes:
            if n.type == 'GROUP' and n.node_tree == group:
                n.inputs['Shadow'].default_value = (*(SKIN_SHADOW if 'Skin' in m.name else ENV_SHADOW), 1)


CLEAN_CURTAINS = False   # off: the user prefers the original warm see-through curtains (flat versions were worse)
CURTAINS = {'Material.005': dict(colour=(0.48, 0.36, 0.27), shadow=(0.36, 0.26, 0.20), opacity=0.92),   # left: heavier warm linen
            'Material.002': dict(colour=(0.92, 0.85, 0.74), shadow=(0.78, 0.66, 0.56), opacity=0.62)}   # right: warm sheer
# pure leaf textures: keep their light/dark detail, recolour it between a dark and a light green
GREENS = {'Material.010': ((0.05, 0.07, 0.035), (0.19, 0.22, 0.10)),   # palm: indoors on the dark side of the room
          'Material.049': ((0.08, 0.11, 0.06), (0.32, 0.36, 0.17)),   # near leaves
          'Material.050': ((0.06, 0.12, 0.08), (0.32, 0.40, 0.24)),   # ivy
          'Material.041': ((0.08, 0.13, 0.07), (0.36, 0.42, 0.21)),
          'Material.031': ((0.08, 0.13, 0.07), (0.36, 0.42, 0.21)),
          'Material.036': ((0.08, 0.13, 0.07), (0.36, 0.42, 0.21))}
FOLIAGE_SHADOW = (0.44, 0.40, 0.30)        # warm olive: same family as the room shade, so plants sit in the light
ROSES = 'Material.048'                     # leaves and flowers share one texture: keep it, cool shadow only
WINDOW = dict(glass='moxing0693', depth=0.6, inset=0.05, colour=(1.0, 0.80, 0.55), strength=1.1)   # glow behind the glass; side curtains unlit


def group_node(m, group):
    return next((n for n in m.node_tree.nodes if n.type == 'GROUP' and n.node_tree == group), None)


def clean_curtain(group) -> None:
    for name, look in CURTAINS.items():
        m = bpy.data.materials.get('Toon • ' + name)
        if m is not None: clean_one_curtain(m, group, look)


def clean_one_curtain(m, group, look) -> None:
    """Flat warm fabric, no photo texture; see-through by a constant amount. Dithered (not blended) so the object mask
    still covers it and the ink pass draws no lines from the building behind."""
    N, L = m.node_tree.nodes, m.node_tree.links
    gn = group_node(m, group); out = next(n for n in N if n.type == 'OUTPUT_MATERIAL' and n.is_active_output)
    for l in list(gn.inputs['Color'].links): L.remove(l)
    gn.inputs['Color'].default_value = (*look['colour'], 1); gn.inputs['Shadow'].default_value = (*look['shadow'], 1); gn.inputs['AO'].default_value = 0.3
    mix = N.new('ShaderNodeMixShader'); tr = N.new('ShaderNodeBsdfTransparent'); mix.inputs['Fac'].default_value = look['opacity']
    L.new(tr.outputs['BSDF'], mix.inputs[1]); L.new(gn.outputs['Shader'], mix.inputs[2])
    for l in list(out.inputs['Surface'].links): L.remove(l)
    L.new(mix.outputs['Shader'], out.inputs['Surface'])
    m.surface_render_method = 'DITHERED'; m.use_transparent_shadow = True


def clean_greens(group) -> list:
    done = []
    for name, (dark, light) in GREENS.items():
        m = bpy.data.materials.get('Toon • ' + name)
        if m is None: continue
        N, L = m.node_tree.nodes, m.node_tree.links; gn = group_node(m, group)
        if not gn.inputs['Color'].is_linked: continue
        src = gn.inputs['Color'].links[0].from_socket
        bw = N.new('ShaderNodeRGBToBW'); L.new(src, bw.inputs['Color'])
        mr = N.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.03; mr.inputs['From Max'].default_value = 0.45; L.new(bw.outputs['Val'], mr.inputs['Value'])
        mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.inputs['A'].default_value = (*dark, 1); mix.inputs['B'].default_value = (*light, 1)
        L.new(mr.outputs['Result'], mix.inputs['Factor']); L.new(mix.outputs['Result'], gn.inputs['Color'])
        gn.inputs['Shadow'].default_value = (*FOLIAGE_SHADOW, 1); done.append(name)
    r = bpy.data.materials.get('Toon • ' + ROSES)
    if r is not None: group_node(r, group).inputs['Shadow'].default_value = (*FOLIAGE_SHADOW, 1)
    return done


def window_light(env) -> str:
    """Warm room light seen between the curtains of the window across the street: an emissive panel just behind its
    glass, so the curtains in front stay ordinary fabric."""
    glass = next(o for o in env.objects if o.get('source_name') == WINDOW['glass'])
    M = glass.matrix_world; pts = [M @ Vector(c) for c in glass.bound_box]
    x = min(p.x for p in pts) - WINDOW['depth']; y0, y1 = min(p.y for p in pts), max(p.y for p in pts); z0, z1 = min(p.z for p in pts), max(p.z for p in pts)
    i = WINDOW['inset']; me = bpy.data.meshes.new('Toon • pm window glow')
    me.from_pydata([(x, y0 + i, z0 + i), (x, y1 - i, z0 + i), (x, y1 - i, z1 - i), (x, y0 + i, z1 - i)], [], [(0, 1, 2, 3)])
    m = bpy.data.materials.new('Toon • pm window glow'); N, L = m.node_tree.nodes, m.node_tree.links
    for n in list(N): N.remove(n)
    out = N.new('ShaderNodeOutputMaterial'); em = N.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*WINDOW['colour'], 1); em.inputs['Strength'].default_value = WINDOW['strength']
    L.new(em.outputs['Emission'], out.inputs['Surface']); me.materials.append(m)
    o = bpy.data.objects.new('Toon • pm window glow', me); env.objects.link(o); o.visible_shadow = False
    return f'x={x:.2f} y={y0:.2f}..{y1:.2f} z={z0:.2f}..{z1:.2f}'


def apply(T, env, toon, group) -> dict:
    sun(env); sky_with_bounce(T); haze(T, env); soft_shading(group)   # no floor bounce: it lit her from below
    if CLEAN_CURTAINS: clean_curtain(group)
    greens = clean_greens(group); win = window_light(env)
    return {'sun': [SUN_AZ, SUN_EL], 'greens': greens, 'window': win}
