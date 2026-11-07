"""Export the fitted reading chair with visible PBR materials; keep source meshes intact.
Run inside Blender with ROOT set to this checkout. The previous depth proxy stays available.
"""
import bpy,json
from pathlib import Path
ROOT=Path(globals()['ROOT']);OUT=ROOT/'web/public/environment/balcony-toon';OUT.mkdir(parents=True,exist_ok=True)
source=bpy.data.scenes['Balcony • Reading v2 (Claude)'];previous=bpy.context.window.scene
scene=bpy.data.scenes.new('Balcony • visible chair export');made=[];images=[];materials=[]
try:
 bpy.context.window.scene=source;bpy.context.view_layer.update()
 for old in source.objects:
  if not old.name.startswith('Reading chair'):continue
  obj=old.copy();obj.data=old.data.copy();obj.parent=None;obj.matrix_world=old.matrix_world.copy();obj.animation_data_clear();obj.hide_render=False;obj.hide_viewport=False
  scene.collection.objects.link(obj);made.append(obj)
  obj.data.validate(verbose=False);obj.data.update()
  oldmat=old.data.materials[0];image=next(n.image for n in oldmat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
  # Load the user-supplied albedo into an owned, bounded copy; don't resize source textures.
  path=Path('<checkout>/assets/environment/Balcony/tex')/image.name
  tex=bpy.data.images.load(str(path),check_existing=False);tex.name='Visible chair • '+image.name
  w,h=tex.size;tex.scale(1024,max(1,round(h*1024/w)));tex.pack();images.append(tex)
  mat=bpy.data.materials.new('Visible chair • '+old.get('source_name',old.name));mat.use_nodes=True;materials.append(mat)
  bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Roughness'].default_value=.82
  node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=tex;mat.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
  obj.data.materials.clear();obj.data.materials.append(mat)
 bpy.context.window.scene=scene
 for obj in made:obj.select_set(True)
 bpy.context.view_layer.objects.active=made[0]
 path=OUT/'chair-visible.glb'
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_cameras=False,export_lights=False,export_animations=False,export_yup=True)
 stats={'asset':path.name,'source_scene':source.name,'meshes':len(made),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in made),'texture_sizes':[list(i.size) for i in images],'bytes':path.stat().st_size,'coordinates':'Blender Z-up to glTF Y-up; original fitted world transforms preserved','note':'Visible chair replaces the depth-only proxy; source Blender scene unchanged.'}
 (OUT/'chair-visible.export.json').write_text(json.dumps(stats,indent=2));print(json.dumps(stats))
finally:
 bpy.context.window.scene=previous
 for obj in made:
  mesh=obj.data;bpy.data.objects.remove(obj,do_unlink=True)
  if mesh.users==0:bpy.data.meshes.remove(mesh)
 bpy.data.scenes.remove(scene)
 for m in materials:
  if m.users==0:bpy.data.materials.remove(m)
 for i in images:
  if i.users==0:bpy.data.images.remove(i)
