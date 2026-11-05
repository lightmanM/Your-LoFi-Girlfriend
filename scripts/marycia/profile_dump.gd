extends SceneTree
func _initialize():
 var p=SkeletonProfileHumanoid.new()
 var rows=[]
 for i in p.bone_size:
  var t=p.get_reference_pose(i)
  var q=t.basis.get_rotation_quaternion()
  rows.append({"name":p.get_bone_name(i),"parent":p.get_bone_parent(i),"position":[t.origin.x,t.origin.y,t.origin.z],"rotation":[q.x,q.y,q.z,q.w]})
 var f=FileAccess.open(OS.get_cmdline_user_args()[0],FileAccess.WRITE)
 f.store_string(JSON.stringify(rows,"  "));quit()
