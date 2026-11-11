import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {reachArm} from '../src/balcony/arm-ik.js';
import {fakeRig,degrees} from './fake-rig.js';

// Two-bone reach: the wrist goes to the target; the elbow keeps its side, or goes where it is told.
const elbowSide=(rig,side)=>{const s=rig.world(side+'UpperArm'),e=rig.world(side+'LowerArm'),w=rig.world(side+'Hand');
 const d=w.clone().sub(s).normalize(),b=e.clone().sub(s);return b.addScaledVector(d,-b.dot(d)).normalize();};

test('the wrist reaches the target',()=>{
 const rig=fakeRig(),target=rig.world('leftUpperArm').add(new Vector3(.15,.25,.2));
 reachArm(rig,'left',target,1);rig.root.updateMatrixWorld(true);
 assert.ok(rig.world('leftHand').distanceTo(target)<1e-3);
});

test('weight 0 leaves the pose alone, and half weight goes half way',()=>{
 const rig=fakeRig(),from=rig.world('leftHand'),target=rig.world('leftUpperArm').add(new Vector3(.15,.25,.2)),before=rig.snapshot();
 reachArm(rig,'left',target,0);
 for(const [k,q] of Object.entries(rig.snapshot()))assert.equal(degrees(q,before[k]),0,k);
 reachArm(rig,'left',target,.5);rig.root.updateMatrixWorld(true);
 assert.ok(rig.world('leftHand').distanceTo(from.lerp(target,.5))<1e-3);
});

test('the elbow goes toward the direction it is given',()=>{
 for(const pole of [new Vector3(1,0,0),new Vector3(0,-1,0),new Vector3(0,0,-1)]){
  const rig=fakeRig(),target=rig.world('leftUpperArm').add(new Vector3(.1,.3,.1));
  reachArm(rig,'left',target,1,pole);rig.root.updateMatrixWorld(true);
  assert.ok(rig.world('leftHand').distanceTo(target)<1e-3,'still reaches');
  const d=target.clone().sub(rig.world('leftUpperArm')).normalize(),want=pole.clone().addScaledVector(d,-pole.dot(d)).normalize();
  assert.ok(elbowSide(rig,'left').dot(want)>.99,`elbow toward ${pole.toArray()}`);
 }
});
