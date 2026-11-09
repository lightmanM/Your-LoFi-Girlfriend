"""Contact-led static rest studies, with two-bone IK and explicit limb roll.

New scenes preserve previous previews. No runtime clips are modified.
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/motion'))
import blender_bridge as bridge
BASE=bpy.data.scenes['LoFi • Rainy evening • Refresh']
LIB=json.loads((ROOT/'web/public/models/marycia/source-motions.json').read_text())

def update(): bpy.context.view_layer.update()
def head(a,n): return a.pose.bones[n].matrix.to_translation().copy()
def orient(a,n,direction,guide,guide_axis='Z'):
    p=a.pose.bones[n];pos=head(a,n);y=Vector(direction).normalized();g=Vector(guide)
    g=(g-y*g.dot(y)).normalized()
    if guide_axis=='Z':z=g;x=y.cross(z).normalized();z=x.cross(y)
    else:x=g;z=x.cross(y).normalized();x=y.cross(z)
    m=Matrix((x,y,z)).transposed().to_4x4();m.translation=pos;p.matrix=m;update()

def limb(a,upper,lower,end,target,pole,side,leg=False):
    h=head(a,upper);target=Vector(target);pole=Vector(pole)
    l1=(a.data.bones[lower].head_local-a.data.bones[upper].head_local).length
    l2=(a.data.bones[end].head_local-a.data.bones[lower].head_local).length
    delta=target-h;distance=delta.length
    if not abs(l1-l2)+.002 < distance < l1+l2-.002:
        raise ValueError(f'{upper} unreachable target: {distance:.4f}, lengths {l1:.4f},{l2:.4f}')
    axis=delta.normalized();bend=pole-h;bend=(bend-axis*bend.dot(axis)).normalized()
    along=(l1*l1-l2*l2+distance*distance)/(2*distance)
    elbow=h+axis*along+bend*math.sqrt(max(0,l1*l1-along*along))
    u=(elbow-h).normalized();v=(target-elbow).normalized()
    if leg:
        orient(a,upper,u,(1,0,0),'X');orient(a,lower,target-head(a,lower),(1,0,0),'X')
    else:
        normal=u.cross(v).normalized()*(-side)
        orient(a,upper,u,normal);orient(a,lower,target-head(a,lower),normal)
    return (head(a,end)-target).length

def turn(a,n,axis,degrees):
    p=a.pose.bones[n];m=p.matrix.copy();h=m.to_translation()
    p.matrix=Matrix.Translation(h)@Quaternion(Vector(axis),math.radians(degrees)).to_matrix().to_4x4()@Matrix.Translation(-h)@m;update()

def clone_collection(scene,name):
    original=bpy.data.collections[name];scene.collection.children.unlink(original)
    clone=bpy.data.collections.new(name+' / contact study');scene.collection.children.link(clone)
    for obj in original.objects:
        o=obj.copy();clone.objects.link(o)
    return clone

def make(kind):
    name='Room refresh • '+kind+' contact study';assert name not in bpy.data.scenes
    scene=BASE.copy();scene.name=name;bpy.context.window.scene=scene
    col=bpy.data.collections.new('Contact study / '+kind);scene.collection.children.link(col)
    with bpy.data.libraries.load(str(ROOT/'assets/characters/marycia/marycia-working.blend'),link=False) as (src,dst):dst.objects=src.objects
    for o in dst.objects:col.objects.link(o)
    for o in col.objects:
        for modifier in o.modifiers:
            if modifier.type=='ARMATURE':modifier.use_deform_preserve_volume=True
    a=next(o for o in col.objects if o.type=='ARMATURE');a.animation_data_clear()
    for p in a.pose.bones:p.rotation_mode='QUATERNION';p.matrix_basis=Matrix.Identity(4)
    # Keep supplied relaxed finger articulation as a basis, not its wrist rotations.
    fingers={k:v for k,v in bridge.clip_frame(LIB['clips']['handsIdle'],0).items() if any(t in k.lower() for t in ['thumb','index','middle','ring','little'])}
    bridge.apply_deltas(a,bridge.humanoid_map(),fingers)
    for p in a.pose.bones:
        if any(n in p.name for n in ['Index','Middle','Ring','Little']):
            angle=16 if 'Proximal' in p.name else 12 if 'Intermediate' in p.name else 8
            p.rotation_quaternion=Quaternion((1,0,0),math.radians(-angle))
    update()
    residuals={}
    scale=1.25
    if kind=='sofa':
        furniture=clone_collection(scene,'Refresh / Sofa')
        for o in furniture.objects:o.location.z*=.82;o.scale.z*=.82
        for o in furniture.objects:
            if o.name.startswith('Sofa soft arm') and o.location.x>0:o.location.z=.62*.90;o.scale.z=.90
        # Pelvis seated, thorax slightly reclined and asymmetrical, chin level.
        turn(a,'Spine',(1,0,0),-5);turn(a,'Chest',(0,1,0),-3)
        turn(a,'Head',(1,0,0),4);turn(a,'Head',(0,0,1),-5)
        rootloc=Vector((.40,.94,.68-.75033897*scale))
        local=lambda world:(Vector(world)-rootloc)/scale
        for side,sgn,x,y in [('L',1,.52,.52),('R',-1,.28,.57)]:
            residuals['ankle'+side]=limb(a,'Upper_leg.'+side,'Lower_leg.'+side,'Foot.'+side,local((x,y,.112)),local((x,.28,.50)),sgn,True)
            # Soles parallel to floor: restore original absolute foot orientation.
            p=a.pose.bones['Foot.'+side];m=a.data.bones[p.name].matrix_local.copy();m.translation=head(a,p.name);p.matrix=m
            a.pose.bones['Toe.'+side].matrix_basis=Matrix.Identity(4);update()
        for side,sgn,target,pole,direction in [
            ('L',1,(.80,.78,.81),(.69,.99,.85),(.0,-1,-.06)),
            ('R',-1,(.26,.77,.64),(.08,.90,.82),(.0,-1,-.12))]:
            residuals['wrist'+side]=limb(a,'Upper_arm.'+side,'Lower_arm.'+side,'Hand.'+side,local(target),local(pole),sgn)
            orient(a,'Hand.'+side,direction,(0,0,1))
        rotation=Matrix.Identity(3)
    else:
        furniture=clone_collection(scene,'Refresh / Bed')
        for o in list(furniture.objects):
            if o.name.startswith(('Rose bed throw','Bed throw fringe')):furniture.objects.unlink(o)
            elif o.name.startswith('Linen pillow'):o.location.y=1.0;o.location.z=.62;o.scale.z*=.60
            elif o.name.startswith('Rose pillow'):o.location.y+=.14
        # Side sleeping with modest, staggered knee flexion; no compressed fetal curl.
        for side,sgn,target,pole in [('L',1,(-.025,.025,.14),(-.025,-.27,.38)),('R',-1,(-.09,.045,.10),(-.09,-.26,.39))]:
            residuals['ankle'+side]=limb(a,'Upper_leg.'+side,'Lower_leg.'+side,'Foot.'+side,target,pole,sgn,True)
            p=a.pose.bones['Foot.'+side];m=a.data.bones[p.name].matrix_local.copy();m.translation=head(a,p.name);p.matrix=m;update()
        for side,sgn,target,pole,direction,dorsal in [
            ('L',1,(-.055,-.24,.88),(.11,-.13,.76),(0,-.15,.98),(1,0,0)),
            ('R',-1,(-.065,-.24,.96),(-.09,-.25,.85),(0,.10,.98),(1,0,0))]:
            residuals['wrist'+side]=limb(a,'Upper_arm.'+side,'Lower_arm.'+side,'Hand.'+side,target,pole,sgn)
            orient(a,'Hand.'+side,direction,dorsal)
        turn(a,'Neck',(0,1,0),8);turn(a,'Head',(1,0,0),12)
        for o in col.objects:
            if o.type=='MESH' and o.data.shape_keys:
                for key in ['eyeBlinkLeft','eyeBlinkRight']:
                    if key in o.data.shape_keys.key_blocks:o.data.shape_keys.key_blocks[key].value=1
        rotation=Matrix(((0,1,0),(0,0,1),(1,0,0)))
        rootloc=Vector((1.55,.43,.77))-rotation@Vector((0,0,.75033897*scale))
    root=bpy.data.objects.new('Contact placement / '+kind,None);col.objects.link(root)
    for o in list(col.objects):
        if o!=root and o.parent is None:o.parent=root
    root.scale=(scale,)*3;root.rotation_mode='QUATERNION';root.rotation_quaternion=rotation.to_quaternion();root.location=rootloc;update()
    scene['ik_endpoint_residuals']=json.dumps(residuals)
    # Independent inspection camera; original room camera remains untouched.
    cam=scene.camera.copy();cam.data=cam.data.copy();col.objects.link(cam);cam.name='Contact inspection / '+kind
    if kind=='sofa':location=(1.4,-2.8,1.55);target=(.35,.85,.70);cam.data.lens=60
    else:location=(.0,-1.5,2.45);target=(1.45,.40,.76);cam.data.lens=56
    cam.location=location;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
    scene.render.resolution_x=1000;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.cycles.samples=24
    scene.render.filepath=str(ROOT/f'docs/room-refresh/{kind}-contact-01.png')
    return scene

sofa=make('sofa');bed=make('bed')
queue=[sofa,bed]
def render_next():
    if not queue:return None
    s=queue.pop(0);bpy.context.window.scene=s;bpy.ops.render.render(write_still=True)
    return 1 if queue else None
bpy.app.timers.register(render_next,first_interval=.5)
print('Contact-led static poses built; inspection renders queued.')
