import bpy,pathlib,json,sys,math
from mathutils import Vector
root=pathlib.Path(sys.argv[sys.argv.index('--')+1]);bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'marycia-working.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('bn0010_')];triangles=0
for o in meshes:o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
positions={b.name:list(arm.matrix_world@b.head_local) for b in arm.data.bones}
flat={}
for side in ['L','R']:
 points=[positions[f'{part}.{side}'] for part in ['Upper_arm','Lower_arm','Hand']]
 flat[side]=max(p[2] for p in points)-min(p[2] for p in points)
assert triangles==65113,(triangles,'triangle mismatch')
assert all(x<.002 for x in flat.values()),flat
assert all(math.isfinite(c) for p in positions.values() for c in p)
keys={o.name:len(o.data.shape_keys.key_blocks)-1 for o in meshes if o.data.shape_keys}
expected=json.loads((root/'marycia-working.export.json').read_text())['retainedMorphs']['bn0010_Face']
assert keys.get('bn0010_Face')==len(expected),keys
result={'triangles':triangles,'meshObjects':len(meshes),'armatureBones':len(arm.data.bones),'armHeightDeviationMeters':flat,'faceMorphs':keys,'imageCount':len(bpy.data.images),'finite':True}
(root/'marycia-working.reimport.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
