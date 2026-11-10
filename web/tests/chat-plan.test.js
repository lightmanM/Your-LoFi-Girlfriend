import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHAT,pickChat,canStart,loadChat,saveChat,forgetChat,chatMotion} from '../src/voice/chat-plan.js';
import {TALK} from '../src/voice/talk-plan.js';

const LINES=JSON.parse(readFileSync(new URL('../public/voice/lines.json',import.meta.url),'utf8')).lines;
const ASKS=LINES.filter(l=>l.kind==='ask'),NOTICES=LINES.filter(l=>l.kind==='notice');
const DARK=new Set(ASKS.filter(l=>l.mood==='dark').map(l=>l.id));
const seeded=(seed=7)=>()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296;
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),m};};
const broken={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
const fresh=()=>loadChat(undefined);
function run(n,random=seeded()){
 let memory=fresh();const out=[];
 for(let i=0;i<n;i++){const r=pickChat(LINES,memory,random);out.push(r);memory=r.memory;}
 return out;
}

test('about one click in three is a question',()=>{
 const asks=run(3000).filter(r=>r.kind==='ask').length/3000;
 assert.ok(asks>=.30&&asks<=.36,`share of questions ${asks}`);
});

test('never two questions in a row',()=>{
 const kinds=run(2000).map(r=>r.kind);
 for(let i=1;i<kinds.length;i++)assert.ok(!(kinds[i]==='ask'&&kinds[i-1]==='ask'),`questions at ${i-1} and ${i}`);
});

test('no question or notice repeats until its set has all been heard',()=>{
 const picks=run(600);
 for(const [kind,pool] of [['ask',ASKS],['notice',NOTICES]]){
  const ids=picks.filter(r=>r.kind===kind).map(r=>r.id);
  for(let i=0;i+pool.length<=ids.length;i+=pool.length)
   assert.equal(new Set(ids.slice(i,i+pool.length)).size,pool.length,`${kind} round ${i/pool.length}`);
 }
});

test('never two heavier questions one after the other',()=>{
 const asks=run(3000).filter(r=>r.kind==='ask').map(r=>r.id);
 for(let i=1;i<asks.length;i++)assert.ok(!(DARK.has(asks[i])&&DARK.has(asks[i-1])),`${asks[i-1]} then ${asks[i]}`);
});

test('picking never changes what it is given',()=>{
 const memory=fresh(),before=JSON.stringify(memory),lines=JSON.stringify(LINES);
 pickChat(LINES,memory,seeded());
 assert.equal(JSON.stringify(memory),before);assert.equal(JSON.stringify(LINES),lines);
});

test('she can be clicked only while quietly reading, and not within the cool-down',()=>{
 const free={ready:true,started:true,greeting:false,talking:false,chatting:false,busy:false,frozen:false,since:Infinity};
 assert.equal(canStart(free),true);
 for(const k of ['greeting','talking','chatting','busy','frozen'])assert.equal(canStart({...free,[k]:true}),false,k);
 for(const k of ['ready','started'])assert.equal(canStart({...free,[k]:false}),false,k);
 assert.equal(canStart({...free,since:CHAT.cooldown-.1}),false);
 assert.equal(canStart({...free,since:CHAT.cooldown}),true);
 assert.equal(canStart({...free,since:2.9},3),false);assert.equal(canStart({...free,since:3},3),true);   // ?chatcool
});

test('memory survives a reload, and blocked or broken storage gives a fresh one',()=>{
 const s=store(),memory=run(5).at(-1).memory;
 saveChat(s,memory);assert.deepEqual(loadChat(s),memory);
 assert.deepEqual(loadChat(broken),fresh());saveChat(broken,memory);   // no throw
 for(const junk of ['nope','{"asks":3}','{"asks":{"heard":[1]},"notices":{"heard":[]}}','null']){
  const j=store();j.setItem(CHAT.key,junk);assert.deepEqual(loadChat(j),fresh(),junk);
 }
});

test('a question not finished is unheard again',()=>{
 const r=pickChat(LINES,fresh(),()=>0);   // random 0: a question
 assert.equal(r.kind,'ask');
 const back=forgetChat(r.memory,r.id);
 assert.equal(back.asks.heard.includes(r.id),false);
 assert.notEqual(back.asks.last,r.id);
 assert.equal(r.memory.asks.heard.includes(r.id),true);   // the memory it was given is unchanged
});

test('notices vary how she looks up; questions are always a full look',()=>{
 const r=seeded(3),long=NOTICES.find(l=>l.duration>=TALK.short),short=NOTICES.find(l=>l.duration<TALK.short);
 for(const last of ['look','midway','tilt'])for(let i=0;i<60;i++){
  const m=chatMotion(long,{last,random:r});assert.ok(['look','midway','tilt'].includes(m),m);assert.notEqual(m,last);
 }
 assert.equal(new Set(Array.from({length:200},()=>chatMotion(long,{random:r}))).size,3);
 if(short)for(let i=0;i<100;i++)assert.notEqual(chatMotion(short,{random:r}),'midway',`${short.id} is too short to look up partway`);
 for(const q of ASKS)assert.equal(chatMotion(q,{last:'look',random:r}),'look');
});

test('she can be clicked again 3 seconds after a conversation (the owner: 20 s was too long)',()=>{
 assert.equal(CHAT.cooldown,3);
 const free={ready:true,started:true,greeting:false,talking:false,chatting:false,busy:false,frozen:false};
 assert.equal(canStart({...free,since:2.9}),false);assert.equal(canStart({...free,since:3}),true);
});
