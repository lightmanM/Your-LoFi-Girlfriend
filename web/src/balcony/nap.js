// Her nap on the daybed: lie() puts her there asleep (her sleeping pose, her hips where the daybed is, the book shut
// beside the pillow), update(dt) keeps her there breathing slowly, rise() gives her back to her chair exactly as she
// was. She gets there by her walk (nap-walk.js), which ends in this very pose, so lie() then moves nothing; a
// character without the walk is put there by lie() in the dark of a cut, and rise() always happens in the dark
// (nap-plan.js).
// The pose and places come from the Blender study (scripts/balcony-nap/export_web.py -> nap.json).
import * as THREE from 'three';
import {lifeSignals} from '../companion/life.js';

export const SLEEP=Object.freeze({
 breathPeriod:5.8,     // s a breath: slower than awake
 chest:2.4,spine:-1.2, // degrees her chest and spine move with it
 smile:.2,             // of her relaxed expression
});
const X=new THREE.Vector3(1,0,0),turn=new THREE.Quaternion(),rad=THREE.MathUtils.degToRad;

export class Sleeper{
 /**
  * @param {import('@pixiv/three-vrm').VRM} vrm
  * @param {THREE.Object3D} book the book's root (its first child holds the two halves)
  * @param {{tracks:{bone:string,rotations:number[]}[],hips:number[],book:{matrix:number[],shut:number}}} data nap.json
  * @param {{mirrorV0?:boolean,leaf?:THREE.Object3D|null}} [o] mirrorV0: a VRM 0.x model turned around on load;
  *  leaf: the page that turns, hidden while the book is shut
  */
 constructor(vrm,book,data,o={}){
  if(!Array.isArray(data?.tracks)||data.hips?.length!==3||data.book?.matrix?.length!==16||!(data.book.shut>=0)||!book?.children[0])
   throw new Error('nap: the nap data or the book is not as expected');
  this.vrm=vrm;this.book=book;this.data=data;this.o=o;this.asleep=false;this.time=0;this.saved=null;
  this.halves=[];this.spine=null;
  book.children[0]?.traverse(c=>{
   if(!c.isMesh)return;
   if(/00[45]$/.test(c.name))this.halves.push({mesh:c,sign:/004$/.test(c.name)?1:-1});else if(/spine/i.test(c.name))this.spine=c;
  });
 }
 bone(n){return this.vrm.humanoid.getNormalizedBoneNode(n);}
 applyPose(){
  const v0=this.vrm.meta?.metaVersion==='0'&&this.o.mirrorV0!==false;
  for(const t of this.data.tracks){
   const node=this.bone(t.bone);if(!node)continue;
   node.quaternion.fromArray(t.rotations,0);if(v0){node.quaternion.x*=-1;node.quaternion.z*=-1;}
  }
 }
 /**
  * Onto the daybed, asleep. If anything fails on the way she is put back as she was, and the error goes on.
  * @param {{home?:{position:THREE.Vector3,book:THREE.Matrix4,leaf:boolean}|null,walked?:boolean}} [o] after her walk
  *  there (nap-walk.js): home is how she and her book were in her chair; her hair is left as it is, and so is the
  *  book, shut where her hand has laid it
  */
 lie({home=null,walked=false}={}){
  if(this.asleep)return;
  const root=this.vrm.scene,book=this.book,inner=book.children[0];
  this.saved=home??{position:root.position.clone(),book:book.matrix.clone(),leaf:this.o.leaf?.visible??true};
  this.asleep=true;this.time=0;   // from here rise() undoes whatever has been done
  try{
   this.applyPose();this.vrm.humanoid.update();root.updateMatrixWorld(true);
   const hips=this.vrm.humanoid.getRawBoneNode('hips').getWorldPosition(new THREE.Vector3());
   root.position.add(new THREE.Vector3().fromArray(this.data.hips).sub(hips));root.updateMatrixWorld(true);
   if(this.o.leaf)this.o.leaf.visible=false;
   if(!walked){   // placed there in the dark of a cut
    // the book: shut, where it lies by the pillow (the matrix is its halves' parent's, in the world)
    for(const h of this.halves)h.mesh.rotation.z=h.sign*rad(this.data.book.shut);
    inner.updateMatrix();
    book.matrix.fromArray(this.data.book.matrix).multiply(new THREE.Matrix4().copy(inner.matrix).invert());
    book.matrixWorldNeedsUpdate=true;book.updateMatrixWorld(true);
    this.vrm.springBoneManager?.reset();   // her hair starts at rest, not flung from her chair
   }
  }catch(e){this.rise();throw e;}
 }
 /** She is getting up by herself (nap-walk.js takes her from here). @returns how she and her book were in her chair */
 release(){const home=this.saved;this.asleep=false;this.saved=null;return home;}
 /** Every frame while she is on the daybed, before vrm.update(). */
 update(dt){
  if(!this.asleep)return;
  this.time+=dt;this.applyPose();
  const breath=lifeSignals(this.time,{breathPeriod:SLEEP.breathPeriod}).breath;
  this.bone('chest')?.quaternion.multiply(turn.setFromAxisAngle(X,rad(breath*SLEEP.chest)));
  this.bone('spine')?.quaternion.multiply(turn.setFromAxisAngle(X,rad(breath*SLEEP.spine)));
  const em=this.vrm.expressionManager;
  if(em){em.setValue('blink',1);if(em.getExpression('relaxed'))em.setValue('relaxed',SLEEP.smile);}
 }
 /** Back to her chair, as she was. Her pose is the reader's to set again; the viewer settles her hair once it has. */
 rise(){
  if(!this.asleep)return;
  const root=this.vrm.scene,book=this.book;
  root.position.copy(this.saved.position);root.updateMatrixWorld(true);
  for(const h of this.halves)h.mesh.rotation.z=0;
  if(this.spine)this.spine.rotation.z=0;
  if(this.o.leaf)this.o.leaf.visible=this.saved.leaf;
  book.matrix.copy(this.saved.book);book.matrixWorldNeedsUpdate=true;book.updateMatrixWorld(true);
  const em=this.vrm.expressionManager;
  if(em?.getExpression('relaxed'))em.setValue('relaxed',0);
  this.asleep=false;this.saved=null;
 }
}
