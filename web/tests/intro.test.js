import test from 'node:test';
import assert from 'node:assert/strict';
import {beepPlan,BEEP} from '../src/intro/beep.js';

test('beep: two short blips starting at the given time',()=>{
 const p=beepPlan(1);
 assert.equal(p.length,BEEP.count);
 assert.equal(p[0].start,1);
 for(const b of p){assert.ok(Math.abs(b.end-b.start-BEEP.length)<1e-9);assert.equal(b.freq,BEEP.freq);}
});
test('beep: blips are separated by the gap and never overlap',()=>{
 const p=beepPlan(0);
 for(let i=1;i<p.length;i++){assert.ok(p[i].start>p[i-1].end);assert.ok(Math.abs(p[i].start-p[i-1].end-BEEP.gap)<1e-9);}
});
test('beep: envelope fits inside each blip',()=>{
 assert.ok(BEEP.attack+BEEP.release<BEEP.length);
});
