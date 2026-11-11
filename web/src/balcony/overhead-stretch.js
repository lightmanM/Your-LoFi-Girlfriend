// The overhead stretch: she lowers the book to her lap, lets go of it, gathers her hands, raises her elbows with loose
// fists outside her shoulders, pushes up into an open V with her back arched and her eyes shut, leans a little to each
// side, lets the V fall open with the elbows dropping first, takes hold of the book and lifts it again.
//
// The choreography (times, angles, hand positions) is ported from the study keyed by hand in Blender
// (scripts/balcony-stretch/stretch.py); here it is solved on any VRM's normalized bones, so it plays on the stand-in
// character as well. It has the interface of the calm break (unwind.js: weight, carry, apply, armWeight, face), so the
// reader carries the book down and up and keeps her hands on it exactly as it does there.
import {Quaternion,Vector3,Matrix4,MathUtils} from 'three';
import {Track,EASE,smooth,smoother} from './tracks.js';
import {reachArm,rotateWorld} from './arm-ik.js';

export const STRETCH=Object.freeze({
 pre:2.3,easeIn:.8,easeOut:.8,post:1.8,   // s: book down, into the stretch, out of it, book up
 played:6.3,                               // s between those: hands off the book, up, the hold, down, hands back
 lead:1.5,                                 // the study's shot reads for this long first: its times are ours plus this
 rightLag:.07,                             // s her right arm runs behind her left (and 2.5 times that coming down)
 free:Object.freeze([4.85,5.4]),           // study time: her hands leave the book
 back:Object.freeze([10.15,10.83]),        // and come back to it
 arm:.355,                                 // the study character's arm length, in the units its wrist positions use
 reach:.97,                                // the wrist goes at most this share of the arm's length from the shoulder
 lift:24,neckShare:.4,                     // degrees her head is already up from the book when the stretch begins
 torso:Object.freeze({spine:3.5,chest:9,leanSpine:.6,leanChest:.4}),   // degrees of arch at full stretch; share of the lean
 // the shoulder girdle follows the arm: degrees of lift per degree the upper arm is above `from`, up to `most`
 // (higher and her shoulders reach her ears); a little forward when the arm is up in front
 shoulder:Object.freeze({from:35,per:.27,most:22,forward:9}),
 forearmRoll:75,                           // degrees of the hand's roll the forearm takes; the wrist bends for the rest
 fingers:Object.freeze({Index:.9,Middle:1,Ring:1,Little:1.05}),
 open:Object.freeze({Proximal:10,Intermediate:14,Distal:9}),    // degrees each finger joint curls in an open hand
 fist:Object.freeze({Proximal:62,Intermediate:80,Distal:48}),   // and in a fist
 thumb:Object.freeze({Metacarpal:.55,Proximal:.7,Distal:.7}),   // how far each thumb joint relaxes from its grip
});
const O=STRETCH;

// --- the choreography, in the study's time (s) ---
// stretch amount: a small dip first (anticipation), up, a little further at the top, a slump on the breath out
const AMOUNT=new Track(0).to(-.15,4.45,5.05).to(1,5.05,6.7).to(1.1,6.7,7.6,'soft').to(-.22,8.5,9.8).to(0,9.8,10.9);
const SIDE=new Track(0).to(4.5,6.75,7.5).to(-3.5,7.55,8.35).to(0,8.4,9.2);                 // degrees she leans to her left (+)
const SHRUG=new Track(0).to(-2,4.45,5).to(5,5.6,6.8).to(7,6.8,7.6,'soft').to(-3,8.5,9.7).to(0,9.7,10.8);
const HEAD_UP=new Track(0).to(22,5.3,6.7).to(26,6.7,7.6,'soft').to(0,8.45,9.9);            // degrees above STRETCH.lift
const HEAD_ROLL=new Track(0).to(5,6.7,7.5).to(-4,7.55,8.35).to(0,8.45,9.4);                // + to her left
const LIDS=new Track(0).to(1,5.55,6).to(0,9.1,9.7);                                        // closed through the stretch
const FIST=new Track(0).to(.8,4.6,5.6).to(.1,6.75,7.4).to(.42,8.5,9.4).to(.15,10.1,10.7);  // loose fists up, open at the top, limp down

// An arm free of the book, seen from her chest as (to her side, up, forward), mirrored for her right arm: the wrist
// from the shoulder (study units), the way the elbow points, the way the fingers point, the way the back of the hand
// faces. Up: gather in front of the ribs, elbows out with the fists outside the shoulders, up into an open V, reach.
// Down: the V opens, the elbows drop with the hands trailing above them, the forearms come down to her lap.
const REST=Object.freeze({wrist:[.05,-.24,.20],bend:[.6,-.4,-.7],fingers:[-.3,-.25,.92],back:[-.05,.97,.25]});
function armTracks(lag){
 const w=(a,b)=>[a+lag,b+lag],r=(a,b)=>[a+2.5*lag,b+2.5*lag];
 const A1=w(4.9,5.6),A2=w(5.3,6.1),A3=w(5.75,6.65),A4=w(6.6,7.5),TURN=w(6,6.75);
 const R1=r(8.5,9.25),R2=r(8.85,10),R3=r(9.65,10.5),FALL=r(9.1,10),LAND=r(9.75,10.55);
 return Object.freeze({
  wrist:new Track(REST.wrist).to([.10,-.12,.16],...A1).to([.20,.12,.04],...A2).to([.15,.30,-.01],...A3)
   .to([.132,.319,-.03],...A4,'soft').to([.21,.26,0],...R1).to([.18,-.06,.11],...R2).to([.07,-.19,.17],...R3),
  bend:new Track(REST.bend).to([.75,-.55,-.35],...A1).to([.85,-.5,.15],...A2).to([.9,0,-.45],...A3)
   .to([.9,-.3,-.3],...R1).to([.3,-.95,-.1],...R2).to([.55,-.4,-.75],...R3),
  fingers:new Track(REST.fingers).to([-.25,-.45,.86],...A1).to([-.3,.75,.55],...A2).to([.2,.9,-.35],...TURN)
   .to([.3,.82,-.48],...A4,'soft').to([.45,.85,-.25],...R1).to([0,.7,.7],...FALL).to([-.2,-.3,.93],...LAND),
  back:new Track(REST.back).to([.25,.85,.45],...A1).to([.8,.15,-.55],...A2).to([.6,-.25,-.75],...TURN)
   .to([.55,-.45,-.7],...A4,'soft').to([.5,-.3,-.8],...R1).to([.2,.6,-.75],...FALL).to([.1,.9,.4],...LAND),
 });
}
const SIDES=Object.freeze([['left',1,0],['right',-1,O.rightLag]]);
const TRACKS=Object.freeze(Object.fromEntries(SIDES.map(([side,,lag])=>[side,armTracks(lag)])));

const X=new Vector3(1,0,0),Y=new Vector3(0,1,0),Z=new Vector3(0,0,1),rad=MathUtils.degToRad,deg=MathUtils.radToDeg;
const q=new Quaternion(),turn=(node,axis,degrees)=>{if(node&&degrees)node.quaternion.multiply(q.setFromAxisAngle(axis,rad(degrees)));};
const worldPos=node=>node.getWorldPosition(new Vector3()),worldQuat=node=>node.getWorldQuaternion(new Quaternion());
/** Give a bone a world rotation (its children follow). */
function setWorld(node,world){
 node.parent.updateWorldMatrix(true,false);
 node.quaternion.copy(worldQuat(node.parent).invert().multiply(world));node.updateWorldMatrix(false,true);
}

export class OverheadStretch{
 constructor(){
  this.pre=O.pre;this.easeIn=O.easeIn;this.easeOut=O.easeOut;this.post=O.post;this.played=O.played;
  this.length=O.pre+O.easeIn+O.played+O.easeOut+O.post;this.t=-1;
 }
 get active(){return this.t>=0&&this.t<this.length;}
 begin(){this.t=0;}
 /** @param {number} dt seconds */
 advance(dt){if(this.active)this.t+=dt;if(this.t>=this.length)this.t=-1;}
 /** The study's time for this moment. */
 clock(){return this.t+O.lead;}
 /** 0..1: how much of her body the stretch has (0 while the book travels). */
 weight(){
  if(!this.active)return 0;
  const out=this.t-(this.length-this.post-this.easeOut);
  return smooth((this.t-this.pre)/this.easeIn)*(1-smooth(out/this.easeOut));
 }
 /** 0..1: the book's way from her hands at reading height (0) to her lap (1). */
 carry(){
  if(!this.active)return 0;
  if(this.t<this.pre)return EASE.down(this.t/this.pre);
  const p=this.t-(this.length-this.post);return p>0?1-EASE.back(p/this.post):1;
 }
 /** 0..1: how far a hand is off the book. @param {'left'|'right'} side */
 armWeight(side){
  if(!this.active)return 0;
  const s=this.clock()-(side==='right'?O.rightLag:0),[a,b]=O.free,[c,d]=O.back;
  return smoother((s-a)/(b-a))*(1-smoother((s-c)/(d-c)));
 }
 /** Degrees she leans to her left (+) or right (-) at the top. */
 lean(){return this.active?SIDE.at(this.clock())*this.weight():0;}
 /** Eyes shut through the stretch (the reader takes the larger of this and her blinking). */
 face(name){
  if(name!=='eyeBlinkLeft'&&name!=='eyeBlinkRight')return 0;
  return this.active?LIDS.at(this.clock())*this.weight():0;
 }
 /**
  * Her back, head, shoulders, arms and hands, layered on the current pose by the stretch's weight w. An arm is posed
  * by how far its hand is off the book; the reader then brings each hand back onto the book by the rest.
  * @param {import('@pixiv/three-vrm').VRM} vrm @param {number} [w]
  */
 apply(vrm,w=this.weight()){
  if(w<=0)return;
  const s=this.clock(),bone=n=>vrm.humanoid.getNormalizedBoneNode(n),T=O.torso;
  const amount=AMOUNT.at(s),lean=SIDE.at(s);
  turn(bone('spine'),X,-T.spine*amount*w);turn(bone('chest'),X,-T.chest*amount*w);     // arched back over the chair
  turn(bone('spine'),Z,-T.leanSpine*lean*w);turn(bone('chest'),Z,-T.leanChest*lean*w);
  const up=O.lift+HEAD_UP.at(s),roll=HEAD_ROLL.at(s);
  for(const [name,share] of [['neck',O.neckShare],['head',1-O.neckShare]]){turn(bone(name),X,-up*share*w);turn(bone(name),Z,-roll*share*w);}
  for(const [side,sign] of SIDES){const free=this.armWeight(side);if(free>0)this.arm(bone,vrm,side,sign,s,free);}
 }
 // One arm free of the book, blended in from the pose by `free`.
 arm(bone,vrm,side,sign,s,free){
  const chest=bone('chest')??bone('spine'),shoulder=bone(side+'Shoulder'),upper=bone(side+'UpperArm'),lower=bone(side+'LowerArm'),hand=bone(side+'Hand');
  if(!chest||!upper||!lower||!hand)return;
  const tracks=TRACKS[side],joints=[shoulder,upper,lower,hand].filter(Boolean),before=joints.map(n=>n.quaternion.clone());
  chest.updateWorldMatrix(true,true);
  const frame=worldQuat(chest),seen=(v,mirror=sign)=>new Vector3(mirror*v[0],v[1],v[2]).applyQuaternion(frame);
  const length=worldPos(upper).distanceTo(worldPos(lower))+worldPos(lower).distanceTo(worldPos(hand));
  const offset=seen(tracks.wrist.at(s)).multiplyScalar(length/O.arm).clampLength(0,length*O.reach);
  const elbow=seen(tracks.bend.at(s)).normalize();
  const solve=()=>reachArm(vrm,side,worldPos(upper).add(offset),1,elbow);
  solve();
  if(shoulder){
   // the girdle follows the upper arm; the wrist is measured from the shoulder joint, which then has moved
   const aim=worldPos(lower).sub(worldPos(upper)).normalize(),G=O.shoulder;
   const raised=deg(Math.acos(MathUtils.clamp(-aim.dot(seen([0,1,0],1)),-1,1)));
   turn(shoulder,Z,sign*(MathUtils.clamp((raised-G.from)*G.per,0,G.most)+SHRUG.at(s)));
   turn(shoulder,Y,-sign*G.forward*smooth((raised-50)/60)*Math.max(0,aim.dot(seen([0,0,1],1))));
   shoulder.updateWorldMatrix(false,true);solve();
  }
  this.roll(upper,lower,hand,sign,elbow);
  // the hand: fingers and the back of the hand the way the choreography points them
  const fingers=seen(tracks.fingers.at(s)).normalize(),back=seen(tracks.back.at(s));
  back.addScaledVector(fingers,-back.dot(fingers)).normalize();
  const palm=new Vector3().crossVectors(fingers,back);
  const want=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(fingers.clone().multiplyScalar(sign),back,palm.multiplyScalar(sign)));
  // the forearm takes the hand's roll (as far as a forearm turns), the wrist only bends
  const axis=worldPos(hand).sub(worldPos(lower)).normalize(),rel=want.clone().multiply(worldQuat(lower).invert());
  const along=axis.x*rel.x+axis.y*rel.y+axis.z*rel.z,most=rad(O.forearmRoll);
  let twist=2*Math.atan2(along,rel.w);if(twist>Math.PI)twist-=2*Math.PI;if(twist<-Math.PI)twist+=2*Math.PI;
  rotateWorld(lower,new Quaternion().setFromAxisAngle(axis,MathUtils.clamp(twist,-most,most)));
  setWorld(hand,want);
  joints.forEach((n,i)=>{const posed=n.quaternion.clone();n.quaternion.copy(before[i]).slerp(posed,free);});
  joints[0].updateWorldMatrix(false,true);
  this.hand(bone,side,sign,FIST.at(s-(side==='right'?O.rightLag:0)),free);
 }
 // Turn the upper and lower arm about their own length so the elbow is a hinge: it folds the forearm toward the front
 // of the upper arm (as in the T-pose, where the hand comes forward), whatever way the arm points. The joints stay put.
 roll(upper,lower,hand,sign,elbow){
  const S=worldPos(upper),E=worldPos(lower),W=worldPos(hand),u=E.clone().sub(S).normalize(),v=W.clone().sub(E).normalize();
  const fold=v.clone().addScaledVector(u,-v.dot(u));
  if(fold.lengthSq()<1e-8)fold.copy(elbow).negate().addScaledVector(u,elbow.dot(u));   // a straight arm: away from the elbow's side
  if(fold.lengthSq()<1e-8)return;
  fold.normalize();
  const basis=(along,front)=>{const x=along.clone().multiplyScalar(sign),z=front.clone().addScaledVector(x,-front.dot(x)).normalize(),y=new Vector3().crossVectors(z,x);
   return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));};
  setWorld(upper,basis(u,fold));
  const hinge=new Vector3().crossVectors(fold,u.clone().multiplyScalar(sign)).normalize();     // the upper arm's own up: the elbow's axis
  setWorld(lower,basis(v,new Vector3().crossVectors(v.clone().multiplyScalar(sign),hinge)));
 }
 // Fingers: the grip they hold in the pose, opened or curled into a loose fist; the thumb relaxed out beside the palm.
 hand(bone,side,sign,fist,free){
  const target=new Quaternion();
  for(const [finger,k] of Object.entries(O.fingers))for(const segment of Object.keys(O.open)){
   const node=bone(side+finger+segment);if(!node)continue;
   target.setFromAxisAngle(Z,-sign*rad(k*(O.open[segment]+(O.fist[segment]-O.open[segment])*fist)));
   node.quaternion.slerp(target,free);
  }
  for(const [segment,relax] of Object.entries(O.thumb)){
   const node=bone(side+'Thumb'+segment);if(node)node.quaternion.slerp(target.identity(),relax*(1-.6*fist)*free);
  }
 }
}
