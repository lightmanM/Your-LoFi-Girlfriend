import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm';
import {readVRMDocument} from '../vrm-file.js';
import {SOURCE_ACTIONS} from './source-motion.js';
import {CompanionCharacter} from './character.js';
import {createRoomView} from './room-scene.js';
import './room.css';

const $=id=>document.getElementById(id);
const view=createRoomView($('room-canvas'));
const loader=new GLTFLoader();loader.register(p=>new VRMLoaderPlugin(p));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let character=null,library=null,environment=null,loading=true,error=null,modelName='Marycia',demo=false;
let last=performance.now(),uiTime=0,cyclesBeforeDemo=0,loadCount=0,modelLoads=0;
const transitions=[];
let previousState='loading';
const metrics={frameMs:[],maxJointStep:0,frames:0};
const lastJoints=new Map();
async function fetchData(url,type='arrayBuffer'){
 const r=await fetch(url);if(!r.ok)throw Error(`${url}: HTTP ${r.status}`);loadCount++;return r[type]();
}
function enable(){
 for(const id of ['hello','source-action','demo','pause-room','room-model','restore-room','load-marycia'])$(id).disabled=loading||!character;
}
// Hold the loading lock across file reads/downloads as well as decoding.
async function loadCharacter(readBuffer,name,profile='generic'){
 if(loading&&character)return false;
 loading=true;enable();let candidate;
 try{
  const buffer=await readBuffer();
  readVRMDocument(buffer);
  const gltf=await loader.parseAsync(buffer,'');candidate=gltf.userData.vrm;
  if(!candidate)throw Error('The file has no VRM character');
  VRMUtils.removeUnnecessaryVertices(candidate.scene);VRMUtils.combineSkeletons(candidate.scene);
  const next=new CompanionCharacter(candidate,library,profile);next.vrm.update(0);next.vrm.scene.updateMatrixWorld(true);
  // Scene anchor is independent of raw skeleton names; swap-specific contacts still need tuning.
  const hip=next.vrm.humanoid.getRawBoneNode('hips').getWorldPosition(new THREE.Vector3());
  next.vrm.scene.position.set(-.35,.475-hip.y,-.57);
  next.interaction.paused=reduced.matches;next.speed=Number($('speed').value);
  view.scene.add(next.vrm.scene);character?.dispose();character=next;candidate=null;
  environment?.traverse(o=>{if(o.name.startsWith('Vivi_LapThrow'))o.visible=profile==='vivi';});
  view.setCharacter(next.vrm.scene);
  modelName=name;
  $('character-label').textContent=name;
  document.querySelector('.room').setAttribute('aria-label',`Interactive cozy room with ${name}`);
  modelLoads++;error=null;lastJoints.clear();metrics.maxJointStep=0;
  $('pause-room').textContent=next.interaction.paused?'Resume':'Pause';$('pause-room').setAttribute('aria-pressed',String(next.interaction.paused));
  $('model-status').textContent=`${name} · seated anchor loaded; check fit and clothing when replacing`;
  demo=false;previousState='loading';
  return true;
 }catch(e){if(candidate)VRMUtils.deepDispose(candidate.scene);error=e.message;$('model-status').textContent=`${e.message}${character?' · Current character kept.':''}`;return false;}
 finally{loading=false;enable();}
}
function replace(buffer,name,profile='generic'){return loadCharacter(()=>buffer,name,profile);}
function greet(name=$('source-action').value){
 if(!character||loading)return;
 if(character.interaction.paused){character.interaction.paused=false;$('pause-room').textContent='Pause';$('pause-room').setAttribute('aria-pressed','false');}
 character.request(name);
}
for(const [value,{label}] of Object.entries(SOURCE_ACTIONS))$('source-action').add(new Option(label,value));
$('hello').onclick=()=>greet();
$('pause-room').onclick=()=>{const c=character.interaction;c.paused=!c.paused;$('pause-room').textContent=c.paused?'Resume':'Pause';$('pause-room').setAttribute('aria-pressed',String(c.paused));};
$('camera-reset').onclick=view.reset;
$('mood').onchange=e=>{const enabled=e.target.value==='golden-hour';view.setMood(enabled);document.body.dataset.mood=enabled?'golden-hour':'baseline';};
$('inspect-toggle').onclick=()=>{$('inspector').hidden=!$('inspector').hidden;};
$('speed').onchange=()=>{if(character)character.speed=Number($('speed').value);};
$('demo').onclick=()=>{
 if(!character)return;
 $('inspector').hidden=false;demo=true;cyclesBeforeDemo=character.interaction.completed;
 greet();greet(); // The second request exercises the bounded follow-up queue.
};
$('room-model').onchange=async e=>{
 const file=e.target.files[0];if(!file||loading)return;
 if(file.size>64*1024*1024){$('model-status').textContent='Choose a self-contained VRM smaller than 64 MiB.';return;}
 await loadCharacter(()=>file.arrayBuffer(),file.name.replace(/\.vrm$/i,''));e.target.value='';
};
$('load-marycia').onclick=()=>loadCharacter(()=>fetchData('/models/marycia/marycia.vrm'),'Marycia','marycia');
$('restore-room').onclick=()=>loadCharacter(()=>fetchData('/models/vivi/vivi.vrm'),'Vivi','vivi');
function ui(){
 if(!character)return;
 const s=character.interaction.snapshot();
 if(s.state!==previousState){transitions.push({state:s.state,time:character.time,cycle:s.started});if(transitions.length>60)transitions.shift();previousState=s.state;}
 $('status').textContent=s.paused?'Paused — resume whenever you like.':s.queued?'One more action is queued.':s.state==='acting'?`${modelName} · ${SOURCE_ACTIONS[character.action].label}`:s.state==='finishing'?'Settling back into a quiet moment…':'A quiet moment. Try a supplied expression or hand pose.';
 if(!$('inspector').hidden){
  document.querySelectorAll('[data-state]').forEach(e=>e.classList.toggle('active',e.dataset.state===s.state));
  $('idle-weight').textContent=`${Math.round((1-s.weight)*100)}%`;$('gesture-weight').textContent=`${Math.round(s.weight*100)}%`;
  $('idle-meter').value=1-s.weight;$('gesture-meter').value=s.weight;
  $('completed').textContent=s.completed;$('queued').textContent=s.queued?'1 follow-up':'None';
  if($('diagnostics').parentElement.open)$('diagnostics').textContent=JSON.stringify(snapshot(),null,2);
 }
 if(demo&&s.completed>=cyclesBeforeDemo+2&&s.state==='idle'){demo=false;$('demo').textContent='↻ Replay demonstration';$('status').textContent='Demonstration complete: two source actions returned to idle.';}
}
function snapshot(){
 return {ready:!!character&&!!environment&&!loading,modelName,error,modelLoads,loadCount,demo,
  ...character?.snapshot(),view:view.snapshot(),transitions:[...transitions],environmentObjects:environment?(()=>{let n=0;environment.traverse(o=>{if(o.isMesh)n++;});return n;})():0,
  render:{...view.renderer.info.render},memory:{...view.renderer.info.memory},frames:metrics.frames,
  maxJointStepMeters:metrics.maxJointStep,canvasCount:document.querySelectorAll('canvas').length};
}
function render(now){
 requestAnimationFrame(render);const dt=(now-last)/1000;last=now;
 if(document.hidden)return;
 if(character){
  character.update(dt,view.camera,{reducedMotion:reduced.matches});
  for(const name of ['leftHand','rightHand','head']){
   const p=character.vrm.humanoid.getRawBoneNode(name).getWorldPosition(new THREE.Vector3());
   if(lastJoints.has(name))metrics.maxJointStep=Math.max(metrics.maxJointStep,p.distanceTo(lastJoints.get(name)));
   lastJoints.set(name,p);
  }
 }
 view.render(dt,{paused:character?.interaction.paused??true,reducedMotion:reduced.matches});metrics.frames++;
 uiTime+=dt;if(uiTime>.08){ui();uiTime=0;}
}
window.lofiRoom={ready:()=>!!character&&!!environment&&!loading,snapshot,greet,replace,
 resetMetrics:()=>{metrics.maxJointStep=0;metrics.frames=0;lastJoints.clear();},
};
requestAnimationFrame(render);
try{
 const useVivi=new URLSearchParams(location.search).get('character')==='vivi';
 const initial=useVivi?{url:'/models/vivi/vivi.vrm',name:'Vivi',profile:'vivi'}:{url:'/models/marycia/marycia.vrm',name:'Marycia',profile:'marycia'};
 const [env,motions,buffer]=await Promise.all([
  loader.loadAsync('/environment/afternoon-room.glb'),fetchData('/models/marycia/source-motions.json','json'),fetchData(initial.url),
 ]);
 environment=view.addEnvironment(env);library=motions;
 if(!await replace(buffer,initial.name,initial.profile))throw Error(error);
 $('loader').hidden=true;enable();ui();
}catch(e){error=e.message;loading=false;$('load-detail').textContent=`Could not open the room: ${e.message}. Reload to retry.`;$('loader').querySelector('strong').textContent='Room unavailable';$('loader').querySelector('.loading-ring').hidden=true;}
