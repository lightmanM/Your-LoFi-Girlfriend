import {test} from 'node:test';
import assert from 'node:assert/strict';
import {widenEyes,EYES} from '../src/balcony/eye-range.js';

const MAPS=['rangeMapHorizontalInner','rangeMapHorizontalOuter','rangeMapVerticalDown','rangeMapVerticalUp'];
const applier=()=>Object.fromEntries(MAPS.map(k=>[k,{inputMaxValue:90,outputScale:10}]));
const values=a=>MAPS.map(k=>[a[k].inputMaxValue,a[k].outputScale]);

test('fully widened: her eyes turn one for one, up to the wide limit',()=>{
 const a=applier();widenEyes(a,1);
 assert.deepEqual(values(a),MAPS.map(()=>[EYES.wide.inputMaxValue,EYES.wide.outputScale]));
});
test('halfway between rest and wide',()=>{
 const a=applier();widenEyes(a,.5);
 assert.deepEqual(values(a),MAPS.map(()=>[(90+EYES.wide.inputMaxValue)/2,(10+EYES.wide.outputScale)/2]));
});
test('back to exactly the model\'s own range at 0, however often it was widened',()=>{
 const a=applier();widenEyes(a,1);widenEyes(a,.3);widenEyes(a,1);widenEyes(a,0);
 assert.deepEqual(values(a),MAPS.map(()=>[90,10]));
});
test('no applier (a model without eye bones): nothing happens',()=>{
 assert.doesNotThrow(()=>widenEyes(undefined,1));assert.doesNotThrow(()=>widenEyes({},1));
});
