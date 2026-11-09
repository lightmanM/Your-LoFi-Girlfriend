"""Image pass for the toon look test: ink from depth and normal edges (light on the room, none on foliage, curtains and
the near leaves), a solid line around her, optional Kuwahara paint, warm grade, bloom and vignette.
Runs inside the live Blender via MCP (exec); call build(scene, ...). Same steps a web post pass would do."""
import bpy

P = dict(paint=0.0, depth_lo=0.14, depth_hi=0.30, normal_lo=1.1, normal_hi=1.7, speck=1.5, near_lo=1.3, near_hi=2.6,
         ink_env=0.85, ink_her=0.9, ink=(0.24, 0.16, 0.12, 1.0), sat=1.08, contrast=6.0, warm=(1.0, 1.0, 1.0, 1.0),
         bloom=0.25, bloom_threshold=0.85, bloom_size=0.5, vignette=0.0, aerial=None, facade_shade=None)


def node(t, idn, **inputs):
    n = t.nodes.new(idn)
    for k, v in inputs.items(): n.inputs[k].default_value = v
    return n


def math(t, op, a=None, b=None):
    n = t.nodes.new('ShaderNodeMath'); n.operation = op
    if a is not None: n.inputs[0].default_value = a
    if b is not None: n.inputs[1].default_value = b
    return n


def remap(t, lo, hi):
    n = t.nodes.new('ShaderNodeMapRange'); n.inputs['From Min'].default_value = lo; n.inputs['From Max'].default_value = hi; n.clamp = True
    return n


def crypto(t, scene, names):
    c = t.nodes.new('CompositorNodeCryptomatteV2'); c.source = 'RENDER'; c.scene = scene
    c.layer_name = scene.view_layers[0].name + '.CryptoObject'; c.matte_id = ','.join(names); return c


def sobel(t, L, socket):
    f = node(t, 'CompositorNodeFilter', Factor=1.0); f.inputs['Type'].default_value = 'Sobel'; L.new(socket, f.inputs['Image'])
    bw = t.nodes.new('CompositorNodeRGBToBW'); L.new(f.outputs['Image'], bw.inputs['Image']); return bw.outputs['Val']


def room_edges(t, L, rl, scene, p, no_lines):
    lg = math(t, 'LOGARITHM', b=2.718281828); L.new(rl.outputs['Depth'], lg.inputs[0])
    ed = remap(t, p['depth_lo'], p['depth_hi']); L.new(sobel(t, L, lg.outputs[0]), ed.inputs['Value'])
    en = remap(t, p['normal_lo'], p['normal_hi']); L.new(sobel(t, L, rl.outputs['Normal']), en.inputs['Value'])
    mx = math(t, 'MAXIMUM'); L.new(ed.outputs['Result'], mx.inputs[0]); L.new(en.outputs['Result'], mx.inputs[1])
    near = remap(t, p['near_lo'], p['near_hi']); L.new(rl.outputs['Depth'], near.inputs['Value'])
    edge = math(t, 'MULTIPLY'); L.new(mx.outputs[0], edge.inputs[0]); L.new(near.outputs['Result'], edge.inputs[1])
    if no_lines:
        th = remap(t, 0.15, 0.35); L.new(crypto(t, scene, no_lines).outputs['Matte'], th.inputs['Value'])
        gr = t.nodes.new('CompositorNodeDilateErode'); gr.inputs['Size'].default_value = 1; L.new(th.outputs['Result'], gr.inputs['Mask'])
        keep = math(t, 'SUBTRACT', a=1.0); L.new(gr.outputs['Mask'], keep.inputs[1])
        e2 = math(t, 'MULTIPLY'); L.new(edge.outputs[0], e2.inputs[0]); L.new(keep.outputs[0], e2.inputs[1]); edge = e2
    bl = node(t, 'CompositorNodeBlur'); bl.inputs['Size'].default_value = (p['speck'], p['speck']); L.new(edge.outputs[0], bl.inputs['Image'])
    bw = t.nodes.new('CompositorNodeRGBToBW'); L.new(bl.outputs['Image'], bw.inputs['Image'])
    clean = remap(t, 0.30, 0.65); L.new(bw.outputs['Val'], clean.inputs['Value'])
    w = math(t, 'MULTIPLY', b=p['ink_env']); L.new(clean.outputs['Result'], w.inputs[0]); return w.outputs[0]


def her_edges(t, L, scene, p, character):
    sl = remap(t, 0.5, 1.2); L.new(sobel(t, L, crypto(t, scene, character).outputs['Matte']), sl.inputs['Value'])
    w = math(t, 'MULTIPLY', b=p['ink_her']); L.new(sl.outputs['Result'], w.inputs[0]); return w.outputs[0]


def vignette(t, L, image, amount):
    ic = t.nodes.new('CompositorNodeImageCoordinates'); L.new(image, ic.inputs['Image'])
    ln = t.nodes.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'; L.new(ic.outputs['Normalized'], ln.inputs[0])
    fall = remap(t, 0.55, 1.25); fall.interpolation_type = 'SMOOTHSTEP'; L.new(ln.outputs['Value'], fall.inputs['Value'])
    k = math(t, 'MULTIPLY', b=amount); L.new(fall.outputs['Result'], k.inputs[0])
    mix = t.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['B'].default_value = (0.20, 0.12, 0.12, 1)
    L.new(k.outputs[0], mix.inputs['Factor']); L.new(image, mix.inputs['A']); return mix.outputs['Result']


def facade_shade(t, L, rl, image, f):
    """Slanted shadow edge on the far building: below a line through the frame (pixel coordinates of the 1600x900
    frame, y measured up from the bottom), only where depth says it is that building. Lit above the line, cool shade below."""
    ic = t.nodes.new('CompositorNodeImageCoordinates'); L.new(image, ic.inputs['Image'])
    sp = t.nodes.new('ShaderNodeSeparateXYZ'); L.new(ic.outputs['Pixel'], sp.inputs['Vector'])
    x0, y0 = f['through']
    dx = math(t, 'SUBTRACT', b=x0); L.new(sp.outputs['X'], dx.inputs[0])
    k = math(t, 'MULTIPLY', b=f['slope']); L.new(dx.outputs[0], k.inputs[0])
    line = math(t, 'ADD', b=y0); L.new(k.outputs[0], line.inputs[0])
    below = math(t, 'SUBTRACT'); L.new(line.outputs[0], below.inputs[0]); L.new(sp.outputs['Y'], below.inputs[1])   # > 0 under the line
    edge = remap(t, -f['soft'], f['soft']); edge.interpolation_type = 'SMOOTHSTEP'; L.new(below.outputs[0], edge.inputs['Value'])
    far = remap(t, *f['depth']); L.new(rl.outputs['Depth'], far.inputs['Value'])
    m = math(t, 'MULTIPLY'); L.new(edge.outputs['Result'], m.inputs[0]); L.new(far.outputs['Result'], m.inputs[1])
    mix = t.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['B'].default_value = f['colour']
    L.new(m.outputs[0], mix.inputs['Factor']); L.new(image, mix.inputs['A']); return mix.outputs['Result']


def build(scene, debug: bool = False, p: dict = P, no_lines=(), character=()) -> bpy.types.NodeTree:
    p = {**P, **p}; name = 'Toon • compositor (Claude)'
    if name in bpy.data.node_groups: bpy.data.node_groups.remove(bpy.data.node_groups[name])
    t = bpy.data.node_groups.new(name, 'CompositorNodeTree'); L = t.links
    t.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    for vl in scene.view_layers: vl.use_pass_z = True; vl.use_pass_normal = True; vl.use_pass_cryptomatte_object = True
    rl = t.nodes.new('CompositorNodeRLayers'); rl.scene = scene; out = t.nodes.new('NodeGroupOutput')
    ink = room_edges(t, L, rl, scene, p, no_lines)
    if character:
        mx = math(t, 'MAXIMUM'); L.new(ink, mx.inputs[0]); L.new(her_edges(t, L, scene, p, character), mx.inputs[1]); ink = mx.outputs[0]
    img = rl.outputs['Image']
    if p['paint'] > 0:
        kw = node(t, 'CompositorNodeKuwahara', Size=p['paint']); kw.inputs['Type'].default_value = 'Anisotropic'; L.new(img, kw.inputs['Image']); img = kw.outputs['Image']
    warm = t.nodes.new('ShaderNodeMix'); warm.data_type = 'RGBA'; warm.blend_type = 'MULTIPLY'; warm.inputs['Factor'].default_value = 1.0
    warm.inputs['B'].default_value = p['warm']; L.new(img, warm.inputs['A'])
    hs = node(t, 'CompositorNodeHueSat', Saturation=p['sat']); L.new(warm.outputs['Result'], hs.inputs['Image'])
    bc = node(t, 'CompositorNodeBrightContrast', Contrast=p['contrast']); L.new(hs.outputs['Image'], bc.inputs['Image'])
    mul = t.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['B'].default_value = p['ink']
    L.new(ink, mul.inputs['Factor']); L.new(bc.outputs['Image'], mul.inputs['A'])
    hazed = mul.outputs['Result']
    if p['facade_shade']:
        hazed = facade_shade(t, L, rl, hazed, p['facade_shade'])
    if p['aerial']:
        a = p['aerial']; dz = remap(t, a['near'], a['far']); dz.inputs['To Max'].default_value = a['amount']; L.new(rl.outputs['Depth'], dz.inputs['Value'])
        hz = t.nodes.new('ShaderNodeMix'); hz.data_type = 'RGBA'; hz.inputs['B'].default_value = a['colour']
        L.new(dz.outputs['Result'], hz.inputs['Factor']); L.new(hazed, hz.inputs['A']); hazed = hz.outputs['Result']
    gl = t.nodes.new('CompositorNodeGlare'); gl.inputs['Type'].default_value = 'Bloom'; gl.inputs['Threshold'].default_value = p['bloom_threshold']
    gl.inputs['Strength'].default_value = p['bloom']; gl.inputs['Size'].default_value = p['bloom_size']; L.new(hazed, gl.inputs['Image'])
    final = gl.outputs['Image']
    if p['vignette'] > 0: final = vignette(t, L, final, p['vignette'])
    L.new((ink if debug else final), out.inputs['Image'])
    scene.compositing_node_group = t; scene.render.use_compositing = True
    return t
