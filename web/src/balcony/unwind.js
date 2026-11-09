// A short break from reading, in place of the overhead stretch: she lowers the book to her lap (her hands stay on it),
// rolls her shoulders back twice with a breath in, tilts her head to one side and then the other with her eyes closed,
// breathes out, and lifts the book again. Procedural offsets on the normalized bones; the same interface the reader
// used for the stretch clip (weight, carry, apply, armWeight, face), so the book put-down and pick-up are unchanged.
import {Quaternion,Vector3,MathUtils} from 'three';

export const UNWIND=Object.freeze({
 pre:2.3,easeIn:.8,easeOut:.8,post:1.7,    // s: book down, into the break, out of it, book up
 roll:Object.freeze({count:2,period:1.9,lift:10,forward:6,fade:.35}),   // shoulder rolls (degrees at the clavicle)
 breath:Object.freeze({chest:-3}),          // degrees the chest lifts back on the breath in (first roll)
 tilt:Object.freeze({start:4.3,deg:15,ease:.8,hold:1.1,gap:.35,neckShare:.4,eyes:.95}),   // head to her right, then left
 lift:Object.freeze({deg:24,neckShare:.4}),   // her head comes up from the book for the break (degrees)
 settle:.6,                                 // s after the second tilt
});
const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
// The book's carry, with human timing rather than a steady glide. Putting down: slow while she is still reading, faster
// as it nears the lap, a soft touch-down. Picking up: a quick lift that slows, overshoots a little and settles.
function putDown(x){const u=Math.pow(Math.min(1,x),1.7);return u*u*(3-2*u);}
function pickUp(x){const u=Math.min(1,x),c=1.6;return 1+(c+1)*Math.pow(u-1,3)+c*Math.pow(u-1,2);}
const q=new Quaternion(),X=new Vector3(1,0,0),Y=new Vector3(0,1,0),Z=new Vector3(0,0,1),r=MathUtils.degToRad;
const turn=(node,axis,deg)=>{if(node&&deg)node.quaternion.multiply(q.setFromAxisAngle(axis,r(deg)));};

export class Unwind{
 constructor(o=UNWIND){
  this.o=o;this.pre=o.pre;this.easeIn=o.easeIn;this.easeOut=o.easeOut;this.post=o.post;this.t=-1;
  const T=o.tilt;this.played=T.start+2*(2*T.ease+T.hold)+T.gap+o.settle;
  this.length=o.pre+o.easeIn+this.played+o.easeOut+o.post;
 }
 get active(){return this.t>=0&&this.t<this.length;}
 begin(){this.t=0;}
 advance(dt){if(this.active)this.t+=dt;if(this.t>=this.length)this.t=-1;}
 /** seconds into the break itself (0 while the book goes down, `played` after) */
 elapsed(){return MathUtils.clamp(this.t-this.pre-this.easeIn,0,this.played);}
 weight(){
  if(!this.active)return 0;
  const out=this.t-(this.length-this.post-this.easeOut);
  return smooth((this.t-this.pre)/this.easeIn)*(1-smooth(out/this.easeOut));
 }
 carry(){
  if(!this.active)return 0;
  if(this.t<this.pre)return putDown(this.t/this.pre);
  const p=this.t-(this.length-this.post);return p>0?1-pickUp(p/this.post):1;
 }
 /** Her hands stay on the book throughout. */
 armWeight(){return 0;}
 // her head to one side (+1: her right) and back, then the other; 0..1 per tilt with its sign
 tilt(u){
  const T=this.o.tilt,one=(a)=>smooth((u-a)/T.ease)*(1-smooth((u-a-T.ease-T.hold)/T.ease));
  const a=T.start,b=a+2*T.ease+T.hold+T.gap;
  return one(a)-one(b);
 }
 /** Eyes closed while her head is tilted (the reader takes the larger of this and her blinking). */
 face(name){
  if(name!=='eyeBlinkLeft'&&name!=='eyeBlinkRight')return 0;
  return this.o.tilt.eyes*smooth((Math.abs(this.tilt(this.elapsed()))-.55)/.35)*this.weight();
 }
 /** Shoulder rolls, breath and head tilts, layered on the current pose by the break's weight w. */
 apply(vrm,w=this.weight()){
  if(w<=0)return;
  const u=this.elapsed(),R=this.o.roll,bone=n=>vrm.humanoid.getNormalizedBoneNode(n);
  // shoulders roll back: forward and up, over the top, back and down (two circles, faded in and out)
  const span=R.count*R.period,env=smooth(u/R.fade)*(1-smooth((u-span+R.fade)/R.fade)),phi=Math.PI*2*Math.min(u,span)/R.period;
  const lift=R.lift*(1-Math.cos(phi))/2*env,fwd=R.forward*Math.sin(phi)*env;
  for(const [side,s] of [['left',1],['right',-1]]){const sh=bone(side+'Shoulder');turn(sh,Z,s*lift*w);turn(sh,Y,-s*fwd*w);}   // +Z raises her left clavicle
  // breath in with the first roll, out by the second
  const breath=Math.sin(Math.PI*MathUtils.clamp(u/span,0,1));turn(bone('chest'),X,this.o.breath.chest*breath*w);
  // her head up from the book (her reading pose looks down at it), then the tilts: the neck takes a share of each
  const L=this.o.lift;turn(bone('neck'),X,-L.deg*L.neckShare*w);turn(bone('head'),X,-L.deg*(1-L.neckShare)*w);
  const T=this.o.tilt,k=this.tilt(u)*T.deg*w;turn(bone('neck'),Z,k*T.neckShare);turn(bone('head'),Z,k*(1-T.neckShare));
 }
}
