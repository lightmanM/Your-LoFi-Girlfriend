// Tucking her hair behind her ear: her left hand (the side the camera sees) slides off the book's edge, comes up to
// her temple, strokes back over her ear to behind it and returns to the book, her head leaning a little away from the
// hand. Her right hand keeps hold of the book and she keeps reading. Her hair itself does not move: the hand only
// passes over it.
//
// Where her hair is comes from the model (a ray from her side to the middle of her head at three heights), so it
// plays on any VRM. The reader starts it, slides her hand out by slide(), layers apply() on her pose and brings the
// hand back onto the book by what armWeight() leaves.
import {Quaternion,Vector3,Raycaster,MathUtils} from 'three';
import {Track,smooth,smoother,pulse} from './tracks.js';
import {reachArm} from './arm-ik.js';
import {worldPos,worldQuat,hingeRoll,orientHand} from './arm-pose.js';

export const TUCK=Object.freeze({
 every:Object.freeze([150,420]),               // s between tucks
 length:5.4,
 slip:Object.freeze([0,.6,4.75,5.4]),          // s: her hand slides out past the book's edge; back in at the end
 free:Object.freeze([.45,1.9]),                // s: her hand leaves the book, unhurried
 back:Object.freeze([3.55,4.95]),              // and comes back to it
 stroke:Object.freeze([1.9,3.2]),              // s: fingertips at her temple, then back over her ear to behind it
 // the points on her hair the fingertips pass, in her head's frame: (up from her eye height, forward) in m:
 // her temple, over her ear, behind it, and a little down the hair behind it
 points:Object.freeze([[.05,.02],[.032,-.012],[-.005,-.045],[-.045,-.05]]),
 eye:.07,out:.085,                             // her eye height and her hair's distance from the middle, when they cannot be measured
 sink:.004,                                    // m the fingertips press into her hair
 // the hand is cupped: its fingertips are this share of the hand's length ahead of the wrist, and this share to the
 // palm's side of it
 reach:.88,cup:.1,
 hand:.16,                                     // m: the hand's length for a model without finger bones
 tilt:3.5,turn:2,                              // degrees her head tilts and turns away from the hand
 shrug:3,                                      // degrees her shoulder comes up with the arm
 forearmRoll:75,                               // degrees of the hand's roll the forearm takes
 curl:Object.freeze({Proximal:20,Intermediate:30,Distal:18}),   // degrees each finger joint curls
 fingers:Object.freeze({Index:.8,Middle:1,Ring:1.7,Little:2.2}),   // the first two fingers lead, gently curved; the small ones curl in
 // degrees each finger closes in toward the middle one (a model's fingers fan out a little at rest)
 together:Object.freeze({Index:8,Middle:2,Ring:-4,Little:-9}),
 thumb:.3,                                     // how far the thumb relaxes from its grip
});
const O=TUCK,SIDE='left',SIGN=1;   // her left hand, toward the camera; her right keeps hold of the book

// --- the choreography, s from the start; directions as (to her side, up, forward), seen from her head or chest ---
const ALONG=new Track(0).to(1,1.9,2.5,'soft').to(2,2.4,2.95,'soft').to(3,2.9,3.5,'soft');   // along the points on her hair
// m off her hair: she comes up to it from below, beside her neck, and leaves the same way, so the hand does not
// cross her face
const NEAR=new Track([.07,-.13,.01]).to([0,0,0],.9,1.95,'soft').to([.05,-.13,.02],3.5,4.6);
// her fingers point up and back along her hair, in line with her forearm (the wrist stays straight), and turn further
// back as they pass over her ear
const FINGERS=new Track([-.2,.65,-.6]).to([-.28,.68,-.68],1.1,1.9).to([-.25,.3,-.92],2,3.2).to([-.2,.6,-.65],3.5,4.5);
const BACK=new Track([.8,.5,.3]).to([.85,.45,.25],2,3.2);        // the back of her hand faces out and up
const BEND=new Track([.35,-.7,.6]).to([.4,-.7,.55],1.9,3.2);     // her elbow stays low and in front of her
const lean=t=>pulse(t,.8,1.9,3.2,4.4);

const X=new Vector3(1,0,0),Y=new Vector3(0,1,0),Z=new Vector3(0,0,1),rad=MathUtils.degToRad;
const q=new Quaternion(),turn=(node,axis,degrees)=>{if(node&&degrees)node.quaternion.multiply(q.setFromAxisAngle(axis,rad(degrees)));};
const measured=new WeakMap();   // per model: where her hair is and how long her hand is

export class HairTuck{
 constructor(){this.length=O.length;this.t=-1;this.shape=null;}
 get active(){return this.t>=0&&this.t<this.length;}
 /**
  * Start it. @param {import('@pixiv/three-vrm').VRM} vrm in the pose she holds now
  * @returns {boolean} false for a model without the bones it needs (nothing starts)
  */
 begin(vrm){
  const bone=n=>vrm.humanoid.getNormalizedBoneNode(n);
  if(!bone('head')||!bone(SIDE+'UpperArm')||!bone(SIDE+'LowerArm')||!bone(SIDE+'Hand'))return false;
  if(!measured.has(vrm))measured.set(vrm,measure(vrm,bone));
  this.shape=measured.get(vrm);this.t=0;return true;
 }
 /** @param {number} dt seconds */
 advance(dt){if(this.active)this.t+=dt;if(this.t>=this.length)this.t=-1;}
 /** 0..1: how far her hand is off the book. */
 armWeight(){
  if(!this.active)return 0;
  const [a,b]=O.free,[c,d]=O.back;return smoother((this.t-a)/(b-a))*(1-smoother((this.t-c)/(d-c)));
 }
 /** 0..1: how far her hand, still holding it, has slid out past the book's edge (its fingers clear the cover). */
 slide(){
  if(!this.active)return 0;
  const [a,b,c,d]=O.slip;return smooth((this.t-a)/(b-a))*(1-smooth((this.t-c)/(d-c)));
 }
 /** Where her fingertips are going now (world). */
 tipWorld(vrm){
  const head=vrm.humanoid.getNormalizedBoneNode('head'),pts=this.shape.points,u=ALONG.at(this.t),near=NEAR.at(this.t);
  const i=Math.min(pts.length-2,Math.floor(u)),p=pts[i].clone().lerp(pts[i+1],u-i);
  p.x+=SIGN*near[0];p.y+=near[1];p.z+=near[2];
  head.updateWorldMatrix(true,false);return head.localToWorld(p);
 }
 /** Her head and her left arm and hand, layered on the current pose. */
 apply(vrm){
  if(!this.active)return;
  const t=this.t,bone=n=>vrm.humanoid.getNormalizedBoneNode(n),head=bone('head'),k=lean(t);
  turn(head,Z,SIGN*O.tilt*k);turn(head,Y,-SIGN*O.turn*k);     // away from the hand
  const free=this.armWeight();if(free<=0)return;
  const chest=bone('chest')??bone('spine')??head,shoulder=bone(SIDE+'Shoulder'),upper=bone(SIDE+'UpperArm'),lower=bone(SIDE+'LowerArm'),hand=bone(SIDE+'Hand');
  const joints=[shoulder,upper,lower,hand].filter(Boolean),before=joints.map(n=>n.quaternion.clone());
  chest.updateWorldMatrix(true,true);
  const seen=(frame,v)=>new Vector3(SIGN*v[0],v[1],v[2]).applyQuaternion(frame),hq=worldQuat(head),cq=worldQuat(chest);
  const fingers=seen(hq,FINGERS.at(t)).normalize(),elbow=seen(cq,BEND.at(t)).normalize();
  const back=seen(hq,BACK.at(t));back.addScaledVector(fingers,-back.dot(fingers)).normalize();
  const wrist=this.tipWorld(vrm).addScaledVector(fingers,-this.shape.hand*O.reach).addScaledVector(back,this.shape.hand*O.cup);
  const solve=()=>reachArm(vrm,SIDE,wrist,1,elbow);
  solve();
  if(shoulder){turn(shoulder,Z,SIGN*O.shrug*k);shoulder.updateWorldMatrix(false,true);solve();}
  hingeRoll(upper,lower,hand,SIGN,elbow);
  orientHand(lower,hand,SIGN,fingers,back,O.forearmRoll);
  joints.forEach((n,i)=>{const posed=n.quaternion.clone();n.quaternion.copy(before[i]).slerp(posed,free);});
  joints[0].updateWorldMatrix(false,true);
  // a cupped hand: the fingers curled, the small ones more; the thumb relaxed a little from its grip
  const target=new Quaternion();
  for(const [finger,share] of Object.entries(O.fingers))for(const [segment,degrees] of Object.entries(O.curl)){
   const node=bone(SIDE+finger+segment);if(!node)continue;
   target.setFromAxisAngle(Z,-SIGN*rad(share*degrees));
   if(segment==='Proximal')target.premultiply(q.setFromAxisAngle(Y,SIGN*rad(O.together[finger])));
   node.quaternion.slerp(target,free);
  }
  for(const segment of ['Metacarpal','Proximal','Distal']){const node=bone(SIDE+'Thumb'+segment);if(node)node.quaternion.slerp(target.identity(),O.thumb*free);}
 }
}

// Where her hair is beside and behind her ear (in her head's frame) and how long her hand is, from the model itself.
function measure(vrm,bone){
 const head=bone('head'),meshes=[];vrm.scene?.traverse(o=>{if(o.isMesh)meshes.push(o);});
 head.updateWorldMatrix(true,true);
 const eyes=['leftEye','rightEye'].map(bone).filter(Boolean);
 const eye=eyes.length===2?head.worldToLocal(worldPos(eyes[0]).add(worldPos(eyes[1])).multiplyScalar(.5)).y:O.eye;
 const ray=new Raycaster();ray.far=1;
 const points=O.points.map(([up,forward])=>{
  let x=SIGN*O.out;
  if(meshes.length){   // from well out at her side straight in toward the middle of her head: the first thing met is her hair
   const from=head.localToWorld(new Vector3(SIGN*.5,eye+up,forward)),to=head.localToWorld(new Vector3(0,eye+up,forward));
   ray.set(from,to.sub(from).normalize());
   const hit=ray.intersectObjects(meshes,false)[0];if(hit)x=head.worldToLocal(hit.point.clone()).x;
  }
  return new Vector3(x-SIGN*O.sink,eye+up,forward);
 });
 const chain=['Hand','MiddleProximal','MiddleIntermediate','MiddleDistal'].map(n=>bone(SIDE+n));
 let hand=O.hand;
 if(chain.every(Boolean)){const p=chain.map(worldPos);hand=p[0].distanceTo(p[1])+p[1].distanceTo(p[2])+p[2].distanceTo(p[3])*1.9;}   // the last joint about as long as the one before
 return {points,hand};
}
