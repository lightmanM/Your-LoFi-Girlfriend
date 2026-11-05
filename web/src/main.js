import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin, VRMUtils} from '@pixiv/three-vrm';
import {CharacterAdapter} from './character-adapter.js';
import {readVRMDocument} from './vrm-file.js';
import './style.css';

const $ = id => document.getElementById(id);
const SOURCE = '/models/vivi/vivi.vrm';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let current = null;
let loading = false;
let displayName = '';
let boundsHeight = 1.6;
let loadSequence = 0;
let successfulLoads = 0;
let disposedCharacters = 0;
let lastError = null;
let renderer;
let scene;
let camera;
let orbit;
const loader = new GLTFLoader();
loader.register(parser => new VRMLoaderPlugin(parser));

function setMessage(text, error = false) {
  $('message').textContent = text;
  $('message').style.color = error ? '#a94435' : '';
}

function updateControls() {
  const ready = !!current && !loading;
  for (const id of ['blink','look','pause','restore']) $(id).disabled = !ready;
  $('model-file').disabled = loading;
  $('smile').disabled = !ready || !current.report.capabilities.smile;
  $('mouth').disabled = !ready || !current.report.capabilities.mouth;
  $('blink').disabled = !ready || !current.report.capabilities.blink;
  $('look').disabled = !ready || !current.vrm.lookAt;
  document.querySelectorAll('[data-pose]').forEach(button => {
    button.disabled = !ready;
    button.classList.toggle('selected', button.dataset.pose === current?.pose);
  });
}

function frame(mode) {
  if (!current) return;
  const head = new THREE.Vector3();
  current.vrm.humanoid.getRawBoneNode('head').getWorldPosition(head);
  if (mode === 'face') {
    orbit.target.copy(head).add(new THREE.Vector3(0,boundsHeight*.055,0));
    camera.position.copy(orbit.target).add(new THREE.Vector3(boundsHeight*.045,boundsHeight*.012,boundsHeight*.65));
    orbit.minDistance = boundsHeight*.28;
  } else {
    orbit.target.set(0,boundsHeight*.52,0);
    const distance = boundsHeight*(camera.aspect<.85 ? 2.5 : 2.2);
    camera.position.set(boundsHeight*.24,boundsHeight*.75,distance);
    orbit.minDistance = boundsHeight*.5;
  }
  orbit.update();
  $('view-label').textContent = mode==='face' ? 'FACE & EXPRESSIONS' : 'FULL BODY';
  $('face-view').classList.toggle('selected',mode==='face');
  $('body-view').classList.toggle('selected',mode!=='face');
}

function disposeVRM(vrm) {
  vrm.scene.removeFromParent();
  VRMUtils.deepDispose(vrm.scene);
}

async function replaceCharacter(buffer, name, {bundled = false, credit = null} = {}) {
  // Keep the old character rendering until a complete new character is validated.
  const sequence = ++loadSequence;
  loading = true; updateControls();
  if (!current) $('loading').hidden = false;
  $('progress').textContent = 'Decoding model, textures and skeleton…';
  setMessage(`Preparing ${name}…`);
  let candidateScene;
  let candidate;
  try {
    const document = readVRMDocument(buffer);
    const gltf = await loader.parseAsync(buffer,'');
    candidateScene = gltf.scene;
    candidate = gltf.userData.vrm;
    const adapter = new CharacterAdapter(candidate);
    VRMUtils.rotateVRM0(candidate);
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    candidate.scene.traverse(object => {
      if (object.isMesh) {object.castShadow = true; object.frustumCulled = false;}
    });
    candidate.update(0);
    candidate.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(candidate.scene);
    const height = box.max.y-box.min.y;
    if (!Number.isFinite(height) || height < .2 || height > 5) throw new Error('Unexpected character scale. Export in meters before loading.');
    candidate.scene.position.y -= box.min.y;
    candidate.scene.updateMatrixWorld(true);
    if (sequence !== loadSequence) {disposeVRM(candidate); return {superseded:true};}
    const previous = current;
    current = adapter; boundsHeight = height; displayName = name;
    scene.add(candidate.scene);
    if (previous) {disposeVRM(previous.vrm); disposedCharacters++;}
    successfulLoads++;
    lastError = null;
    $('model-title').textContent = name;
    $('model-label').textContent = name;
    $('model-description').textContent = credit ?? (bundled ? 'Official VRoid beta sample · CC0' : 'Your local VRM · original license applies');
    $('bones').textContent = 'Mapped';
    $('expressions').textContent = current.report.capabilities.smile && current.report.capabilities.blink ? 'Smile + blink' : 'Partial';
    $('fingers').textContent = current.report.capabilities.fingers ? 'Available' : 'Limited';
    $('smile').value = '0'; $('smile-value').textContent = '0%'; $('mouth').value = '0';
    $('look').setAttribute('aria-pressed','false'); $('pause').textContent = 'Pause idle movement';
    $('technical').textContent = JSON.stringify({name, format:document.extensions.VRM?'VRM 0.x':'VRM 1.x',
      sourceBytes:buffer.byteLength, heightMeters:Number(height.toFixed(3)), ...adapter.report},null,2);
    frame('body');
    setMessage(`${name} is ready. Try the face controls or load another VRM to check replacement.`);
    return {name, ...adapter.snapshot()};
  } catch (error) {
    if (candidateScene && candidateScene !== current?.vrm.scene) VRMUtils.deepDispose(candidateScene);
    lastError = error.message;
    setMessage(`${error.message}${current ? ' The current character has been kept.' : ' Try loading a local VRM file.'}`,true);
    return {error:error.message};
  } finally {
    if (sequence === loadSequence) {loading = false; $('loading').hidden = true; updateControls();}
  }
}

async function restore() {
  if (loading) return;
  loading = true; updateControls();
  if (!current) $('loading').hidden = false;
  setMessage('Downloading the Vivi placeholder…');
  try {
    const response = await fetch(SOURCE);
    if (!response.ok) throw new Error(`Could not download the model (HTTP ${response.status}).`);
    const bytes = await response.arrayBuffer();
    return await replaceCharacter(bytes,'Vivi',{bundled:true});
  } catch (error) {
    lastError = error.message;
    setMessage(error.message,true);
    return {error:error.message};
  } finally {loading = false; $('loading').hidden = true; updateControls();}
}

async function boot() {
  const host = $('canvas-host');
  renderer = new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000,0);
  host.append(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30,1,.05,40);
  camera.position.set(.4,1.2,3.2);
  orbit = new OrbitControls(camera,renderer.domElement);
  orbit.enableDamping = true; orbit.dampingFactor = .08;
  orbit.target.set(0,.8,0); orbit.maxDistance=8; orbit.maxPolarAngle=Math.PI*.55;
  scene.add(new THREE.HemisphereLight(0xfff9ef,0x667b62,1.3));
  const key = new THREE.DirectionalLight(0xfff4df,1.5);
  key.position.set(-2.5,4,3);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024); key.shadow.camera.left=-2;key.shadow.camera.right=2;
  key.shadow.camera.top=3;key.shadow.camera.bottom=-1;key.shadow.normalBias=.025;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe5eeff,1.2);fill.position.set(3,2,-2);scene.add(fill);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.5,96),new THREE.ShadowMaterial({opacity:.15}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.64,.646,96),new THREE.MeshBasicMaterial({color:0xa3b49a,transparent:true,opacity:.4,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2;ring.position.y=-.002;scene.add(ring);

  new ResizeObserver(() => {
    const width=host.clientWidth,height=host.clientHeight;
    renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();
  }).observe(host);
  let lastTime = performance.now();
  function render(time) {
    requestAnimationFrame(render);
    const dt=(time-lastTime)/1000;lastTime=time;
    if(document.hidden)return;
    current?.update(dt,camera,reducedMotion.matches);
    orbit.update();renderer.render(scene,camera);
  }
  requestAnimationFrame(render);
  if (new URLSearchParams(location.search).get('character') === 'marycia') {
    const response = await fetch('/models/marycia/marycia.vrm');
    if (!response.ok) throw new Error(`Could not load Marycia (HTTP ${response.status}).`);
    await replaceCharacter(await response.arrayBuffer(), 'Marycia', {credit:'Marycia · ©BeroarN · working conversion'});
  } else {
    await restore();
  }
}

$('smile').oninput = event => {current?.setSmile(Number(event.target.value));$('smile-value').textContent=`${Math.round(Number(event.target.value)*100)}%`;};
$('mouth').oninput = event => current?.setMouth(Number(event.target.value));
$('blink').onclick = () => current?.blink();
$('look').onclick = () => {if(current){current.lookAtViewer=!current.lookAtViewer;$('look').setAttribute('aria-pressed',String(current.lookAtViewer));}};
$('pause').onclick = () => {if(current){current.paused=!current.paused;$('pause').textContent=current.paused?'Resume idle movement':'Pause idle movement';}};
document.querySelectorAll('[data-pose]').forEach(button=>button.onclick=()=>{current?.setPose(button.dataset.pose);updateControls();});
$('body-view').onclick=()=>frame('body');$('face-view').onclick=()=>frame('face');
$('restore').onclick=()=>void restore();
$('model-file').onchange=async event=>{
  const file=event.target.files[0];if(!file||loading)return;
  if(file.size>64*1024*1024){setMessage('Choose a VRM no larger than 64 MiB for this development viewer.',true);return;}
  await replaceCharacter(await file.arrayBuffer(),file.name.replace(/\.vrm$/i,''));
  event.target.value='';
};

window.characterLab={
  ready:()=>!!current&&!loading,
  snapshot:()=>({name:displayName,loading,successfulLoads,disposedCharacters,lastError,heightMeters:boundsHeight,
    character:current?.snapshot(),canvasCount:document.querySelectorAll('canvas').length,
    memory:renderer?{...renderer.info.memory}:null,render:renderer?{...renderer.info.render}:null,
    mappedBones:current?.vrm.humanoid.humanBones?Object.keys(current.vrm.humanoid.humanBones):[],
    expressions:current?.vrm.expressionManager?.expressions.map(e=>e.expressionName),
    facialWeights:current?{blink:current.vrm.expressionManager?.getValue('blink'),happy:current.vrm.expressionManager?.getValue('happy')}:null,
    joints:current?Object.fromEntries(['head','leftUpperArm','leftLowerArm','leftHand','rightUpperArm','rightLowerArm','rightHand'].map(name=>[name,{
      world:current.vrm.humanoid.getRawBoneNode(name).getWorldPosition(new THREE.Vector3()).toArray(),
      normalizedLocal:current.vrm.humanoid.getNormalizedBoneNode(name).position.toArray(),
    }])):null}),
  replace:replaceCharacter,restore,
};
boot().catch(error=>{lastError=error.message;$('loading').hidden=true;setMessage(`The 3D viewer could not start: ${error.message}`,true);});
