import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createChat} from '../src/voice/chat.js';

// One conversation with stand-ins for her reader, voice and model.
const NOTICE={id:'n',kind:'notice',duration:2,subtitle:{ja:'あ',en:'A'},moras:[{text:'ア',consonant:null,vowel:'a',start:.05,vowelStart:.05,end:1.9}],envelope:{fps:50,values:[50,50]}};
function setup({canLook=true}={}){
 const reader={talking:false,lids:0,attend:()=>canLook,cancelAttend(){},reading:{holdReading(){}}};
 const voice={ids:f=>[NOTICE].filter(f).map(l=>l.id),line:()=>NOTICE,prefetch:()=>Promise.resolve(new ArrayBuffer(0)),
  say:()=>({time:()=>0,status:()=>'waiting',stop(){}})};
 const vrm={expressionManager:{setValue(){}},humanoid:{getNormalizedBoneNode:()=>null}};
 return createChat({voice,reader,vrm,target:new Vector3(),store:undefined,hidden:()=>false,now:()=>0});
}

test('a conversation that cannot start (she cannot look up) counts nothing as heard',()=>{
 const chat=setup({canLook:false});
 assert.equal(chat.start(),false);
 assert.deepEqual(chat.state().heard,{asks:[],notices:[]});
 assert.equal(chat.active(),false);
});

test('a conversation that starts counts its line as heard',()=>{
 const chat=setup();
 assert.equal(chat.start({notice:'n',motion:'look'}),true);
 assert.deepEqual(chat.state().heard.notices,['n']);
});
