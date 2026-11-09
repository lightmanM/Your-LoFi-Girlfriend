import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALK,nextDelay,pickNext,pickMotion,talkPlan,subtitleAt,loadHeard,saveHeard,forget} from '../src/voice/talk-plan.js';

const LINES=JSON.parse(readFileSync(new URL('../public/voice/lines.json',import.meta.url),'utf8')).lines.filter(l=>l.kind==='talk');
const DARK=new Set(LINES.filter(l=>l.mood==='dark').map(l=>l.id));
const seeded=(seed=7)=>()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296;
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),m};};
const broken={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};

test('the wait before a line is 1 to 2 minutes; an override fixes it',()=>{
 const r=seeded();
 for(let i=0;i<200;i++){const d=nextDelay(r);assert.ok(d>=60&&d<=120,`${d}`);}
 assert.equal(nextDelay(r,[2,2]),2);
});

test('every round plays each line once, and never two dark lines in a row, across rounds',()=>{
 for(const seed of [1,2,3,4,5]){
  const r=seeded(seed);let mem={heard:[],last:null};const said=[];
  for(let i=0;i<LINES.length*20;i++){const {id,heard}=pickNext(LINES,{...mem,random:r});said.push(id);mem={heard,last:id};}
  for(let k=0;k<20;k++)assert.deepEqual([...said.slice(k*32,k*32+32)].sort(),LINES.map(l=>l.id).sort(),`round ${k}`);
  for(let i=1;i<said.length;i++)assert.ok(!(DARK.has(said[i])&&DARK.has(said[i-1])),`dark pair at ${i}: ${said[i-1]}, ${said[i]}`);
 }
});

test('a returning visitor hears lines they have not heard first',()=>{
 const light=LINES.filter(l=>l.mood==='light'),unheard=[light[0].id,light[1].id];
 const heard=LINES.map(l=>l.id).filter(id=>!unheard.includes(id));
 for(const seed of [3,4,5]){const {id}=pickNext(LINES,{heard,last:light[5].id,random:seeded(seed)});assert.ok(unheard.includes(id),id);}
});

test('if only dark lines are left right after a dark one (e.g. the set changed), a light line comes again first',()=>{
 const dark=LINES.filter(l=>l.mood==='dark'),unheard=[dark[1].id,dark[2].id];
 const heard=LINES.map(l=>l.id).filter(id=>!unheard.includes(id));
 const {id}=pickNext(LINES,{heard,last:dark[0].id,random:seeded(6)});
 assert.ok(!DARK.has(id),id);
});

test('memory of lines no longer in the set is ignored; no lines, nothing',()=>{
 const {id,heard}=pickNext(LINES,{heard:['gone','basil'],last:'gone',random:seeded(4)});
 assert.notEqual(id,'basil');assert.ok(!heard.includes('gone'));
 assert.deepEqual(pickNext([],{}),{id:null,heard:[]});
});

test('pickNext does not change the memory it is given',()=>{
 const heard=['basil'];pickNext(LINES,{heard,random:seeded(5)});
 assert.deepEqual(heard,['basil']);
});

test('motions: half-closed eyes only on dark lines to herself; a full look for short lines to you; a glance mid-line only on long ones',()=>{
 const r=seeded(9),seen=line=>new Set(Array.from({length:300},()=>pickMotion(line,{random:r})));
 const selfLight={to:'self',about:'thought',mood:'light',duration:4},selfDark={...selfLight,mood:'dark'};
 assert.ok(!seen(selfLight).has('lids'));assert.ok(seen(selfDark).has('lids'));
 for(const m of seen(selfLight))assert.ok(['page','aside','up','tilt'].includes(m),m);
 const youShort={to:'you',about:'thought',mood:'light',duration:3.7},youLong={...youShort,duration:6};
 assert.deepEqual([...seen(youShort)].sort(),['look']);   // the smaller look is not picked: her eyes read as narrowed from the camera
 assert.deepEqual([...seen(youLong)].sort(),['look','midway']);
});

test('never the same motion twice in a row when another is allowed',()=>{
 const r=seeded(11);
 for(const last of ['page','aside','up','tilt'])for(let i=0;i<50;i++)assert.notEqual(pickMotion({to:'self',about:'book',mood:'light',duration:5},{last,random:r}),last);
 assert.notEqual(pickMotion({to:'you',about:'life',mood:'light',duration:6},{last:'look',random:r}),'look');
});

test('book lines to herself are mostly read half-aloud; thoughts mostly look up',()=>{
 const r=seeded(13),count=line=>{const c={};for(let i=0;i<600;i++){const m=pickMotion(line,{random:r});c[m]=(c[m]??0)+1;}return c;};
 const book=count({to:'self',about:'book',mood:'light',duration:5});
 assert.ok(Object.entries(book).every(([m,n])=>m==='page'||n<book.page),JSON.stringify(book));
 const thought=count({to:'self',about:'thought',mood:'light',duration:5});
 assert.ok(thought.up>thought.tilt,JSON.stringify(thought));
});

test('talkPlan: when she speaks, when she looks at you, when it ends',()=>{
 const line={duration:6,parts:[{start:.05},{start:3.4}]},plain={duration:6};
 for(const m of ['page','aside','up','tilt','lids'])assert.equal(talkPlan(plain,m).look,null);
 for(const m of ['look','eyes']){const p=talkPlan(plain,m);assert.equal(p.look,0);assert.equal(p.speak,TALK.ease);}
 const mid=talkPlan(line,'midway');assert.equal(mid.speak,.3);assert.ok(Math.abs(mid.look-(.3+3.4-TALK.ease))<1e-9);
 const midPlain=talkPlan(plain,'midway');assert.ok(Math.abs(midPlain.look-(.3+2-TALK.ease))<1e-9);
 const p=talkPlan(plain,'look');assert.ok(Math.abs(p.end-(p.speak+6+TALK.linger+TALK.ease))<1e-9);
});

test('subtitleAt: the whole subtitle, or the part being spoken',()=>{
 const whole={subtitle:{ja:'あ',en:'A'}};
 assert.deepEqual(subtitleAt(whole,1),{ja:'あ',en:'A'});
 const split={subtitle:{ja:'あ。い',en:'A. B.'},parts:[{ja:'あ。',en:'A.',start:.05},{ja:'い',en:'B.',start:3}]};
 assert.equal(subtitleAt(split,0).ja,'あ。');assert.equal(subtitleAt(split,2.85).ja,'あ。');
 assert.equal(subtitleAt(split,2.9).ja,'い');assert.equal(subtitleAt(split,5).en,'B.');
});

test('memory survives a visit; missing, broken or blocked storage starts fresh without errors',()=>{
 const s=memory();
 assert.deepEqual(loadHeard(s),{heard:[],last:null});
 saveHeard(s,{heard:['basil','wind'],last:'wind'});
 assert.deepEqual(loadHeard(s),{heard:['basil','wind'],last:'wind'});
 s.setItem(TALK.key,'{not json');assert.deepEqual(loadHeard(s),{heard:[],last:null});
 s.setItem(TALK.key,'{"heard":"basil"}');assert.deepEqual(loadHeard(s),{heard:[],last:null});
 assert.deepEqual(loadHeard(broken),{heard:[],last:null});assert.deepEqual(loadHeard(undefined),{heard:[],last:null});
 assert.doesNotThrow(()=>saveHeard(broken,{heard:[],last:null}));
});

test('a skipped line is forgotten: unheard again, and the line said before it counts as last again',()=>{
 const before={heard:['wither'],last:'wither'};
 const {id,heard}=pickNext(LINES,{...before,random:seeded(8)});
 const after=forget({heard,last:id},id,before.last);
 assert.deepEqual(after,{heard:['wither'],last:'wither'});
 assert.ok(!DARK.has(pickNext(LINES,{...after,random:seeded(9)}).id),'still no dark line after the dark one she said');
});
