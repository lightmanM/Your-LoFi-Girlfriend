import * as THREE from 'three';
import {VRMUtils} from '@pixiv/three-vrm';
import {inspectCharacter} from '../character-contract.js';
import {Interaction} from './interaction.js';
import {applySeatedProfile} from './character-profile.js';
import {sampleScalar,sampleRotation,loopTime,actionTime,SOURCE_ACTIONS} from './source-motion.js';
import {lifeSignals,applyLife,gazePoint} from './life.js';

export class CompanionCharacter {
 constructor(vrm,library,profile='generic'){
  this.vrm=vrm;this.library=library;this.report=inspectCharacter(vrm);
  applySeatedProfile(vrm,profile);VRMUtils.rotateVRM0(vrm);vrm.update(0);
  this.interaction=new Interaction({duration:3,blendIn:.5,blendOut:.65});
  this.time=0;this.speed=1;this.action='smile';this.queuedAction=null;this.faceValues={};
  // Gaze target: a point the eyes track; the head follows a little through the life layer.
  this.gaze=new THREE.Object3D();this.gaze.name='Gaze target';this.gazeFocus=new THREE.Vector3(.85,1.42,2.45);this.gazeGlance=new THREE.Vector3(-.95,.5,.45);
  this.life={enabled:true,amount:1};
  if(vrm.lookAt){vrm.lookAt.target=this.gaze;vrm.lookAt.autoUpdate=true;}
  this.faceTargets=new Map();
  vrm.scene.traverse(o=>{
   if(o.isMesh){o.castShadow=true;o.frustumCulled=false;}
   if(o.morphTargetDictionary)for(const [name,index] of Object.entries(o.morphTargetDictionary)){
    if(!this.faceTargets.has(name))this.faceTargets.set(name,[]);
    this.faceTargets.get(name).push({mesh:o,index});
   }
  });
  this.faceNames=[...new Set(Object.values(library.clips).flatMap(c=>Object.keys(c.face)))];
  this.missingFaceMorphs=this.faceNames.filter(n=>!this.faceTargets.has(n));
  this.applyPose();vrm.update(0);this.applyFace();vrm.scene.updateMatrixWorld(true);
 }
 applyTracks(clip,time,weight=1){
  for(const track of clip.tracks){
   const node=this.vrm.humanoid.getNormalizedBoneNode(track.bone);if(!node)continue;
   const q=sampleRotation(clip.times,track.rotations,time);
   if(this.vrm.meta.metaVersion==='0'){q.x=-q.x;q.z=-q.z;}
   node.quaternion.slerp(q,weight);
  }
 }
 applyPose(){
  const clips=this.library.clips,c=this.interaction;
  // Source sit is a pose; hands and face are independent authored layers.
  this.applyTracks(clips.sit,0);this.applyTracks(clips.handsIdle,0);
  const action=clips[SOURCE_ACTIONS[this.action].clip];
  if(c.weight>0)this.applyTracks(action,actionTime(c.elapsed,action.duration),c.weight);
  if(this.life.enabled){
   // Keep breathing under actions; calm the idle head drift while one plays.
   const s=lifeSignals(this.time,{headDepth:1-.7*c.weight,gazeDepth:1-.5*c.weight});
   applyLife(this.vrm,s,this.life.amount);
   gazePoint(this.time,s,{focus:this.gazeFocus,glance:c.weight>0?null:this.gazeGlance,out:this.gaze.position});
  }
 }
 applyFace(){
  const clips=this.library.clips,c=this.interaction;
  const idle=clips.faceIdle,loop=loopTime(this.time,idle.duration);
  const action=clips[SOURCE_ACTIONS[this.action].clip],hasFace=Object.keys(action.face).length>0;
  for(const name of this.faceNames){
   const values=idle.face[name];
   let value=values?sampleScalar(idle.times,values,loop.time)*(1-loop.wrap)+values[0]*loop.wrap:0;
   if(hasFace){const target=action.face[name]?sampleScalar(action.times,action.face[name],actionTime(c.elapsed,action.duration)):0;value=value*(1-c.weight)+target*c.weight;}
   this.faceValues[name]=value;
   for(const {mesh,index} of this.faceTargets.get(name)??[])mesh.morphTargetInfluences[index]=value;
  }
 }
 update(dt,camera){
  if(camera)this.gazeFocus.copy(camera.position);
  const c=this.interaction,delta=c.paused?0:Math.min(dt,.05)*this.speed;
  const started=c.started;this.time+=delta;c.update(delta);
  if(c.started!==started&&this.queuedAction){this.setAction(this.queuedAction);this.queuedAction=null;}
  this.applyPose();this.vrm.update(delta);
  // Apply after VRM expression bindings; a single source owns each facial channel.
  this.applyFace();this.vrm.scene.updateMatrixWorld(true);
 }
 setAction(name){this.action=name;this.interaction.duration=SOURCE_ACTIONS[name].duration;}
 request(name=this.action){
  if(!SOURCE_ACTIONS[name])throw new Error('Unknown supplied action: '+name);
  const result=this.interaction.request();
  if(result==='started')this.setAction(name);else this.queuedAction=name;
  return result;
 }
 snapshot(){
  const joints={};
  for(const name of ['hips','head','leftHand','rightHand','leftFoot','rightFoot','leftUpperLeg','rightUpperArm','leftIndexProximal','rightIndexProximal','leftEye','rightEye']){
   const raw=this.vrm.humanoid.getRawBoneNode(name);const normalized=this.vrm.humanoid.getNormalizedBoneNode(name);
   if(!raw||!normalized)continue;
   joints[name]={rawQuaternion:raw.quaternion.toArray(),position:raw.getWorldPosition(new THREE.Vector3()).toArray(),quaternion:normalized.quaternion.toArray()};
  }
  return {life:{...this.life,gaze:this.gaze.position.toArray()},expressions:Object.fromEntries(['blink','happy','aa'].map(n=>[n,this.vrm.expressionManager?.getValue(n)??0])),springJoints:this.vrm.springBoneManager?.joints.size??0,interaction:this.interaction.snapshot(),time:this.time,speed:this.speed,joints,source:this.library.source,action:this.action,faceMorphs:{...this.faceValues},missingFaceMorphs:this.missingFaceMorphs,clips:Object.entries(this.library.clips).map(([name,c])=>({name,duration:c.duration,tracks:c.tracks.length})),capabilities:this.report.capabilities};
 }
 dispose(){this.vrm.scene.removeFromParent();VRMUtils.deepDispose(this.vrm.scene);}
}
