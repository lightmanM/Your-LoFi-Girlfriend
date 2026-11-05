import {AnimationClip,QuaternionKeyframeTrack,VectorKeyframeTrack,Vector3} from 'three';

// Source JSON is in a T-pose-normalized VRM 1 frame, independent of raw bone names.
export function retargetClip(source,library,vrm){
 const tracks=[];const legacy=vrm.meta.metaVersion==='0';
 for(const track of source.tracks){
  const node=vrm.humanoid.getNormalizedBoneNode(track.bone);if(!node)continue;
  const values=track.rotations.map((v,i)=>legacy&&(i%4===0||i%4===2)?-v:v);
  tracks.push(new QuaternionKeyframeTrack(`${node.uuid}.quaternion`,source.times,values));
 }
 const hips=vrm.humanoid.getNormalizedBoneNode('hips');
 vrm.scene.updateMatrixWorld(true);
 const hipHeight=hips.getWorldPosition(new Vector3()).y-vrm.scene.position.y;
 const ratio=hipHeight/library.sourceHipHeight;
 const positions=source.hipPositions.map((v,i)=>i%3===1?hips.position.y+(v-library.sourceHipHeight)*ratio:hips.position.getComponent(i%3));
 tracks.push(new VectorKeyframeTrack(`${hips.uuid}.position`,source.times,positions));
 return new AnimationClip(source.name,source.duration,tracks);
}
