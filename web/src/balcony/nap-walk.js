// Her walk to the daybed and her way back. Out: she yawns, closes her book, gets up, walks out through the door, sits
// down on the daybed as she turns and lies down on her side. Back: she wakes, gets up with her book, walks in again,
// sits down in her chair and opens it. The motions were made in Blender (scripts/balcony-nap/nap.py, back.py) and
// come as clips with a pose for every frame (export_web.py -> nap-walk.json, nap-back.json): rotations for her
// bones, where her hips are in the room, how far the book is shut and three expressions. begin() takes over from the
// pose she is in, whatever it is at that moment, and eases into the clip; update(dt) plays it. The way out ends in
// the pose nap.js keeps her in; the way back ends by easing into her reading as the reader poses it that frame.
// The clips' footsteps fit the character they were made with, so the viewer plays them for her alone (others go by the cut).
import * as THREE from 'three';
import {reachLeg} from './arm-ik.js';

export const WALK=Object.freeze({
 blendIn:.8,   // s to ease from the pose she is in into a clip that does not say (clip.blend.in)
 gaze:2,       // m ahead of her face her eyes rest on
});
const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
const smoother=x=>x<=0?0:x>=1?1:x*x*x*(x*(6*x-15)+10);

/** How long the clip plays, s. @param {{fps:number,frames:number}} clip @returns {number} */
export function clipLength(clip){return (clip.frames-1)/clip.fps;}

/**
 * The two frames a time falls between and how far it is from the first to the second.
 * @param {{fps:number,frames:number}} clip @param {number} t @returns {{a:number,b:number,k:number}}
 */
export function clipFrame(clip,t){
 const f=Math.min(Math.max(t*clip.fps,0),clip.frames-1),a=Math.floor(f);
 return {a,b:Math.min(a+1,clip.frames-1),k:f-a};
}

/** A per-frame value at that place. @param {number[]} values @param {{a:number,b:number,k:number}} f @returns {number} */
export function clipValue(values,{a,b,k}){return values[a]*(1-k)+values[b]*k;}

/**
 * How much of the chair's seat is under her, 0..1. marks.seated is [all of her weight on it, none of it] in seconds,
 * in either order: rising off it on her way out, coming down onto it on her way back.
 * @param {{marks:{seated:number[]}}} clip @param {number} t @returns {number}
 */
export function seated(clip,t){const [a,b]=clip.marks.seated;return 1-smooth((t-a)/(b-a));}

/** Whether the picture's door frame and furniture may cover her now (marks.cover: from, to). @returns {boolean} */
export function covered(clip,t){const [a,b]=clip.marks.cover;return t>=a&&t<b;}

/** Her shadow on the picture, 0..1 (marks.shadow: comes from, to; goes from, to). @returns {number} */
export function shadowed(clip,t){const [a,b,c,d]=clip.marks.shadow;return smooth((t-a)/(b-a))*(1-smooth((t-c)/(d-c)));}

/**
 * Whether a clip is whole: every bone has one pose or one for every frame, and so have her hips, the book and her face.
 * @param {object} clip @returns {boolean}
 */
export function clipOk(clip){
 const n=clip?.frames,all=v=>Array.isArray(v)&&v.every(Number.isFinite);
 if(!(Number.isInteger(n)&&n>1&&clip.fps>0&&clip.bones&&clip.face&&clip.marks))return false;
 if(!Object.values(clip.bones).every(v=>all(v)&&(v.length===4||v.length===4*n)))return false;
 if(!(all(clip.hips)&&clip.hips.length===3*n&&all(clip.shut)&&clip.shut.length===n))return false;
 if(!['blink','aa','relaxed'].every(k=>all(clip.face[k])&&clip.face[k].length===n))return false;
 const m=clip.marks,pair=v=>all(v)&&v.length===2&&v[0]!==v[1];
 if(!(pair(m.seated)&&pair(m.cover)&&all(m.shadow)&&m.shadow.length===4&&m.shadow[0]!==m.shadow[1]&&m.shadow[2]!==m.shadow[3]))return false;
 return clip.blend===undefined||(clip.blend.in>0&&clip.blend.out>=0&&clip.blend.in+clip.blend.out<(n-1)/clip.fps);
}

export class NapWalk{
 /**
  * @param {import('@pixiv/three-vrm').VRM} vrm
  * @param {THREE.Object3D} book the book's root (its first child holds the two halves and the spine)
  * @param {object} clip nap-walk.json (clipOk)
  * @param {{grip:{update:(lap?:number)=>void},look?:THREE.Object3D,leaf?:THREE.Object3D|null,drop?:number,mirrorV0?:boolean}} o
  *  grip: keeps the book in her left hand; look: what her eyes follow; leaf: the page that turns; drop: how far the
  *  viewer lowered her onto its chair's seat (the clip sits her at the height she was posed at); mirrorV0: a VRM 0.x
  *  model turned around on load, whose pose rotations mirror x and z (as in reader.js and nap.js)
  */
 constructor(vrm,book,clip,o){
  if(!clipOk(clip))throw new Error('nap walk: the clip is not as expected');
  this.vrm=vrm;this.book=book;this.clip=clip;this.o=o;this.t=0;this.active=false;this.home=null;
  this.blendIn=clip.blend?.in??WALK.blendIn;this.blendOut=clip.blend?.out??0;
  this.mirror=vrm.meta?.metaVersion==='0'&&o.mirrorV0!==false;
  this.bones=Object.keys(clip.bones).map(name=>({name,node:vrm.humanoid.getNormalizedBoneNode(name),values:clip.bones[name],from:new THREE.Quaternion()})).filter(b=>b.node);
  this.far=[];this.spine=null;      // the half of the book her right hand holds (and its pages), and the spine
  book.children[0]?.traverse(c=>{if(!c.isMesh)return;if(/005$/.test(c.name))this.far.push(c);else if(/spine/i.test(c.name))this.spine=c;});
  this.tmp={q:new THREE.Quaternion(),q2:new THREE.Quaternion(),hips:new THREE.Vector3(),from:new THREE.Vector3(),to:new THREE.Vector3(),foot:new THREE.Vector3(),ahead:new THREE.Vector3()};
 }
 get length(){return clipLength(this.clip);}
 /** Whether the clip is handing over to her reading: the viewer then lets the reader pose her first, every frame. */
 get tailing(){return this.active&&this.blendOut>0&&this.t>this.length-this.blendOut;}
 /** Where her hips are in the room now. */
 hips(out=new THREE.Vector3()){return this.vrm.humanoid.getRawBoneNode('hips').getWorldPosition(out);}
 /**
  * Take over from the pose she is in now. Remembers how she and her book were in her chair (home), or is told (when
  * she is not in it: on her way back).
  * @param {{home?:{position:THREE.Vector3,book:THREE.Matrix4,leaf:boolean}|null}} [o]
  */
 begin({home=null}={}){
  const root=this.vrm.scene;root.updateMatrixWorld(true);
  this.home=home??{position:root.position.clone(),book:this.book.matrix.clone(),leaf:this.o.leaf?.visible??true};
  for(const b of this.bones)b.from.copy(b.node.quaternion);
  this.hips(this.tmp.from);
  if(this.o.leaf)this.o.leaf.visible=false;
  this.t=0;this.active=true;
 }
 /** One frame of the walk, before vrm.update(). @returns {boolean} whether it is still playing */
 update(dt){
  if(!this.active)return false;
  this.t=Math.min(this.t+dt,this.length);
  const {clip,tmp,vrm}=this,f=clipFrame(clip,this.t),w=smoother(this.t/this.blendIn),root=vrm.scene,lerp=THREE.MathUtils.lerp;
  // handing over to her reading: the clip's share goes from all to none, over the pose the reader gave her this frame
  const tail=this.tailing?smoother((this.length-this.t)/this.blendOut):1;
  for(const b of this.bones){
   if(b.values.length===4)tmp.q.fromArray(b.values,0);
   else tmp.q.fromArray(b.values,f.a*4).slerp(tmp.q2.fromArray(b.values,f.b*4),f.k);
   if(this.mirror){tmp.q.x*=-1;tmp.q.z*=-1;}
   if(tail<1)b.node.quaternion.slerp(tmp.q,tail);else b.node.quaternion.copy(b.from).slerp(tmp.q,w);
  }
  // her hips where the clip has them; while she is seated, lower by what the viewer lowered her onto its seat
  const sink=(this.o.drop??0)*seated(clip,this.t);
  tmp.to.fromArray(clip.hips,f.a*3).lerp(tmp.hips.fromArray(clip.hips,f.b*3),f.k);tmp.to.y-=sink;
  if(tail>=1)tmp.to.lerpVectors(tmp.from,tmp.to,w);
  vrm.humanoid.update();root.updateMatrixWorld(true);
  tmp.to.sub(this.hips(tmp.hips)).add(root.position);            // where that puts her as a whole
  if(tail<1)root.position.lerpVectors(this.home.position,tmp.to,tail);else root.position.copy(tmp.to);
  root.updateMatrixWorld(true);
  if(sink*w*tail>1e-4)for(const side of ['left','right']){   // and her feet stay on the floor, as the seat does it (seat.js)
   vrm.humanoid.getNormalizedBoneNode(side+'Foot').getWorldPosition(tmp.foot);tmp.foot.y+=sink*w*tail;
   reachLeg(vrm,side,tmp.foot,1);
  }
  // the book stays in her left hand; her right hand's half folds over onto it
  root.updateMatrixWorld(true);this.o.grip.update(0);
  const shut=THREE.MathUtils.degToRad(clipValue(clip.shut,f));
  for(const m of this.far)m.rotation.z=-2*shut;
  if(this.spine)this.spine.rotation.z=-shut;
  const em=vrm.expressionManager;
  if(em){
   const set=(name,v)=>em.setValue(name,tail<1?lerp(em.getValue(name)??0,v,tail):v);
   set('blink',clipValue(clip.face.blink,f));set('aa',clipValue(clip.face.aa,f));
   if(em.getExpression('relaxed'))set('relaxed',clipValue(clip.face.relaxed,f));
  }
  if(this.o.look){   // her eyes rest ahead of her, wherever her head is turned
   const head=vrm.humanoid.getNormalizedBoneNode('head');
   if(head){
    head.updateWorldMatrix(true,false);head.getWorldPosition(tmp.foot).add(tmp.ahead.set(0,0,WALK.gaze).applyQuaternion(head.getWorldQuaternion(tmp.q)));
    if(tail<1)this.o.look.position.lerp(tmp.foot,tail);else this.o.look.position.copy(tmp.foot);
   }
  }
  return this.t<this.length;
 }
 /** She is on the daybed: nap.js keeps her pose from here. The book stays shut where her hand has laid it. */
 end(){
  this.active=false;
  this.vrm.expressionManager?.setValue('aa',0);
 }
 /** She is back in her chair and the reader has her again: the last of the clip is taken off her. */
 finish(){
  if(!this.home)return;
  const em=this.vrm.expressionManager;
  this.active=false;
  for(const m of this.far)m.rotation.z=0;
  if(this.spine)this.spine.rotation.z=0;
  if(em){em.setValue('aa',0);if(em.getExpression('relaxed'))em.setValue('relaxed',0);}
  this.vrm.scene.position.copy(this.home.position);this.vrm.scene.updateMatrixWorld(true);
  if(this.o.leaf)this.o.leaf.visible=this.home.leaf;
  this.home=null;
 }
 /** Stop wherever she is and put her back in her chair as she was (for a failure on the way). */
 abort(){
  if(!this.home)return;
  const root=this.vrm.scene,em=this.vrm.expressionManager;
  this.end();
  for(const m of this.far)m.rotation.z=0;
  if(this.spine)this.spine.rotation.z=0;
  if(em){em.setValue('blink',0);if(em.getExpression('relaxed'))em.setValue('relaxed',0);}   // nothing of the walk stays on her face
  root.position.copy(this.home.position);root.updateMatrixWorld(true);
  this.book.matrix.copy(this.home.book);this.book.matrixWorldNeedsUpdate=true;this.book.updateMatrixWorld(true);
  if(this.o.leaf)this.o.leaf.visible=this.home.leaf;
  this.home=null;
 }
}
