// One wind for the whole scene: a slow breeze plus a gust every 18 to 40 s. Each plant group feels it a moment apart
// (outside first, the palm and the near leaves last) through a spring, so it lags, overshoots and settles like a plant.
// The background picture and the near-leaves layer bend in their shaders; nothing in the picture is re-rendered.
import * as THREE from 'three';

// Like the Blender wind tutorials (a Simple Deform bend driven by noise, plus a Displace modifier on the leaves): each
// plant bends as a whole around its base (the ivy around where it hangs from), more toward its tips, and its leaves
// move in clumps as a slow noise drifts through them. Angles in degrees per unit of wind; clumps in picture pixels.
// pivot: picture pixels (2560 x 1440, from the top left); sign: +1 bends toward screen right for upright plants
export const PLANTS={
 // slow, irregular sway like the palm (two drifting rhythms, f and f2), whole-plant bend first, gentle leaf clumps
 ivy:{bend:2.3,clump:6,delay:0,stiff:2.8,damp:1.0,freq:.31,freq2:.19,pivots:[[1296,-190],[752,-190]],hanging:true},
 balcony:{bend:0,shear:15,clump:4,delay:.35,stiff:2.9,damp:1.05,freq:.37,freq2:.23},
 roses:{bend:4.6,clump:5,delay:.3,stiff:2.7,damp:1.0,freq:.35,freq2:.21,pivots:[[800,1232]]},
 palm:{bend:1.7,clump:12,delay:.9,stiff:2.6,damp:1.0,freq:.42,pivots:[[304,1540]]},
 leaves:{bend:5.5,clump:46,delay:.6,stiff:1.9,damp:.75,freq:.29,freq2:.17,pivots:[[2800,520]],hanging:true},
};
export const GUSTS={every:[18,40],strength:[.6,1.1],rise:1.4,hold:[.8,2.2],fall:3.2,breeze:.45};

const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
export class Wind{
 constructor(random=Math.random){
  this.random=random;this.t=0;this.history=[];this.next=4+random()*8;this.gust=null;
  this.state=Object.fromEntries(Object.keys(PLANTS).map(k=>[k,{x:0,v:0}]));
 }
 range([a,b]){return a+(b-a)*this.random();}
 /** wind strength outside at time t: breeze plus the current gust */
 force(t){
  const b=GUSTS.breeze*(1+.35*Math.sin(t*.37)+.2*Math.sin(t*.83+1.3));
  let g=0;for(const q of this.gusts??[]){const u=t-q.t0;if(u<0)continue;
   g+=q.a*(u<GUSTS.rise?smooth(u/GUSTS.rise):u<GUSTS.rise+q.hold?1:1-smooth((u-GUSTS.rise-q.hold)/GUSTS.fall));}
  return b+g;
 }
 update(dt){
  this.t+=dt;this.gusts??=[];
  if(this.t>=this.next){this.gusts.push({t0:this.t,a:this.range(GUSTS.strength),hold:this.range(GUSTS.hold)});this.next=this.t+this.range(GUSTS.every);}
  this.gusts=this.gusts.filter(q=>this.t-q.t0<GUSTS.rise+q.hold+GUSTS.fall+5);
  for(const [k,p] of Object.entries(PLANTS)){
   const s=this.state[k],target=this.force(this.t-p.delay);
   // spring toward the wind's push, with a slow natural sway of the plant itself on top
   const a=p.stiff*p.stiff*(target-s.x)-2*p.damp*s.v;s.v+=a*dt;s.x+=s.v*dt;
  }
 }
 /** tip displacement for a group, in picture pixels */
 /** the group's own back-and-forth on top of the wind's push, 0..: how hard it is moving (drives the clumps) */
 sway(k){const p=PLANTS[k],s=this.state[k],t=this.t,T=6.283;
  if(!p.freq2)return s.x*(1+.45*Math.sin(t*p.freq*T+k.length))+.15*Math.sin(t*p.freq*3.7+1.1);   // the palm, as approved
  return s.x*(1+.32*Math.sin(t*p.freq*T+k.length)+.22*Math.sin(t*p.freq2*T+2.3))+.12*Math.sin(t*p.freq2*T*1.3+1.1);}
 angle(k){return PLANTS[k].bend*this.sway(k)*Math.PI/180;}
 activity(k){return .35+Math.min(1.5,Math.max(0,this.state[k].x));}
}

const SIZE='const vec2 lofiPx=vec2(2560.,1440.);';
const NOISE=`
float lofiHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float lofiNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(lofiHash(i),lofiHash(i+vec2(1,0)),f.x),mix(lofiHash(i+vec2(0,1)),lofiHash(i+vec2(1,1)),f.x),f.y);}
// leaf clumps: two octaves of smooth noise drifting with the wind (like a Displace texture on a moving empty)
vec2 lofiClump(vec2 px,float t,float scale){
 vec2 q=px/scale+vec2(-t*.45,t*.12);
 return vec2(lofiNoise(q)+.5*lofiNoise(q*2.1+7.3),lofiNoise(q+19.1)+.5*lofiNoise(q*2.1+3.7))/1.5-.5;
}
// bend: rotate around the pivot, by more toward the tips (h: 0 base .. 1 tip); returns the displacement
vec2 lofiBend(vec2 px,vec2 pivot,float ang,float h){
 float a=ang*pow(h,1.3);vec2 r=px-pivot;float c=cos(a),s=sin(a);
 return vec2(c*r.x-s*r.y,s*r.x+c*r.y)-r;
}`;
const toUv=([x,y])=>new THREE.Vector2(x,1440-y);   // pivots in the shader: pixels with y up

// Where she lies on the daybed the picture takes her shadow, so she rests on it instead of floating over it: each
// pixel's place in the room (from the cover map's distance) is measured to capsules along her body, for the darkening
// right against her, and a ray from it toward the sun is tested against the same capsules, for the shadow she casts.
// Colour and strengths are matched by eye to her shadow in the Blender render of the same pose.
export const REST={count:9,color:[.36,.22,.17],contact:.5,shadow:.25,soft:3};

/** The background: picture, the picture without the swaying plants, and the wind field. palm: the palm alone and whole
 * (rendered `overscan` times wider than the picture, so fronds swinging in from past the edge exist), the cover map
 * (R: distance to the nearest opaque surface) and the palm's nearest distance, to keep it behind anything in front.
 * view: the picture camera's world matrix and the tangents of half its field of view, for the darkening under her. */
export function plateMaterial(full,clean,field,plantMask,palmOnly=false,palm,view=null){
 for(const t of [full,clean,palm.full])t.colorSpace=THREE.SRGBColorSpace;
 palm.full.generateMipmaps=false;palm.full.minFilter=THREE.LinearFilter;
 palm.cover.colorSpace=THREE.NoColorSpace;palm.cover.generateMipmaps=false;palm.cover.minFilter=palm.cover.magFilter=THREE.NearestFilter;
 field.colorSpace=THREE.NoColorSpace;field.minFilter=THREE.LinearFilter;field.generateMipmaps=false;
 const u={plate:{value:full},clean:{value:clean},field:{value:field},plantMask:{value:plantMask},palmOnly:{value:palmOnly?1:0},time:{value:0},
  palmFull:{value:palm.full},cover:{value:palm.cover},overscan:{value:palm.overscan},palmNear:{value:palm.near},depthLog:{value:Math.log2(palm.depthRange)},
  angPalm:{value:0},angIvy:{value:0},angRoses:{value:0},shearPots:{value:0},act:{value:new THREE.Vector4()},
  pivPalm:{value:toUv(PLANTS.palm.pivots[0])},pivRoses:{value:toUv(PLANTS.roses.pivots[0])},
  pivIvyA:{value:toUv(PLANTS.ivy.pivots[0])},pivIvyB:{value:toUv(PLANTS.ivy.pivots[1])},
  clump:{value:new THREE.Vector4(PLANTS.palm.clump,PLANTS.ivy.clump,PLANTS.balcony.clump,PLANTS.roses.clump)},
  restOn:{value:0},restA:{value:Array.from({length:REST.count},()=>new THREE.Vector3(0,-99,0))},restB:{value:Array.from({length:REST.count},()=>new THREE.Vector3(0,-99,0))},
  restR:{value:Array.from({length:REST.count},()=>new THREE.Vector2(.1,.1))},restColor:{value:new THREE.Color().fromArray(REST.color)},
  camWorld:{value:view?.matrixWorld??new THREE.Matrix4()},camTan:{value:new THREE.Vector2(...(view?.tan??[1,1]))},restSun:{value:new THREE.Vector3(0,1,0)}};
 const m=new THREE.ShaderMaterial({uniforms:u,depthTest:false,depthWrite:false,toneMapped:false,transparent:palmOnly,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`${SIZE}${NOISE}
uniform sampler2D plate,clean,field,plantMask,palmFull,cover;uniform float time,angPalm,angIvy,angRoses,shearPots,palmOnly,overscan,palmNear,depthLog;uniform vec4 act,clump;
uniform vec2 pivPalm,pivRoses,pivIvyA,pivIvyB;varying vec2 vUv;
uniform float restOn;uniform vec3 restA[${REST.count}],restB[${REST.count}],restColor,restSun;uniform vec2 restR[${REST.count}],camTan;uniform mat4 camWorld;
float lofiSeg(vec3 p,vec3 a,vec3 b){vec3 ab=b-a;float t=clamp(dot(p-a,ab)/max(dot(ab,ab),1e-6),0.,1.);return length(p-a-ab*t);}
// how much of the sun a capsule leaves a point (1: all of it): the ray's nearest pass by the capsule, softer with distance
float lofiLit(vec3 ro,vec3 rd,vec3 a,vec3 b,float r){
 vec3 ba=b-a,oa=ro-a;float baba=dot(ba,ba),dba=dot(rd,ba),oad=dot(oa,rd),oaba=dot(oa,ba),den=max(baba-dba*dba,1e-5);
 float ts=clamp((oaba-oad*dba)/den,0.,1.),tr=max(dot(a+ba*ts-ro,rd),.02);   // along the capsule, then along the ray
 float s=clamp(${REST.soft.toFixed(1)}*(length(ro+rd*tr-a-ba*ts)-r)/tr+.5,0.,1.);return s*s*(3.-2.*s);
}
void main(){
 vec4 f=texture2D(field,vUv);float h=f.r,wPalm=f.g,wIvy=f.b,wBal=f.a;
 vec2 px=vUv*lofiPx;
 // the balcony group holds the roses (left, with their own bend) and the potted plants (a gentle lean)
 float rose=smoothstep(1050.,950.,px.x);
 vec2 d=wPalm*(lofiBend(px,pivPalm,angPalm,h)+clump.x*act.x*h*lofiClump(px,time,190.));
 vec2 src=vUv-d/lofiPx;
 // only plant pixels move: where the displaced spot is plant, show it; everywhere else the still, plant-free picture
 // (so the door, curtains and wall behind a swinging frond never warp). Off-picture spots count as no plant.
 float inside=step(0.,src.x)*step(src.x,1.)*step(0.,src.y)*step(src.y,1.);
 float seen=smoothstep(.04,.55,texture2D(plantMask,src).r)*inside;   // palm as the picture shows it, at the displaced spot
 // the whole palm (also the parts past the picture edge, or hidden at rest), except where something opaque is in front
 vec4 pf=texture2D(palmFull,(src-.5)/overscan+.5);
 vec2 cv=texture2D(cover,vUv).rg;float a=pf.a*step(palmNear,exp2((cv.r+cv.g/255.)*depthLog));
 vec3 palmCol=mix(pf.rgb,texture2D(plate,src).rgb,smoothstep(.6,.95,seen/max(pf.a,.05)));
 vec3 still=mix(texture2D(clean,vUv).rgb,texture2D(plate,vUv).rgb,1.-smoothstep(0.,2.,length(d)));
 // the roses, balcony plants and ivy are live 3D meshes now: under them, the plant-free picture
 // (widened by a few pixels: the picture's ink outline around each plant lies just outside its mask)
 float pm=0.;for(int i=0;i<9;i++){vec2 o=vec2(float(i/3)-1.,float(i-i/3*3)-1.)*3./lofiPx;vec4 q=texture2D(plantMask,vUv+o);pm=max(pm,max(q.g,max(q.b,q.a)));}
 still=mix(still,texture2D(clean,vUv).rgb,smoothstep(0.,.5,pm));
 if(palmOnly>.5){       // second pass after the 3D plants: only the palm, so its fronds stay in front of the roses
  gl_FragColor=vec4(palmCol,a*step(.01,wPalm));
 }else{
  if(restOn>0.){      // the daybed darkens where she rests on it
   float dd=exp2((cv.r+cv.g/255.)*depthLog);vec3 pw=(camWorld*vec4((vUv*2.-1.)*camTan*dd,-dd,1.)).xyz;float near=0.;
   float lit=1.;
   for(int i=0;i<${REST.count};i++){
    float q=1.-smoothstep(restR[i].x,restR[i].x+restR[i].y,lofiSeg(pw,restA[i],restB[i]));near=max(near,q*q);
    lit=min(lit,lofiLit(pw,restSun,restA[i],restB[i],restR[i].x));
   }
   still=mix(still,still*restColor,max(near*${REST.contact.toFixed(2)},(1.-lit)*${REST.shadow.toFixed(2)})*restOn);
  }
  gl_FragColor=vec4(mix(still,palmCol,a),1.);
 }
 #include <colorspace_fragment>
}`});
 m.userData.uniforms=u;return m;
}
/** The out-of-focus leaves in front of the camera: a branch reaching in from past the right edge, bending as a whole. */
export function leavesMaterial(tex){
 tex.colorSpace=THREE.SRGBColorSpace;
 const u={map:{value:tex},ang:{value:0},act:{value:0},time:{value:0},piv:{value:toUv(PLANTS.leaves.pivots[0])},clump:{value:PLANTS.leaves.clump}};
 const m=new THREE.ShaderMaterial({uniforms:u,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`${SIZE}${NOISE}
uniform sampler2D map;uniform float ang,act,time,clump;uniform vec2 piv;varying vec2 vUv;
void main(){
 vec2 px=vUv*lofiPx;float h=clamp(length(px-piv)/1400.,0.,1.);
 vec2 d=lofiBend(px,piv,ang,h)+clump*act*h*lofiClump(px,time*.6,320.);
 gl_FragColor=texture2D(map,vUv-d/lofiPx);
 #include <colorspace_fragment>
}`});
 m.userData.uniforms=u;return m;
}
