import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {HairTuck,TUCK} from '../src/balcony/hair-tuck.js';
import {fakeRig,degrees} from './fake-rig.js';

// Tucking her hair behind her ear: her left hand lets go of the book, comes up to her temple, strokes back over
// her ear and goes back to the book, while her right hand keeps hold of it.
const at=(t,rig=fakeRig())=>{const k=new HairTuck();assert.equal(k.begin(rig),true);k.advance(t);return {k,rig};};
const posed=t=>{const {k,rig}=at(t);k.apply(rig);rig.root.updateMatrixWorld(true);return {k,rig};};

test('her hand slides off the book before it leaves, and is back on it before the slide ends',()=>{
 const k=new HairTuck();assert.equal(k.active,false);assert.equal(k.armWeight(),0);assert.equal(k.slide(),0);
 assert.ok(at(.25).k.slide()>.3,'sliding out');assert.equal(at(.25).k.armWeight(),0,'still on the book');
 const mid=at(TUCK.length/2).k;assert.equal(mid.armWeight(),1);assert.equal(mid.slide(),1);
 const late=at(TUCK.back[1]+.02).k;assert.equal(late.armWeight(),0,'back on the book');assert.ok(late.slide()>.3,'still out past its edge');
 assert.equal(at(TUCK.length+.1).k.active,false);
 let last=0;for(let t=0;t<TUCK.length;t+=1/60){const w=at(t).k.armWeight();assert.ok(Math.abs(w-last)<.06,`no jump at ${t.toFixed(2)}`);last=w;}
});

test('at the stroke her fingertips are at the side of her head, on her left, elbow down and forward',()=>{
 const {k,rig}=posed(TUCK.stroke[0]+.3),head=rig.world('head'),wrist=rig.world('leftHand'),elbow=rig.world('leftLowerArm');
 const tip=k.tipWorld(rig);
 assert.ok(tip.x>head.x+.04&&tip.x<head.x+.16,`beside her head (${(tip.x-head.x).toFixed(3)})`);
 assert.ok(tip.y>head.y&&tip.y<head.y+.16,`at ear height (${(tip.y-head.y).toFixed(3)})`);
 assert.ok(wrist.distanceTo(tip)<.26,'the hand reaches it');
 assert.ok(elbow.y<wrist.y,'elbow below the hand');assert.ok(elbow.z>rig.world('leftUpperArm').z,'elbow in front of the shoulder');
});

test('the stroke goes back and down, behind her ear',()=>{
 const a=posed(TUCK.stroke[0]),b=posed(TUCK.stroke[1]);
 const p=a.k.tipWorld(a.rig),q=b.k.tipWorld(b.rig);
 assert.ok(q.z<p.z-.03,'back');assert.ok(q.y<p.y,'down');
});

test('only her left arm and her head move, her head only a little; nothing is left changed afterwards',()=>{
 const rig=fakeRig(),before=rig.snapshot(),k=new HairTuck();k.begin(rig);k.advance(TUCK.stroke[0]+.2);k.apply(rig);
 for(const n of ['rightShoulder','rightUpperArm','rightLowerArm','rightHand','spine','chest','hips'])assert.equal(degrees(rig.nodes[n].quaternion,before[n]),0,n);
 assert.ok(degrees(rig.nodes.leftUpperArm.quaternion,before.leftUpperArm)>20,'the arm is up');
 const tilt=degrees(rig.nodes.head.quaternion,before.head);assert.ok(tilt>0&&tilt<=TUCK.tilt+TUCK.turn,`head ${tilt.toFixed(1)} degrees`);
 rig.pose();k.advance(TUCK.length);k.apply(rig);
 for(const n of Object.keys(before))assert.equal(degrees(rig.nodes[n].quaternion,before[n]),0,n);
});

test('the hand moves without a jolt',()=>{
 const k=new HairTuck(),rig=fakeRig();k.begin(rig);let last=null,fastest=0;
 for(let t=0;t<TUCK.length;t+=1/60){
  rig.pose();k.advance(1/60);if(!k.active)break;k.apply(rig);rig.root.updateMatrixWorld(true);
  const w=rig.world('leftHand');if(last)fastest=Math.max(fastest,w.distanceTo(last)*60);last=w;
 }
 assert.ok(fastest<.9,`an unhurried hand: fastest ${fastest.toFixed(2)} m/s`);
});

test('a character without the bones it needs is left alone',()=>{
 const rig=fakeRig();delete rig.nodes.leftHand;
 const k=new HairTuck();assert.equal(k.begin(rig),false);assert.equal(k.active,false);
});
