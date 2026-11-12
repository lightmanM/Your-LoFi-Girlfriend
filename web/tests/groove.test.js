import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GROOVE,nodShape,Groove} from '../src/balcony/groove.js';
import {fakeRig,degrees} from './fake-rig.js';

// Nodding to the music: now and then, for a few bars, her head dips a little on each beat.
const beatAt=(t,bpm=80,confidence=.8)=>({bpm,phase:((t*bpm/60)%1+1)%1,confidence});
const run=(g,{from=0,seconds,free=true,beat=beatAt,dt=1/60,each})=>{let t=from;for(;t<from+seconds;t+=dt){g.update(dt,{beat:beat?beat(t):null,free});each?.(t);}return t;};
const soon=()=>new Groove({random:()=>0,first:1});

test('the dip is deepest on the beat and wraps without a jump',()=>{
 assert.ok(nodShape(0)>.99);assert.ok(nodShape(.5)<.1,'up between beats');
 assert.ok(Math.abs(nodShape(.999)-nodShape(0))<.02,'continuous across the beat');
 for(let p=0;p<1;p+=.01)assert.ok(Math.abs(nodShape(p+.01)-nodShape(p))<.12,`smooth at ${p.toFixed(2)}`);
});

test('she nods for a few bars when the music has a clear beat, then stops for a good while',()=>{
 const g=soon();let top=0,nodding=0;
 const t=run(g,{seconds:40,each:()=>{top=Math.max(top,g.weight());if(g.weight()>0)nodding+=1/60;}});
 assert.ok(top>.99,'fully in');
 const beats=nodding*80/60;
 assert.ok(beats>=GROOVE.beats[0]-1&&beats<=GROOVE.beats[1]+3,`about ${beats.toFixed(1)} beats`);
 assert.equal(g.weight(),0);
 assert.ok(g.next-t>=GROOVE.every[0]-40,'the next one is minutes away');
});

test('no nodding without a clear beat, or while she is doing something else',()=>{
 let g=soon();run(g,{seconds:20,beat:null});assert.equal(g.weight(),0,'no music');
 g=soon();run(g,{seconds:20,beat:t=>beatAt(t,80,GROOVE.confident-.1)});assert.equal(g.weight(),0,'an unclear beat');
 g=soon();run(g,{seconds:20,free:false});assert.equal(g.weight(),0,'busy');
 const dip=soon();let t0=run(dip,{seconds:4});
 t0=run(dip,{from:t0,seconds:1,beat:t=>beatAt(t,80,GROOVE.keep+.02)});assert.ok(dip.weight()>.9,'a beat a little less clear does not stop her');
 run(dip,{from:t0,seconds:1,beat:t=>beatAt(t,80,GROOVE.keep-.05)});assert.equal(dip.weight(),0,'a lost beat does');
 const t=run(g,{from:20,seconds:4});assert.ok(g.weight()>0,'it starts once she is free');
 run(g,{from:t,seconds:.8,free:false});assert.equal(g.weight(),0,'and stops soon when she is not');
});

test('it comes in and goes out gently',()=>{
 const g=soon();let last=0;
 run(g,{seconds:40,each:()=>{assert.ok(Math.abs(g.weight()-last)<.05,'no jump');last=g.weight();}});
});

test('her head dips on the beat by a couple of degrees, shared with her neck, and is untouched otherwise',()=>{
 const rig=fakeRig(),g=soon(),before=rig.snapshot();
 g.apply(rig);assert.equal(degrees(rig.nodes.head.quaternion,before.head),0,'idle: nothing');
 let t=run(g,{seconds:6});                           // well into the episode
 const period=60/80;t=Math.ceil(t/period)*period;     // on a beat
 g.update(0,{beat:beatAt(t),free:true});
 rig.pose();g.apply(rig);
 const head=degrees(rig.nodes.head.quaternion,before.head),neck=degrees(rig.nodes.neck.quaternion,before.neck);
 assert.ok(head>.8&&head<=GROOVE.head,`head ${head.toFixed(2)} degrees`);assert.ok(neck>0&&neck<head,'the neck takes a smaller share');
 assert.ok(rig.world('head').distanceTo(rig.world('neck'))>0);
 for(const n of ['leftUpperArm','rightHand','spine'])assert.equal(degrees(rig.nodes[n].quaternion,before[n]),0,n);
});
