import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Euler,MathUtils} from 'three';
import {withPoseFix} from '../src/standin/pose-fix.js';

// Small turns (degrees, in the bone's own frame) on the reading pose, so a stand-in character fits the chair and book.
const POSE={name:'p',tracks:[{bone:'chest',rotations:[0,0,0,1]},{bone:'neck',rotations:[0,.1,0,.995]}]};

test('a fix turns its bone and leaves the others',()=>{
 const out=withPoseFix(POSE,{chest:[10,0,0]});
 const q=new Quaternion().fromArray(out.tracks[0].rotations),want=new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(10),0,0));
 assert.ok(q.angleTo(want)<1e-6);
 assert.deepEqual(out.tracks[1],POSE.tracks[1]);
});

test('the pose it was given is not changed, and no fix gives the same pose',()=>{
 const before=JSON.stringify(POSE);withPoseFix(POSE,{chest:[5,5,5]});assert.equal(JSON.stringify(POSE),before);
 assert.deepEqual(withPoseFix(POSE,{}),POSE);
});
