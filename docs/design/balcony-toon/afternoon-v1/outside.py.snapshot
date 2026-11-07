"""Outdoor light improvements for the afternoon toon look, each switchable for comparison:
  facade  - late sun on the building across the street, with a slanted shadow edge (light linked to that building only)
  dapple  - warm dappled light with leaf shadows on the balcony (light linked to the balcony, leaf-cutout card above it)
  distance- the far building a little lighter, cooler and softer than the balcony (depth haze in the image pass)
  rim     - warm rim light on the edges of the outdoor plants
Applied after afternoon.py. Everything it adds is named 'Toon • out …'."""
import bpy, math, bmesh
from mathutils import Vector

FACADE = dict(direction=(0.75, 0.35, 0.55), colour=(1.0, 0.80, 0.55), energy=3.2,
              shade=dict(through=(640.0, 640.0), slope=0.9, soft=18.0, depth=(18.0, 22.0), colour=(0.64, 0.66, 0.82, 1.0)))
DAPPLE = dict(light_at=(6.3, 23.4, 2.35), aim=(6.0, 24.9, 0.0), watts=260.0, colour=(1.0, 0.80, 0.52), spot_deg=80.0,
              card_at=(6.1, 24.4, 1.85), card_size=(3.6, 3.2), leaf_scale=2.6, gap=0.52)
DISTANCE = dict(near=14.0, far=34.0, amount=0.22, colour=(0.88, 0.88, 0.93, 1.0))
RIM = dict(materials=('Material.050', 'Material.048', 'Material.041', 'Material.031', 'Material.036'), amount=0.55, colour=(1.0, 0.80, 0.50))


def collection(name, objects) -> bpy.types.Collection:
    c = bpy.data.collections.new(name)
    for o in objects: c.objects.link(o)
    return c


def bounds(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return pts


def card(env, name, verts, faces, material) -> bpy.types.Object:
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.materials.append(material)
    o = bpy.data.objects.new(name, me); env.objects.link(o)
    return o


def plain(name) -> bpy.types.Material:
    """Shadow-only surface: transparent to the camera, solid in shadow maps (EEVEE drops camera-hidden objects from shadows)."""
    m = bpy.data.materials.new(name); N, L = m.node_tree.nodes, m.node_tree.links
    for n in list(N): N.remove(n)
    out = N.new('ShaderNodeOutputMaterial'); lp = N.new('ShaderNodeLightPath'); tr = N.new('ShaderNodeBsdfTransparent'); dif = N.new('ShaderNodeBsdfDiffuse')
    mix = N.new('ShaderNodeMixShader'); L.new(lp.outputs['Is Shadow Ray'], mix.inputs['Fac']); L.new(tr.outputs['BSDF'], mix.inputs[1]); L.new(dif.outputs['BSDF'], mix.inputs[2])
    L.new(mix.outputs['Shader'], out.inputs['Surface']); m.surface_render_method = 'DITHERED'; m.use_transparent_shadow = True
    return m


def facade_sun(env) -> dict:
    far = [o for o in env.objects if o.type == 'MESH' and not o.name.startswith('Toon •') and max(p.x for p in bounds(o)) < -7]
    li = bpy.data.lights.new('Toon • out facade sun', 'SUN'); li.color, li.energy, li.angle = FACADE['colour'], FACADE['energy'], math.radians(1.5)
    o = bpy.data.objects.new('Toon • out facade sun', li); env.objects.link(o)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector(FACADE['direction']).normalized().to_track_quat('Z', 'Y')
    o.light_linking.receiver_collection = collection('Toon • out facade receivers', far)
    # the slanted shadow edge is painted in the image pass (EEVEE ignored a shadow-casting card); see look()
    return {'facade_objects': len(far)}


def leaf_material() -> bpy.types.Material:
    m = bpy.data.materials.new('Toon • out leaves'); N, L = m.node_tree.nodes, m.node_tree.links
    for n in list(N): N.remove(n)
    out = N.new('ShaderNodeOutputMaterial'); tc = N.new('ShaderNodeTexCoord'); nz = N.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = DAPPLE['leaf_scale']; nz.inputs['Detail'].default_value = 3.0; nz.inputs['Roughness'].default_value = 0.6
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation = 'LINEAR'
    ramp.color_ramp.elements[0].position = DAPPLE['gap'] - 0.03; ramp.color_ramp.elements[1].position = DAPPLE['gap'] + 0.03
    L.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    mix = N.new('ShaderNodeMixShader'); tr = N.new('ShaderNodeBsdfTransparent'); dif = N.new('ShaderNodeBsdfDiffuse')
    L.new(ramp.outputs['Color'], mix.inputs['Fac']); L.new(dif.outputs['BSDF'], mix.inputs[1]); L.new(tr.outputs['BSDF'], mix.inputs[2])
    lp = N.new('ShaderNodeLightPath'); cam = N.new('ShaderNodeMixShader'); tr2 = N.new('ShaderNodeBsdfTransparent')
    L.new(lp.outputs['Is Shadow Ray'], cam.inputs['Fac']); L.new(tr2.outputs['BSDF'], cam.inputs[1]); L.new(mix.outputs['Shader'], cam.inputs[2])
    L.new(cam.outputs['Shader'], out.inputs['Surface'])
    m.surface_render_method = 'DITHERED'; m.use_transparent_shadow = True
    return m


def dapple(env, group) -> dict:
    """Leaf-dappled sun on the balcony, in the shading itself (EEVEE ignored a leaf-cutout card's shadows):
    every toon material used on the balcony gets Dapple = 1; the pattern is masked to the balcony footprint."""
    mats = set()
    for o in env.objects:
        if o.type != 'MESH' or o.name.startswith('Toon •'): continue
        pts = bounds(o); mn, mx = min(p.x for p in pts), max(p.x for p in pts); cy = sum(p.y for p in pts) / 8; cz = sum(p.z for p in pts) / 8
        if 3.5 < mn and mx < 8.3 and 22.8 < cy < 26.8 and cz < 1.6:
            mats.update(s.material for s in o.material_slots if s.material)
    n = 0
    for m in mats:
        gn = next((x for x in m.node_tree.nodes if x.type == 'GROUP' and x.node_tree == group), None) if m.node_tree else None
        if gn: gn.inputs['Dapple'].default_value = 1.0; n += 1
    return {'dapple_materials': n}


def rim(group) -> list:
    done = []
    for name in RIM['materials']:
        m = bpy.data.materials.get('Toon • ' + name)
        if m is None: continue
        gn = next((n for n in m.node_tree.nodes if n.type == 'GROUP' and n.node_tree == group), None)
        if gn: gn.inputs['Rim'].default_value = RIM['amount']; gn.inputs['Rim Color'].default_value = (*RIM['colour'], 1); done.append(name)
    return done


def apply(T, env, group, features) -> dict:
    info = {'outside': sorted(features)}
    if 'facade' in features: info.update(facade_sun(env))
    if 'dapple' in features: info.update(dapple(env, group))
    if 'rim' in features: info['rim'] = rim(group)
    return info


def look(features) -> dict:
    """Image-pass settings this module adds (merged into the compositor parameters)."""
    out = {}
    if 'distance' in features: out['aerial'] = DISTANCE
    if 'facade' in features: out['facade_shade'] = FACADE['shade']
    return out
