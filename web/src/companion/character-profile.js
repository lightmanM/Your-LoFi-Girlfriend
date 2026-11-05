// Costume-specific corrections belong here, not in reusable scene/action scripts.
export function applySeatedProfile(vrm,profile='generic'){
 if(profile!=='vivi'||!vrm.springBoneManager)return;
 // Vivi's front/back skirt bones are already parented to the thighs. Keep that
 // skinning for this seated pose instead of letting standing-only springs fall
 // through the legs. Hair, sleeves and other springs remain active.
 for(const joint of [...vrm.springBoneManager.joints]){
  if(/^J_Sec_[LR]_Skirt/.test(joint.bone.name))vrm.springBoneManager.deleteJoint(joint);
 }
}
