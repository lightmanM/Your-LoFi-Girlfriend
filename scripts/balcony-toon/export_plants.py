"""Export the swaying balcony plants as light 3D meshes for the web (positions only; their colour comes from the
rendered picture at their rest position, by camera projection). Live Blender via MCP:
  exec(open('scripts/balcony-toon/export_plants.py').read(), {'OUT': '<balcony-toon folder>', 'RATIO': {...}})
Writes <OUT>/plants.glb with one node per object, named '<group>:<source name>'. Source meshes are never edited."""
import bpy, json, pathlib
OUT = pathlib.Path(globals()['OUT'])
GROUPS = {'roses': ['moxing0043'], 'ivy': ['moxing1015', 'moxing1016', 'moxing1019'],
          'pots': ['moxing1064', 'moxing1066', 'moxing1067', 'moxing1068', 'moxing1071', 'moxing1072', 'moxing1073', 'moxing1074',
                   'moxing1075', 'moxing1076', 'moxing1077', 'moxing1079', 'moxing1080', 'moxing0035_1', 'moxing1083', 'moxing1084',
                   'moxing1087', 'moxing1088', 'moxing1089', 'moxing1090', 'moxing1091', 'moxing1092', 'moxing1093', 'moxing1094', 'moxing1095']}
TARGET = globals().get('TARGET', {'roses': 105000, 'ivy': 75000, 'pots': 220000})   # triangles per group
FLOOR = 5000        # small objects keep at least this many triangles (decimation erases small leaves first)
env = bpy.data.collections['Toon • environment (Claude)']
src = {o.get('source_name'): o for o in env.objects if o.type == 'MESH'}
tmp = bpy.data.scenes.new('Toon • plant export (Claude)'); made = []; stats = {}
try:
    for g, names in GROUPS.items():
        objs = [src[n] for n in names if n in src]
        tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)
        ratio = min(1.0, TARGET[g] / max(tris, 1)); stats[g] = {'objects': len(objs), 'tris': tris, 'ratio': round(ratio, 4)}
        for o in objs:
            c = bpy.data.objects.new(f"{g}:{o.get('source_name')}", o.data); tmp.collection.objects.link(c)
            c.matrix_world = o.matrix_world.copy(); made.append(c)
            n = sum(len(p.vertices) - 2 for p in o.data.polygons); r = min(1.0, max(ratio, FLOOR / max(n, 1)))
            if r < 1:
                d = c.modifiers.new('decimate', 'DECIMATE'); d.ratio = r; d.use_collapse_triangulate = True
    win = bpy.context.window; prev = win.scene; win.scene = tmp
    bpy.context.view_layer.update()
    for o in made: o.select_set(True)
    bpy.context.view_layer.objects.active = made[0]
    bpy.ops.export_scene.gltf(filepath=str(OUT / 'plants.glb'), export_format='GLB', use_selection=True, use_active_scene=True,
                              export_apply=True, export_yup=True, export_materials='NONE', export_normals=False, export_texcoords=False,
                              export_attributes=False, export_cameras=False, export_lights=False, export_animations=False)
    win.scene = prev
    stats['bytes'] = (OUT / 'plants.glb').stat().st_size
finally:
    for o in made: bpy.data.objects.remove(o)
    bpy.data.scenes.remove(tmp)
print(json.dumps(stats))
