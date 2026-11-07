// The reading chair as real geometry, so it sits in depth with her (in front of her legs, behind her back) and her
// body can cast changing shadows onto its seat and back. Its colour is not lit: every point takes the colour the
// background picture has at that spot, seen from the fixed camera, so it matches the rendered toon chair exactly.
// Her shadow is a second, transparent copy of the chair that only darkens where she blocks the sun.
import * as THREE from 'three';
export const VISIBLE_CHAIR='/environment/balcony-toon/chair-visible.glb';
// Shadow colour and strength on the chair, matched to her shadow in the Blender render.
export const CHAIR_SHADOW={color:[.30,.13,.05],opacity:.5,elevation:66,radius:14};   // soft: her hair strands must not draw streaks
// Contact darkening: the chair darkens near her body, measured to capsules around her torso and thighs (metres).
export const CHAIR_CONTACT={strength:.7,color:[.45,.24,.12],   // radii are fitted to her pose at load (calibrateChairContact)
 capsules:[['hips','chest',.10,.155],['leftUpperLeg','leftLowerLeg',.065,.11],['rightUpperLeg','rightLowerLeg',.065,.11]]};

/** Camera that rendered the picture, with the field of view the picture covers. */
export function pictureCamera(position,quaternion,hfovDeg,vfovDeg){
 const cam=new THREE.PerspectiveCamera(vfovDeg,Math.tan(THREE.MathUtils.degToRad(hfovDeg)/2)/Math.tan(THREE.MathUtils.degToRad(vfovDeg)/2),.05,120);
 cam.position.fromArray(position);cam.quaternion.fromArray(quaternion);cam.updateMatrixWorld(true);cam.updateProjectionMatrix();
 return cam;
}
function projectedMaterial(picture,cam,contact){
 const m=new THREE.MeshBasicMaterial({map:picture,toneMapped:false});
 const projView=new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);
 const n=contact.capsules.length;
 m.userData.contact={a:Array.from({length:n},()=>new THREE.Vector3(0,-99,0)),b:Array.from({length:n},()=>new THREE.Vector3(0,-99,0)),
  r:new THREE.Vector2(),radii:contact.capsules.map(c=>new THREE.Vector2(c[2],c[3]))};
 m.onBeforeCompile=s=>{
  const u=m.userData.contact;m.userData.shaderSeen=s.fragmentShader.includes('lofiSeg')||'pending';
  s.uniforms.lofiProjView={value:projView};s.uniforms.lofiA={value:u.a};s.uniforms.lofiB={value:u.b};s.uniforms.lofiR={value:u.radii};
  s.uniforms.lofiContactColor={value:new THREE.Color().fromArray(contact.color)};s.uniforms.lofiContactStrength={value:contact.strength};
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vLofiWorld;')
   .replace('#include <project_vertex>','#include <project_vertex>\nvLofiWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vLofiWorld;uniform mat4 lofiProjView;
uniform vec3 lofiA[${n}];uniform vec3 lofiB[${n}];uniform vec2 lofiR[${n}];uniform vec3 lofiContactColor;uniform float lofiContactStrength;
float lofiSeg(vec3 p,vec3 a,vec3 b){vec3 ab=b-a;float t=clamp(dot(p-a,ab)/max(dot(ab,ab),1e-6),0.,1.);return length(p-a-ab*t);}`)
   .replace('#include <map_fragment>',`vec4 lofiP=lofiProjView*vec4(vLofiWorld,1.0);
diffuseColor*=texture2D(map,lofiP.xy/lofiP.w*.5+.5);
float lofiNear=0.;
for(int i=0;i<${n};i++){float d=lofiSeg(vLofiWorld,lofiA[i],lofiB[i]);lofiNear=max(lofiNear,1.-smoothstep(lofiR[i].x,lofiR[i].x+lofiR[i].y,d));}
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*lofiContactColor,lofiNear*lofiContactStrength);`);
 };
 m.customProgramCacheKey=()=>'lofiProjectedChair'+n;
 return m;
}
// Woven seat and back have gaps, so darkening drawn on the strands alone shows the picture undarkened between them.
// Two solid panels, fitted to the seat and the back and coloured from the picture like the chair, fill the gaps: they
// are invisible on their own, but carry the contact darkening and her shadow across the whole weave.
function principal(points){
 const c=new THREE.Vector3();points.forEach(p=>c.add(p));c.divideScalar(points.length);
 const C=[[0,0,0],[0,0,0],[0,0,0]];
 for(const p of points){const d=[p.x-c.x,p.y-c.y,p.z-c.z];for(let i=0;i<3;i++)for(let j=0;j<3;j++)C[i][j]+=d[i]*d[j];}
 const mul=v=>new THREE.Vector3(C[0][0]*v.x+C[0][1]*v.y+C[0][2]*v.z,C[1][0]*v.x+C[1][1]*v.y+C[1][2]*v.z,C[2][0]*v.x+C[2][1]*v.y+C[2][2]*v.z);
 const power=(v,skip)=>{for(let k=0;k<60;k++){if(skip)v.addScaledVector(skip,-v.dot(skip));v=mul(v).normalize();}return v;};
 const e1=power(new THREE.Vector3(1,.3,.2)),e2=power(new THREE.Vector3(.2,1,.3),e1);
 return {c,e1,e2,n:new THREE.Vector3().crossVectors(e1,e2).normalize()};
}
function hull(pts){
 pts=[...pts].sort((a,b)=>a.x-b.x||a.y-b.y);const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
 const lo=[],hi=[];
 for(const p of pts){while(lo.length>1&&cross(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}
 for(const p of pts.reverse()){while(hi.length>1&&cross(hi[hi.length-2],hi[hi.length-1],p)<=0)hi.pop();hi.push(p);}
 return lo.slice(0,-1).concat(hi.slice(0,-1));
}
function panel(points,towards,shrink){
 const f=principal(points);if(f.n.dot(towards)<0)f.n.negate();
 const along=points.map(p=>p.clone().sub(f.c).dot(f.n)).sort((a,b)=>a-b),lift=along[Math.floor(along.length*.9)];
 const flat=points.map(p=>{const d=p.clone().sub(f.c);return new THREE.Vector2(d.dot(f.e1),d.dot(f.e2));});
 const h=hull(flat),mid=h.reduce((a,p)=>a.add(p),new THREE.Vector2()).divideScalar(h.length);
 const ring=h.map(p=>p.clone().lerp(mid,shrink));
 const pos=[],to3=p=>f.c.clone().addScaledVector(f.e1,p.x).addScaledVector(f.e2,p.y).addScaledVector(f.n,lift);
 const m3=to3(mid);
 ring.forEach((p,i)=>{const a=to3(p),b=to3(ring[(i+1)%ring.length]);pos.push(m3.x,m3.y,m3.z,a.x,a.y,a.z,b.x,b.y,b.z);});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;
}
function solidPanels(root,inverse){
 const pts=[];root.updateWorldMatrix(true,true);
 root.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position,v=new THREE.Vector3();for(let i=0;i<a.count;i+=2)pts.push(v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).clone());});
 const ys=pts.map(p=>p.y).sort((a,b)=>a-b),bins={};
 for(const y of ys)if(y>.3&&y<.62){const k=Math.round(y*100);bins[k]=(bins[k]||0)+1;}
 const seatY=+Object.entries(bins).sort((a,b)=>b[1]-a[1])[0][0]/100;
 const seat=pts.filter(p=>Math.abs(p.y-seatY)<.025),back=pts.filter(p=>p.y>seatY+.09);
 const up=new THREE.Vector3(0,1,0),c=principal(seat).c,b=principal(back).c,front=c.clone().sub(b).setY(0).normalize();
 return [panel(seat,up,.08),panel(back,front,.1)].map(g=>g.applyMatrix4(inverse));
}
/** Turn the exported chair into the projected chair plus its shadow layer. */
export function prepareChair(root,picture,cam,shadow=CHAIR_SHADOW,contact=CHAIR_CONTACT){
 root.name='Visible reading chair';
 const mat=projectedMaterial(picture,cam,contact),meshes=[];root.userData.contactMaterial=mat;root.userData.contact=contact;
 root.traverse(o=>{if(o.isMesh)meshes.push(o);});
 const shadeMat=new THREE.ShadowMaterial({color:new THREE.Color().fromArray(shadow.color),opacity:shadow.opacity,depthWrite:false});
 shadeMat.depthFunc=THREE.LessEqualDepth;
 for(const o of meshes){
  o.material=mat;o.renderOrder=1;o.castShadow=false;o.receiveShadow=false;
  const s=new THREE.Mesh(o.geometry,shadeMat);s.name=o.name+' shadow';s.renderOrder=3;s.receiveShadow=true;s.castShadow=false;
  o.add(s);
 }
 for(const g of solidPanels(root,new THREE.Matrix4().copy(root.matrixWorld).invert())){
  const p=new THREE.Mesh(g,mat);p.name='Chair weave panel';p.renderOrder=1;
  const s=new THREE.Mesh(g,shadeMat);s.renderOrder=3;s.receiveShadow=true;p.add(s);root.add(p);
 }
 return root;
}
/** Fit each contact capsule's radius to her actual reading pose: the distance from the bone to the nearest point of
 *  the chair, less a centimetre, so the darkening is strongest where she touches and fades over the falloff. */
export function calibrateChairContact(root,vrm){
 const m=root.userData.contactMaterial,u=m?.userData.contact;if(!u)return [];
 updateChairContact(root,vrm);
 const pts=[];root.traverse(o=>{if(!o.isMesh||o.name.endsWith('shadow'))return;o.updateWorldMatrix(true,false);const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)pts.push(new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld));});
 const seg=(p,a,b)=>{const ab=b.clone().sub(a),t=THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/Math.max(ab.lengthSq(),1e-9),0,1);return p.distanceTo(a.clone().addScaledVector(ab,t));};
 return u.radii.map((r,i)=>{let d=Infinity;for(const p of pts)d=Math.min(d,seg(p,u.a[i],u.b[i]));r.x=Math.max(.02,d-.01);return +r.x.toFixed(3);});
}
/** Move the contact capsules to her bones (call every frame after her pose is set, before rendering). */
export function updateChairContact(root,vrm){
 const m=root.userData.contactMaterial,u=m?.userData.contact;if(!u)return;
 root.userData.contact.capsules.forEach(([from,to],i)=>{
  const a=vrm.humanoid.getNormalizedBoneNode(from),b=vrm.humanoid.getNormalizedBoneNode(to);
  if(a&&b){a.getWorldPosition(u.a[i]);b.getWorldPosition(u.b[i]);}
 });
}
/** Her contact shadow on the chair. The chair sits in soft indoor light in the picture, so the low sun would shadow
 *  all of it; instead a light that adds no brightness, from the sun's side but much higher, casts her shadow just under
 *  and behind her. Only the chair's shadow layer receives it. */
export function enableChairShadows(renderer,scene,target,sunDirection,shadow=CHAIR_SHADOW){
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;   // VSM honours a blur radius
 const flat=new THREE.Vector3().fromArray(sunDirection).setY(0).normalize(),e=THREE.MathUtils.degToRad(shadow.elevation);
 const dir=flat.multiplyScalar(Math.cos(e)).setY(Math.sin(e));
 const light=new THREE.DirectionalLight(0xffffff,0);light.name='Chair contact shadow';
 light.position.copy(target).addScaledVector(dir,6);light.target.position.copy(target);
 light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.radius=shadow.radius;light.shadow.blurSamples=20;
 Object.assign(light.shadow.camera,{left:-.9,right:.9,top:1.1,bottom:-.9,near:2,far:9});
 light.shadow.normalBias=.01;light.shadow.bias=-.0005;light.shadow.camera.updateProjectionMatrix();
 scene.add(light,light.target);return light;
}
