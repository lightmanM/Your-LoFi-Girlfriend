import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3,Box3,Object3D} from 'three';
import {createReach,herCapsules,BODY} from '../src/voice/reach.js';

// The pointer test against a cheap stand-in for her (capsules on her bones, the book's box): her skinned meshes cost
// ~28 ms a ray, which made the page stutter while the pointer moved near her (final review).
const dom={getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})};
const camera=()=>{const c=new PerspectiveCamera(60,1,.1,100);c.updateMatrixWorld();return c;};   // at the origin, looking down -z
const upright={a:new Vector3(0,-.5,-5),b:new Vector3(0,.5,-5),r:.2};

test('a ray through a capsule hits her, one beside it does not',()=>{
 const reach=createReach({dom,camera:camera(),capsules:()=>[upright],boxes:()=>[]});
 assert.equal(reach.hit(50,50),true);
 assert.equal(reach.hit(5,50),false);
});

test('the book counts too',()=>{
 const book=new Box3(new Vector3(1.2,-.3,-5.3),new Vector3(1.8,.3,-4.7));
 const reach=createReach({dom,camera:camera(),capsules:()=>[],boxes:()=>[book]});
 assert.equal(reach.hit(50+1.5/(5*Math.tan(Math.PI/6))*50,50),true);
 assert.equal(reach.hit(50,50),false);
});

test('a test is cheap: well under a millisecond',()=>{
 const caps=Array.from({length:BODY.length},(_,i)=>({a:new Vector3(i*.01,-.5,-5),b:new Vector3(i*.01,.5,-5),r:.1}));
 const reach=createReach({dom,camera:camera(),capsules:()=>caps,boxes:()=>[new Box3(new Vector3(3,3,-6),new Vector3(4,4,-5))]});
 const t0=performance.now();for(let i=0;i<5000;i++)reach.hit(i%100,(i*7)%100);
 const each=(performance.now()-t0)/5000;
 assert.ok(each<.2,`${each.toFixed(3)} ms a test`);
});

test('her capsules follow her bones and her size, skipping bones she lacks',()=>{
 const bones={};const scene=new Object3D();scene.scale.setScalar(2);
 for(const [i,name] of ['hips','spine','chest','neck','head','leftUpperArm','leftLowerArm','leftHand'].entries()){
  const b=new Object3D();b.position.set(0,i*.1,0);scene.add(b);bones[name]=b;
 }
 scene.updateMatrixWorld(true);
 const vrm={scene,humanoid:{getRawBoneNode:n=>bones[n]??null}};
 const caps=herCapsules(vrm);
 assert.ok(caps.length>=5);
 for(const c of caps){assert.ok(c.r>0);assert.ok(Number.isFinite(c.a.y)&&Number.isFinite(c.b.y));}
 const hips=caps.find(c=>c.a.y===0);assert.ok(hips,'a capsule starts at her hips');
 const base=BODY.find(([from])=>from==='hips')[2];assert.equal(hips.r,base*2,'radii scale with her');
});
