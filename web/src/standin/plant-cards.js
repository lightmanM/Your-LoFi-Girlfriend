// Plant cards: the stand-in for the balcony's plant meshes (which are private). Each plant in the shared plant mask
// (G ivy, B roses, A pots) becomes one flat card facing the camera, placed at the plant's own depth (the cover map's
// distance) and covering exactly its region of the picture at rest. livePlants() (viewer/plants.js) treats the cards
// like the real meshes: it colours them from the picture, cuts them to the plant's shape with the plant-alone image,
// and bends them in the wind about their base (the ivy about its top). Flatter than the real plants up close.
import * as THREE from 'three';
import {PLANTS3D} from '../viewer/plants.js';

/**
 * Connected regions of one channel of an RGBA image (a coarse grid of `step` pixels; 4-neighbour), as pixel rectangles.
 * @param {{width:number,height:number,data:ArrayLike<number>}} img @param {number} channel 0 R, 1 G, 2 B, 3 A
 * @returns {{x0:number,y0:number,x1:number,y1:number}[]}
 */
export function cardsFromMask({width,height,data},channel,{step=4,minArea=60,threshold=128}={}){
 const gw=Math.ceil(width/step),gh=Math.ceil(height/step),on=new Uint8Array(gw*gh),seen=new Uint8Array(gw*gh),out=[];
 for(let gy=0;gy<gh;gy++)for(let gx=0;gx<gw;gx++){
  const x=Math.min(width-1,gx*step+(step>>1)),y=Math.min(height-1,gy*step+(step>>1));
  on[gy*gw+gx]=data[(y*width+x)*4+channel]>=threshold?1:0;
 }
 for(let start=0;start<on.length;start++){
  if(!on[start]||seen[start])continue;
  let x0=Infinity,y0=Infinity,x1=-1,y1=-1,n=0;const stack=[start];seen[start]=1;
  while(stack.length){
   const k=stack.pop(),gx=k%gw,gy=(k-gx)/gw;n++;
   x0=Math.min(x0,gx);x1=Math.max(x1,gx);y0=Math.min(y0,gy);y1=Math.max(y1,gy);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=gx+dx,ny=gy+dy,nk=ny*gw+nx;
    if(nx>=0&&ny>=0&&nx<gw&&ny<gh&&on[nk]&&!seen[nk]){seen[nk]=1;stack.push(nk);}
   }
  }
  if(n>=minArea)out.push({x0:x0*step,y0:y0*step,x1:Math.min(width,(x1+1)*step),y1:Math.min(height,(y1+1)*step)});
 }
 return out;
}

/** Metres to the nearest opaque surface from a cover-map texel (R + G/255, log scale up to depthRange; plants.js). */
export function coverDistance(r,g,depthRange){
 return Math.pow(2,(r/255+g/255/255)*Math.log2(depthRange));
}

/**
 * One card: a grid in world space that covers `rect` (pixels of an image of `size`) on the camera's picture, at view
 * depth `depth`. @returns {THREE.Mesh} named `name` ('ivy:card-0', …, as livePlants matches them)
 */
export function cardMesh(rect,camera,size,depth,name,{cols=6,rows=10,near=depth}={}){
 const pos=[],idx=[],v=new THREE.Vector3();
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const px=rect.x0+(rect.x1-rect.x0)*i/cols,py=rect.y0+(rect.y1-rect.y0)*j/rows;
  v.set(px/size.width*2-1,1-py/size.height*2,.5).applyMatrix4(camera.projectionMatrixInverse);   // view space
  v.multiplyScalar(depth/-v.z).applyMatrix4(camera.matrixWorld);
  pos.push(v.x,v.y,v.z);
 }
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1,d=c+1;idx.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);
 const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial());m.name=name;m.userData={card:true,cardDepth:depth,cardNear:near};return m;
}

// A card's depths. The cover map holds what is behind or in front of the plants, not the plants themselves; the plant
// shader takes each pixel's depth from it (plants.js, CARD): just in front of what was behind the plant there, but never
// behind `near` (the nearest surface behind the plant, a low percentile so a soft edge does not count), so a leaf over a
// gap in the railing does not blink out when it sways across a bar. `depth` (the typical surface behind it) is the
// card's own, for pixels hidden at rest and for its geometry.
export function regionDepths(rect,mask,cover,channel,depthRange,step=2){
 const seen=[],all=[];
 for(let y=rect.y0;y<rect.y1;y+=step)for(let x=rect.x0;x<rect.x1;x+=step){
  const i=(y*cover.width+x)*4,dist=coverDistance(cover.data[i],cover.data[i+1],depthRange);
  all.push(dist);if(mask.data[i+channel]>=128)seen.push(dist);
 }
 const list=(seen.length?seen:all).sort((p,q)=>p-q),at=f=>list[Math.min(list.length-1,Math.floor(list.length*f))];
 return {depth:at(.5)*.97,near:at(.05)*.97};
}
export const regionDepth=(...a)=>regionDepths(...a).depth;

/** Rectangles merged wherever they overlap, so each part of a plant is drawn by one card only. @returns {object[]} */
export function mergeRects(rects){
 let out=rects.map(r=>({...r})),merged=true;
 while(merged){
  merged=false;
  for(let i=0;i<out.length&&!merged;i++)for(let j=i+1;j<out.length&&!merged;j++){
   const a=out[i],b=out[j];
   if(a.x0<b.x1&&b.x0<a.x1&&a.y0<b.y1&&b.y0<a.y1){
    out=[...out.filter((_,k)=>k!==i&&k!==j),{x0:Math.min(a.x0,b.x0),y0:Math.min(a.y0,b.y0),x1:Math.max(a.x1,b.x1),y1:Math.max(a.y1,b.y1)}];
    merged=true;
   }
  }
 }
 return out;
}

/**
 * Cards for every plant in the mask. mask and cover are RGBA pixels of the same size (top row first).
 * @returns {THREE.Group} for livePlants()
 */
export function plantCards({mask,cover},camera,{depthRange=64,step=2,minArea=10,pad=.06}={}){
 const group=new THREE.Group();group.name='Plant cards';
 for(const [name,p] of Object.entries(PLANTS3D)){
  const padded=cardsFromMask(mask,p.channel,{step,minArea}).map(r=>{
   const px=(r.x1-r.x0)*pad,py=(r.y1-r.y0)*pad;   // a little room around each plant: its shape comes from the picture
   return {x0:Math.max(0,Math.floor(r.x0-px)),y0:Math.max(0,Math.floor(r.y0-py)),x1:Math.min(mask.width,Math.ceil(r.x1+px)),y1:Math.min(mask.height,Math.ceil(r.y1+py))};
  });
  mergeRects(padded).forEach((rect,k)=>{
   const {depth,near}=regionDepths(rect,mask,cover,p.channel,depthRange);
   group.add(cardMesh(rect,camera,mask,depth,`${name}:card-${k}`,{near}));
  });
 }
 return group;
}

/**
 * A texture's exact pixels (no canvas: a canvas would lose the colour of fully transparent pixels, and the mask keeps
 * the pots in alpha), read back through the GPU at width × height, top row first.
 */
export function readTexture(renderer,texture,width,height){
 const rt=new THREE.WebGLRenderTarget(width,height,{depthBuffer:false});
 const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:{map:{value:texture}},depthTest:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:'uniform sampler2D map;varying vec2 vUv;void main(){gl_FragColor=texture2D(map,vUv);}'}));
 const scene=new THREE.Scene();scene.add(quad);const before=renderer.getRenderTarget();
 renderer.setRenderTarget(rt);renderer.render(scene,new THREE.Camera());
 const buf=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(rt,0,0,width,height,buf);renderer.setRenderTarget(before);
 rt.dispose();quad.geometry.dispose();quad.material.dispose();
 const data=new Uint8ClampedArray(width*height*4),row=width*4;   // GPU rows run bottom-up
 for(let y=0;y<height;y++)data.set(buf.subarray((height-1-y)*row,(height-y)*row),y*row);
 return {width,height,data};
}
