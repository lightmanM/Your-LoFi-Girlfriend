import test from 'node:test';
import assert from 'node:assert/strict';
import {NAP,napGap,napDue,cutDark,cutLength,napStart,napStep,darkness} from '../src/balcony/nap-plan.js';

const free={started:true,greeting:false,talking:false,chatting:false,welcoming:false,busy:false,frozen:false,hidden:false};

test('a wait lies between its shortest and longest',()=>{
 assert.equal(napGap([10,30],()=>0),10);
 assert.equal(napGap([10,30],()=>1),30);
 assert.equal(napGap([10,30],()=>.5),20);
});

test('a nap starts only when due and she is only reading',()=>{
 assert.equal(napDue(100,100,free),true);
 assert.equal(napDue(99,100,free),false);
 for(const k of ['greeting','talking','chatting','welcoming','busy','frozen','hidden'])assert.equal(napDue(100,100,{...free,[k]:true}),false,k);
 assert.equal(napDue(100,100,{...free,started:false}),false);
});

test('the cut goes dark, holds, and comes back',()=>{
 const c={out:1,dark:.6,in:1.4};
 assert.equal(cutLength(c),3);
 assert.equal(cutDark(0,c),0);
 assert.ok(cutDark(.5,c)>0&&cutDark(.5,c)<1);
 assert.equal(cutDark(1,c),1);
 assert.equal(cutDark(1.6,c),1);
 assert.ok(cutDark(2.3,c)>0&&cutDark(2.3,c)<1);
 assert.equal(cutDark(3,c),0);
});

test('a whole nap: out, asleep, back; she changes places only in the dark',()=>{
 const cut={out:.5,dark:.4,in:.6},dt=.05,events=[],phases=[];
 let s=napStart(),bed=false,onBedFor=0,maxDark=0;
 for(let i=0;i<400;i++){
  s=napStep(s,dt,{due:i===10,length:2,cut});
  if(s.event){events.push(s.event);if(s.event!=='woke')assert.equal(darkness(s,cut),1,`${s.event} in the dark`);}
  if(s.event==='lie')bed=true;
  if(s.event==='rise')bed=false;
  if(bed)onBedFor+=dt;
  if(phases.at(-1)!==s.phase)phases.push(s.phase);
  maxDark=Math.max(maxDark,darkness(s,cut));
 }
 assert.deepEqual(phases,['awake','toBed','asleep','toChair','awake']);
 assert.deepEqual(events,['lie','rise','woke']);
 assert.equal(maxDark,1);
 assert.ok(onBedFor>2+.7&&onBedFor<2+1.6,`on the daybed ${onBedFor.toFixed(2)} s`);
 assert.equal(darkness(s,cut),0);
});

test('awake, nothing happens until a nap is due',()=>{
 let s=napStart();
 for(let i=0;i<50;i++)s=napStep(s,.1);
 assert.equal(s.phase,'awake');
 assert.equal(darkness(s),0);
});

test('one long frame cannot skip her change of place',()=>{
 let s=napStep(napStart(),.016,{due:true});
 s=napStep(s,10);                                  // a tab that was throttled
 assert.equal(s.phase,'asleep');
 assert.equal(s.event,'lie');
 s=napStep(napStep(s,1e4),.016);                   // long asleep, then the cut back starts
 s=napStep(s,10);
 assert.equal(s.phase,'awake');
 assert.equal(s.event,'rise');
});

test('the defaults are 15 to 20 minutes asleep, and awake longer than that in between',()=>{
 assert.deepEqual([...NAP.length],[15*60,20*60]);
 assert.ok(NAP.first[0]>=600&&NAP.every[0]>NAP.length[1]);
});

test('with a walk she goes out in full view and comes back by the cut',()=>{
 const cut={out:.5,dark:.4,in:.6},dt=.05,events=[];
 let s=napStart(),darkOut=0,darkBack=0,walked=0;
 for(let i=0;i<600;i++){
  s=napStep(s,dt,{due:i===10,length:2,cut,walk:3});
  if(s.event)events.push(s.event);
  if(s.phase==='toBed'){walked+=dt;darkOut=Math.max(darkOut,darkness(s,cut));}
  if(s.phase==='toChair')darkBack=Math.max(darkBack,darkness(s,cut));
 }
 assert.deepEqual(events,['walk','lie','rise','woke']);
 assert.equal(darkOut,0);
 assert.equal(darkBack,1);
 assert.ok(Math.abs(walked-3)<.11,`walked for ${walked.toFixed(2)} s`);
 assert.equal(s.phase,'awake');
});

test('a walk that has begun is finished even if the next step is told there is none',()=>{
 let s=napStep(napStart(),.016,{due:true,walk:5});
 s=napStep(s,2,{walk:0});
 assert.equal(s.phase,'toBed');
 assert.equal(darkness(s),0);
 s=napStep(s,4,{walk:0});
 assert.equal(s.phase,'asleep');
 assert.equal(s.event,'lie');
});

test('with a way back she gets up in full view, and is awake when it is over',()=>{
 const cut={out:.5,dark:.4,in:.6},dt=.05,events=[];
 let s=napStart(),dark=0,back=0;
 for(let i=0;i<700;i++){
  s=napStep(s,dt,{due:i===10,length:2,cut,walk:3,back:s.phase==='asleep'?4:0});
  if(s.event)events.push(s.event);
  if(s.phase==='toChair')back+=dt;
  dark=Math.max(dark,darkness(s,cut));
 }
 assert.deepEqual(events,['walk','lie','getup','woke']);
 assert.equal(dark,0,'never dark');
 assert.ok(Math.abs(back-4)<.11,`on her way back for ${back.toFixed(2)} s`);
 assert.equal(s.phase,'awake');
});

test('placed on the daybed by the cut, she is brought back by the cut even if a way back is there',()=>{
 const cut={out:.5,dark:.4,in:.6},events=[];
 let s=napStart(),dark=0;
 for(let i=0;i<700;i++){s=napStep(s,.05,{due:i===10,length:2,cut,walk:0,back:4});if(s.event)events.push(s.event);if(s.phase==='toChair')dark=Math.max(dark,darkness(s,cut));}
 assert.deepEqual(events,['lie','rise','woke']);
 assert.equal(dark,1);
});

test('without a way back she is brought back by the cut, even if she walked out',()=>{
 const cut={out:.5,dark:.4,in:.6},events=[];
 let s=napStart(),dark=0;
 for(let i=0;i<700;i++){s=napStep(s,.05,{due:i===10,length:2,cut,walk:3});if(s.event)events.push(s.event);if(s.phase==='toChair')dark=Math.max(dark,darkness(s,cut));}
 assert.deepEqual(events,['walk','lie','rise','woke']);
 assert.equal(dark,1);
});
