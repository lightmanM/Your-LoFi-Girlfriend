"""Rebuild the toon look test and render it, from the live Blender via MCP:
  exec(open('scripts/balcony-toon/render_toon.py').read(), {'OUT': '<png path>', 'ROOT': '<repo root>'})
Steps run on timers (bake, then render) and report to <png>.progress.json, so the MCP call returns at once."""
import bpy, json, time, pathlib
ROOT = pathlib.Path(globals().get('ROOT', '.')); OUT = pathlib.Path(globals()['OUT'])
# painted without ink: curtains, the palm, the near leaves, ivy and potted plants (source object names)
NO_LINES = {'窗帘', 'moxing0035', 'moxing0035_1', 'moxing0042', 'moxing0043', 'moxing1015', 'moxing1016', 'moxing1064', 'moxing1066', 'moxing1090'}
prog = OUT.with_suffix('.progress.json')
ns = {'__name__': 'toon'}; exec((ROOT / 'scripts/balcony-toon/build_toon.py').read_text(), ns); info = ns['build']()
T = bpy.data.scenes[ns['NAME']]
cs = {}; exec((ROOT / 'scripts/balcony-toon/compositor.py').read_text(), cs)
env = bpy.data.collections[ns['ENV']]; ch = bpy.data.collections[ns['CHAR']]
VARIANT = globals().get('VARIANT', 'day')
LOOK = {'day': dict(paint=5.0),
        'dusk': dict(ink_env=0.4, ink_her=0.85, ink=(0.36, 0.22, 0.15, 1.0), warm=(1.0, 0.97, 0.92, 1.0), sat=1.12, contrast=8.0,
                     bloom=0.7, bloom_threshold=0.75, bloom_size=0.7, vignette=0.35),
        'afternoon': dict(ink_env=0.4, ink_her=0.85, ink=(0.38, 0.24, 0.16, 1.0), warm=(1.0, 0.96, 0.90, 1.0), sat=1.10, contrast=6.0,
                          bloom=0.55, bloom_threshold=0.8, bloom_size=0.75, vignette=0.25)}[VARIANT]
if VARIANT in ('dusk', 'afternoon'):
    ds = {'ROOT': str(ROOT)}; exec((ROOT / f'scripts/balcony-toon/{VARIANT}.py').read_text(), ds)
    group = bpy.data.node_groups[ns['GROUP']]
    info.update(ds['apply'](T, env, lambda m: ns['toon'](m, group), group))
OUTSIDE = set(globals().get('OUTSIDE', {'facade', 'dapple', 'rim'} if VARIANT == 'afternoon' else ()))   # chosen 2026-11-06; no distance haze
if OUTSIDE and VARIANT == 'afternoon':
    os_ = {}; exec((ROOT / 'scripts/balcony-toon/outside.py').read_text(), os_)
    info.update(os_['apply'](T, env, bpy.data.node_groups[ns['GROUP']], OUTSIDE)); LOOK = {**LOOK, **os_['look'](OUTSIDE)}
cs['build'](T, p=LOOK, no_lines=[o.name for o in env.objects if o.get('source_name') in NO_LINES], character=[o.name for o in ch.objects if o.type == 'MESH'])
probe = bpy.data.objects['Toon • indoor light probe']


def step_bake():
    try:
        win = bpy.context.window_manager.windows[0]; win.scene = T
        with bpy.context.temp_override(window=win, scene=T, view_layer=T.view_layers[0], active_object=probe, object=probe, selected_objects=[probe]):
            bpy.ops.object.lightprobe_cache_bake(subset='ACTIVE')
        prog.write_text(json.dumps({'stage': 'baked'})); bpy.app.timers.register(step_render, first_interval=1.0)
    except Exception as e: prog.write_text(json.dumps({'stage': 'error', 'err': repr(e)}))


def step_render():
    t = time.time()
    try:
        bpy.context.window.scene = T; T.render.filepath = str(OUT); T.render.image_settings.file_format = 'PNG'
        bpy.ops.render.render(write_still=True)
        prog.write_text(json.dumps({'stage': 'done', 'sec': round(time.time() - t, 1), **info}))
    except Exception as e: prog.write_text(json.dumps({'stage': 'error', 'err': repr(e)}))


prog.write_text(json.dumps({'stage': 'built', **info})); bpy.app.timers.register(step_bake, first_interval=0.5)
