"""Create a separate, T-posed working GLB. Run with Blender --background --disable-autoexec.
Usage: --python export_blender.py -- --source <extracted/Assets/.../bn0010_Marycia> --output <dir>
"""
import bpy,sys,argparse,json,re,pathlib,math
import numpy as np
from mathutils import Vector,Matrix
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);src=pathlib.Path(a.source);out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(src/'fbx/bn0010_Marycia.fbx'),use_anim=False)
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
bpy.ops.wm.save_as_mainfile(filepath=str(out/'marycia-imported.blend'))
# Apply the creator's static clothing-fit preset, retaining human face/teeth.
s=(src/'animation/Anim/bn0010_FX_Base.anim').read_text()
s=s[s.index('  m_FloatCurves:'):s.index('  m_PPtrCurves:')]
static={}
for c in re.split(r'\n  - serializedVersion: 2\n    curve:',s)[1:]:
    attr=re.search(r'    attribute: blendShape\.(.+)',c);path=re.search(r'    path: (.+)',c);v=re.search(r'        value: (.+)',c)
    if attr and path and v and float(v[1]) and path[1]!='bn0010_Face':static.setdefault(path[1],{})[attr[1]]=float(v[1])/100
static.update({'bn0010_Hair':{'Cat_OFF':1,'HumanEar_ON':1},'bn0010_Face':{'Eye_Shadow_OFF':1}})
static.setdefault('bn0010_CosA',{})['Cat_OFF']=1
for name in ['bn0010_Cat_Ear','bn0010_Cat_Tail']:bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
# Bake customization deltas into every retained shape so appearance stays fixed during expressions.
retained={}
for o in [o for o in bpy.context.scene.objects if o.type=='MESH']:
    keys=o.data.shape_keys
    if not keys:continue
    n=len(o.data.vertices);base=np.empty(n*3,dtype=np.float32);keys.key_blocks[0].data.foreach_get('co',base)
    offset=np.zeros_like(base)
    for k,v in static.get(o.name,{}).items():
        if k in keys.key_blocks:
            d=np.empty_like(base);keys.key_blocks[k].data.foreach_get('co',d);offset+=(d-base)*v
    for k in keys.key_blocks:
        d=np.empty_like(base);k.data.foreach_get('co',d);k.data.foreach_set('co',d+offset);k.value=0
    keep=[]
    if o.name=='bn0010_Face':
        # Retain deforming facial keys for the creator's supplied MMD/ARKit curves.
        keep=[]
        for k in keys.key_blocks[1:]:
            if k.name in static.get(o.name,{}):continue
            d=np.empty_like(base);k.data.foreach_get('co',d)
            if np.max(np.abs(d-(base+offset)))>1e-7:keep.append(k.name)
    for k in list(keys.key_blocks)[::-1]:
        if k.name!='Basis' and k.name not in keep:o.shape_key_remove(k)
    retained[o.name]=keep
# Pose each arm chain horizontally; helper twist bones follow their existing parents.
for side,sign in [('L',1),('R',-1)]:
    for prefix in ['Upper_arm','Lower_arm','Hand']:
        bone=arm.pose.bones[f'{prefix}.{side}'];bpy.context.view_layer.update()
        direction=(bone.tail-bone.head).normalized();q=direction.rotation_difference(Vector((sign,0,0)))
        bone.matrix=Matrix.Translation(bone.head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-bone.head) @ bone.matrix
        bpy.context.view_layer.update()
# Bake linear skinning into all shape keys, then use that pose as the new rest pose.
# This preserves morph deltas; applying an Armature modifier directly would discard them.
for o in [o for o in bpy.context.scene.objects if o.type=='MESH']:
    n=len(o.data.vertices);matrices=np.zeros((n,4,4),dtype=np.float64);weights=np.zeros(n)
    basis=o.matrix_world.inverted() @ arm.matrix_world
    group_mats={g.index:np.array(basis @ arm.pose.bones[g.name].matrix @ arm.data.bones[g.name].matrix_local.inverted() @ basis.inverted()) for g in o.vertex_groups if g.name in arm.pose.bones}
    for v in o.data.vertices:
        for g in v.groups:
            if g.group in group_mats:matrices[v.index]+=group_mats[g.group]*g.weight;weights[v.index]+=g.weight
    valid=weights>1e-8;matrices[valid]/=weights[valid,None,None];matrices[~valid]=np.eye(4)
    custom_normals=np.array([v.vector[:] for v in o.data.corner_normals]) if o.data.has_custom_normals else None
    blocks=list(o.data.shape_keys.key_blocks) if o.data.shape_keys else []
    for data in [k.data for k in blocks] if blocks else [o.data.vertices]:
        co=np.empty(n*3,dtype=np.float32);data.foreach_get('co',co);co=co.reshape(n,3)
        transformed=np.einsum('nij,nj->ni',matrices,np.column_stack((co,np.ones(n))))[:,:3]
        data.foreach_set('co',transformed.astype(np.float32).ravel())
    if blocks:o.data.vertices.foreach_set('co',np.array([v.co[:] for v in blocks[0].data],dtype=np.float32).ravel())
    o.data.update()
    if custom_normals is not None:
        ids=np.array([loop.vertex_index for loop in o.data.loops]);normal_mats=np.linalg.inv(matrices[ids,:3,:3]).transpose(0,2,1)
        normals=np.einsum('nij,nj->ni',normal_mats,custom_normals);normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-12)
        o.data.normals_split_custom_set(normals.tolist())
bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='POSE');bpy.ops.pose.armature_apply(selected=False);bpy.ops.object.mode_set(mode='OBJECT')
# Rebuild portable base-color materials. Unity lilToon masks/lighting are not exported verbatim.
guid_paths={}
for meta in src.rglob('*.meta'):
    m=re.search(r'^guid: (.+)$',meta.read_text(),re.M)
    if m:guid_paths[m[1]]=meta.with_suffix('')
textures={};materials={}
for mat in bpy.data.materials:
    path=src/'material'/f'{mat.name}.mat'
    if not path.exists():continue
    s=path.read_text();m=re.search(r'    - _MainTex:\n        m_Texture:.*guid: ([0-9a-f]+)',s)
    texpath=guid_paths[m[1]]
    if texpath not in textures:
        im=bpy.data.images.load(str(texpath),check_existing=True);im.scale(2048,2048);im.filepath_raw=str(out/(texpath.stem+'-2k.png'));im.file_format='PNG';im.save();im.pack();textures[texpath]=im
    mat.use_nodes=True;mat.node_tree.nodes.clear();nodes=mat.node_tree.nodes;links=mat.node_tree.links
    output=nodes.new('ShaderNodeOutputMaterial');bsdf=nodes.new('ShaderNodeBsdfPrincipled');tex=nodes.new('ShaderNodeTexImage');tex.image=textures[texpath]
    links.new(tex.outputs['Color'],bsdf.inputs['Base Color']);links.new(bsdf.outputs['BSDF'],output.inputs['Surface']);bsdf.inputs['Roughness'].default_value=.85
    transparent=mat.name.endswith('_Ad') or mat.name.endswith('_Front')
    if transparent:
        links.new(tex.outputs['Alpha'],bsdf.inputs['Alpha']);mat.surface_render_method='DITHERED'
    mat.use_backface_culling=True
    materials[mat.name]={'transparent':transparent,'texture':texpath.name,'shadeColor':[1,.906,.872] if 'Skin'in mat.name else [1,.894,.797]}
# Blender -Y forward exports to glTF/VRM1 +Z; keep the imported facing direction.
bpy.context.view_layer.update()
for o in bpy.context.scene.objects:
    if o.type=='MESH':
        world=o.matrix_world.copy();o.parent=arm;o.matrix_world=world
# Importer mapping is useful data, not Unity executable setup.
meta=(src/'fbx/bn0010_Marycia.fbx.meta').read_text();mapping=re.findall(r'\s+boneName: (.+)\n\s+humanName: (.+)',meta)
report={'source':'Marycia 1.5.1 purchased package','generator':'Blender '+bpy.app.version_string,'humanoidMapping':mapping,'materials':materials,'retainedMorphs':retained,'staticAppearance':static,'triangles':sum(len(o.data.loop_triangles) for o in bpy.context.scene.objects if o.type=='MESH'),'notes':['T-pose baked across mesh and retained morphs','Human ears; cat ears and tail omitted','Base color 2K textures; MToon configured by package_vrm.py','Spring approximation; Unity constraints and physics not exported']}
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(out/'marycia-working.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'marycia-working.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_skins=True,export_def_bones=False,export_morph=True,export_morph_normal=False,export_morph_tangent=False,export_yup=True)
(out/'marycia-working.export.json').write_text(json.dumps(report,indent=2));print('MARYCIA_EXPORT_COMPLETE',flush=True)
