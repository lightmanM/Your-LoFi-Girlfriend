import test from 'node:test';
import assert from 'node:assert/strict';
import {lifeSignals,gazePoint,LIFE_RANGE} from '../src/companion/life.js';
import {Vector3} from 'three';

test('signals stay bounded and continuous',()=>{
 let previous=lifeSignals(0);
 for(let t=0;t<300;t+=1/60){
  const s=lifeSignals(t);
  for(const [k,v] of Object.entries(s)){
   assert.ok(Number.isFinite(v),k);assert.ok(v>=-1.0001&&v<=1.0001,`${k}=${v}`);
   assert.ok(Math.abs(v-previous[k])<.05,`${k} jumped ${Math.abs(v-previous[k])} at ${t}`);
  }
  previous=s;
 }
});
test('breath rises and falls once per period',()=>{
 const samples=[];for(let t=0;t<4.6;t+=.01)samples.push(lifeSignals(t).breath);
 assert.ok(Math.max(...samples)>.99&&Math.min(...samples)<.01);
 assert.ok(samples.indexOf(Math.max(...samples))<samples.length*.5,'inhale is the shorter half');
});
test('depth options scale the signals',()=>{
 const s=lifeSignals(7.3,{headDepth:0,gazeDepth:.5});
 assert.ok(s.headYaw===0);assert.equal(s.gazeX,lifeSignals(7.3).gazeX*.5);
});
test('gaze wanders near the focus and glances away on schedule',()=>{
 const focus=new Vector3(1,1.4,2.5),glance=new Vector3(-1,1.5,-2.5);
 const near=gazePoint(1,lifeSignals(1),{focus,glance});
 assert.ok(near.distanceTo(focus)<=LIFE_RANGE.gazeX+LIFE_RANGE.gazeY+1e-9);
 const away=gazePoint(13-1.2,lifeSignals(13-1.2),{focus,glance});
 assert.ok(away.distanceTo(glance)<.01,'fully on the glance target during the hold');
 const back=gazePoint(13.5,lifeSignals(13.5),{focus,glance});
 assert.ok(back.distanceTo(focus)<.2);
});
