// Small turns on the reading pose for a stand-in character (standin.json `poseFix`): degrees about x, y, z in each bone's
// own frame, applied after the pose's rotation. Characters differ in proportions (Vivi's chest is longer than
// Marycia's), so the same pose would leave her hands short of the book or her face off the camera.
import {Quaternion,Euler,MathUtils} from 'three';

/**
 * @param {{tracks:{bone:string,rotations:number[]}[]}} pose @param {Object<string,number[]>} fix bone → [x,y,z] degrees
 * @returns {object} a new pose (the one given is not changed)
 */
export function withPoseFix(pose,fix={}){
 if(!Object.keys(fix).length)return pose;
 return {...pose,tracks:pose.tracks.map(t=>{
  const f=fix[t.bone];if(!f)return t;
  const turn=new Quaternion().setFromEuler(new Euler(...f.map(MathUtils.degToRad)));
  return {...t,rotations:new Quaternion().fromArray(t.rotations).multiply(turn).toArray()};
 })};
}
