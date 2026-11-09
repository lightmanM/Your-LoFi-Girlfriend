import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Object3D,Quaternion} from 'three';
import {Unwind,UNWIND} from '../src/balcony/unwind.js';

// The break from reading: book down to her lap, two shoulder rolls, her head tilted one way and the other with her
// eyes closed, book back up. Run at a given time (s since it began).
const at=t=>{const u=new Unwind();u.begin();u.advance(t);return u;};
const breakStart=UNWIND.pre+UNWIND.easeIn;
const fakeVrm=()=>{const nodes={};for(const n of ['leftShoulder','rightShoulder','chest','neck','head'])nodes[n]=new Object3D();
 return {nodes,humanoid:{getNormalizedBoneNode:n=>nodes[n]??null}};};
const angle=(a,b)=>a.angleTo(b)*180/Math.PI;

test('it puts the book down, takes its break, and picks the book up again, in that order',()=>{
 const u=new Unwind();
 assert.equal(u.length,UNWIND.pre+UNWIND.easeIn+u.played+UNWIND.easeOut+UNWIND.post);
 assert.equal(at(.5*UNWIND.pre).weight(),0);
 assert.ok(at(.5*UNWIND.pre).carry()>0&&at(.5*UNWIND.pre).carry()<1,'book on its way down');
 const mid=at(breakStart+u.played/2);assert.equal(mid.weight(),1);assert.equal(mid.carry(),1);
 assert.equal(at(u.length-.05).weight(),0);assert.ok(at(u.length-.05).carry()<.1,'book back up');
 assert.equal(at(u.length+.1).active,false);
});

test('her hands stay on the book the whole time',()=>{
 for(const t of [0,1,breakStart,breakStart+3,breakStart+7])assert.equal(at(t).armWeight('left'),0);
});

test('her head tilts to one side, back, then to the other, and ends level',()=>{
 const u=new Unwind(),T=UNWIND.tilt,s=[];
 for(let x=0;x<=u.played;x+=1/60)s.push(u.tilt(x));
 assert.ok(Math.max(...s)>.99&&Math.min(...s)<-.99,'both sides, fully');
 assert.ok(s.indexOf(Math.max(...s))<s.indexOf(Math.min(...s)),'one side first');
 assert.equal(u.tilt(0),0);assert.ok(Math.abs(u.tilt(u.played))<1e-9);
 for(let i=1;i<s.length;i++)assert.ok(Math.abs(s[i]-s[i-1])<.05,`no jump at ${(i/60).toFixed(2)} s`);
 assert.ok(Math.abs(u.tilt(T.start+T.ease+T.hold/2))>.99,'held at the first tilt');
});

test('her eyes close while her head is tilted, not while she rolls her shoulders',()=>{
 const T=UNWIND.tilt,hold=at(breakStart+T.start+T.ease+T.hold/2);
 assert.ok(hold.face('eyeBlinkLeft')>.8);assert.ok(hold.face('eyeBlinkRight')>.8);
 assert.equal(at(breakStart+1).face('eyeBlinkLeft'),0);
 assert.equal(hold.face('mouthSmile'),0);
});

test('nothing moves before the break has weight; during it her shoulders, head and neck turn',()=>{
 const v=fakeVrm(),still=new Quaternion();
 at(.3).apply(v,0);for(const n of Object.values(v.nodes))assert.ok(angle(n.quaternion,still)<1e-6);
 const peak=at(breakStart+UNWIND.roll.period/2);peak.apply(v,1);
 assert.ok(angle(v.nodes.leftShoulder.quaternion,still)>UNWIND.roll.lift*.8,'shoulder at the top of its roll');
 assert.ok(angle(v.nodes.head.quaternion,still)>10,'head up from the book');
});

test('the two tilts go opposite ways',()=>{
 const T=UNWIND.tilt,one=fakeVrm(),two=fakeVrm();
 at(breakStart+T.start+T.ease+T.hold/2).apply(one,1);
 at(breakStart+T.start+2*T.ease+T.hold+T.gap+T.ease+T.hold/2).apply(two,1);
 const z=q=>q.z;   // sign of the head's turn about her forward axis (the tilt; the lift is about her side axis)
 assert.ok(z(one.nodes.head.quaternion)>.03&&z(two.nodes.head.quaternion)<-.03);
});
