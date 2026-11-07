// The roses, the balcony plants and the ivy across the street as live 3D meshes (light copies of the Blender plants),
// bending in the shared wind. Their colour is the rendered toon picture at each point's REST position (projected from
// the fixed camera), so at rest they match the picture exactly; when they move, their colours move with them. How
// much of each point shows (behind the door frame, through the sheer curtain) is also read at the rest position, from
// the render's per-plant coverage mask. Parts that something hid at rest (a door frame, the sheer curtain) take their
// colour from a render of the plant alone, so a plant that moves out from behind a frame is whole, not cut off; what
// covers it now is decided per pixel from the cover map (the nearest opaque surface, and the sheer curtain).
import * as THREE from 'three';

// group: channel of plant-mask (G ivy, B roses, A pots), hanging (bends around its top), bend (degrees per unit of
// wind at the tips), clump (metres of leaf movement), wind direction in the world (blowing in from the street)
export const PLANTS3D={
 ivy:{channel:1,hanging:true,bend:1.4,clump:.10},
 roses:{channel:2,hanging:false,bend:4.5,clump:.035},
 pots:{channel:3,hanging:false,bend:5,clump:.03},
};
const NOISE=`
float lofiH(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float lofiN(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(lofiH(i),lofiH(i+vec3(1,0,0)),f.x),mix(lofiH(i+vec3(0,1,0)),lofiH(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(lofiH(i+vec3(0,0,1)),lofiH(i+vec3(1,0,1)),f.x),mix(lofiH(i+vec3(0,1,1)),lofiH(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 lofiClump3(vec3 p,float t,vec3 wind){vec3 q=p*3.2-wind*t*.5;
 return vec3(lofiN(q),lofiN(q+17.3),lofiN(q+41.7))-.5;}`;

/**
 * @param {THREE.Group} root loaded plants.glb (nodes named 'group:source')
 * @param {THREE.Texture} picture the rendered picture with the plants (plate)
 * @param {THREE.Texture} mask per-plant coverage (plant-mask: R palm, G ivy, B roses, A pots)
 * @param {THREE.Camera} cam the camera that rendered the picture (pictureCamera)
 * @param {THREE.Vector3} windDir horizontal world direction the wind blows toward
 * @param {THREE.Texture} cover R + G/255: distance to the nearest opaque surface, B: sheer coverage (past sheerNear metres)
 * @param {THREE.Texture} full each group alone and whole (ivy, roses, pots stacked bottom to top)
 */
export function livePlants(root,picture,mask,cam,windDir,cover,full,depthRange=64,sheerNear=4){
 cover.colorSpace=THREE.NoColorSpace;cover.generateMipmaps=false;cover.minFilter=cover.magFilter=THREE.NearestFilter;
 full.colorSpace=THREE.SRGBColorSpace;full.generateMipmaps=false;full.minFilter=THREE.LinearFilter;
 mask.colorSpace=THREE.NoColorSpace;mask.generateMipmaps=false;mask.minFilter=THREE.LinearFilter;
 const projView=new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);
 const axis=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),windDir).normalize();   // bend axis
 root.updateMatrixWorld(true);const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
 const group=new THREE.Group();group.name='Live plants';
 for(const o of meshes){
  // node names are 'group:source' in the file; the loader drops the ':' so match the group by prefix
  const tag=o.name+' '+(o.parent?.name??''),name=Object.keys(PLANTS3D).find(k=>tag.startsWith(k)||tag.includes(' '+k))??'pots',p=PLANTS3D[name];
  const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.computeBoundingBox();const bb=g.boundingBox;
  // flex: 0 at the anchor (base, or top for hanging ivy) to 1 at the far end; pivot: the anchor's centre
  const pos=g.attributes.position,flex=new Float32Array(pos.count),lo=bb.min.y,hi=bb.max.y;
  for(let i=0;i<pos.count;i++){const f=(pos.getY(i)-lo)/Math.max(hi-lo,1e-4);flex[i]=p.hanging?1-f:f;}
  g.setAttribute('flex',new THREE.BufferAttribute(flex,1));
  const pivot=new THREE.Vector3((bb.min.x+bb.max.x)/2,p.hanging?hi:lo,(bb.min.z+bb.max.z)/2);
  const m=new THREE.Mesh(g,plantMaterial(name,p,picture,mask,projView,axis,windDir,cover,full,depthRange,sheerNear,cam.matrixWorldInverse));   // one program per group, shared by three.js
  m.material.uniforms.pivot.value.copy(pivot);m.userData.group=name;
  m.renderOrder=1.2;m.frustumCulled=false;group.add(m);
 }
 group.userData.update=(t,angles,activity)=>{
  for(const m of group.children){const u=m.material.uniforms,k=m.userData.group;u.time.value=t;u.angle.value=angles[k]??0;u.act.value=activity[k]??0;}
 };
 return group;
}
function plantMaterial(name,p,picture,mask,projView,axis,windDir,cover,full,depthRange,sheerNear,camView){
 return new THREE.ShaderMaterial({transparent:true,depthWrite:true,depthTest:true,toneMapped:false,side:THREE.DoubleSide,
  uniforms:{picture:{value:picture},mask:{value:mask},cover:{value:cover},full:{value:full},row:{value:p.channel-1},depthLog:{value:Math.log2(depthRange)},sheerNear:{value:sheerNear},
   camView:{value:camView},projView:{value:projView},axis:{value:axis},wind:{value:windDir.clone()},
   pivot:{value:new THREE.Vector3()},angle:{value:0},act:{value:0},time:{value:0},clump:{value:p.clump}},
  vertexShader:`${NOISE}
attribute float flex;uniform mat4 projView,camView;uniform vec3 axis,wind,pivot;uniform float angle,act,time,clump;varying vec4 vRest,vCur;varying vec2 vDist;
vec3 rotateAxis(vec3 v,vec3 k,float a){float c=cos(a),s=sin(a);return v*c+cross(k,v)*s+k*dot(k,v)*(1.-c);}
void main(){
 vRest=projView*vec4(position,1.);
 float h=pow(clamp(flex,0.,1.),1.3);
 vec3 p=pivot+rotateAxis(position-pivot,axis,angle*h);       // the whole plant bends around its anchor
 p+=clump*act*h*lofiClump3(position,time,wind);              // leaves move in clumps
 vCur=projView*vec4(p,1.);vDist=vec2(-(camView*vec4(position,1.)).z,-(camView*vec4(p,1.)).z);   // rest, now
 gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}`,
  fragmentShader:`uniform sampler2D picture,mask,cover,full;uniform float depthLog,row,sheerNear;varying vec4 vRest,vCur;varying vec2 vDist;
float dist(float v){return exp2(v*depthLog);}
vec4 whole(vec2 uv){return texture2D(full,vec2(uv.x,(clamp(uv.y,.002,.998)+row)/3.));}   // this group alone, whole
void main(){
 vec2 uv=vRest.xy/vRest.w*.5+.5,now=vCur.xy/vCur.w*.5+.5;
 vec4 w=whole(uv);
 if(w.a<.06)discard;
 vec3 cn=texture2D(cover,now).rgb,cr=texture2D(cover,uv).rgb;
 float m=.05+.012*vDist.y;                                          // the cover distance is 16-bit: a tight margin
 if(dist(cn.r+cn.g/255.)<vDist.y-m)discard;                         // behind a door frame, wall or furniture now
 float sheerNow=vDist.y>sheerNear?cn.b:0.;                          // seen through the sheer curtain now
 float hidRest=max(step(dist(cr.r+cr.g/255.),vDist.x-.05-.012*vDist.x),step(.05,vDist.x>sheerNear?cr.b:0.));
 // at rest and in the open, the picture itself (exact match); where something hid it at rest, the plant alone
 float seen=texture2D(mask,uv)[${p.channel}]/max(w.a,.05);
 vec3 col=mix(w.rgb,texture2D(picture,uv).rgb,smoothstep(.6,.95,seen)*(1.-hidRest));
 gl_FragColor=vec4(col,w.a*(1.-sheerNow));
 #include <colorspace_fragment>
}`});
}
