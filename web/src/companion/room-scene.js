import * as THREE from 'three';
import {FixedCamera,bindCameraLook} from './fixed-camera.js';
import {createAtmosphere,createWindowSky} from './atmosphere.js';

export function createRoomView(host){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.info.autoReset=false;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.setClearColor(0x6b6752);host.append(renderer.domElement);
 const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x6b6752,14,26);
 const camera=new THREE.PerspectiveCamera(41,1,.1,40);
 const controls=new FixedCamera(camera);bindCameraLook(renderer.domElement,controls);
 const ambient=new THREE.HemisphereLight(0xaebfcd,0x5b4232,.85);scene.add(ambient);
 const sun=new THREE.DirectionalLight(0xffd397,2.0);sun.position.set(-3.2,5,1.8);sun.castShadow=true;
 sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:16});sun.shadow.normalBias=.018;sun.shadow.bias=-.00015;sun.target.position.set(0,0,-.5);scene.add(sun,sun.target);
 const fill=new THREE.DirectionalLight(0xc5d9ed,.45);fill.position.set(3,2.5,4);scene.add(fill);
 const lamp=new THREE.PointLight(0xffc47b,3,3,2);lamp.position.set(1.05,.95,-.78);scene.add(lamp);
 const floorLamp=new THREE.PointLight(0xffc47b,2,2.4,2);floorLamp.position.set(-1.56,1.45,-.95);scene.add(floorLamp);
 const atmosphere=createAtmosphere(renderer,scene,camera);
 const originals=new Map();const characterMaterials=new Map();const skies=[];let mood=true;
 function setMood(enabled){
  mood=enabled;atmosphere.setEnabled(enabled);
  ambient.color.set(enabled?0xaebfcd:0xfff4dd);ambient.groundColor.set(enabled?0x5b4232:0x9a8d76);ambient.intensity=enabled?.85:2.2;
  sun.color.set(enabled?0xffd397:0xffe0a8);sun.intensity=enabled?2:3;fill.intensity=enabled?.45:.8;
  lamp.intensity=enabled?3:2.5;floorLamp.intensity=enabled?2:0;renderer.toneMappingExposure=enabled?1.05:1.12;
  for(const [m,original]of originals){
   m.color.copy(original.color);m.emissive?.copy(original.emissive);if(m.emissiveIntensity!==undefined)m.emissiveIntensity=original.emissiveIntensity;
   if(!enabled)continue;
   const n=m.name.toLowerCase();
   if(n.includes('wood')||n.includes('floor_')||n.includes('room_oak')||n.includes('room_trim'))m.color.multiplyScalar(.65);
   if(n.includes('carpet')&&n.includes('sofa'))m.color.set(0x697951);
   if(n.includes('room_sage'))m.color.set(0x4d6657);
   if(n.includes('_lamp')&&m.emissive){m.emissive.set(0xffb45e);m.emissiveIntensity=1.8;}
  }
  for(const [m,original]of characterMaterials){
   m.color.copy(original.color).multiplyScalar(enabled?.64:1);
   if(m.shadeColorFactor)m.shadeColorFactor.copy(original.shade).multiplyScalar(enabled?.64:1);
  }
  for(const s of skies)s.mesh.material=enabled?s.sky:s.original;
 }
 function frame(){controls.frame(host.clientWidth<700);}
 new ResizeObserver(()=>{
  renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();frame();atmosphere.resize(host.clientWidth,host.clientHeight);
 }).observe(host);frame();
 return {renderer,scene,camera,controls,reset:()=>controls.reset(),setMood,
  setCharacter(root){
   characterMaterials.clear();root.traverse(o=>{if(!o.isMesh)return;for(const m of(Array.isArray(o.material)?o.material:[o.material])){
    if(m.isMToonMaterial&&!characterMaterials.has(m))characterMaterials.set(m,{color:m.color.clone(),shade:m.shadeColorFactor.clone()});
   }});setMood(mood);
  },
  snapshot:()=>({camera:controls.snapshot(),mood:mood?'golden-hour':'baseline'}),
  render(dt,options){controls.update(dt);atmosphere.update(dt,options);atmosphere.render();},
  addEnvironment(gltf){
   gltf.scene.traverse(o=>{
    if(!o.isMesh)return;o.receiveShadow=true;o.castShadow=!/sky|curtain/i.test(o.name);
    for(const m of(Array.isArray(o.material)?o.material:[o.material])){
     if(m.color&&!originals.has(m))originals.set(m,{color:m.color.clone(),emissive:m.emissive?.clone(),emissiveIntensity:m.emissiveIntensity});
     if(/curtain/i.test(o.name))m.side=THREE.DoubleSide;
    }
    if(/Warm_outdoor_sky|Warm outdoor sky/i.test(o.name)){skies.push({mesh:o,original:o.material,sky:createWindowSky()});}
   });scene.add(gltf.scene);setMood(mood);return gltf.scene;
  },
 };
}
