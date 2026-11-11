import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BREAKS,gap,due,after} from '../src/balcony/breaks.js';

// When her two breaks from reading happen: the calm break every 4 to 8 minutes, the overhead stretch every 5 to 15,
// never together, never back to back.
const rng=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};

test('the stretch comes every 5 to 15 minutes, the calm break every 4 to 8',()=>{
 assert.deepEqual(BREAKS.stretch.every,[300,900]);assert.deepEqual(BREAKS.unwind.every,[240,480]);
 const r=rng(3);
 for(let i=0;i<500;i++){const g=gap(BREAKS.stretch.every,r);assert.ok(g>=300&&g<=900,`${g}`);}
 assert.equal(gap([300,900],()=>0),300);assert.equal(gap([300,900],()=>.5,.1),60,'scaled for checks');
});

test('nothing starts while she is in the middle of something',()=>{
 const next={unwind:10,stretch:20};
 assert.equal(due(30,next,false),null);
 assert.equal(due(5,next,true),null,'not yet due');
 assert.equal(due(15,next,true),'unwind');
 assert.equal(due(30,next,true),'unwind','the one that has waited longest goes first');
 assert.equal(due(30,{unwind:25,stretch:20},true),'stretch');
});

test('after one ends the other keeps its time, or waits a minute',()=>{
 const gapOf=()=>400;
 assert.deepEqual(after('unwind',100,{unwind:80,stretch:500},gapOf),{unwind:500,stretch:500});
 assert.deepEqual(after('unwind',100,{unwind:80,stretch:90},gapOf),{unwind:500,stretch:100+BREAKS.apart});
 const before={unwind:80,stretch:90};after('stretch',100,before,gapOf);
 assert.deepEqual(before,{unwind:80,stretch:90},'the schedule passed in is not changed');
});

test('over a day they never overlap, never run back to back, and the stretch keeps its 5 to 15 minutes',()=>{
 const r=rng(11),LENGTH={unwind:15.6,stretch:12},gapOf=n=>gap(BREAKS[n].every,r);
 let next={unwind:gapOf('unwind'),stretch:gapOf('stretch')},playing=null,ends=0,lastEnd={},starts={unwind:[],stretch:[]},lastAnyEnd=-1e9,lastEnded=null;
 for(let t=0;t<86400;t+=.5){
  if(playing&&t>=ends){next=after(playing,t,next,gapOf);lastEnd[playing]=t;lastAnyEnd=t;lastEnded=playing;playing=null;}
  if(!playing){
   const busy=(t%37)<4;                          // page turns and glances come and go
   const name=due(t,next,!busy);
   if(name){
    if(lastEnded&&lastEnded!==name)assert.ok(t-lastAnyEnd>=BREAKS.apart,`${name} ${t-lastAnyEnd}s after the other`);
    if(lastEnd[name]!==undefined){const [a,b]=BREAKS[name].every,waited=t-lastEnd[name];
     assert.ok(waited>=a&&waited<=b+BREAKS.apart+LENGTH.unwind+LENGTH.stretch+5,`${name} after ${waited}s`);}
    playing=name;ends=t+LENGTH[name];starts[name].push(t);
   }
  }
 }
 assert.ok(starts.stretch.length>=86400/900-2&&starts.stretch.length<=86400/300);
 assert.ok(starts.unwind.length>starts.stretch.length,'the calm break is the more frequent one');
});
