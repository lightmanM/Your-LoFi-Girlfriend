// One line of small talk with its subtle motion: to you (she looks at the camera: a full look, a glance up mid-line,
// or an eyes-only look) or to herself (eyes on the page, a glance aside, thinking up, a small tilt, or half-closed
// eyes). Her mouth follows the voice, the subtitle shows (a murmur when she talks to herself), and her reading holds
// still until she is done. Call update() every frame after the reader's update() and before vrm.update().
import * as THREE from 'three';
import {TALK,talkPlan,subtitleAt} from './talk-plan.js';
import {GREET} from './greeting-plan.js';
import {mouthKeys,mouthShape,VISEMES} from './lipsync.js';
import {applyFace,FACE} from './face.js';
import {gazeReport} from './gaze-report.js';
import {talkingHead,applyHead} from './talk-head.js';

const CLOSED=Object.freeze(Object.fromEntries(VISEMES.map(v=>[v,0])));
const X=new THREE.Vector3(1,0,0),q=new THREE.Quaternion();
const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
const LOOKS=new Set(['look','midway','eyes']);

/**
 * @param {{reader:object,vrm:object,voice:object,line:object,motion:string,target:THREE.Vector3,subtitles?:object,random?:()=>number,now?:()=>number}} o
 *  now: the page clock in seconds (a backstop if the voice's clock stops)
 * @returns {{update:()=>boolean,stop:()=>void,speaking:()=>boolean,state:()=>object}|null}
 */
export function startTalk({reader,vrm,voice,line,motion,target,subtitles,random=Math.random,now=()=>performance.now()/1000}){
 const plan=talkPlan(line,motion),keys=mouthKeys(line);
 const speech=voice.say(line.id,{delay:plan.speak});if(!speech)return null;
 const toYou=line.to==='you',warm=toYou&&line.mood==='light',S=GREET.smile,sign=random()<.5?-1:1;
 const lineEnd=plan.speak+line.duration,release=lineEnd+TALK.linger;   // when her look starts easing back (talk clock)
 const em=vrm.expressionManager,clock=()=>speech.time()+plan.speak,startedAt=now();
 let moved=false,attended=false,finished=false,mouth=CLOSED,smile=0,lids=0;
 reader.talking=true;reader.reading.holdReading(true);
 // her motion starts at the plan's look time (a look at you) or at once (to herself); it eases back at `release`
 function move(t){
  const hold=Math.max(0,release-t-TALK.ease),ease=TALK.ease,r=reader.reading;
  if(LOOKS.has(motion))return attended=reader.attend({at:target,hold,ease,tilt:GREET.tilt,share:motion==='eyes'?TALK.eyes.share:1});
  if(motion==='aside')r.glance({...TALK.aside,hold,ease,eyes:'away'});
  else if(motion==='up')r.glance({yaw:sign*TALK.up.yaw,pitch:TALK.up.pitch,hold,ease,eyes:'away'});
  else if(motion==='tilt')r.glance({yaw:0,pitch:0,roll:sign*TALK.tilt.roll,hold,ease,eyes:'page'});
  return true;   // page, lids: her reading holds still, nothing turns
 }
 function face(t){
  if(warm){   // a soft smile, from when she speaks (or looks up at you mid-line) until her look eases back
   const from=motion==='midway'?plan.look+TALK.ease*.5:plan.speak-S.lead;
   smile=smooth((t-from)/S.rise)*(1-smooth((t-release)/S.fall));
   applyFace(em,{smile:smile*TALK.smile,relaxed:smile*FACE.relaxed,mouth});
  }else{        // calm: relaxed, no smile
   const calm=smooth((t-plan.speak+.4)/.6)*(1-smooth((t-release)/S.fall));
   applyFace(em,{smile:0,relaxed:.5*calm,mouth});
  }
  if(warm){   // a small nod over the end of a light line to you
   const a=plan.speak+line.duration*.5,b=lineEnd+.4,u=(t-a)/(b-a);
   if(u>0&&u<1)vrm.humanoid.getNormalizedBoneNode('head')?.quaternion.multiply(q.setFromAxisAngle(X,THREE.MathUtils.degToRad(TALK.nod*Math.sin(Math.PI*u))));
  }
  // never quite still while she speaks: small dips with the louder syllables and a slow sway (talk-head.js)
  const presence=smooth((t-(plan.speak-.3))/.5)*(1-smooth((t-lineEnd)/(TALK.linger+.5)));
  applyHead(vrm,talkingHead(line,speech.time(),{weight:presence*(toYou?1:.4)}));   // calmer when she murmurs to herself
  if(motion==='lids'){   // eyes half-close softly over the middle of a dark line
   const a=plan.speak+TALK.lids.from*line.duration,b=plan.speak+TALK.lids.to*line.duration;
   lids=TALK.lids.weight*smooth((t-a)/.4)*(1-smooth((t-b)/.4));reader.lids=lids;
  }
 }
 // Let go of everything: the reader first (so nothing can leave her held), then her look or glance (the line can end
 // while it is still held: her frames stopped while the voice played on, a hidden tab), then her face and the subtitle.
 function end(){
  finished=true;mouth=CLOSED;smile=0;lids=0;
  reader.lids=0;reader.talking=false;reader.reading.holdReading(false);
  if(attended)reader.cancelAttend();else if(moved&&!LOOKS.has(motion))reader.reading.endLookUpAt();
  applyFace(em,{smile:0,relaxed:0,mouth:CLOSED});subtitles?.set(false);
 }
 return {
  line,motion,speech,plan,
  /** @returns {boolean} false once the line is over */
  update(){
   if(finished)return false;
   if(now()-startedAt>plan.end+TALK.stuck){speech.stop();end();return false;}   // its voice clock stopped
   const t=clock();
   if(!moved&&t>=(plan.look??0))moved=move(t);
   mouth=mouthShape(line,keys,speech.time());
   face(t);
   const on=t>=plan.speak-TALK.subtitleLead&&t<lineEnd+.3;
   subtitles?.set(on,subtitleAt(line,speech.time()),{murmur:!toYou});
   if(t>plan.end)end();
   return !finished;
  },
  /** Stop now: the voice stops and she eases back to her book. */
  stop(){speech.stop();end();},
  speaking:()=>!finished&&speech.status()==='speaking',
  state:()=>({line:line.id,motion,to:line.to,mood:line.mood,t:+clock().toFixed(3),clip:+speech.time().toFixed(3),speech:speech.status(),
   audible:speech.audible(),finished,subtitle:subtitles?.visible()??false,murmur:subtitles?.murmur()??false,smile:+smile.toFixed(3),lids:+lids.toFixed(3),
   mouth:Object.fromEntries(VISEMES.map(v=>[v,+mouth[v].toFixed(3)])),...gazeReport(vrm,target)}),
 };
}
