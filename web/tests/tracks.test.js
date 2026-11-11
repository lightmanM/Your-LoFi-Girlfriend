import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Track,EASE,pulse,smooth} from '../src/balcony/tracks.js';

// Timing curves for authored motion (the overhead stretch): eases, tracks of overlapping moves, pulses.
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<eps,`${a} is not ${b}`);

test('every ease starts at 0 and ends at 1',()=>{
 for(const [name,e] of Object.entries(EASE)){
  assert.equal(e(-.5),0,name);assert.equal(e(0),0,name);near(e(1),1);assert.equal(e(1.5),1,name);
 }
});

test('no ease starts with a jolt, except the one meant to leave at speed',()=>{
 for(const [name,e] of Object.entries(EASE))if(name!=='out')assert.ok(e(.02)<.02,name);
});

test('back passes the goal a little, then settles; down is slow first',()=>{
 const peak=Math.max(...Array.from({length:201},(_,i)=>EASE.back(i/200)));
 assert.ok(peak>1.02&&peak<1.2,`peak ${peak}`);
 assert.ok(EASE.down(.3)<.1);assert.ok(EASE.down(.8)>.75);
});

test('a track holds before, between and after its moves',()=>{
 const tr=new Track(1).to(3,2,4).to(0,6,7);
 assert.equal(tr.at(0),1);near(tr.at(4),3);near(tr.at(5),3);near(tr.at(9),0);
});

test('overlapping moves blend without a stop',()=>{
 const tr=new Track(0).to(1,0,1).to(2,.6,1.6);
 const steps=Array.from({length:160},(_,i)=>tr.at((i+1)/100)-tr.at(i/100));
 assert.ok(steps.every(s=>s>=0));
 assert.ok(Math.min(...steps.slice(20,140))>.002,'still moving through the first move\'s end');
 near(tr.at(1.6),2);
});

test('a track works on vectors, and adding a move leaves the first track as it was',()=>{
 const a=new Track([0,0]),b=a.to([2,4],0,1,'soft');
 assert.deepEqual(b.at(.5),[1,2]);
 assert.deepEqual(a.at(.5),[0,0]);
});

test('an unknown ease is refused',()=>{
 assert.throws(()=>new Track(0).to(1,0,1,'bounce'),/ease/);
});

test('a pulse rises, holds and falls',()=>{
 assert.equal(pulse(0,1,2,3,4),0);assert.equal(pulse(2.5,1,2,3,4),1);assert.equal(pulse(5,1,2,3,4),0);
 near(pulse(1.5,1,2,3,4),smooth(.5));
});
