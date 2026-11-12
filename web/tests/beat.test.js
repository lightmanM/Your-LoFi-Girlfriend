import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BEAT,createBeat} from '../src/music/beat.js';

// The beat of the music, found from its level as the page hears it (one number per frame). Signals here are made
// the way a track looks through the level meter: a hit on each beat that dies away, smoothed, plus noise.
const rng=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
function listen(beat,{bpm,seconds,noise=.05,offbeat=0,from=0,seed=3}){
 const random=rng(seed),period=60/bpm;let t=from,level=0;
 while(t<from+seconds){
  t+=1/60*(.8+.4*random());                                   // frames are not evenly spaced
  const since=((t%period)+period)%period,half=(((t+period/2)%period)+period)%period;
  const raw=bpm?Math.exp(-since/.09)+offbeat*Math.exp(-half/.09):0;
  level+=(Math.min(1,raw+noise*random())-level)*.45;            // the meter's own smoothing
  beat.push(level,t);
 }
 return t;
}
const wrap=x=>x-Math.round(x);   // a phase difference, -0.5..0.5

for(const bpm of [64,78,90,104])test(`it finds a steady ${bpm} beats a minute and where the beats fall`,()=>{
 const beat=createBeat(),t=listen(beat,{bpm,seconds:12}),b=beat.read(t);
 assert.ok(b,'a beat is heard');
 assert.ok(Math.abs(b.bpm-bpm)<2.5,`tempo ${b.bpm.toFixed(1)}`);
 assert.ok(b.confidence>=BEAT.confident,`sure of it (${b.confidence.toFixed(2)})`);
 // the meter's smoothing delays what it shows by a few hundredths of a second; the phase is on the beat within a tenth
 const period=60/bpm,next=Math.ceil(t/period)*period;
 assert.ok(Math.abs(wrap(beat.read(next).phase))<.1,`phase at a beat ${beat.read(next).phase.toFixed(2)}`);
});

test('a hit between the beats does not double the tempo',()=>{
 const beat=createBeat(),t=listen(beat,{bpm:72,seconds:12,offbeat:.45});
 assert.ok(Math.abs(beat.read(t).bpm-72)<2.5,`tempo ${beat.read(t).bpm.toFixed(1)}`);
});

test('silence and noise have no beat',()=>{
 let beat=createBeat(),t=listen(beat,{bpm:0,seconds:10,noise:0});
 assert.equal(beat.read(t),null,'silence');
 beat=createBeat();t=listen(beat,{bpm:0,seconds:10,noise:.6});
 const b=beat.read(t);assert.ok(!b||b.confidence<BEAT.confident,`noise (${b?.confidence.toFixed(2)})`);
});

test('the phase runs on smoothly between estimates, and a new track is picked up',()=>{
 const beat=createBeat();let t=listen(beat,{bpm:80,seconds:12});
 let last=beat.read(t).phase;
 for(let i=0;i<120;i++){t+=1/60;beat.push(.2,t);const p=beat.read(t).phase,step=wrap(p-last);assert.ok(step>0&&step<.06,`steady step ${step.toFixed(3)}`);last=p;}
 t=listen(beat,{bpm:100,seconds:14,from:t});
 assert.ok(Math.abs(beat.read(t).bpm-100)<2.5,`the new tempo ${beat.read(t).bpm.toFixed(1)}`);
});

test('a gap in the sound (the tab was hidden) starts it over',()=>{
 const beat=createBeat();let t=listen(beat,{bpm:80,seconds:10});
 beat.push(.3,t+5);
 assert.equal(beat.read(t+5),null);
});
