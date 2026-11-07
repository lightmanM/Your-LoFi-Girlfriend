// The viewer: what a visitor sees. A warm afternoon on the balcony, rendered once in Blender as a toon picture, with
// Marycia live in front of it: reading most of the time (page turns, looking up, shifting in her seat) and now and
// then putting the book down to stretch. No controls; the camera stays still, like a video that never repeats.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm';
import {Reader} from '../balcony/reader.js';
import {GRADE,gradeMaterial} from './grade.js';
import {seatCharacter} from '../balcony/seat.js';
import {Wind,PLANTS,plateMaterial,leavesMaterial} from './wind.js';
import {livePlants,PLANTS3D} from './plants.js';
import {createMusic} from '../music/player.js';
import {bindMusicControls} from '../music/controls.js';
import {VISIBLE_CHAIR,CHAIR_SHADOW,CHAIR_CONTACT,prepareChair,pictureCamera,enableChairShadows,updateChairContact,calibrateChairContact} from '../balcony/visible-chair.js';

const BASE='/environment/balcony-toon/';
// Light on her, matched by eye to the toon picture: warm low sun through the door, a sky fill, warm bounce below.
const LIGHT={sunIntensity:2.0,sunColor:[1,.72,.5],sky:[.95,.78,.62],ground:[.59,.48,.38],fill:.6};
// ?light=sun,fill,r,g,b,sr,sg,sb for tuning against the Blender picture
if(new URLSearchParams(location.search).has('light')){const v=new URLSearchParams(location.search).get('light').split(',').map(Number);
 Object.assign(LIGHT,{sunIntensity:v[0],fill:v[1],sky:v.slice(2,5),sunColor:v.length>=8?v.slice(5,8):null,ground:v.slice(2,5).map(x=>x*.62)});}
const FOCUS_X=.74;            // where she sits across the picture (0 left, 1 right): narrow screens crop around her
const host=document.getElementById('stage'),note=document.getElementById('note');
const params=new URLSearchParams(location.search);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;
host.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(17,16/9,.05,120);
const loader=new GLTFLoader();loader.register(p=>new VRMLoaderPlugin(p));
const state={data:null,vrm:null,reader:null,ready:false,error:null,frames:[]};
const rad=THREE.MathUtils.degToRad;

// Cover the screen with the authored 16:9 frame; on narrower screens keep her in view rather than the frame's centre.
function fit(){
 const w=host.clientWidth,h=host.clientHeight,a=w/h,c=state.data.camera,k=16/9;
 camera.fov=c.vfov_deg;camera.aspect=k;
 if(a>=k){const fullH=w/k;camera.setViewOffset(w,fullH,0,(fullH-h)/2,w,h);}
 else{const fullW=h*k,x=THREE.MathUtils.clamp(fullW*FOCUS_X-w/2,0,fullW-w);camera.setViewOffset(fullW,h,x,0,w,h);}
 camera.updateProjectionMatrix();renderer.setSize(w,h);
}
// A picture layer: a plane filling the camera's view at a distance, drawn in a fixed order around her.
function layer(material,distance,order){
 const c=state.data.camera,q=new THREE.Quaternion().fromArray(c.quaternion);
 const geo=new THREE.PlaneGeometry(2*distance*Math.tan(rad(c.hfov_deg)/2),2*distance*Math.tan(rad(c.vfov_deg)/2));
 const mesh=new THREE.Mesh(geo,material);
 mesh.quaternion.copy(q);mesh.position.fromArray(c.position).add(new THREE.Vector3(0,0,-distance).applyQuaternion(q));
 mesh.renderOrder=order;mesh.frustumCulled=false;scene.add(mesh);return mesh;
}
function place(vrm,pose,c){
 vrm.scene.scale.setScalar(c.scale);vrm.scene.rotation.y+=rad(c.yaw_deg);
 for(const t of pose.tracks){const n=vrm.humanoid.getNormalizedBoneNode(t.bone);if(n)n.quaternion.fromArray(t.rotations,0);}
 vrm.update(0);vrm.scene.updateMatrixWorld(true);
 const hip=vrm.humanoid.getRawBoneNode('hips').getWorldPosition(new THREE.Vector3());
 vrm.scene.position.add(new THREE.Vector3().fromArray(c.hips).sub(hip));vrm.scene.updateMatrixWorld(true);
}
// Test hooks (not shown to visitors): ?character=<file>.vrm in the same folder, ?seed=N, ?still=T freezes her at
// T seconds, stepped at a fixed rate so every run shows exactly the same pose.
const character=d=>{const c=params.get('character');return c&&/^[\w.-]+\.vrm$/.test(c)?d.vrm.replace(/[^/]+$/,c):d.vrm;};
const json=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`${url}: HTTP ${r.status}`);return r.json();};
async function load(){
 const d=state.data=await json(BASE+'scene.json');
 // framing (spike/balcony-toon/framing.json): the chair and she sit offset along the floor; palm and leaves bend points
 const F=d.framing??{},off=new THREE.Vector3().fromArray(F.character_offset??[0,0,0]);
 d.character={...d.character,hips:new THREE.Vector3().fromArray(d.character.hips).add(off).toArray()};
 d.look_target=new THREE.Vector3().fromArray(d.look_target).add(off).toArray();
 if(F.palm_pivot)PLANTS.palm.pivots=[F.palm_pivot];
 if(F.leaves_pivot_shift)PLANTS.leaves.pivots=PLANTS.leaves.pivots.map(([x,y])=>[x+F.leaves_pivot_shift[0],y+F.leaves_pivot_shift[1]]);
 camera.position.fromArray(d.camera.position);camera.quaternion.fromArray(d.camera.quaternion);fit();new ResizeObserver(fit).observe(host);
 const tex=new THREE.TextureLoader();
 const [plate,leaves,chair,book,pose,vrmBuffer,authored,clean,field,plantMask,plants,cover,plantsFull,palmFull]=await Promise.all([
  tex.loadAsync(BASE+d.plate),tex.loadAsync(BASE+d.leaves),loader.loadAsync(VISIBLE_CHAIR),loader.loadAsync(BASE+d.book),json(d.pose),
  fetch(character(d)).then(r=>{if(!r.ok)throw Error('character: HTTP '+r.status);return r.arrayBuffer();}),
  fetch(d.authored).then(r=>r.ok?r.json():null).catch(()=>null),
  tex.loadAsync(BASE+d.wind.clean),tex.loadAsync(BASE+d.wind.field),tex.loadAsync(BASE+d.wind.mask),loader.loadAsync(BASE+d.wind.plants),
  tex.loadAsync(BASE+d.wind.cover),tex.loadAsync(BASE+d.wind.full),tex.loadAsync(BASE+d.wind.palm_full),
 ]);
 // the picture and the near leaves sway in one wind (wind.js)
 state.wind=new Wind();const palm={full:palmFull,overscan:d.wind.overscan,cover,near:d.wind.palm_near,depthRange:d.wind.depth_range};
 state.plateMat=plateMaterial(plate,clean,field,plantMask,false,palm);state.leavesMat=leavesMaterial(leaves);
 state.palmMat=plateMaterial(plate,clean,field,plantMask,true,palm);
 layer(state.plateMat,60,0);layer(state.palmMat,59,1.5);layer(state.leavesMat,1,10);
 // roses, balcony plants and ivy: live 3D, coloured from the picture at their rest position (whole where it hid them)
 const picCam=pictureCamera(d.camera.position,d.camera.quaternion,d.camera.hfov_deg,d.camera.vfov_deg);
 const windDir=new THREE.Vector3(1,0,0).applyQuaternion(picCam.quaternion).setY(0).normalize();   // toward screen right
 state.plants=livePlants(plants.scene,plate,plantMask,picCam,windDir,cover,plantsFull,d.wind.depth_range,d.wind.sheer_near);scene.add(state.plants);
 // ?shadow=r,g,b,opacity[,elevation,radius] for tuning her shadow on the chair against the Blender picture
 if(params.has('contact')){const v=params.get('contact').split(',').map(Number);CHAIR_CONTACT.strength=v[0];CHAIR_CONTACT.capsules.forEach(c=>{c[3]*=v[1]??1;});if(v.length>=5)CHAIR_CONTACT.color=v.slice(2,5);}
 if(params.has('shadow')){const v=params.get('shadow').split(',').map(Number);Object.assign(CHAIR_SHADOW,{color:v.slice(0,3),opacity:v[3],...(v.length>4?{elevation:v[4],radius:v[5]??7}:{})});}
 chair.scene.position.add(off);chair.scene.updateMatrixWorld(true);
 state.chair=prepareChair(chair.scene,plate,pictureCamera(d.camera.position,d.camera.quaternion,d.camera.hfov_deg,d.camera.vfov_deg));scene.add(state.chair);
 book.scene.position.add(off);book.scene.updateMatrixWorld(true);   // the book was exported at her old seat: it moves with her
 book.scene.traverse(o=>{if(o.isMesh){o.renderOrder=2;o.castShadow=true;state.bookMesh??=o;}});scene.add(book.scene);
 const vrm=state.vrm=(await loader.parseAsync(vrmBuffer,'')).userData.vrm;
 VRMUtils.removeUnnecessaryVertices(vrm.scene);VRMUtils.combineSkeletons(vrm.scene);VRMUtils.rotateVRM0(vrm);
 vrm.scene.traverse(o=>{if(o.isMesh){o.renderOrder=2;o.frustumCulled=false;o.castShadow=true;}});
 if(params.has('grade')){const v=params.get('grade').split(',').map(Number);Object.assign(GRADE,{gain:v[0],sat:v[1],warm:v.slice(2,5)});}
 for(const root of [vrm.scene,book.scene])root.traverse(o=>{if(o.isMesh)[o.material].flat().forEach(m=>gradeMaterial(m));});
 place(vrm,pose,d.character);scene.add(vrm.scene);
 state.seat=params.get('seat')==='0'?{drop:0,update(){}}:seatCharacter(vrm,state.chair);   // sit on the seat, not above it
 // the book was exported in her hands at her unseated height: it drops with her, before its grip is captured
 book.scene.position.y-=state.seat.drop;book.scene.updateMatrixWorld(true);
 state.contactRadii=calibrateChairContact(state.chair,vrm);
 const look=new THREE.Object3D();look.position.fromArray(d.look_target);scene.add(look);
 if(vrm.lookAt){vrm.lookAt.target=look;vrm.lookAt.autoUpdate=true;}
 const hips=new THREE.Vector3().fromArray(d.character.hips);
 const sun=new THREE.DirectionalLight(new THREE.Color().fromArray(LIGHT.sunColor??d.sun.color),LIGHT.sunIntensity);
 sun.position.copy(hips).addScaledVector(new THREE.Vector3().fromArray(d.sun.direction),10);sun.target.position.copy(hips);enableChairShadows(renderer,scene,hips,d.sun.direction);
 scene.add(sun,sun.target,new THREE.HemisphereLight(new THREE.Color().fromArray(LIGHT.sky),new THREE.Color().fromArray(LIGHT.ground),LIGHT.fill));
 state.reader=new Reader(vrm,book.scene,pose,look,{authored,seed:params.has('seed')?+params.get('seed'):(Math.random()*1e9)|0,
  random:params.has('seed')?()=>.5:Math.random,
  eventScale:+(params.get('events')??1),shoulders:params.get('shoulders')!=='0',stretchAt:params.has('stretch')?+params.get('stretch'):undefined});
 if(params.has('still')){const n=Math.round(+params.get('still')*60);for(let i=0;i<n;i++){state.reader.update(1/60);state.seat.update();vrm.update(1/60);}state.frozen=true;updateChairContact(state.chair,vrm);}
 state.ready=true;requestAnimationFrame(()=>host.classList.add('ready'));
}
let last=performance.now();
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.1);last=now;
 if(state.wind&&params.get('wind')!=='0'){
  const w=state.wind;w.update(state.frozen?0:dt);const u=state.plateMat.userData.uniforms,l=state.leavesMat.userData.uniforms;
  for(const U of [u,state.palmMat.userData.uniforms]){U.time.value=w.t;U.angPalm.value=-w.angle('palm');U.act.value.set(w.activity('palm'),0,0,0);}
  l.time.value=w.t;
  const deg=Math.PI/180*+(params.get('plantgain')??1);   // ?plantgain exaggerates the 3D plants' bend for checks
  state.plants?.userData.update(w.t,{ivy:w.sway('ivy')*PLANTS3D.ivy.bend*deg,roses:w.sway('roses')*PLANTS3D.roses.bend*deg,pots:w.sway('balcony')*PLANTS3D.pots.bend*deg},
   {ivy:w.activity('ivy'),roses:w.activity('roses'),pots:w.activity('balcony')});
  l.ang.value=w.angle('leaves');l.act.value=w.activity('leaves');
 }
 if(state.reader&&!state.frozen){state.reader.update(dt);state.seat.update();state.vrm.update(dt);updateChairContact(state.chair,state.vrm);if(state.frames.length<600)state.frames.push(dt*1000);}
 renderer.render(scene,camera);
}
requestAnimationFrame(frame);
// Background music: starts on the first click or tap (browsers block sound before a gesture). ?music=0 turns it off.
// ?musicstall=<s> shortens the wait before a track that will not start is skipped (for checks).
const music=params.get('music')==='0'?null:createMusic({startTimeout:params.has('musicstall')?+params.get('musicstall'):undefined});
const unbindMusic=music?bindMusicControls(music):null;
import.meta.hot?.dispose(()=>{unbindMusic?.();music?.dispose();});
// For automated checks only; nothing here is shown to visitors.
window.lofiViewer={wind:()=>state.wind&&{t:+state.wind.t.toFixed(1),force:+state.wind.force(state.wind.t).toFixed(2),palmDeg:+(state.wind.angle('palm')*57.3).toFixed(2),leavesDeg:+(state.wind.angle('leaves')*57.3).toFixed(2),gusts:state.wind.gusts?.length??0,next:+(state.wind.next-state.wind.t).toFixed(1)},pose:()=>{const h=state.vrm.humanoid,P=n=>h.getNormalizedBoneNode(n).getWorldPosition(new THREE.Vector3()).toArray().map(x=>+x.toFixed(3));
 const out=Object.fromEntries(['neck','chest','leftShoulder','rightShoulder','leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftHand','rightHand','head'].map(n=>[n,P(n)]));
 out.rot=Object.fromEntries(['leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftHand','rightHand','leftShoulder','rightShoulder'].map(n=>[n,h.getRawBoneNode(n).getWorldQuaternion(new THREE.Quaternion()).toArray().map(x=>+x.toFixed(4))]));
 out.book=state.bookMesh&&new THREE.Box3().setFromObject(state.bookMesh).getCenter(new THREE.Vector3()).toArray().map(x=>+x.toFixed(3));
 out.shoulderQ=['leftShoulder','rightShoulder'].map(n=>h.getNormalizedBoneNode(n).quaternion.toArray().map(x=>+x.toFixed(3)));out.stretch=state.reader.stretch&&{active:state.reader.stretch.active,w:+state.reader.stretch.weight().toFixed(2),t:+state.reader.stretch.t.toFixed(2)};return out;},seat:()=>({drop:+(state.seat?.drop??0).toFixed(3),contactRadii:state.contactRadii}),ready:()=>state.ready,error:()=>state.error,
 chair:()=>{const meshes=[];state.chair?.traverse(o=>{if(o.isMesh)meshes.push(o);});return {meshes:meshes.length,visible:meshes.every(o=>o.visible&&[o.material].flat().every(m=>m.colorWrite)),receivesShadows:meshes.some(o=>o.receiveShadow),shadowMap:renderer.shadowMap.enabled};},
 stats:()=>{const f=[...state.frames].sort((a,b)=>a-b),i=renderer.info;return {calls:i.render.calls,triangles:i.render.triangles,textures:i.memory.textures,medianFrameMs:f[f.length>>1]??null,p95FrameMs:f[Math.floor(f.length*.95)]??null};},
 grips:()=>state.reader?.gripsLocal(),hands:()=>state.reader?.handsLocal(),music:()=>music?.state()??null,musicSeekEnd:s=>music?.seekToEnd(s),
 reader:()=>{const r=state.reader;return r&&{time:+r.time.toFixed(1),line:r.reading.line,page:r.reading.page,stretch:!!r.stretch?.active,nextStretch:+(r.nextStretch-r.time).toFixed(1)};}};
load().catch(e=>{state.error=e.message;note.textContent='The balcony could not load. Please refresh.';console.error(e);});
