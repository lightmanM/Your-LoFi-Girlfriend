import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyFace,FACE} from '../src/voice/face.js';

const recorder=()=>{const v={};return {setValue:(k,x)=>{v[k]=x;},v};};
const mouth=(o={})=>({aa:0,ih:0,ou:0,ee:0,oh:0,...o});

test('mouth shapes go straight onto the face, smile and relax as given',()=>{
 const em=recorder();applyFace(em,{smile:1,relaxed:.6,mouth:mouth({oh:.4})});
 assert.equal(em.v.oh,.4);assert.equal(em.v.aa,0);assert.equal(em.v.relaxed,.6);
 assert.ok(Math.abs(em.v.happy-FACE.happy*(1-FACE.talkingEase*.4/.6))<1e-9);
});
test('her smile eases off as her mouth opens, so round vowels stay round',()=>{
 const shut=recorder(),open=recorder();
 applyFace(shut,{smile:1,mouth:mouth()});applyFace(open,{smile:1,mouth:mouth({aa:.6})});
 assert.equal(shut.v.happy,FACE.happy);
 assert.ok(Math.abs(open.v.happy-FACE.happy*(1-FACE.talkingEase))<1e-9);
});
test('no expression manager: nothing happens',()=>{
 assert.doesNotThrow(()=>applyFace(null,{smile:1,mouth:mouth()}));
});
