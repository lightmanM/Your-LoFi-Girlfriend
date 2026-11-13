import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clipLength,clipFrame,clipValue,seated,covered,shadowed,clipOk} from '../src/balcony/nap-walk.js';

const small={fps:10,frames:5,bones:{hips:[0,0,0,1],head:Array(20).fill(0)},hips:Array(15).fill(0),shut:[0,10,20,30,40],
 face:{blink:[0,0,0,0,1],aa:[0,0,0,0,0],relaxed:[0,0,0,0,0]},marks:{seated:[.1,.3],cover:[.35,9],shadow:[.3,.5,9,10]}};
const file=name=>JSON.parse(readFileSync(new URL(`../public/environment/balcony-toon/${name}`,import.meta.url),'utf8'));

test('a clip plays from its first frame to its last',()=>{
 assert.equal(clipLength(small),.4);
 assert.deepEqual(clipFrame(small,0),{a:0,b:1,k:0});
 const mid=clipFrame(small,.25);
 assert.equal(mid.a,2);assert.equal(mid.b,3);assert.ok(Math.abs(mid.k-.5)<1e-9);
 assert.deepEqual(clipFrame(small,.4),{a:4,b:4,k:0});
});

test('before its start and after its end a clip holds its first and last frame',()=>{
 assert.deepEqual(clipFrame(small,-3),{a:0,b:1,k:0});
 assert.deepEqual(clipFrame(small,99),{a:4,b:4,k:0});
});

test('values between frames are in between',()=>{
 assert.equal(clipValue(small.shut,clipFrame(small,.1)),10);
 assert.ok(Math.abs(clipValue(small.shut,clipFrame(small,.15))-15)<1e-9);
 assert.equal(clipValue(small.shut,clipFrame(small,5)),40);
});

test('she is on her chair until she starts to rise, and off it once she is up',()=>{
 assert.equal(seated(small,0),1);
 assert.equal(seated(small,.1),1);
 assert.ok(seated(small,.2)>0&&seated(small,.2)<1);
 assert.equal(seated(small,.3),0);
 assert.equal(seated(small,9),0);
});

test('coming down onto her chair, the seat takes her weight the other way round',()=>{
 const back={marks:{seated:[.9,.6]}};
 assert.equal(seated(back,0),0);
 assert.equal(seated(back,.6),0);
 assert.ok(seated(back,.75)>0&&seated(back,.75)<1);
 assert.equal(seated(back,.9),1);
 assert.equal(seated(back,5),1);
});

test('the picture covers her, and takes her shadow, between its marks',()=>{
 assert.equal(covered(small,.2),false);assert.equal(covered(small,.35),true);assert.equal(covered(small,8),true);assert.equal(covered(small,9),false);
 assert.equal(shadowed(small,.2),0);assert.ok(shadowed(small,.4)>0&&shadowed(small,.4)<1);assert.equal(shadowed(small,1),1);
 assert.ok(shadowed(small,9.5)>0&&shadowed(small,9.5)<1);assert.equal(shadowed(small,10),0);
});

test('a broken clip is told apart',()=>{
 assert.equal(clipOk(small),true);
 assert.equal(clipOk(null),false);
 assert.equal(clipOk({...small,frames:1}),false);
 assert.equal(clipOk({...small,hips:small.hips.slice(3)}),false);
 assert.equal(clipOk({...small,bones:{...small.bones,head:[0,0,0]}}),false);
 assert.equal(clipOk({...small,shut:[0,1,2,3,NaN]}),false);
 assert.equal(clipOk({...small,face:{blink:small.face.blink,aa:small.face.aa}}),false);
 assert.equal(clipOk({...small,marks:{...small.marks,seated:[.1]}}),false);
 assert.equal(clipOk({...small,marks:{...small.marks,seated:[.3,.3]}}),false);
 assert.equal(clipOk({...small,marks:{seated:[.1,.3],shadow:[.3,.5,9,10]}}),false);
 assert.equal(clipOk({...small,marks:{...small.marks,shadow:[.3,.5,9]}}),false);
 assert.equal(clipOk({...small,blend:{in:.1,out:-1}}),false);
 assert.equal(clipOk({...small,blend:{in:0,out:.1}}),false,'no time to ease in');
 assert.equal(clipOk({...small,blend:{in:.3,out:.3}}),false,'longer than the clip');
 assert.equal(clipOk({...small,blend:{in:.1,out:.2}}),true);
});

test('her walk as shipped is whole, and ends in the pose and place she sleeps in',()=>{
 const walk=file('nap-walk.json'),nap=file('nap.json'),last=walk.frames-1;
 assert.equal(clipOk(walk),true);
 assert.ok(clipLength(walk)>10&&clipLength(walk)<25,`${clipLength(walk)} s`);
 for(let i=0;i<3;i++)assert.ok(Math.abs(walk.hips[last*3+i]-nap.hips[i])<.002,'her hips end where she sleeps');
 for(const t of nap.tracks){
  const v=walk.bones[t.bone];assert.ok(v,t.bone);
  const q=v.length===4?v:v.slice(last*4,last*4+4),dot=Math.abs(q.reduce((s,x,i)=>s+x*t.rotations[i],0));
  assert.ok(dot>.9999,`${t.bone} ends as in the sleeping pose`);
 }
 assert.equal(walk.shut[0],0);assert.equal(walk.shut[last],nap.book.shut);
 assert.equal(walk.face.blink[last],1);
});

test('in her walk nothing jumps from one frame to the next',()=>{
 const walk=file('nap-walk.json');
 let far=0;
 for(let i=1;i<walk.frames;i++)far=Math.max(far,Math.hypot(walk.hips[i*3]-walk.hips[i*3-3],walk.hips[i*3+1]-walk.hips[i*3-2],walk.hips[i*3+2]-walk.hips[i*3-1]));
 assert.ok(far*walk.fps<1.8,`her hips never move faster than a walk (${(far*walk.fps).toFixed(2)} m/s)`);
 for(const [bone,v] of Object.entries(walk.bones)){
  if(v.length===4)continue;
  for(let i=1;i<walk.frames;i++){
   const dot=v[i*4]*v[i*4-4]+v[i*4+1]*v[i*4-3]+v[i*4+2]*v[i*4-2]+v[i*4+3]*v[i*4-1];
   assert.ok(dot>.985,`${bone} turns smoothly at frame ${i} (dot ${dot.toFixed(4)})`);
  }
 }
});

// --- the player, on a bare rig ---
import {Object3D,Mesh,Vector3,Matrix4,Quaternion} from 'three';
import {NapWalk,WALK} from '../src/balcony/nap-walk.js';
import {fakeRig} from './fake-rig.js';

function stage({drop=0,blend=null}={}){
 const rig=fakeRig(),scene=new Object3D();scene.add(rig.root);scene.position.set(9,0,-25);scene.updateMatrixWorld(true);
 const face={},made=[];
 const vrm={scene,meta:{metaVersion:'1'},humanoid:{getNormalizedBoneNode:n=>rig.nodes[n]??null,getRawBoneNode:n=>rig.nodes[n]??null,update(){}},
  expressionManager:{setValue:(k,v)=>{face[k]=v;},getValue:k=>face[k]??null,getExpression:k=>k==='relaxed'?{}:null}};
 const book=new Object3D(),inner=new Object3D();book.add(inner);book.matrixAutoUpdate=false;book.matrix.makeTranslation(1,2,3);
 const part=name=>{const m=new Mesh();m.name=name;inner.add(m);made.push(m);return m;};
 const near=part('book_cover004'),far=part('book_cover005'),pages=part('book_pages005'),spine=part('book_spine002');
 const leaf=new Object3D(),look=new Object3D(),grips=[];
 const grip={update(){grips.push(1);book.matrix.copy(rig.nodes.leftHand.matrixWorld);}};
 // eleven frames, one second: her hips cross the room and sink, her spine turns, the book shuts, her eyes close
 const n=11,turn=i=>new Quaternion().setFromAxisAngle(new Vector3(0,1,0),i/10).toArray();
 const clip={fps:10,frames:n,bones:{spine:Array.from({length:n},(_,i)=>turn(i)).flat(),head:[0,0,0,1],noSuchBone:[0,0,0,1]},
  hips:Array.from({length:n},(_,i)=>[9-i*.3,.9-i*.02,-25+i*.1]).flat(),shut:Array.from({length:n},(_,i)=>i*7.4),
  face:{blink:Array.from({length:n},(_,i)=>i/10),aa:Array.from({length:n},(_,i)=>i===5?.5:0),relaxed:Array.from({length:n},(_,i)=>i/40)},
  marks:{seated:[.2,.5],cover:[.6,9],shadow:[.5,.8,9,10]},...(blend?{blend}:{})};
 const walk=new NapWalk(vrm,book,clip,{grip,look,leaf,drop});
 return {rig,scene,vrm,face,book,near,far,pages,spine,leaf,look,grips,clip,walk};
}
const hipsAt=s=>s.rig.nodes.hips.getWorldPosition(new Vector3());
const play=(s,seconds,dt=1/60)=>{let going=true;for(let t=0;t<seconds-1e-9;t+=dt)going=s.walk.update(dt);return going;};

test('the player refuses a clip that is not whole',()=>{
 const s=stage();
 assert.throws(()=>new NapWalk(s.vrm,s.book,{...s.clip,hips:[]},{grip:{update(){}}}),/clip/);
});

test('before it begins the player does nothing',()=>{
 const s=stage(),at=hipsAt(s);
 assert.equal(s.walk.update(.1),false);
 assert.ok(hipsAt(s).distanceTo(at)<1e-9);assert.equal(s.grips.length,0);
});

test('it eases in from the pose she is in, without a jump',()=>{
 const s=stage();
 s.rig.nodes.spine.quaternion.setFromAxisAngle(new Vector3(1,0,0),.4);s.scene.updateMatrixWorld(true);
 const from=s.rig.nodes.spine.quaternion.clone(),at=hipsAt(s);
 s.walk.begin();
 assert.equal(s.walk.update(1/60),true);
 assert.ok(s.rig.nodes.spine.quaternion.angleTo(from)<.01,'her spine has hardly moved');
 assert.ok(hipsAt(s).distanceTo(at)<.01,'nor have her hips');
 assert.equal(s.leaf.visible,false);
});

test('at its end she is where the clip ends, the book shut in her hand, her eyes closed',()=>{
 const s=stage();
 s.walk.begin();
 assert.equal(play(s,WALK.blendIn),true);
 assert.equal(play(s,2),false);
 const last=s.clip.frames-1;
 assert.ok(hipsAt(s).distanceTo(new Vector3().fromArray(s.clip.hips,last*3))<1e-6);
 assert.ok(s.rig.nodes.spine.quaternion.angleTo(new Quaternion().fromArray(s.clip.bones.spine,last*4))<1e-6);
 const shut=74*Math.PI/180;
 assert.ok(Math.abs(s.far.rotation.z+2*shut)<1e-6&&Math.abs(s.pages.rotation.z+2*shut)<1e-6,"her right hand's half is folded over");
 assert.ok(Math.abs(s.spine.rotation.z+shut)<1e-6);assert.equal(s.near.rotation.z,0);
 assert.equal(s.face.blink,1);assert.equal(s.face.aa,0);
 assert.ok(s.grips.length>60,'the book followed her hand every frame');
 assert.ok(s.book.matrix.equals(s.rig.nodes.leftHand.matrixWorld));
 // nap.js takes over from here; the book stays shut where her hand has laid it
 s.walk.end();
 assert.equal(s.walk.active,false);assert.ok(Math.abs(s.far.rotation.z+2*shut)<1e-6);assert.ok(Math.abs(s.spine.rotation.z+shut)<1e-6);
});

test("while she is still seated her hips keep the viewer's lowering, and lose it as she rises",()=>{
 const low=stage({drop:.06}),plain=stage();
 // the bare rig has no legs: give this one a pair, bent as when seated, for her feet to be put back with
 const feet={};
 for(const [side,x] of [['left',.08],['right',-.08]]){
  let parent=low.rig.nodes.hips;
  for(const [name,y,z] of [['UpperLeg',-.05,0],['LowerLeg',0,.4],['Foot',-.4,0]]){const b=new Object3D();b.position.set(name==='UpperLeg'?x:0,y,z);parent.add(b);low.rig.nodes[side+name]=b;parent=b;}
 }
 low.scene.updateMatrixWorld(true);
 for(const side of ['left','right'])feet[side]=low.rig.nodes[side+'Foot'].getWorldPosition(new Vector3());
 low.walk.begin();plain.walk.begin();
 low.walk.update(.15);plain.walk.update(.15);
 const w=hipsAt(plain).y-hipsAt(low).y;
 assert.ok(w>0&&w<.06,`part of the way in she is ${w.toFixed(3)} lower`);
 low.scene.updateMatrixWorld(true);
 for(const side of ['left','right']){
  const now=low.rig.nodes[side+'Foot'].getWorldPosition(new Vector3()),moved=now.clone().sub(feet[side]),hips=hipsAt(low).sub(new Vector3(9,.9,-25));
  assert.ok(Math.abs(moved.y-hips.y-w)<.01,`her ${side} foot is raised by what her hips are lowered (${(moved.y-hips.y).toFixed(3)})`);
 }
 for(const s of [low,plain])play(s,.75);
 assert.ok(Math.abs(hipsAt(plain).y-hipsAt(low).y)<1e-6,'once she is up the lowering is gone');
});

test('a walk given up half way puts her and her book back as they were',()=>{
 const s=stage(),home=s.scene.position.clone(),book=s.book.matrix.clone();
 s.walk.begin();play(s,.6);
 assert.ok(s.scene.position.distanceTo(home)>.5);
 s.walk.abort();
 assert.ok(s.scene.position.equals(home));assert.ok(s.book.matrix.equals(book));
 assert.equal(s.leaf.visible,true);assert.equal(s.far.rotation.z,0);assert.equal(s.spine.rotation.z,0);
 assert.equal(s.face.aa,0);assert.equal(s.face.blink,0);assert.equal(s.face.relaxed,0);
 assert.equal(s.walk.update(.1),false);
});

test('her eyes rest ahead of her face as she goes',()=>{
 const s=stage();
 s.walk.begin();play(s,1);
 const head=s.rig.nodes.head.getWorldPosition(new Vector3());
 assert.ok(Math.abs(s.look.position.distanceTo(head)-WALK.gaze)<1e-6);
});

test('a model turned round on load gets its rotations mirrored, as its poses are',()=>{
 const s=stage();s.vrm.meta.metaVersion='0';
 const walk=new NapWalk(s.vrm,s.book,s.clip,{grip:{update(){}}});
 walk.begin();for(let i=0;i<120;i++)walk.update(1/60);
 const q=new Quaternion().fromArray(s.clip.bones.spine,(s.clip.frames-1)*4);q.x*=-1;q.z*=-1;
 assert.ok(s.rig.nodes.spine.quaternion.angleTo(q)<1e-6);
});

// --- her way back: the clip hands over to her reading ---
test('the way back starts from where she and her book were, when it is told',()=>{
 const s=stage({blend:{in:.2,out:.4}}),home={position:new Vector3(1,2,3),book:new Matrix4().makeTranslation(4,5,6),leaf:true};
 s.walk.begin({home});
 assert.equal(s.walk.home,home);assert.equal(s.leaf.visible,false);
 play(s,.3);s.walk.abort();
 assert.ok(s.scene.position.equals(home.position));assert.ok(s.book.matrix.equals(home.book));assert.equal(s.leaf.visible,true);
});

test('at its end a clip that hands over eases into the pose the reader gives her each frame',()=>{
 const s=stage({blend:{in:.2,out:.4}}),home=s.scene.position.clone();
 const reading=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.3),last=new Quaternion().fromArray(s.clip.bones.spine,10*4);
 s.walk.begin();
 play(s,.55);
 assert.equal(s.walk.tailing,false);
 const angles=[],dist=[];
 for(let i=0;i<27;i++){
  s.rig.nodes.spine.quaternion.copy(reading);s.face.blink=.2;          // the reader poses her first
  s.walk.update(1/60);
  if(i===3)assert.equal(s.walk.tailing,true);
  angles.push(s.rig.nodes.spine.quaternion.angleTo(reading));dist.push(s.scene.position.distanceTo(home));
 }
 assert.ok(angles[4]>.3,'early in the handover she is still mostly in the clip');
 // the clip itself keeps moving while its share goes, so the way there is not checked to be straight, only smooth
 for(let i=1;i<angles.length;i++){assert.ok(Math.abs(angles[i]-angles[i-1])<.12,`no jump in her pose at step ${i}`);assert.ok(Math.abs(dist[i]-dist[i-1])<.25,`nor in her place at step ${i}`);}
 assert.ok(angles.at(-8)<angles[4]&&dist.at(-8)<dist[4],'she is nearer her reading and her chair late in the handover than early');
 assert.ok(angles.at(-1)<1e-6&&dist.at(-1)<1e-6,'at the end the clip has let go of her');
 assert.ok(Math.abs(s.face.blink-.2)<1e-6,'and of her face');
 assert.ok(last.angleTo(reading)>.5,'(the two poses do differ)');
 s.walk.finish();
 assert.equal(s.walk.active,false);assert.equal(s.leaf.visible,true);assert.equal(s.far.rotation.z,0);assert.equal(s.face.relaxed,0);
 assert.ok(s.scene.position.equals(home));
});

test('her way back as shipped starts as she sleeps, ends as she reads, and nothing jumps',()=>{
 const back=file('nap-back.json'),out=file('nap-walk.json'),nap=file('nap.json'),last=back.frames-1;
 assert.equal(clipOk(back),true);
 assert.ok(back.blend.out>0,'it hands over to her reading');
 for(let i=0;i<3;i++)assert.ok(Math.abs(back.hips[i]-nap.hips[i])<.002,'her hips start where she sleeps');
 for(const t of nap.tracks){
  const v=back.bones[t.bone],dot=Math.abs(v.slice(0,4).reduce((s,x,i)=>s+x*t.rotations[i],0));
  assert.ok(dot>.9999,`${t.bone} starts as in the sleeping pose`);
 }
 assert.equal(back.shut[0],nap.book.shut);assert.equal(back.shut[last],0);
 assert.equal(back.face.blink[0],1);assert.ok(back.face.blink[last]<.05);
 for(let i=0;i<3;i++)assert.ok(Math.abs(back.hips[last*3+i]-out.hips[i])<.01,'her hips end where her walk out began: in her chair');
 for(const [bone,v] of Object.entries(back.bones)){
  const first=out.bones[bone].slice(0,4),end=v.length===4?v:v.slice(last*4,last*4+4),dot=Math.abs(end.reduce((s,x,i)=>s+x*first[i],0));
  assert.ok(dot>.998,`${bone} ends close to the pose her walk out began in (dot ${dot.toFixed(4)})`);
 }
 let far=0;
 for(let i=1;i<back.frames;i++)far=Math.max(far,Math.hypot(back.hips[i*3]-back.hips[i*3-3],back.hips[i*3+1]-back.hips[i*3-2],back.hips[i*3+2]-back.hips[i*3-1]));
 assert.ok(far*back.fps<1.8,`her hips never move faster than a walk (${(far*back.fps).toFixed(2)} m/s)`);
 for(const [bone,v] of Object.entries(back.bones)){
  if(v.length===4)continue;
  for(let i=1;i<back.frames;i++){
   const dot=v[i*4]*v[i*4-4]+v[i*4+1]*v[i*4-3]+v[i*4+2]*v[i*4-2]+v[i*4+3]*v[i*4-1];
   assert.ok(dot>.985,`${bone} turns smoothly at frame ${i} (dot ${dot.toFixed(4)})`);
  }
 }
});
