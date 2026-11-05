# Portable source-curve conversion, using Unidot's Apache-2.0 humanoid decoder.
# Unity-runtime parity is not assumed; validate the result on the destination rig.
extends SceneTree
const Traits=preload("vendor/unidot/human_trait.gd")
const Decode=preload("vendor/unidot/transform_util.gd")
var profile=SkeletonProfileHumanoid.new()
var indices={}
var rest_world={}
var rest_q={}
var names=[]
var allowed={}
func _initialize():
 var args=OS.get_cmdline_user_args()
 var data=JSON.parse_string(FileAccess.get_file_as_string(args[0]))
 for i in profile.bone_size:
  var name=String(profile.get_bone_name(i));indices[name]=i;names.append(name)
  var par=String(profile.get_bone_parent(i));var rest=profile.get_reference_pose(i)
  rest_world[name]=rest if par=="" else rest_world[par]*rest
  rest_q[name]=rest_world[name].basis.get_rotation_quaternion().normalized()
  if name not in ["Root","UpperChest","Jaw"]:allowed[name]=true
 for id in data.clips:
  var clip=data.clips[id]
  var tracks={}
  var has_body=clip.muscles.has("Spine Front-Back")
  var affected={}
  for b in Traits.BoneCount:
   for m in Traits.MuscleFromBone[b]:
    if m>=0 and clip.muscles.has(Traits.MuscleName[m]):affected[Traits.GodotHumanNames[b]]=true
  if has_body:affected["Hips"]=true
  for name in affected:
   if allowed.has(name):tracks[name.substr(0,1).to_lower()+name.substr(1)]=[]
  for frame in clip.times.size():
   var muscles=[];muscles.resize(Traits.BoneCount)
   for b in Traits.BoneCount:
    var v=Vector3.ZERO
    for axis in 3:
     var m=Traits.MuscleFromBone[b][axis]
     if m>=0:v[axis]=float(clip.muscles.get(Traits.MuscleName[m],[0.0])[frame] if clip.muscles.has(Traits.MuscleName[m]) else 0)
    muscles[b]=v
   var local_pose={}
   for b in Traits.BoneCount:
    var v=muscles[b];var pre=Quaternion.IDENTITY
    var donor=int(Traits.extraAffectedByBones.get(b,-1))
    if donor!=-1:
     v.x*=.5;pre=Decode.calculate_humanoid_rotation(donor,Vector3(muscles[donor].x*.5,0,0),true)
    local_pose[Traits.GodotHumanNames[b]]=(pre*Decode.calculate_humanoid_rotation(b,v)).normalized()
   var world={}
   for name in names:
    var par=String(profile.get_bone_parent(indices[name]));var t=profile.get_reference_pose(indices[name])
    t.basis=Basis(local_pose.get(name,t.basis.get_rotation_quaternion()))
    world[name]=t if par=="" else world[par]*t
   if has_body and clip.muscles.has("RootQ.w"):
    var q=Quaternion(clip.muscles["RootQ.x"][frame],-clip.muscles["RootQ.y"][frame],-clip.muscles["RootQ.z"][frame],clip.muscles["RootQ.w"][frame]).normalized()
    var x:Vector3=(world.LeftUpperArm.origin+world.LeftUpperLeg.origin)-(world.RightUpperArm.origin+world.RightUpperLeg.origin)
    var y:Vector3=(world.LeftUpperArm.origin+world.RightUpperArm.origin)-(world.LeftUpperLeg.origin+world.RightUpperLeg.origin)
    x=x.normalized();y=y.normalized();var z=x.cross(y).normalized();x=y.cross(z)
    var correction=(q*Basis(x,y,z).get_rotation_quaternion().inverse()).normalized()
    for name in names:
     if name!="Root":world[name]=Transform3D(Basis(correction),Vector3.ZERO)*world[name]
   for name in affected:
    if not allowed.has(name):continue
    var par=String(profile.get_bone_parent(indices[name]))
    while par!="" and not allowed.has(par):par=String(profile.get_bone_parent(indices[par]))
    var delta:Quaternion=(world[name].basis.get_rotation_quaternion()*rest_q[name].inverse()).normalized()
    if par!="":
     var pd:Quaternion=(world[par].basis.get_rotation_quaternion()*rest_q[par].inverse()).normalized()
     delta=(pd.inverse()*delta).normalized()
    tracks[name.substr(0,1).to_lower()+name.substr(1)].append_array([delta.x,delta.y,delta.z,delta.w])
  clip["tracks"]=[]
  for bone in tracks:clip.tracks.append({"bone":bone,"rotations":tracks[bone]})
  clip["rootTranslationPolicy"]="Seat anchored; source RootT retained in extraction only."
  clip.erase("muscles")
 data["source"]="Marycia 1.5.1 supplied Unity clips / ©BeroarN"
 data["conversion"]={"decoder":"Unidot humanoid Apache-2.0","upstreamCommit":"9719eaa2c5ac10c6444800913a06f28934f4dc34","reference":"Godot 4.4.1 SkeletonProfileHumanoid","coordinateFrame":"normalized VRM1","unityParityVerified":false}
 var out=FileAccess.open(args[1],FileAccess.WRITE);out.store_string(JSON.stringify(data));out.close()
 print("Converted ",data.clips.size()," supplied clips to ",args[1]);quit()
