import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePlaylist,makeBag,advance,EMPTY_QUEUE} from '../src/music/playlist.js';
import {dbToGain,fadeCurve,decide,fadeLength} from '../src/music/fades.js';

// deterministic rng for shuffles
const seeded=(s=1)=>()=>((s=Math.imul(s^s>>>15,1|s)+0x6d2b79f5|0)>>>0)/4294967296;
const track=(o={})=>({id:'a-song',file:'a-song.mp3',title:'Song',artist:'A',duration:120,gain_db:-3,
 license:{name:'CC0 1.0',url:'https://creativecommons.org/publicdomain/zero/1.0/'},source:'https://example.org/',...o});

test('playlist: keeps valid tracks and resolves urls against the base',()=>{
 const {tracks,rejected}=parsePlaylist({version:1,tracks:[track()]},'/music/');
 assert.equal(rejected.length,0);assert.equal(tracks[0].url,'/music/a-song.mp3');
 assert.ok(Math.abs(tracks[0].gain-dbToGain(-3))<1e-9);assert.ok(Object.isFrozen(tracks));
});
test('playlist: rejects unsafe or incomplete tracks',()=>{
 const bad=[track({file:'../secret.mp3'}),track({file:'https://evil.example/x.mp3'}),track({duration:-1}),
  track({gain_db:40}),track({license:{name:'CC0'}}),track({license:{name:'x',url:'javascript:alert(1)'}}),track({title:''})];
 const {tracks,rejected}=parsePlaylist({version:1,tracks:[...bad,track({id:'ok',file:'ok.mp3'})]},'/music/');
 assert.equal(tracks.length,1);assert.equal(rejected.length,bad.length);
});
test('playlist: refuses an unknown format or an empty list',()=>{
 assert.throws(()=>parsePlaylist({version:2,tracks:[track()]},'/m/'));
 assert.throws(()=>parsePlaylist({version:1,tracks:[]},'/m/'));
 assert.throws(()=>parsePlaylist(null,'/m/'));
 assert.throws(()=>parsePlaylist({version:1,tracks:[track({file:'../x.mp3'})]},'/m/'),/no playable/);
});

test('shuffle: every track once per round',()=>{
 const bag=makeBag(23,seeded(7));assert.deepEqual([...bag].sort((a,b)=>a-b),[...Array(23).keys()]);
});
test('shuffle: never repeats a track across rounds',()=>{
 const rng=seeded(3);let q=EMPTY_QUEUE,last=-1;
 for(let i=0;i<500;i++){const r=advance(q,4,rng);assert.notEqual(r.index,last,`repeat at ${i}`);last=r.index;q=r.queue;}
});
test('shuffle: plays the whole round before reshuffling',()=>{
 const rng=seeded(9);let q=EMPTY_QUEUE;const seen=new Set();
 for(let i=0;i<10;i++){const r=advance(q,10,rng);seen.add(r.index);q=r.queue;}
 assert.equal(seen.size,10);
});
test('shuffle: skips failed tracks and gives up when none are left',()=>{
 const rng=seeded(5);let q=EMPTY_QUEUE;
 for(let i=0;i<20;i++){const r=advance(q,3,rng,new Set([1]));assert.notEqual(r.index,1);q=r.queue;}
 assert.equal(advance(EMPTY_QUEUE,3,rng,new Set([0,1,2])).index,-1);
 assert.equal(advance(EMPTY_QUEUE,1,rng).index,0);
});
test('shuffle: does not change the queue it is given',()=>{
 const q=advance(EMPTY_QUEUE,5,seeded(2)).queue,copy=JSON.stringify(q);advance(q,5,seeded(2));
 assert.equal(JSON.stringify(q),copy);
});

test('levels: decibels to gain',()=>{
 assert.equal(dbToGain(0),1);assert.ok(Math.abs(dbToGain(-6)-.501)<.001);
});
test('levels: equal-power fade keeps total power steady',()=>{
 const a=fadeCurve('out',1,64),b=fadeCurve('in',1,64);
 assert.equal(a[0],1);assert.ok(a[63]<1e-6);assert.ok(b[0]<1e-6);assert.equal(b[63],1);
 for(let i=0;i<64;i++)assert.ok(Math.abs(a[i]**2+b[i]**2-1)<1e-6);
});
test('levels: fade curves scale to the track gain',()=>{
 const c=fadeCurve('in',.5,8);assert.ok(Math.abs(c[7]-.5)<1e-9);
});

const CFG={crossfade:6,preload:30};
test('schedule: preloads, then crossfades near the end',()=>{
 assert.equal(decide({time:10,duration:120,preloaded:false,fading:false},CFG),null);
 assert.equal(decide({time:95,duration:120,preloaded:false,fading:false},CFG),'preload');
 assert.equal(decide({time:95,duration:120,preloaded:true,fading:false},CFG),null);
 assert.equal(decide({time:115,duration:120,preloaded:true,fading:false},CFG),'crossfade');
 assert.equal(decide({time:115,duration:120,preloaded:true,fading:true},CFG),null);
});
test('schedule: waits while the length is unknown',()=>{
 assert.equal(decide({time:5,duration:NaN,preloaded:false,fading:false},CFG),null);
 assert.equal(decide({time:5,duration:Infinity,preloaded:false,fading:false},CFG),null);
});
test('schedule: short tracks get a shorter crossfade',()=>{
 assert.equal(fadeLength(120,6),6);assert.equal(fadeLength(12,6),3);
 assert.equal(decide({time:8.5,duration:12,preloaded:true,fading:false},CFG),null);
 assert.equal(decide({time:9.5,duration:12,preloaded:true,fading:false},CFG),'crossfade');
});

test('playlist: rejects duplicate ids and oversized text',()=>{
 const {tracks,rejected}=parsePlaylist({version:1,tracks:[track(),track({file:'b.mp3'}),track({id:'c',file:'c.mp3',title:'x'.repeat(500)})]},'/m/');
 assert.equal(tracks.length,1);assert.deepEqual(rejected.map(r=>r.reason),['duplicate id','title/artist']);
});
