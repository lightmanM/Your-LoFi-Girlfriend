import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleScalar,sampleRotation,loopTime,actionTime} from '../src/companion/source-motion.js';

test('source samples preserve endpoints and interpolate irregular time intervals',()=>{
 assert.equal(sampleScalar([0,.25,1],[0,1,0],.625),.5);
 assert.equal(sampleScalar([0],[.7],100),.7);
 assert.equal(sampleScalar([0,1],[.2,.8],-2),.2);
 assert.equal(sampleScalar([0,1],[.2,.8],2),.8);
});
test('quaternion interpolation takes the short arc and stays normalized',()=>{
 const q=sampleRotation([0,1],[0,0,0,1,0,0,0,-1],.5);
 assert.ok(Math.abs(q.w)===1);assert.ok(Math.abs(q.length()-1)<1e-9);
});
test('loop wrap uses an endpoint crossfade and action time clamps instead of restarting',()=>{
 const before=loopTime(1.999,2,.3),after=loopTime(2.001,2,.3);
 const values=[0,1],times=[0,2];
 const at=({time,wrap})=>sampleScalar(times,values,time)*(1-wrap)+values[0]*wrap;
 assert.ok(Math.abs(at(before)-at(after))<.002);
 assert.equal(actionTime(4,1),1);
});
