// The greeting: as the picture comes into focus she looks up from her book at you, smiles, and says her line; her
// mouth follows the voice, the subtitle shows, and she goes back to reading. Call update() every frame after the
// reader's update() and before vrm.update(). Its clock is the voice's own, so the mouth stays on the sound.
import * as THREE from 'three';
import {greetPlan,greetFace} from './greeting-plan.js';
import {mouthKeys,mouthShape,VISEMES} from './lipsync.js';
import {applyFace,FACE} from './face.js';
import {gazeReport} from './gaze-report.js';
import {talkingHead,applyHead} from './talk-head.js';

export {FACE};   // her smile's weights now live in face.js, shared with small talk
const CLOSED=Object.freeze(Object.fromEntries(VISEMES.map(v=>[v,0])));
const X=new THREE.Vector3(1,0,0),q=new THREE.Quaternion();

/**
 * @param {{reader:import('../balcony/reader.js').Reader,vrm:import('@pixiv/three-vrm').VRM,voice:ReturnType<import('./speech.js').createVoice>,
 *  lineId:string,target:THREE.Vector3,subtitles?:ReturnType<import('./subtitles.js').mountSubtitles>,options?:object}} o
 */
export function startGreeting({reader,vrm,voice,lineId,target,subtitles,options}){
 const line=voice.line(lineId);if(!line){console.warn(`greeting: no line "${lineId}"`);return null;}
 const plan=greetPlan(line,options),keys=mouthKeys(line);
 const speech=voice.say(lineId,{delay:plan.speak});if(!speech)return null;
 let looked=false,finished=false,face={smile:0,nod:0,subtitle:false},mouth=CLOSED;
 const clock=()=>speech.time()+plan.speak;   // seconds since start, on the voice's clock
 const em=vrm.expressionManager;
 const setFace=(smile,m)=>applyFace(em,{smile,relaxed:smile*FACE.relaxed,mouth:m});
 // her face back to neutral, the subtitle off, and her eyes back on the book (the reader's clock can run behind ours)
 function end(){finished=true;mouth=CLOSED;face={smile:0,nod:0,subtitle:false};setFace(0,CLOSED);subtitles?.set(false);if(looked)reader.cancelAttend();}
 return {
  plan,line,speech,
  /** @returns {boolean} false once the greeting is over */
  update(){
   if(finished)return false;
   const t=clock();
   // look up at you (retried each frame while her break has her busy; the hold shortens so she still looks back down on time)
   if(!looked&&t>=plan.look&&t<plan.release)looked=reader.attend({at:target,hold:plan.hold-(t-plan.look),ease:plan.o.ease,tilt:plan.o.tilt});
   face=greetFace(plan,t);
   mouth=mouthShape(line,keys,speech.time());   // closed before and after the line
   setFace(face.smile,mouth);
   if(face.nod)vrm.humanoid.getNormalizedBoneNode('head')?.quaternion.multiply(q.setFromAxisAngle(X,THREE.MathUtils.degToRad(face.nod)));
   // never quite still while she speaks: small dips with the louder syllables and a slow sway (talk-head.js)
   const presence=THREE.MathUtils.smoothstep(t,plan.speak-.3,plan.speak+.2)*(1-THREE.MathUtils.smoothstep(t,plan.speakEnd,plan.speakEnd+1.5));
   applyHead(vrm,talkingHead(line,speech.time(),{weight:presence}));
   subtitles?.set(face.subtitle,line.subtitle);
   if(t>plan.end+plan.o.smile.fall)end();
   return !finished;
  },
  stop(){speech.stop();end();},
  state:()=>({line:line.id,t:+clock().toFixed(3),clip:+speech.time().toFixed(3),speech:speech.status(),audible:speech.audible(),looked,finished,
   head:(({yaw,pitch,tilt}={})=>yaw===undefined?null:{yaw:+yaw.toFixed(1),pitch:+pitch.toFixed(1),tilt})(reader.reading.lookUp?.gaze?reader.reading.lookUp:undefined),
   ...gazeReport(vrm,target),   // lean and aim: how she looks at the camera now (gaze-report.js)
   away:+reader.reading.away.toFixed(2),
   smile:+face.smile.toFixed(3),nod:+face.nod.toFixed(2),subtitle:subtitles?.visible()??false,
   mouth:Object.fromEntries(VISEMES.map(v=>[v,+mouth[v].toFixed(3)]))}),
 };
}
