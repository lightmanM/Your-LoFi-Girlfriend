import {test,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createVoice} from '../src/voice/speech.js';

// The voice's downloads, with fetch stubbed: lines.json, then each clip only when asked for.
const INDEX={lines:[{id:'a',audio:'a.wav',duration:1},{id:'b',audio:'b.wav',duration:1}]};
let calls,fail,realFetch;
beforeEach(()=>{
 calls=[];fail=new Set();realFetch=globalThis.fetch;
 globalThis.fetch=async url=>{
  calls.push(url);
  if(fail.has(url))return {ok:false,status:503};
  return url.endsWith('lines.json')?{ok:true,json:async()=>INDEX}:{ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};
 };
});
afterEach(()=>{globalThis.fetch=realFetch;});

test('loading the lines downloads no audio; a clip is fetched once, when asked for',async()=>{
 const v=createVoice({base:'/v/'});await v.load();
 assert.deepEqual(calls,['/v/lines.json']);
 await v.prefetch('a');await v.prefetch('a');
 assert.deepEqual(calls,['/v/lines.json','/v/a.wav']);
 assert.deepEqual(v.ids(),['a','b']);
 assert.equal(v.prefetch('nope'),null);
});

test('a failed clip download is tried again next time, not remembered as failed',async()=>{
 const v=createVoice({base:'/v/'});await v.load();
 fail.add('/v/b.wav');
 await assert.rejects(v.prefetch('b'),/503/);
 await new Promise(r=>setTimeout(r,0));
 fail.clear();
 assert.ok((await v.prefetch('b')) instanceof ArrayBuffer);
 assert.equal(calls.filter(u=>u==='/v/b.wav').length,2);
});

test('ids can be filtered by line, e.g. greetings only',async()=>{
 const v=createVoice({base:'/v/'});await v.load();
 assert.deepEqual(v.ids(l=>l.id==='a'),['a']);
 assert.deepEqual(v.ids(),['a','b']);
});

test('a voice level set before any sound has played is kept and reported',async()=>{
 const v=createVoice({base:'/v/'});
 assert.doesNotThrow(()=>v.setLevel(.4));
 assert.equal(v.state().level,.4);
});
