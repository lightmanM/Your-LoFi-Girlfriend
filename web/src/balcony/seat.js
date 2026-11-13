// Seats her on the chair: the reading pose was authored against another chair height, so her bottom floated about
// 6 cm above this seat with only the thighs touching its front edge. seatCharacter() lowers her by that gap, keeps her
// feet where they were (both legs re-bend each frame, so the thighs settle flatter on the seat), and presses the
// shorts and skin flat where they would sink into the seat (a clamp in their vertex shaders, inside the seat outline).
import * as THREE from 'three';
import {reachLeg} from './arm-ik.js';

const PRESS=/CosA|SkinBody|Underwear/;            // outfit, body and underwear meshes of this model
const V=()=>new THREE.Vector3();

/** The seat panel of the visible chair: its top height and outline (world xz), from the fitted panel geometry. */
function seatOutline(chair){
 let panel=null;chair.traverse(o=>{if(!panel&&o.name==='Chair weave panel')panel=o;});
 if(!panel)return null;
 panel.updateWorldMatrix(true,false);const a=panel.geometry.attributes.position,ring=[];let top=-Infinity;
 for(let i=0;i<a.count;i+=3){const p=V().fromBufferAttribute(a,i+1).applyMatrix4(panel.matrixWorld);ring.push(new THREE.Vector2(p.x,p.z));top=Math.max(top,p.y);}
 return {top,ring};
}
function lowestSeatPoint(vrm,seat){
 let low=Infinity;const p=V();vrm.scene.updateMatrixWorld(true);
 vrm.scene.traverse(o=>{
  if(!o.isSkinnedMesh||!PRESS.test(o.name))return;
  const a=o.geometry.attributes,bones=o.skeleton.bones;
  for(let i=0;i<a.position.count;i++){
   let best=0,bw=0;for(let k=0;k<4;k++){const w=a.skinWeight.getComponent(i,k);if(w>bw){bw=w;best=a.skinIndex.getComponent(i,k);}}
   if(!/^Hips$/i.test(bones[best]?.name??''))continue;             // her bottom: vertices that follow the hips
   o.getVertexPosition(i,p);o.localToWorld(p);
   if(inside(seat.ring,p.x,p.z))low=Math.min(low,p.y);
  }
 });
 return low;
}
function inside(ring,x,z){let s=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],c=(b.x-a.x)*(z-a.y)-(b.y-a.y)*(x-a.x);if(c!==0){if(s===0)s=Math.sign(c);else if(Math.sign(c)!==s)return false;}}return true;}

function pressFlat(vrm,seat,depth=.10){
 const n=seat.ring.length,ring=seat.ring.map(p=>new THREE.Vector2(p.x,p.y)),depthU={value:depth};   // one setting for every material
 const decl=`uniform vec2 lofiSeatRing[${n}];uniform float lofiSeatTop;uniform float lofiSeatDepth;uniform mat4 lofiInvModel;
bool lofiInSeat(vec2 p){float s=0.;for(int i=0;i<${n};i++){vec2 a=lofiSeatRing[i],b=lofiSeatRing[(i+1)%${n}];float c=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);if(s==0.)s=sign(c);else if(sign(c)!=s&&c!=0.)return false;}return true;}`;
 const press=`{vec4 lofiW=modelMatrix*vec4(transformed,1.);if(lofiW.y<lofiSeatTop&&lofiW.y>lofiSeatTop-lofiSeatDepth&&lofiInSeat(lofiW.xz)){lofiW.y=lofiSeatTop;transformed=(lofiInvModel*lofiW).xyz;}}`;
 vrm.scene.traverse(o=>{
  if(!o.isSkinnedMesh||!PRESS.test(o.name))return;
  for(const m of [o.material].flat()){
   if(m.userData.lofiSeat)continue;m.userData.lofiSeat=true;
   const prev=m.onBeforeCompile;
   m.onBeforeCompile=(s,r)=>{
    prev?.call(m,s,r);
    s.uniforms.lofiSeatRing={value:ring};s.uniforms.lofiSeatTop={value:seat.top};s.uniforms.lofiSeatDepth=depthU;
    s.uniforms.lofiInvModel={value:o.userData.lofiInvModel??=new THREE.Matrix4()};
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\n'+decl).replace('#include <skinning_vertex>','#include <skinning_vertex>\n'+press);
   };
   const key=m.customProgramCacheKey?.bind(m);m.customProgramCacheKey=()=>(key?key():'')+'|lofiSeat'+n;m.needsUpdate=true;
  }
 });
 return amount=>{depthU.value=depth*Math.min(1,Math.max(0,+amount));};
}

/** Lower her onto the seat and press her outfit flat on it. Returns update(), to call each frame after her pose is
 *  set (and before vrm.update), which puts her feet back where the drop would have moved them. When something else
 *  poses her near the chair (her walk away from it, and back onto it), sync() alone keeps the pressing right as she
 *  moves, and press(amount) sets how much of it there is: 1 (or true) as she sits, 0 (or false) off the seat, and
 *  in between as she rises or comes down, so nothing snaps. */
export function seatCharacter(vrm,chair,{margin=.002}={}){
 const seat=seatOutline(chair);if(!seat)return {drop:0,update(){},sync(){},press(){}};
 const low=lowestSeatPoint(vrm,seat),drop=isFinite(low)?Math.max(0,low-seat.top-margin):0;
 vrm.scene.position.y-=drop;vrm.scene.updateMatrixWorld(true);
 const press=pressFlat(vrm,seat);
 const meshes=[];vrm.scene.traverse(o=>{if(o.isSkinnedMesh&&PRESS.test(o.name))meshes.push(o);});
 const foot=V(),target=V();
 const sync=()=>{for(const o of meshes){o.updateWorldMatrix(true,false);(o.userData.lofiInvModel??=new THREE.Matrix4()).copy(o.matrixWorld).invert();}};
 return {drop,seat,sync,press,update(){
  sync();
  if(drop<=0)return;
  for(const side of ['left','right']){
   vrm.humanoid.getNormalizedBoneNode(side+'Foot').getWorldPosition(foot);
   reachLeg(vrm,side,target.copy(foot).setY(foot.y+drop),1);
  }
 }};
}
