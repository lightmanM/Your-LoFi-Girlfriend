"""Render the baked shot from a saved .blend, headless:

  blender -b <file.blend> -P render.py -- --view product|close --out DIR [--start 1 --end 465] [--height 720]

product: the page's own camera and framing (16:9).  close: the same camera cropped square on her, lap to raised
hands, with the foreground plant hidden, to judge the motion itself.
"""
import argparse
import sys
import bpy

SCENE, PLANT = 'Balcony • Stretch anim (Claude)', 'moxing0042.002'
CLOSE_WIDEN, CLOSE_DOWN = 1.15, -0.085


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--view', default='product')
    ap.add_argument('--out', required=True)
    ap.add_argument('--start', type=int)
    ap.add_argument('--end', type=int)
    ap.add_argument('--height', type=int, default=720)
    ap.add_argument('--samples', type=int)
    a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])
    s = bpy.data.scenes[SCENE]
    bpy.context.window.scene = s
    r = s.render
    r.resolution_percentage = 100
    r.resolution_y = a.height
    r.resolution_x = a.height * 16 // 9
    if a.view == 'close':
        cam = s.camera.copy(); cam.data = s.camera.data.copy()
        s.collection.objects.link(cam)
        # the page's camera, cropped square on her: a little wider than the 16:9 frame is high and moved over and
        # down, so her lap and her raised hands are both in the picture
        cam.data.sensor_fit = 'VERTICAL'
        cam.data.sensor_height = cam.data.sensor_width * 9 / 16 * CLOSE_WIDEN
        cam.data.shift_x = 0.40 / CLOSE_WIDEN
        cam.data.shift_y = CLOSE_DOWN
        s.camera = cam
        r.resolution_x = a.height
        bpy.data.objects[PLANT].hide_render = True
    # the toon compositor was built for the empty backdrop scene: give this scene its own copy that reads this scene
    tree = s.compositing_node_group.copy()
    s.compositing_node_group = tree
    for n in tree.nodes:
        if getattr(n, 'scene', None) is not None:
            n.scene = s
    if a.samples:
        s.eevee.taa_render_samples = a.samples
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGB'
    r.filepath = a.out.rstrip('/') + '/f_'
    r.use_overwrite = False            # a relaunch only renders the frames that are missing
    s.frame_start = a.start or s.frame_start
    s.frame_end = a.end or s.frame_end
    bpy.ops.render.render(animation=True)


main()
