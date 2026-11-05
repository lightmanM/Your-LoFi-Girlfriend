import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const source='../assets/vendor/quaternius-ual/UAL1_Standard.glb';
const bytes=fs.readFileSync(source),n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+n));
const binary=bytes.subarray(28+n);
for(const node of doc.nodes){delete node.mesh;delete node.skin;}
for(const key of ['meshes','skins','images','textures','materials','samplers'])delete doc[key];
doc.animations=doc.animations.filter(a=>['A_TPose','Sitting_Idle_Loop','Sitting_Talking_Loop'].includes(a.name));
doc.buffers=[{byteLength:binary.length,uri:'data:application/octet-stream;base64,'+binary.toString('base64')}];
globalThis.ProgressEvent=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');
const map={pelvis:'hips',spine_01:'spine',spine_02:'chest',spine_03:'upperChest',neck_01:'neck',Head:'head'};
for(const [suffix,side]of [['l','left'],['r','right']]){
 for(const [src,dst]of Object.entries({clavicle:'Shoulder',upperarm:'UpperArm',lowerarm:'LowerArm',hand:'Hand',thigh:'UpperLeg',calf:'LowerLeg',foot:'Foot',ball:'Toes'}))map[`${src}_${suffix}`]=side+dst;
 for(const [src,dst]of Object.entries({index:'Index',middle:'Middle',ring:'Ring',pinky:'Little',thumb:'Thumb'})){
  const joints=src==='thumb'?['Metacarpal','Proximal','Distal']:['Proximal','Intermediate','Distal'];
  joints.forEach((joint,i)=>map[`${src}_0${i+1}_${suffix}`]=side+dst+joint);
 }
}
const mixer=new THREE.AnimationMixer(gltf.scene);
const tp=mixer.clipAction(gltf.animations.find(c=>c.name==='A_TPose'));tp.play();mixer.update(0);gltf.scene.updateMatrixWorld(true);
const bones=Object.entries(map).map(([name,bone])=>{
 const node=gltf.scene.getObjectByName(name);if(!node)throw Error(name);
 return {node,bone,parentRest:node.parent.getWorldQuaternion(new THREE.Quaternion()),inverseRest:node.getWorldQuaternion(new THREE.Quaternion()).invert()};
});
const hip=gltf.scene.getObjectByName('pelvis');
const sourceHipHeight=hip.getWorldPosition(new THREE.Vector3()).y;
const leftX=gltf.scene.getObjectByName('hand_l').getWorldPosition(new THREE.Vector3()).x;
const result={source:'Quaternius Universal Animation Library Standard v3; CC0',sourceHipHeight,leftHandRestX:leftX,fps:30,clips:[]};
for(const clip of gltf.animations.filter(c=>c.name!=='A_TPose')){
 mixer.stopAllAction();const action=mixer.clipAction(clip);action.reset().play();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;
 const count=Math.round(clip.duration*30)+1;const times=Array.from({length:count},(_,i)=>i*clip.duration/(count-1));
 const tracks=bones.map(b=>({bone:b.bone,rotations:[]}));const hipPositions=[];
 for(const time of times){
  mixer.setTime(time);gltf.scene.updateMatrixWorld(true);
  bones.forEach((b,i)=>{
   const q=b.parentRest.clone().multiply(b.node.quaternion).multiply(b.inverseRest).normalize();
   // Normalize the source facing direction to VRM 1 (+Z / left arm +X).
   if(leftX<0){q.x*=-1;q.z*=-1;}
   tracks[i].rotations.push(...q.toArray().map(x=>+x.toFixed(7)));
  });
  const p=hip.getWorldPosition(new THREE.Vector3());hipPositions.push(0,+p.y.toFixed(7),0);
 }
 // Explicitly close cyclic clips. Their endpoint differences are checked in audit.
 const loopCorrections=tracks.map(t=>{
  const a=new THREE.Quaternion().fromArray(t.rotations),b=new THREE.Quaternion().fromArray(t.rotations,t.rotations.length-4);
  return {bone:t.bone,radians:a.angleTo(b)};
 });
 for(const t of tracks)t.rotations.splice(t.rotations.length-4,4,...t.rotations.slice(0,4));
 hipPositions.splice(hipPositions.length-3,3,...hipPositions.slice(0,3));
 result.clips.push({name:clip.name,duration:clip.duration,times,tracks,hipPositions,loopCorrections});
}
fs.writeFileSync('public/motions/seated.json',JSON.stringify(result));
console.log(JSON.stringify({sourceHipHeight,leftX,clips:result.clips.map(c=>({name:c.name,duration:c.duration,maxEndpointCorrection:Math.max(...c.loopCorrections.map(x=>x.radians)),hipY:[Math.min(...c.hipPositions.filter((_,i)=>i%3===1)),Math.max(...c.hipPositions.filter((_,i)=>i%3===1))]})),bytes:fs.statSync('public/motions/seated.json').size},null,2));
