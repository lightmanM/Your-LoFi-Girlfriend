import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mouthKeys,mouthShape,loudness,LIPSYNC,VISEMES,VOWEL_VISEME} from '../src/voice/lipsync.js';

// A line as scripts/voice/generate_lines.py writes it: "あまさ、う" with a pause and a devoiced vowel at the end.
const mora=(text,consonant,vowel,start,vowelStart,end)=>({text,consonant,vowel,start,vowelStart,end});
const LINE={duration:1.5,moras:[
 mora('ア',null,'a',.1,.1,.25),
 mora('マ','m','a',.25,.33,.48),
 mora('サ','s','a',.48,.58,.72),
 mora('、',null,'pau',.72,.72,1.02),
 mora('ス','s','U',1.02,1.1,1.16),
],envelope:{fps:50,values:Array.from({length:75},(_,i)=>i>=5&&i<=58?100:0)}};
const keys=mouthKeys(LINE);
const open=w=>Math.max(...VISEMES.map(v=>w[v]));
const at=t=>mouthShape(LINE,keys,t-LIPSYNC.lead);   // shapes as heard: without the visual lead
const mid=m=>(m.vowelStart+m.end)/2;

test('lipsync: the mouth is closed before the line and after it',()=>{
 assert.equal(open(at(0)),0);
 assert.equal(open(at(LINE.duration+.2)),0);
});
test('lipsync: each vowel opens its own viseme',()=>{
 for(const m of LINE.moras.slice(0,3)){const w=at(mid(m));assert.ok(open(w)>.3,`${m.text} opens`);assert.equal(w.aa,open(w),`${m.text} reads as aa`);}
});
test('lipsync: lips close for m, and the mouth closes in a pause',()=>{
 const ma=LINE.moras[1],pause=LINE.moras[3];
 assert.ok(open(at((ma.start+ma.vowelStart)/2))<.08,'m closes the lips');
 assert.ok(open(at(mid(pause)))<.02,'pause closes');
});
test('lipsync: s narrows the mouth without shutting it',()=>{
 const sa=LINE.moras[2],w=at((sa.start+sa.vowelStart)/2);
 assert.ok(open(w)<open(at(mid(sa)))*.6);
});
test('lipsync: a devoiced vowel barely moves the mouth',()=>{
 const su=LINE.moras[4];assert.ok(open(at(mid(su)))<.2);
});
test('lipsync: the mouth leads the sound slightly',()=>{
 assert.ok(LIPSYNC.lead>0&&LIPSYNC.lead<.1);
 const t=LINE.moras[0].vowelStart+.03;
 assert.deepEqual(mouthShape(LINE,keys,t-LIPSYNC.lead),at(t));
 assert.ok(open(mouthShape(LINE,keys,LINE.moras[0].vowelStart-.01))>.05,'already opening just before the sound starts');
});
test('lipsync: weights stay within each viseme gain and move smoothly',()=>{
 let prev=at(0);
 for(let t=0;t<=LINE.duration;t+=1/120){
  const w=at(t);
  for(const v of VISEMES){assert.ok(w[v]>=0&&w[v]<=LIPSYNC.gain[v]+1e-9,`${v} at ${t}`);assert.ok(Math.abs(w[v]-prev[v])<.22,`${v} jumps at ${t.toFixed(3)}`);}
  prev=w;
 }
});
test('lipsync: loudness follows the envelope and quiet speech opens the mouth less',()=>{
 assert.equal(loudness(LINE,0),0);assert.equal(loudness(LINE,.5),1);
 const quiet={...LINE,envelope:{fps:50,values:LINE.envelope.values.map(v=>v*.2)}};
 assert.ok(open(mouthShape(quiet,keys,mid(LINE.moras[0])))<open(mouthShape(LINE,keys,mid(LINE.moras[0]))));
});
test('lipsync: the generated okaeri line opens each vowel in turn',()=>{
 const line=JSON.parse(readFileSync(new URL('../public/voice/lines.json',import.meta.url))).lines.find(l=>l.id==='okaeri');
 const k=mouthKeys(line);
 for(const m of line.moras){const w=mouthShape(line,k,mid(m)-LIPSYNC.lead),v=VOWEL_VISEME[m.vowel];assert.equal(w[v],open(w),`${m.text} reads as ${v}`);}
});
