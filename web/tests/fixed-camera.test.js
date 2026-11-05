import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {FixedCamera} from '../src/companion/fixed-camera.js';

test('large look input changes direction within limits while keeping position fixed',()=>{
 const camera=new PerspectiveCamera();const rig=new FixedCamera(camera);
 rig.frame(false);const position=camera.position.clone(),initial=camera.quaternion.clone();
 rig.look(100,-100);for(let i=0;i<120;i++)rig.update(1/60);
 assert.ok(camera.position.equals(position));assert.ok(camera.quaternion.angleTo(initial)>.01);
 assert.ok(Math.abs(rig.snapshot().yaw)<=2.5*Math.PI/180+1e-9);
 assert.ok(Math.abs(rig.snapshot().pitch)<=1.5*Math.PI/180+1e-9);
});
test('reset restores pointing without translating the camera',()=>{
 const camera=new PerspectiveCamera();const rig=new FixedCamera(camera);rig.frame(true);
 const q=camera.quaternion.clone(),p=camera.position.clone();rig.look(1,1);rig.update(.1);rig.reset();
 for(let i=0;i<160;i++)rig.update(1/60);
 assert.ok(camera.position.equals(p));assert.ok(camera.quaternion.angleTo(q)<.0001);
});
