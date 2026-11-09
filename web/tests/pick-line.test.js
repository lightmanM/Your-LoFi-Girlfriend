import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pickLine,lastLine,rememberLine,PICK} from '../src/voice/pick-line.js';

const IDS=['okaeri','otsukare','kitekureta','iitokoro','yukkuri'];
const memory=(init={})=>{const m=new Map(Object.entries(init));return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),m};};
const broken={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};

test('a line asked for by name is the one she says',()=>{
 assert.equal(pickLine(IDS,{want:'iitokoro',last:'iitokoro'}),'iitokoro');
});

test('an unknown name is ignored: she picks at random instead',()=>{
 assert.ok(IDS.includes(pickLine(IDS,{want:'nope'})));
});

test('never the same line as last visit',()=>{
 for(let i=0;i<50;i++){
  const r=i/50;
  assert.notEqual(pickLine(IDS,{last:'okaeri',random:()=>r}),'okaeri');
 }
});

test('every other line can come up',()=>{
 const seen=new Set();
 for(let i=0;i<40;i++)seen.add(pickLine(IDS,{last:'okaeri',random:()=>i/40}));
 assert.deepEqual([...seen].sort(),IDS.filter(x=>x!=='okaeri').sort());
});

test('with no last visit, any line can come up, first to last',()=>{
 assert.equal(pickLine(IDS,{random:()=>0}),'okaeri');
 assert.equal(pickLine(IDS,{random:()=>.999}),'yukkuri');
});

test('a single line is said even if it was said last time; no lines, nothing',()=>{
 assert.equal(pickLine(['okaeri'],{last:'okaeri'}),'okaeri');
 assert.equal(pickLine([]),null);
});

test('the last line is remembered across visits',()=>{
 const s=memory();
 assert.equal(lastLine(s),null);
 rememberLine(s,'yukkuri');
 assert.equal(lastLine(s),'yukkuri');
 assert.equal(s.m.get(PICK.key),'yukkuri');
});

test('blocked or missing storage just means no memory, never an error',()=>{
 assert.equal(lastLine(broken),null);
 assert.doesNotThrow(()=>rememberLine(broken,'okaeri'));
 assert.equal(lastLine(undefined),null);
 assert.doesNotThrow(()=>rememberLine(undefined,'okaeri'));
});
