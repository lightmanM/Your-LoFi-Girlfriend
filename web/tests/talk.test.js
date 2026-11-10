import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {startTalk} from '../src/voice/talk.js';
import {createSmallTalk} from '../src/voice/small-talk.js';
import {TALK,talkPlan} from '../src/voice/talk-plan.js';

// One line with stand-ins for her reader, voice and model: what the line asks of the reader, and when it lets go.
const LINE={id:'x',to:'you',about:'life',mood:'light',duration:2,subtitle:{ja:'あ',en:'A'},
 moras:[{text:'ア',consonant:null,vowel:'a',start:.05,vowelStart:.05,end:1.9}],envelope:{fps:50,values:[50,50,50]}};
function setup(line=LINE){
 const calls=[],clock={audio:0,wall:0};
 const reader={talking:false,lids:0,attend:()=>{calls.push('attend');return true;},cancelAttend:()=>calls.push('cancelAttend'),
  reading:{holdReading:on=>calls.push(`hold ${on}`),glance:()=>calls.push('glance'),endLookUpAt:()=>calls.push('endLookUpAt')}};
 const voice={say:()=>({time:()=>clock.audio,status:()=>clock.audio<0?'waiting':clock.audio<line.duration?'speaking':'done',audible:()=>false,stop:()=>calls.push('stop')})};
 const vrm={expressionManager:{setValue(){}},humanoid:{getNormalizedBoneNode:()=>null},lookAt:null};
 const subtitles={set(){},visible:()=>false,murmur:()=>false};
 return {calls,clock,reader,talk:motion=>startTalk({reader,vrm,voice,line,motion,target:new Vector3(),subtitles,now:()=>clock.wall})};
}

test('a line that runs out while her look is still held lets go of it (e.g. the tab was hidden)',()=>{
 const {calls,clock,reader,talk}=setup(),t=talk('look'),plan=talkPlan(LINE,'look');
 clock.audio=-plan.speak;t.update();
 assert.ok(calls.includes('attend'));
 clock.audio=LINE.duration+5;   // the voice played on while no frames ran; on return the line is long over
 assert.equal(t.update(),false);
 assert.ok(calls.includes('cancelAttend'),calls.join(', '));
 assert.ok(calls.includes('hold false'));assert.equal(reader.talking,false);
});

test('a glance that the line outlives is let go too',()=>{
 const {calls,clock,talk}=setup({...LINE,to:'self'}),t=talk('aside');
 clock.audio=-TALK.selfLead;t.update();clock.audio=LINE.duration+5;t.update();
 assert.ok(calls.includes('glance'));assert.ok(calls.includes('endLookUpAt'),calls.join(', '));
});

test('if her voice\'s clock stops (sound suspended, e.g. a phone locked), the line still ends by the page clock',()=>{
 const {calls,clock,reader,talk}=setup(),t=talk('look'),plan=talkPlan(LINE,'look');
 clock.audio=.5;t.update();
 clock.wall=plan.end+TALK.stuck-.1;assert.equal(t.update(),true);
 clock.wall=plan.end+TALK.stuck+.1;assert.equal(t.update(),false);
 assert.ok(calls.includes('stop'));assert.equal(reader.talking,false);
});

// The scheduler with stand-ins: a conversation (click to talk) holds small talk, and her next line waits a fresh while after.
function scheduler(){
 const line={...LINE,kind:'talk'},clock={audio:-1,wall:0};
 const reader={talking:false,lids:0,busy:()=>false,attend:()=>true,cancelAttend(){},
  reading:{holdReading(){},glance(){},endLookUpAt(){}}};
 const voice={ids:f=>[line].filter(f).map(l=>l.id),line:()=>line,prefetch(){},state:()=>({context:'running'}),
  say:()=>({time:()=>clock.audio,status:()=>'waiting',audible:()=>false,stop(){}})};
 const vrm={expressionManager:{setValue(){}},humanoid:{getNormalizedBoneNode:()=>null},lookAt:null};
 const st=createSmallTalk({voice,reader,vrm,subtitles:{set(){},visible:()=>false,murmur:()=>false},target:new Vector3(),
  store:undefined,random:()=>.5,every:[10,10],hidden:()=>false});
 st.start();return st;
}

test('a conversation holds small talk, and her next line waits a whole while after it',()=>{
 const st=scheduler();
 st.update(9);assert.equal(st.state().active,false);
 for(let i=0;i<50;i++)st.update(.1,{chatting:true});     // 14 s: a line was due at 10, but she is in a conversation
 assert.equal(st.state().active,false);
 st.update(0,{chatting:false});                          // the conversation ends: a fresh 10 s wait
 st.update(9.9);assert.equal(st.state().active,false);
 st.update(.2);assert.equal(st.state().active,true);
});
