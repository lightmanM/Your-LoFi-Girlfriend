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
// breaths over a stretch of time: the times of each bottom (start of an inhale) and top, and the top's height
const breaths=(seconds,dt=1/240)=>{
 const b=[];for(let t=0;t<seconds;t+=dt)b.push([t,lifeSignals(t).breath]);
 const bottoms=[],tops=[];
 for(let i=1;i<b.length-1;i++){if(b[i][1]<=b[i-1][1]&&b[i][1]<b[i+1][1])bottoms.push(b[i][0]);if(b[i][1]>=b[i-1][1]&&b[i][1]>b[i+1][1])tops.push(b[i]);}
 return {b,bottoms,tops};
};
test('she breathes about every 4.6 s, inhaling quicker than she exhales',()=>{
 const {bottoms,tops}=breaths(46);
 assert.ok(bottoms.length>=9&&bottoms.length<=11,`${bottoms.length} breaths in 46 s`);
 let inhale=0,exhale=0,n=0;
 for(let i=0;i+1<bottoms.length;i++){const top=tops.find(x=>x[0]>bottoms[i]&&x[0]<bottoms[i+1]);if(!top)continue;inhale+=top[0]-bottoms[i];exhale+=bottoms[i+1]-top[0];n++;}
 assert.ok(n>5&&inhale<exhale,`inhale ${inhale/n} s, exhale ${exhale/n} s`);
});
test('each breath turns around softly, at the top and at the bottom: no sudden reversal',()=>{
 const {b}=breaths(60),dt=1/240,v=b.map((x,i)=>i?(x[1]-b[i-1][1])/dt:0);
 const peak=Math.max(...v.map(Math.abs));let jump=0;
 for(let i=2;i<v.length;i++)jump=Math.max(jump,Math.abs(v[i]-v[i-1]));
 assert.ok(jump<.05*peak,`speed changed by ${(jump/peak*100).toFixed(0)}% of its peak in 1/240 s`);
});
test('breaths vary a little in length and depth, like a person\'s',()=>{
 const {bottoms,tops}=breaths(120),len=bottoms.slice(1).map((t,i)=>t-bottoms[i]),depth=tops.map(x=>x[1]);
 const spread=a=>(Math.max(...a)-Math.min(...a));
 const mean=len.reduce((s,x)=>s+x,0)/len.length;
 assert.ok(spread(len)/mean>.05&&spread(len)/mean<.35,`lengths ${len.map(x=>x.toFixed(2)).join(' ')}`);
 assert.ok(spread(depth)>.05&&spread(depth)<.3&&Math.max(...depth)<=1,`depths ${depth.map(x=>x.toFixed(2)).join(' ')}`);
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
