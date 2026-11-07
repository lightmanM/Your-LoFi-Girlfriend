// Balcony reading: a fixed-eye background plate rendered in Cycles, a visible 3D chair, the live VRM in its
// reading pose, and the out-of-focus foreground leaves drawn over her. Camera position is fixed; it only rotates
// within the FixedCamera look limits, which the plate covers, so the flat plate stays exact.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm';
import {FixedCamera,bindCameraLook} from '../companion/fixed-camera.js';
import {readVRMDocument} from '../vrm-file.js';
import {Reader} from './reader.js';
import {seatCharacter} from './seat.js';
import {armInTorso} from './body-coupling.js';
import {VISIBLE_CHAIR,prepareChair,pictureCamera,enableChairShadows,updateChairContact,calibrateChairContact} from './visible-chair.js';

const BASE='/environment/balcony-plate/';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const host=$('stage');
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NeutralToneMapping;renderer.info.autoReset=false;host.append(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(17,16/9,.05,120);
const loader=new GLTFLoader();loader.register(p=>new VRMLoaderPlugin(p));
const texLoader=new THREE.TextureLoader();
const state={data:null,vrm:null,pose:null,ready:false,error:null,frames:[],bench:null,reader:null,look:null};

class BalconyCamera extends FixedCamera{
 constructor(cam,data){super(cam);this.data=data;}
 frame(){
  this.camera.position.fromArray(this.data.position);this.camera.quaternion.fromArray(this.data.quaternion);
  this.base.copy(this.camera.quaternion);this.yaw=this.pitch=this.targetYaw=this.targetPitch=0;
 }
}
let rig=null;
const rad=THREE.MathUtils.degToRad;
function fitCamera(){
 const w=host.clientWidth,h=host.clientHeight,a=w/h,d=state.data.camera;
 // Keep the authored 16:9 framing; wider screens crop top and bottom, narrower ones crop the sides.
 camera.fov=a>=16/9?THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(rad(d.display_hfov_deg)/2)/a)):d.display_vfov_deg;
 camera.aspect=a;camera.updateProjectionMatrix();renderer.setSize(w,h);
}
function card(texture,hfov,vfov,distance,order,transparent){
 const d=state.data.camera,q=new THREE.Quaternion().fromArray(d.quaternion);
 const geo=new THREE.PlaneGeometry(2*distance*Math.tan(rad(hfov)/2),2*distance*Math.tan(rad(vfov)/2));
 texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
 const mat=new THREE.MeshBasicMaterial({map:texture,toneMapped:false,depthTest:false,depthWrite:false,transparent});
 const mesh=new THREE.Mesh(geo,mat);mesh.quaternion.copy(q);
 mesh.position.fromArray(d.position).add(new THREE.Vector3(0,0,-distance).applyQuaternion(q));
 mesh.renderOrder=order;mesh.frustumCulled=false;scene.add(mesh);return mesh;
}
function applyStaticPose(){
 const vrm=state.vrm,v0=vrm.meta.metaVersion==='0';
 for(const t of state.pose.tracks){
  const node=vrm.humanoid.getNormalizedBoneNode(t.bone);if(!node)continue;
  node.quaternion.fromArray(t.rotations,0);if(v0){node.quaternion.x*=-1;node.quaternion.z*=-1;}
 }
}
function placeCharacter(){
 const vrm=state.vrm,c=state.data.character;
 vrm.scene.scale.setScalar(c.scale);vrm.scene.rotation.y+=rad(c.yaw_deg);
 applyStaticPose();vrm.update(0);vrm.scene.updateMatrixWorld(true);
 const hip=vrm.humanoid.getRawBoneNode('hips').getWorldPosition(new THREE.Vector3());
 vrm.scene.position.add(new THREE.Vector3().fromArray(c.hips).sub(hip));vrm.scene.updateMatrixWorld(true);
}
async function load(){
 const r=await fetch(BASE+'balcony.json');if(!r.ok)throw Error('balcony.json: HTTP '+r.status);
 const data=state.data=await r.json();
 rig=new BalconyCamera(camera,data.camera);rig.frame();bindCameraLook(renderer.domElement,rig);fitCamera();
 new ResizeObserver(fitCamera).observe(host);
 const [plate,fg,occluder,book,pose,vrmBuffer]=await Promise.all([
  texLoader.loadAsync(BASE+data.plate.image),texLoader.loadAsync(BASE+data.foreground.image),
  loader.loadAsync(VISIBLE_CHAIR),loader.loadAsync(BASE+data.book),
  fetch(data.pose).then(r=>{if(!r.ok)throw Error('pose: HTTP '+r.status);return r.json();}),
  fetch(data.vrm).then(r=>{if(!r.ok)throw Error('character: HTTP '+r.status);return r.arrayBuffer();}),
 ]);
 card(plate,data.plate.hfov_deg,data.plate.vfov_deg,60,0,false);
 card(fg,data.plate.hfov_deg,data.plate.vfov_deg,1.0,10,true);
 scene.add(state.chair=prepareChair(occluder.scene,plate,pictureCamera(data.camera.position,data.camera.quaternion,data.plate.hfov_deg,data.plate.vfov_deg)));
 book.scene.traverse(o=>{if(o.isMesh){o.renderOrder=2;o.castShadow=true;}});scene.add(book.scene);
 readVRMDocument(vrmBuffer);
 const gltf=await loader.parseAsync(vrmBuffer,'');const vrm=state.vrm=gltf.userData.vrm;
 VRMUtils.removeUnnecessaryVertices(vrm.scene);VRMUtils.combineSkeletons(vrm.scene);VRMUtils.rotateVRM0(vrm);
 vrm.scene.traverse(o=>{if(o.isMesh){o.renderOrder=2;o.frustumCulled=false;o.castShadow=true;}});
 state.pose=pose;placeCharacter();scene.add(vrm.scene);state.seat=seatCharacter(vrm,state.chair);calibrateChairContact(state.chair,vrm);
 const look=state.look=new THREE.Object3D();look.position.fromArray(data.look_target);scene.add(look);
 if(vrm.lookAt){vrm.lookAt.target=look;vrm.lookAt.autoUpdate=true;}
 // The book rides in her hands; the reader drives the reading motion and the occasional stretch break.
 vrm.update(0);vrm.scene.updateMatrixWorld(true);
 const authored=await fetch('/models/marycia/authored-motions.json').then(r=>r.ok?r.json():null).catch(()=>null);
 state.reader=new Reader(vrm,book.scene,pose,look,{seed:+(params.get('seed')??7),eventScale:+(params.get('events')??1),authored,
  stretchAt:params.has('stretch')?+params.get('stretch'):undefined,lines:params.has('lines')?+params.get('lines'):undefined,
  shoulders:params.get('shoulders')!=='0',torso:params.get('torso')!=='0'});
 const s=data.light;
 const sun=new THREE.DirectionalLight(new THREE.Color().fromArray(s.color),s.intensity);sun.position.fromArray(s.direction).multiplyScalar(10).add(new THREE.Vector3().fromArray(data.character.hips));
 sun.target.position.fromArray(data.character.hips);scene.add(sun,sun.target);enableChairShadows(renderer,scene,new THREE.Vector3().fromArray(data.character.hips),s.direction);
 scene.add(new THREE.HemisphereLight(new THREE.Color().fromArray(s.sky),new THREE.Color().fromArray(s.ground),s.ambient));
 state.ready=true;$('status').textContent='Marycia is reading. Drag to look around a little.';
 if(params.has('stats'))$('stats').hidden=false;
}
function snapshot(){
 const i=renderer.info,f=[...state.frames].sort((a,b)=>a-b);
 const res=performance.getEntriesByType('resource').filter(e=>/balcony-plate|models\/marycia/.test(e.name));
 return {ready:state.ready,error:state.error,calls:i.render.calls,triangles:i.render.triangles,textures:i.memory.textures,geometries:i.memory.geometries,
  medianFrameMs:f.length?f[f.length>>1]:null,p95FrameMs:f.length?f[Math.floor(f.length*.95)]:null,frames:f.length,
  transferBytes:res.reduce((n,e)=>n+(e.transferSize||e.encodedBodySize||0),0),resources:res.map(e=>({url:e.name.replace(location.origin,''),bytes:e.encodedBodySize})),
  drawingBuffer:[renderer.domElement.width,renderer.domElement.height],pixelRatio:renderer.getPixelRatio(),camera:rig?.snapshot()};
}
let last=performance.now();
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.1);last=now;
 if(state.ready&&state.frames.length<600)state.frames.push(dt*1000);
 renderer.info.reset();
 if(state.reader){
  state.reader.update(dt);state.seat.update();
  state.vrm.update(dt);updateChairContact(state.chair,state.vrm);
 }
 rig?.update(dt);renderer.render(scene,camera);
 if(params.has('stats')&&state.ready&&state.frames.length%20===0){const s=snapshot();$('stats').textContent=`calls ${s.calls}  tris ${s.triangles}\ntextures ${s.textures}\nframe ${s.medianFrameMs?.toFixed(1)} ms (p95 ${s.p95FrameMs?.toFixed(1)})\ndownload ${(s.transferBytes/1048576).toFixed(1)} MiB`;}
}
requestAnimationFrame(frame);
const JOINTS=['hips','spine','chest','neck','head','leftShoulder','leftUpperArm','leftLowerArm','leftHand','rightShoulder','rightUpperArm','rightLowerArm','rightHand','leftUpperLeg','leftLowerLeg','leftFoot','rightLowerLeg','rightFoot'];
const joints=()=>state.vrm?Object.fromEntries(JOINTS.map(n=>[n,state.vrm.humanoid.getRawBoneNode(n)?.getWorldPosition(new THREE.Vector3()).toArray().map(v=>+v.toFixed(4))])):null;
window.lofiBalcony={joints,lapGap:()=>{const R=state.reader;if(!R?.stretch?.active||!R.lap.meshes)return null;const pages=R.reading.book;pages.updateWorldMatrix(true,false);
 const e=pages.matrixWorld.elements,n=new THREE.Vector3(e[4],e[5],e[6]).normalize(),o=pages.getWorldPosition(new THREE.Vector3()),rc=new THREE.Raycaster(),out=[];
 for(const [dx,dz] of [[0,0],[.1,.07],[-.1,.07],[.1,-.07],[-.1,-.07]]){const p=new THREE.Vector3(dx,0,dz).applyMatrix4(pages.matrixWorld).addScaledVector(n,.05);rc.set(p,n.clone().negate());const hit=rc.intersectObjects(R.lap.meshes,false)[0];out.push(hit?+((hit.distance-.05)*1000).toFixed(0):null);}
 return {gapMm:out,tiltDeg:+(Math.acos(Math.min(1,Math.abs(n.y)))*57.3).toFixed(1)};},torsoDepth:()=>{const v=state.vrm,P=n=>v.humanoid.getNormalizedBoneNode(n).getWorldPosition(new THREE.Vector3());
 const up=P('neck').sub(P('hips')).normalize(),r=P('rightUpperArm').sub(P('leftUpperArm'));r.addScaledVector(up,-r.dot(up)).normalize();const f=new THREE.Vector3().crossVectors(up,r).normalize();
 const rc=new THREE.Raycaster(),out={};const meshes=[];v.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const [name,base] of [['chest',P('chest')],['spine',P('spine')],['upper',P('chest').lerp(P('neck'),.5)]])for(const side of [-1,-.5,0,.5,1]){
  const o=base.clone().addScaledVector(r,side*.09).addScaledVector(f,.5);rc.set(o,f.clone().negate());const h=rc.intersectObjects(meshes,false)[0];
  out[name+side]=h?+(.5-h.distance).toFixed(3):null;}
 return out;},armInTorso:()=>state.vrm?+(armInTorso(state.vrm)*1000).toFixed(1):null,stretch:()=>{const R=state.reader,S=R?.stretch;return S&&{active:S.active,t:+S.t.toFixed(2),w:+S.weight().toFixed(2),phase:+S.phase().toFixed(2),next:+(R.nextStretch-R.time).toFixed(1),book:R.reading.book.getWorldPosition(new THREE.Vector3()).toArray().map(v=>+v.toFixed(3))};},handInBook:()=>{const r=state.reader?.reading;if(!r)return null;r.book.updateWorldMatrix(true,false);const inv=new THREE.Matrix4().copy(r.book.matrixWorld).invert();let n=0,w='';
 for(const b of ['rightHand','rightThumbProximal','rightThumbDistal','rightIndexProximal','rightIndexDistal','rightMiddleProximal','rightMiddleDistal','rightRingDistal','rightLittleDistal']){const nd=state.vrm.humanoid.getRawBoneNode(b);if(!nd)continue;const p=nd.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);if(p.y>.003&&p.y<.034&&Math.abs(p.z)<.11&&.145-Math.abs(p.x)>n){n=.145-Math.abs(p.x);w=b+' y='+p.y.toFixed(3);}}return {mm:+(n*1000).toFixed(1),joint:w};},gripError:()=>{const G=state.reader?.grip;if(!G)return null;const g=G.rightGrip(new THREE.Vector3()),h=state.vrm.humanoid.getRawBoneNode('rightHand').getWorldPosition(new THREE.Vector3());return +(g.distanceTo(h)*1000).toFixed(1);},reading:()=>{const g=state.reader?.reading;return g&&{time:+g.time.toFixed(2),page:g.page,line:g.line,away:+g.away.toFixed(2),head:g.head,turn:g.turn?{p:+g.turnInfo.progress.toFixed(2),hand:+g.turnInfo.hand.toFixed(2)}:null,gaze:state.look.position.toArray().map(v=>+v.toFixed(3))};},meta:()=>state.vrm?.meta?.metaVersion,snapshot,ready:()=>state.ready,resetFrames:()=>{state.frames=[];},look:(x,y)=>rig?.look(x,y)};
load().catch(e=>{state.error=e.message;$('status').textContent='Could not open the balcony: '+e.message;console.error(e);});
