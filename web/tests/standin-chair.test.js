import {test} from 'node:test';
import assert from 'node:assert/strict';
import {standinChair} from '../src/standin/chair.js';

// The stand-in chair: the two panels the page fits to the real chair, kept as numbers (public/standin/chair.json).
const ring=(y,z0,z1)=>[[0,y,z0],[.4,y,z0],[.4,y,z1],[0,y,z1]];
const SPEC={seat:ring(.45,0,.4),back:[[0,.5,0],[.4,.5,0],[.4,.9,-.05],[0,.9,-.05]]};

test('the stand-in chair has the seat the seating code looks for, and a back',()=>{
 const g=standinChair(SPEC),meshes=[];g.traverse(o=>{if(o.isMesh)meshes.push(o);});
 assert.equal(meshes.length,2);
 const seat=meshes.find(m=>m.name==='Chair weave panel');assert.ok(seat,'a mesh named "Chair weave panel"');
 seat.geometry.computeBoundingBox();
 assert.ok(Math.abs(seat.geometry.boundingBox.max.y-.45)<.001,'its top is the seat height');
 assert.ok(meshes.some(m=>m!==seat),'a back panel');
});

test('a chair description without its panels is refused',()=>{
 assert.throws(()=>standinChair({seat:null,back:SPEC.back}),/seat/);
});
