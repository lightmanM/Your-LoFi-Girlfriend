import test from 'node:test';
import assert from 'node:assert/strict';
import {Interaction} from '../src/companion/interaction.js';

test('greeting blends in, finishes, and returns to idle without a weight jump',()=>{
  const c=new Interaction({duration:4,blendIn:.7,blendOut:.9});
  assert.equal(c.state,'idle');assert.equal(c.request(),'started');
  let previous=0;const seen=new Set();
  for(let i=0;i<400;i++){
    c.update(1/60);const s=c.snapshot();seen.add(s.state);
    assert.ok(s.weight>=0&&s.weight<=1);
    assert.ok(Math.abs(s.weight-previous)<.05,'blend weight should change gradually');previous=s.weight;
  }
  assert.deepEqual([...seen],['acting','finishing','idle']);
  assert.equal(c.completed,1);assert.equal(c.weight,0);
});

test('rapid requests create at most one follow-up, never restart the current action',()=>{
  const c=new Interaction({duration:2,blendIn:.4,blendOut:.5});c.request();c.update(.3);
  const age=c.elapsed;
  for(let i=0;i<20;i++)c.request();
  assert.equal(c.elapsed,age);assert.equal(c.queued,true);
  for(let i=0;i<400;i++)c.update(1/60);
  assert.equal(c.completed,2);assert.equal(c.state,'idle');assert.equal(c.queued,false);
});

test('pause freezes action time; resume continues from the same weight',()=>{
  const c=new Interaction({duration:3});c.request();c.update(.2);c.paused=true;
  const frozen=c.snapshot();c.update(3);assert.deepEqual(c.snapshot(),frozen);
  c.paused=false;c.update(.1);assert.ok(c.elapsed>frozen.elapsed);
});

test('smoothstep easing has zero boundary velocity and rejects invalid time',()=>{
  const c=new Interaction({duration:3,blendIn:.75,blendOut:.8});c.request();c.update(.001);
  assert.ok(c.weight<.00001);assert.throws(()=>c.update(NaN));assert.throws(()=>c.update(-1));
});
