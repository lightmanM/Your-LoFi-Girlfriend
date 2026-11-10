import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {cardsFromMask,coverDistance,cardMesh,regionDepth,regionDepths,mergeRects} from '../src/standin/plant-cards.js';

// Plant cards: the stand-in for the balcony's plant meshes, cut from the shared plant mask (G ivy, B roses, A pots).
function image(w,h,paint){const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)paint(x,y,data,(y*w+x)*4);return {width:w,height:h,data};}
const blobs=image(200,100,(x,y,d,i)=>{if((x>=10&&x<50&&y>=20&&y<80)||(x>=120&&x<180&&y>=30&&y<60))d[i+1]=255;});

test('two separate plants make two cards',()=>{
 const r=cardsFromMask(blobs,1,{step:2,minArea:10});
 assert.equal(r.length,2);
 const [a,b]=[...r].sort((p,q)=>p.x0-q.x0);
 assert.ok(Math.abs(a.x0-10)<=2&&Math.abs(a.x1-50)<=2&&Math.abs(a.y0-20)<=2&&Math.abs(a.y1-80)<=2,JSON.stringify(a));
 assert.ok(Math.abs(b.x0-120)<=2&&Math.abs(b.x1-180)<=2,JSON.stringify(b));
});

test('specks smaller than minArea are not cards, and other channels are ignored',()=>{
 const speck=image(100,100,(x,y,d,i)=>{if(x===5&&y===5)d[i+1]=255;if(x>40&&x<90&&y>40&&y<90)d[i+2]=255;});
 assert.equal(cardsFromMask(speck,1,{step:1,minArea:4}).length,0);
 assert.equal(cardsFromMask(speck,2,{step:1,minArea:4}).length,1);
});

test('the cover map gives the distance in metres (R + G/255 on a log scale up to depthRange)',()=>{
 const half=Math.round(.5*255);
 assert.ok(Math.abs(coverDistance(half,0,64)-Math.pow(2,half/255*6))<1e-9);
 assert.equal(coverDistance(0,0,64),1);
});

test('a card covers its region on screen at rest',()=>{
 const cam=new PerspectiveCamera(40,2,.1,100);cam.position.set(1,2,3);cam.lookAt(new Vector3(1,2,-10));cam.updateMatrixWorld();
 const W=400,H=200,rect={x0:100,y0:40,x1:180,y1:150},mesh=cardMesh(rect,cam,{width:W,height:H},6.5,'pots:card-0');
 assert.equal(mesh.name,'pots:card-0');
 const pos=mesh.geometry.attributes.position,px=[];
 for(let i=0;i<pos.count;i++){const p=new Vector3().fromBufferAttribute(pos,i).project(cam);px.push([(p.x+1)/2*W,(1-p.y)/2*H]);}
 const xs=px.map(p=>p[0]),ys=px.map(p=>p[1]);
 for(const [got,want] of [[Math.min(...xs),100],[Math.max(...xs),180],[Math.min(...ys),40],[Math.max(...ys),150]])assert.ok(Math.abs(got-want)<1,`${got} vs ${want}`);
 const view=new Vector3().fromBufferAttribute(pos,0).applyMatrix4(cam.matrixWorldInverse);
 assert.ok(Math.abs(-view.z-6.5)<1e-6,'at the depth asked for');
});

test('a card\'s own depth is the typical depth behind its plant (the shader refines it pixel by pixel)',()=>{
 const W=100,H=100,code=m=>{const v=Math.log2(m)/Math.log2(64);const r=Math.floor(v*255),g=Math.round((v*255-r)*255);return [r,g];};
 const mask=image(W,H,(x,y,d,i)=>{if(x>=20&&x<80&&y>=10&&y<70)d[i+3]=255;});
 const cover=image(W,H,(x,y,d,i)=>{const m=y>=70?3:(x<30?8:10);const [r,g]=code(m);d[i]=r;d[i+1]=g;});
 const depth=regionDepth({x0:20,y0:10,x1:80,y1:90},mask,cover,3,64,1);
 assert.ok(Math.abs(depth-10*.97)<.05,`${depth.toFixed(2)} m: just in front of the wall behind most of it`);
});

test('a card mesh tells the plant shader it is a card, and its depth',()=>{
 const cam=new PerspectiveCamera(40,2,.1,100);cam.updateMatrixWorld();
 const m=cardMesh({x0:0,y0:0,x1:10,y1:10},cam,{width:100,height:50},7,'ivy:card-0');
 assert.equal(m.userData.card,true);assert.equal(m.userData.cardDepth,7);
});


test('overlapping cards merge, so no leaf is drawn twice as they sway (final review)',()=>{
 const merged=mergeRects([{x0:0,y0:0,x1:10,y1:10},{x0:8,y0:5,x1:20,y1:12},{x0:30,y0:30,x1:40,y1:40}]);
 assert.equal(merged.length,2);
 assert.deepEqual(merged.find(r=>r.x0===0),{x0:0,y0:0,x1:20,y1:12});
});

test('a card also knows the nearest surface behind its plant, so swaying leaves stay in front of a railing (final review)',()=>{
 const W=100,H=100,code=m=>{const v=Math.log2(m)/Math.log2(64);const r=Math.floor(v*255),g=Math.round((v*255-r)*255);return [r,g];};
 const mask=image(W,H,(x,y,d,i)=>{if(x>=20&&x<80&&y>=10&&y<70)d[i+3]=255;});
 const cover=image(W,H,(x,y,d,i)=>{const m=x%10===0?8:26;const [r,g]=code(m);d[i]=r;d[i+1]=g;});   // railing bars at 8 m before a facade at 26 m
 const {depth,near}=regionDepths({x0:20,y0:10,x1:80,y1:70},mask,cover,3,64,1);
 assert.ok(Math.abs(near-8*.97)<.1,`near ${near.toFixed(2)} m: in front of the railing`);
 assert.ok(depth>near,'its own depth is the typical one behind it');
});
