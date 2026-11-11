import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OverheadStretch,STRETCH} from '../src/balcony/overhead-stretch.js';
import {fakeRig,degrees,still} from './fake-rig.js';

// The overhead stretch: book down to her lap, hands off it, both arms up into an open V with her back arched and her
// eyes shut, a small lean each way, arms down, book up. Run at a given time (s since it began).
const at=t=>{const s=new OverheadStretch();s.begin();s.advance(t);return s;};
const S=STRETCH,TOP=S.pre+S.easeIn+2.6;       // well into the hold at the top
const posed=t=>{const rig=fakeRig(),s=at(t);s.apply(rig,s.weight());rig.root.updateMatrixWorld(true);return {rig,s};};
const times=(a,b,step=1/30)=>Array.from({length:Math.floor((b-a)/step)+1},(_,i)=>a+i*step);

test('book down, the stretch, book up, in that order, in about twelve seconds',()=>{
 const s=new OverheadStretch();
 assert.ok(Math.abs(s.length-12)<.01,`${s.length}`);
 assert.equal(s.active,false);
 const down=at(S.pre/2);assert.equal(down.weight(),0);assert.ok(down.carry()>0&&down.carry()<1,'book on its way down');
 const top=at(TOP);assert.equal(top.weight(),1);assert.equal(top.carry(),1);
 const up=at(s.length-.05);assert.equal(up.weight(),0);assert.ok(up.carry()<.1,'book back up');
 assert.equal(at(s.length+.1).active,false);
});

test('her hands stay on the book while it travels and leave it only for the stretch',()=>{
 const s=new OverheadStretch();
 for(const t of times(0,S.pre+S.easeIn))for(const side of ['left','right'])assert.equal(at(t).armWeight(side),0,`${side} at ${t.toFixed(2)}`);
 for(const side of ['left','right'])assert.equal(at(TOP).armWeight(side),1);
 for(const t of times(s.length-S.post-S.easeOut+.3,s.length))for(const side of ['left','right'])assert.equal(at(t).armWeight(side),0,`${side} at ${t.toFixed(2)}`);
 // whenever a hand is off the book the stretch has the whole body: the reader blends on that
 for(const t of times(0,s.length))for(const side of ['left','right'])if(at(t).armWeight(side)>0)assert.equal(at(t).weight(),1,`at ${t.toFixed(2)}`);
});

test('her right arm runs a little behind her left',()=>{
 const leaving=times(S.pre+S.easeIn,TOP).map(at).find(s=>s.armWeight('left')>.3&&s.armWeight('left')<.7);
 assert.ok(leaving,'a moment as the hands leave the book');
 assert.ok(leaving.armWeight('right')<leaving.armWeight('left'));
});

test('her eyes are shut at the top, and open while the book moves',()=>{
 for(const k of ['eyeBlinkLeft','eyeBlinkRight'])assert.ok(at(TOP).face(k)>.9);
 const s=new OverheadStretch();
 for(const t of [...times(0,S.pre+S.easeIn),...times(s.length-S.post,s.length)])assert.equal(at(t).face('eyeBlinkLeft'),0,`at ${t.toFixed(2)}`);
 assert.equal(at(TOP).face('mouthSmile'),0);
});

test('nothing moves until the stretch has weight',()=>{
 const rig=fakeRig(),before=rig.snapshot();
 at(.4).apply(rig,0);at(TOP).apply(rig,0);
 for(const [k,q] of Object.entries(rig.snapshot()))assert.ok(degrees(q,before[k])<1e-6,k);
});

test('at the top both hands are above her head in an open V, her back arched and her head up',()=>{
 const {rig}=posed(TOP),ref=fakeRig();
 const head=rig.world('head').y+.12;
 for(const [side,s] of [['left',1],['right',-1]]){
  const w=rig.world(side+'Hand'),sh=rig.world(side+'UpperArm');
  assert.ok(w.y>head,`${side} hand above her head (${w.y.toFixed(2)} vs ${head.toFixed(2)})`);
  assert.ok(s*(w.x-sh.x)>.03,`${side} hand outside its shoulder`);
  assert.ok(rig.world(side+'LowerArm').y>sh.y,`${side} elbow above the shoulder`);
 }
 // just before she leans to one side, the two arms mirror each other (her right a moment behind)
 const level=posed(S.pre+S.easeIn+2.1).rig,l=level.world('leftHand'),r=level.world('rightHand');
 assert.ok(Math.abs(l.x+r.x)<.03&&Math.abs(l.y-r.y)<.03&&Math.abs(l.z-r.z)<.03,`left ${l.toArray().map(x=>x.toFixed(3))} right ${r.toArray().map(x=>x.toFixed(3))}`);
 assert.ok(rig.nodes.chest.quaternion.x<-.03,'chest arched back');
 assert.ok(rig.world('head').z<ref.world('head').z-.02,'head back with it');
 assert.ok(degrees(rig.nodes.head.quaternion,ref.nodes.head.quaternion)>20,'head tipped up');
});

test('her shoulders rise with her arms, but not to her ears',()=>{
 const {rig}=posed(TOP),ref=fakeRig();
 for(const side of ['left','right']){
  const lift=degrees(rig.nodes[side+'Shoulder'].quaternion,ref.nodes[side+'Shoulder'].quaternion);
  assert.ok(lift>8&&lift<=S.shoulder.most+10,`${side} ${lift.toFixed(1)} degrees`);
  assert.ok(rig.world(side+'UpperArm').y>ref.world(side+'UpperArm').y,'the joint is higher');
 }
});

test('her elbows never lock, and nothing jumps from one frame to the next',()=>{
 const s=new OverheadStretch(),free=times(S.pre+S.easeIn,s.length-S.post-S.easeOut,1/60);
 let last=null;
 for(const t of free){
  const {rig}=posed(t);
  for(const side of ['left','right']){
   const sh=rig.world(side+'UpperArm'),el=rig.world(side+'LowerArm'),w=rig.world(side+'Hand');
   const reach=sh.distanceTo(w)/(sh.distanceTo(el)+el.distanceTo(w));
   assert.ok(reach<=.985,`${side} arm straight at ${t.toFixed(2)} (${reach.toFixed(3)})`);
  }
  const now={l:rig.world('leftHand'),r:rig.world('rightHand'),h:rig.world('head')};
  if(last)for(const k of ['l','r','h'])assert.ok(now[k].distanceTo(last[k])<.035,`${k} jumps ${now[k].distanceTo(last[k]).toFixed(3)} m at ${t.toFixed(2)}`);
  last=now;
 }
});

test('fists on the way up, open hands at the top',()=>{
 const curl=t=>{const {rig}=posed(t);return degrees(rig.nodes.leftMiddleProximal.quaternion,still);};
 const rising=S.pre+S.easeIn+1.1;
 assert.ok(curl(rising)>35,`loose fist going up (${curl(rising).toFixed(0)})`);
 assert.ok(curl(TOP)<25,`open at the top (${curl(TOP).toFixed(0)})`);
});

test('she leans a little to one side and then the other at the top',()=>{
 const s=new OverheadStretch(),lean=times(S.pre+S.easeIn,s.length-S.post).map(t=>at(t).lean());
 assert.ok(Math.max(...lean)>3&&Math.min(...lean)<-2,'both ways');
 assert.ok(lean.indexOf(Math.max(...lean))<lean.indexOf(Math.min(...lean)),'to her left first');
 assert.ok(Math.abs(lean.at(-1))<1e-6,'and ends upright');
});

test('a character without finger bones still stretches',()=>{
 const rig=fakeRig();for(const k of Object.keys(rig.nodes))if(/Index|Middle|Ring|Little|Thumb/.test(k))delete rig.nodes[k];
 const s=at(TOP);assert.doesNotThrow(()=>s.apply(rig,1));
 rig.root.updateMatrixWorld(true);assert.ok(rig.world('leftHand').y>rig.world('head').y);
});
