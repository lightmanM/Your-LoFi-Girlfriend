// Plays an authored clip (absolute normalized-bone rotations, authored-motions.json format) as an occasional event
// over the reading pose: eases from the current pose into the clip's first frame, plays it, eases back. While it
// runs the book rests on her lap. weight() is how much the clip owns the upper body (0..1).
import {Quaternion,MathUtils} from 'three';
import {sampleRotation,sampleScalar} from '../companion/source-motion.js';

const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
const qa=new Quaternion(),qb=new Quaternion();
// slow while she is still reading, faster as it nears the lap, then a soft touch-down
function putDown(x){
 const u=Math.pow(Math.min(1,x),1.7);
 return u*u*(3-2*u);
}
function pickUp(x){
 const u=Math.min(1,x),c=1.6;                                             // ease-out with a little overshoot (back)
 return 1+(c+1)*Math.pow(u-1,3)+c*Math.pow(u-1,2);
}

// Torso bones take the clip's motion relative to its first frame (the clip was authored over another seated pose and
// facing; its absolute torso would turn her to that facing). Arms, hands, fingers, neck and head play absolute.
const RELATIVE=new Set(['hips','spine','chest','upperChest']);
const SMOOTH=[[-.1,.1],[-.05,.2],[0,.4],[.05,.2],[.1,.1]];   // short temporal filter: softens snaps in the capture

export class ClipEvent{
 /** @param {object} clip one entry of authored-motions.json clips @param {{easeIn?:number,easeOut?:number,start?:number,end?:number}} o */
 // slow: [[from, to, rate]] clip-time spans played at another rate (e.g. 0.7 = slower)
 // pre/post: seconds before and after the clip with the clip weight at 0 (for putting a prop down and picking it up)
 // scale: {bone: s} bones played relative to the clip's first frame with their motion scaled by s
 // lead: {side, delay, peak}: that side's arm plays first and holds at clip time 'peak' while the other arm waits
 // 'delay' seconds and then follows (a one-arm stretch before the two-arm one); afterwards both play in step
 constructor(clip,{easeIn=1.8,easeOut=2.0,start=0,end=clip.duration,slow=[],pre=0,post=0,scale={},lead=null}={}){
  this.clip=clip;this.easeIn=easeIn;this.easeOut=easeOut;this.start=start;this.end=end;this.t=-1;this.slow=slow;
  this.pre=pre;this.post=post;this.scale=scale;this.lead=lead;
  this.played=(end-start)+slow.reduce((n,[a,b,r])=>n+(b-a)*(1/r-1),0)+(lead?lead.delay:0);
  this.length=pre+easeIn+this.played+easeOut+post;
  this.first=new Map(clip.tracks.map(t=>[t.bone,sampleRotation(clip.times,t.rotations,start).invert()]));
 }
 sample(track,time,out){
  out.set(0,0,0,0);let ref=null;
  for(const [dt,w] of SMOOTH){
   const q=sampleRotation(this.clip.times,track.rotations,MathUtils.clamp(time+dt,this.start,this.end));
   if(!ref)ref=q.clone();else if(q.dot(ref)<0)q.set(-q.x,-q.y,-q.z,-q.w);
   out.x+=q.x*w;out.y+=q.y*w;out.z+=q.z*w;out.w+=q.w*w;
  }
  return out.normalize();
 }
 get active(){return this.t>=0&&this.t<this.length;}
 begin(){this.t=0;}
 advance(dt){if(this.active)this.t+=dt;if(this.t>=this.length)this.t=-1;}
 /** clip time currently shown (held at the ends during the eases) */
 elapsed(){return MathUtils.clamp(this.t-this.pre-this.easeIn,0,this.played);}
 /** clip time for a bone: with a lead, the leading arm, the following arm and the rest of the body run apart at first */
 boneTime(bone){
  const L=this.lead;if(!L)return this.clipTime();
  const e=this.elapsed(),d=L.delay,P=L.peak;
  if(e>=P+d)return this.clipTime(e-d);
  const lead=Math.min(e,P),follow=Math.max(0,e-d),side=bone.startsWith('left')?'left':bone.startsWith('right')?'right':null;
  if(side===L.side)return this.clipTime(lead);
  if(side)return this.clipTime(follow+L.joinFrom);
  return this.clipTime((lead+follow)/2);
 }
 clipTime(played=null){
  let e=played??MathUtils.clamp(this.t-this.pre-this.easeIn,0,this.played-(this.lead?this.lead.delay:0)),c=this.start;
  if(played===null&&this.lead){const x=this.elapsed();e=x<this.lead.peak+this.lead.delay?Math.min(x,this.lead.peak):x-this.lead.delay;}
  for(const [a,b,r] of this.slow){
   if(c+e<=a)break;
   const before=a-c;e-=Math.max(0,before);c=a;
   const span=(b-a)/r;if(e<=span)return c+e*r;
   e-=span;c=b;
  }
  return Math.min(this.end,c+e);
 }
 weight(){
  if(!this.active)return 0;
  const out=this.t-(this.length-this.post-this.easeOut);
  return smooth((this.t-this.pre)/this.easeIn)*(1-smooth(out/this.easeOut));
 }
 /** progress through the played part, 0..1 (0 during ease-in, 1 during ease-out) */
 phase(){return this.active?MathUtils.clamp((this.t-this.pre-this.easeIn)/this.played,0,1):0;}
 /** 0..1 progress of the 'pre' part (put-down) and 1..0 through the 'post' part (pick-up); 1 in between */
 // Human timing rather than a steady glide: putting down starts with a small lift (k dips below 0, toward her face),
 // speeds up and slows into a soft landing; picking up is a quick lift that slows, overshoots a little and settles.
 carry(){
  if(!this.active)return 0;
  if(this.t<this.pre)return putDown(this.t/this.pre);
  const p=this.t-(this.length-this.post);return p>0?1-pickUp(p/this.post):1;
 }
 /** Blend the clip onto the normalized bones by weight (call after the base pose, before additive layers). */
 apply(vrm,w=this.weight()){
  if(w<=0)return;
  const v0=vrm.meta.metaVersion==='0';
  for(const track of this.clip.tracks){
   const node=vrm.humanoid.getNormalizedBoneNode(track.bone);if(!node)continue;
   this.sample(track,this.boneTime(track.bone),qb);

   const sc=this.scale[track.bone];
   if(sc!==undefined){qb.premultiply(this.first.get(track.bone));qb.slerp(qa.identity(),1-sc);qb.premultiply(qa.copy(node.quaternion));}  // pose * (first^-1*clip)^s
   else if(RELATIVE.has(track.bone))qb.premultiply(this.first.get(track.bone)).premultiply(qa.copy(node.quaternion));  // pose * first^-1 * clip
   if(v0&&!RELATIVE.has(track.bone)&&sc===undefined){qb.x=-qb.x;qb.z=-qb.z;}
   const side=track.bone.startsWith('left')?'left':track.bone.startsWith('right')?'right':null;
   node.quaternion.slerp(qb,side?w*this.armWeight(side):w);
  }
 }
 /** How much the clip owns one arm: the waiting arm (with a lead) stays where it was until it joins. */
 armWeight(side){
  const L=this.lead;if(!L||side===L.side)return 1;
  return smooth((this.elapsed()-L.delay+L.joinFrom)/L.join);
 }
 face(name){const f=this.clip.face?.[name];return f?sampleScalar(this.clip.times,f,this.clipTime())*this.weight():0;}
}
