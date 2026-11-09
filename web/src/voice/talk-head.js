// Her head while she speaks: people are never quite still when they talk. Her head dips a little with the louder
// syllables (the line's loudness, smoothed, a moment after the sound) and sways slowly side to side, up and down and in
// tilt. Small enough that her face stays on you. Applied after the reader has aimed her head (so nothing cancels it)
// and before vrm.update(). talkingHead() is pure; applyHead() turns the head bone.
import {Quaternion,Vector3,MathUtils} from 'three';
import {loudness} from './lipsync.js';

export const HEAD=Object.freeze({
 beat:1.3,      // degrees her head dips at full loudness
 beatLag:.08,   // s the head follows the sound
 smooth:.12,    // s either side the loudness is averaged over: a soft dip, not a twitch
 drift:Object.freeze({yaw:.9,pitch:.4,roll:.7}),   // degrees of slow sway
});
const TAU=Math.PI*2;
const sway=(t,a,b,pa,pb)=>.6*Math.sin(TAU*t/a+pa)+.4*Math.sin(TAU*t/b+pb);   // -1..1, two incommensurate swells

/**
 * Head offsets (degrees: + yaw to her left, + pitch down, + roll) at `clip` s into the line's audio.
 * @param {{envelope?:{fps:number,values:number[]}}} line
 * @param {{weight?:number}} [o] weight 0..1: how much of it shows (fade it in as she starts, out after)
 * @returns {{yaw:number,pitch:number,roll:number,beat:number}} beat: the smoothed loudness driving the dips, 0..1
 */
export function talkingHead(line,clip,{weight=1}={},o=HEAD){
 const at=clip-o.beatLag,n=9;let beat=0,sum=0;
 for(let i=0;i<n;i++){const d=(i/(n-1)*2-1)*o.smooth,w=1-Math.abs(d)/o.smooth*.5;beat+=loudness(line,at+d)*w;sum+=w;}
 beat/=sum;
 if(weight<=0)return {beat,yaw:0,pitch:0,roll:0};
 const D=o.drift;
 return {beat,
  yaw:weight*D.yaw*sway(clip,3.1,5.3,.4,1.7),
  pitch:weight*(o.beat*beat+D.pitch*sway(clip,2.3,3.7,2.2,.6)),
  roll:weight*D.roll*sway(clip,4.1,6.7,1.1,2.9)};
}

const q=new Quaternion(),X=new Vector3(1,0,0),Y=new Vector3(0,1,0),Z=new Vector3(0,0,1),r=MathUtils.degToRad;
/** Turn her head bone by the offsets (on top of whatever the reader set this frame). */
export function applyHead(vrm,{yaw,pitch,roll}){
 const head=vrm.humanoid.getNormalizedBoneNode('head');if(!head)return;
 head.quaternion.multiply(q.setFromAxisAngle(Y,r(yaw))).multiply(q.setFromAxisAngle(X,r(pitch))).multiply(q.setFromAxisAngle(Z,r(roll)));
}
