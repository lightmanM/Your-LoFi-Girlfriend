"""Dusk variant of the toon look test, applied to 'Balcony • Toon test (Claude)' after build_toon.build().
Blue-hour sky, the sun off, a warm floor lamp beside her (Kenney CC0), string lights on the railing, warm windows
across the street, soft shading instead of hard bands. Everything it adds is named 'Toon • dusk …'."""
import bpy, math, pathlib
from mathutils import Vector

ROOT = pathlib.Path(globals().get('ROOT', '.'))
SKY = (0.22, 0.32, 0.64); SKY_STRENGTH = 0.55
WARM = (1.0, 0.60, 0.30); BULB = (1.0, 0.72, 0.42)
LAMP_AT, LAMP_HEIGHT = (9.05, 26.12), 1.75
RAIL_X, RAIL_Y, RAIL_Z, BULBS = 3.99, (23.35, 26.25), 1.30, 18
SOFT = ((0.45, 0.0), (0.85, 1.0))          # stops mapped -6..+2: soft ramp from shadow colour to full light
ENV_SHADOW, SKIN_SHADOW = (0.30, 0.30, 0.42), (0.78, 0.50, 0.46)


def emissive(name, colour, strength) -> bpy.types.Material:
    m = bpy.data.materials.new('Toon • dusk ' + name); N, L = m.node_tree.nodes, m.node_tree.links
    for n in list(N): N.remove(n)
    out = N.new('ShaderNodeOutputMaterial'); em = N.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*colour, 1); em.inputs['Strength'].default_value = strength
    L.new(em.outputs['Emission'], out.inputs['Surface']); return m


def point(env, name, at, colour, watts, radius) -> bpy.types.Object:
    li = bpy.data.lights.new('Toon • dusk ' + name, 'POINT'); li.color, li.energy, li.shadow_soft_size = colour, watts, radius
    o = bpy.data.objects.new('Toon • dusk ' + name, li); env.objects.link(o); o.location = at; return o


def sky(T, env) -> None:
    for o in env.objects:
        if o.type == 'LIGHT' and o.data.type == 'SUN': o.hide_render = True
    bg = next(n for n in T.world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (*SKY, 1); bg.inputs['Strength'].default_value = SKY_STRENGTH


def lamp(env, toon) -> dict:
    path = ROOT / 'assets/vendor/kenney-furniture/lampRoundFloor.glb'
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    parts = [o for o in bpy.data.objects if o not in before]
    for o in parts:
        for c in list(o.users_collection): c.objects.unlink(o)
        env.objects.link(o); o.name = 'Toon • dusk lamp ' + o.name
    roots = [o for o in parts if o.parent is None]
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in parts if o.type == 'MESH' for c in o.bound_box]
    h = max(p.z for p in pts) - min(p.z for p in pts); s = LAMP_HEIGHT / h
    for r in roots: r.scale = (s, s, s); r.location = (LAMP_AT[0], LAMP_AT[1], 0)
    bpy.context.view_layer.update()
    shade_z = 0.0
    for o in parts:
        if o.type != 'MESH': continue
        for sl in o.material_slots:
            if sl.material is None: continue
            light = sum(sl.material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value[:3]) > 2.2 if 'Principled BSDF' in sl.material.node_tree.nodes else False
            sl.link = 'OBJECT'; sl.material = emissive('lampshade', WARM, 1.4) if light else toon(sl.material)
        top = max((o.matrix_world @ Vector(c)).z for c in o.bound_box); shade_z = max(shade_z, top)
    point(env, 'lamp bulb', (LAMP_AT[0], LAMP_AT[1], shade_z - 0.18), WARM, 45.0, 0.12)
    return {'lamp_parts': len(parts), 'lamp_scale': round(s, 3)}


def string_lights(env) -> int:
    bulb = emissive('bulb', BULB, 6.0); wire = bpy.data.meshes.new('Toon • dusk wire')
    y0, y1 = RAIL_Y; pts = []
    for i in range(BULBS):
        t = i / (BULBS - 1); y = y0 + (y1 - y0) * t
        z = RAIL_Z - 0.07 * math.sin(math.pi * ((t * 3) % 1.0))          # three gentle swags
        pts.append(Vector((RAIL_X, y, z)))
        me = bpy.data.meshes.new('Toon • dusk bulb'); ob = bpy.data.objects.new('Toon • dusk bulb', me); env.objects.link(ob)
        import bmesh; bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=0.022); bm.to_mesh(me); bm.free()
        me.materials.append(bulb); ob.location = pts[-1] - Vector((0, 0, 0.025)); ob.visible_shadow = False
    wire.from_pydata([tuple(p) for p in pts], [(i, i + 1) for i in range(len(pts) - 1)], [])
    wo = bpy.data.objects.new('Toon • dusk wire', wire); env.objects.link(wo)
    sk = wo.modifiers.new('wire', 'SKIN')
    for v in wire.skin_vertices[0].data: v.radius = (0.004, 0.004)
    wire.materials.append(emissive('wire', (0.05, 0.04, 0.03), 1.0))
    for t in (0.17, 0.5, 0.83):
        point(env, 'string glow', (RAIL_X + 0.05, y0 + (y1 - y0) * t, RAIL_Z - 0.05), BULB, 6.0, 0.08)
    return BULBS


WINDOW_GLOW = {'moxing1044', 'moxing1045'}   # curtains behind the opposite window's glass


def warm_windows(T, env) -> list:
    """The curtains in the window across the street glow warm, as if the room behind is lit (object-level material)."""
    glow = emissive('window', (1.0, 0.66, 0.36), 1.3); hit = []
    for o in env.objects:
        if o.get('source_name') in WINDOW_GLOW and o.type == 'MESH':
            for sl in o.material_slots: sl.link = 'OBJECT'; sl.material = glow
            hit.append(o['source_name'])
    return sorted(hit)


def soft_shading(group) -> None:
    st = group.nodes['Stops']; st.inputs['From Min'].default_value = -6.0; st.inputs['From Max'].default_value = 2.0
    cr = group.nodes['Bands'].color_ramp; cr.interpolation = 'EASE'
    while len(cr.elements) > 2: cr.elements.remove(cr.elements[-1])
    for e, (pos, v) in zip(cr.elements, SOFT): e.position = pos; e.color = (v, v, v, 1)
    group.nodes['Tint'].inputs['Factor'].default_value = 0.7
    for m in bpy.data.materials:
        if not m.name.startswith('Toon • ') or not m.node_tree: continue
        for n in m.node_tree.nodes:
            if n.type == 'GROUP' and n.node_tree == group:
                n.inputs['Shadow'].default_value = (*(SKIN_SHADOW if 'Skin' in m.name else ENV_SHADOW), 1)


def apply(T, env, toon, group) -> dict:
    sky(T, env); info = lamp(env, toon); info['bulbs'] = string_lights(env); info['windows'] = warm_windows(T, env); soft_shading(group)
    return info
