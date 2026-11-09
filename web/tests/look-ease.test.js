import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lookWeight,settle} from '../src/balcony/look-ease.js';

const h=1e-3;
const speed=(f,x)=>(f(x+h)-f(x-h))/(2*h);
const accel=(f,x)=>(f(x+h)-2*f(x)+f(x-h))/(h*h);

test('settle goes 0 to 1, starting and stopping with no speed and no jolt',()=>{
 assert.equal(settle(0),0);assert.equal(settle(1),1);assert.equal(settle(-1),0);assert.equal(settle(2),1);
 for(const x of [.002,.998]){assert.ok(Math.abs(speed(settle,x))<.01,`speed at ${x}`);assert.ok(Math.abs(accel(settle,x))<.5,`acceleration at ${x}: ${accel(settle,x)}`);}
 for(let x=.01;x<1;x+=.01)assert.ok(settle(x+.01)>settle(x),'always moving forward');
});

test('a look: eases out of the book, holds, eases back',()=>{
 const w=t=>lookWeight(t,{ease:1,hold:2});
 assert.equal(w(-.1),0);assert.equal(w(0),0);assert.equal(w(1),1);assert.equal(w(2.5),1);assert.equal(w(3),1);assert.equal(w(4),0);assert.equal(w(5),0);
 assert.ok(Math.abs(w(.5)-.5)<1e-9);assert.ok(Math.abs(w(3.5)-.5)<1e-9);
});

test('a look can come back at its own pace',()=>{
 const w=t=>lookWeight(t,{ease:1,hold:0,back:2});
 assert.ok(Math.abs(w(2)-.5)<1e-9);assert.equal(w(3),0);
});
