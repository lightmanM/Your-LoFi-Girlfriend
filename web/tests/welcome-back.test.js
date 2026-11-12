import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WELCOME,welcomeDue,welcomeSmile,createWelcome} from '../src/companion/welcome-back.js';

// Welcome back: after the visitor has been away from the page for a while she looks up at them with a small smile.
const CLEAR={started:true,greeting:false,talking:false,chatting:false,busy:false,frozen:false};
const rig=(ok=true)=>{
 const looks=[],em={v:{},setValue(n,x){this.v[n]=x;}};let cancelled=0;
 return {looks,em,cancelled:()=>cancelled,vrm:{expressionManager:em},
  reader:{attend(o){looks.push(o);return typeof ok==='function'?ok():ok;},cancelAttend(){cancelled++;}}};
};
const run=(w,seconds,dt=1/60)=>{for(let t=0;t<seconds;t+=dt)w.update(dt);};

test('she welcomes a visitor back only after a real absence, and only when she is free',()=>{
 assert.equal(welcomeDue(WELCOME.away-1,CLEAR),false,'a short look elsewhere is not an absence');
 assert.equal(welcomeDue(WELCOME.away,CLEAR),true);
 for(const gate of ['greeting','talking','chatting','busy','frozen'])assert.equal(welcomeDue(600,{...CLEAR,[gate]:true}),false,gate);
 assert.equal(welcomeDue(600,{...CLEAR,started:false}),false,'not behind the start button');
 assert.equal(welcomeDue(10,CLEAR,{...WELCOME,away:5}),true,'the wait can be set');
});

test('her smile comes after she has looked up and is gone when she looks down',()=>{
 const end=WELCOME.ease+WELCOME.hold+WELCOME.ease;
 assert.equal(welcomeSmile(0),0);
 assert.ok(welcomeSmile(WELCOME.ease+WELCOME.hold*.6)>.9,'full while she holds the look');
 assert.equal(welcomeSmile(end),0);
 for(let t=0;t<end;t+=.05)assert.ok(Math.abs(welcomeSmile(t+.05)-welcomeSmile(t))<.12,`no jump at ${t.toFixed(2)}`);
});

test('she looks up at the visitor once, smiles, and it ends with her face at rest',()=>{
 const r=rig(),target={x:0,y:1,z:2},w=createWelcome({reader:r.reader,vrm:r.vrm,target});
 assert.equal(w.active(),false);w.update(1);assert.equal(r.looks.length,0,'nothing until she is asked');
 w.greet();assert.equal(w.active(),true);
 run(w,WELCOME.notice-.05);assert.equal(r.looks.length,0,'a beat before she notices');
 run(w,.1);assert.equal(r.looks.length,1);
 assert.equal(r.looks[0].at,target);assert.equal(r.looks[0].hold,WELCOME.hold);assert.equal(r.looks[0].ease,WELCOME.ease);
 run(w,WELCOME.ease+WELCOME.hold*.6);assert.ok(r.em.v.happy>0,'smiling');assert.equal(r.looks.length,1,'one look');
 run(w,WELCOME.hold+WELCOME.ease*2);
 assert.equal(w.active(),false);assert.equal(r.em.v.happy,0);assert.equal(r.em.v.relaxed,0);assert.equal(r.cancelled(),0,'the look ended by itself');
});

test('she keeps trying for a moment while she is busy, then lets it go',()=>{
 const r=rig(false),w=createWelcome({reader:r.reader,vrm:r.vrm,target:{}});
 w.greet();run(w,WELCOME.notice+WELCOME.giveUp+.2);
 assert.ok(r.looks.length>1,'retried');assert.equal(w.active(),false);assert.equal(r.em.v.happy??0,0);
});

test('stopping it sends her eyes back to the book; yielding leaves the look to whoever took over',()=>{
 let r=rig(),w=createWelcome({reader:r.reader,vrm:r.vrm,target:{}});
 w.greet();run(w,WELCOME.notice+1);w.stop();
 assert.equal(w.active(),false);assert.equal(r.cancelled(),1);assert.equal(r.em.v.happy,0);
 r=rig();w=createWelcome({reader:r.reader,vrm:r.vrm,target:{}});
 w.greet();run(w,WELCOME.notice+1);w.yield();
 assert.equal(w.active(),false);assert.equal(r.cancelled(),0);assert.equal(r.em.v.happy,0);
});
