import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {talkingHead,HEAD} from '../src/voice/talk-head.js';

// Her head while she speaks: small dips with the louder syllables and a slow sway, never still, never large or jerky.
const LINES=JSON.parse(readFileSync(new URL('../public/voice/lines.json',import.meta.url),'utf8')).lines;
const line=LINES.find(l=>l.id==='forgotten');
const sample=(fn,from,to,dt=1/60)=>{const out=[];for(let t=from;t<to;t+=dt)out.push([t,fn(t)]);return out;};

test('while she speaks her head keeps moving a little, in every direction',()=>{
 const s=sample(t=>talkingHead(line,t),0,line.duration).map(x=>x[1]);
 for(const k of ['yaw','pitch','roll']){
  const v=s.map(x=>x[k]),range=Math.max(...v)-Math.min(...v);
  assert.ok(range>.6,`${k} moves only ${range.toFixed(2)}°`);
 }
});

test('the motion stays subtle: a couple of degrees at most',()=>{
 for(const [,h] of sample(t=>talkingHead(line,t),-1,line.duration+2))
  for(const k of ['yaw','pitch','roll'])assert.ok(Math.abs(h[k])<=2.2,`${k} ${h[k]}`);
});

test('it is smooth: no jumps from one frame to the next',()=>{
 const s=sample(t=>talkingHead(line,t),-1,line.duration+2);
 for(let i=1;i<s.length;i++)for(const k of ['yaw','pitch','roll'])
  assert.ok(Math.abs(s[i][1][k]-s[i-1][1][k])<.2,`${k} jumped at ${s[i][0].toFixed(2)} s`);
});

test('her head dips more on loud syllables than in the pause between sentences',()=>{
 const pause=line.moras.filter(m=>m.vowel==='pau').sort((a,b)=>(b.end-b.start)-(a.end-a.start))[0];
 const quiet=talkingHead(line,(pause.start+pause.end)/2+HEAD.beatLag).beat;
 const loud=Math.max(...sample(t=>talkingHead(line,t).beat,0,line.duration).map(x=>x[1]));
 assert.ok(loud>quiet+.4,`loud ${loud.toFixed(2)}, pause ${quiet.toFixed(2)}`);
});

test('a weight fades it all out (before she speaks, after she has finished)',()=>{
 const h=talkingHead(line,1.3,{weight:0});
 assert.deepEqual([h.yaw,h.pitch,h.roll],[0,0,0]);
});
