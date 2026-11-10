// One conversation the visitor started by clicking her (click to talk): she looks up at the camera once and holds it,
// says a notice, or asks a question and waits for an answer (the pills, answers.js), then replies to the pick or lets
// the question go; she lingers a moment and eases back to her book. Her mouth follows each line, her face smiles or
// stays calm by the line's mood, the subtitle shows. Which conversation, and when she can be clicked: chat-plan.js.
// Call update(dt) every frame after the reader's update() and before vrm.update().
import {CHAT,pickChat,loadChat,saveChat,forgetChat,chatMotion} from './chat-plan.js';
import {TALK,subtitleAt} from './talk-plan.js';
import {GREET} from './greeting-plan.js';
import {mouthKeys,mouthShape,VISEMES} from './lipsync.js';
import {applyFace,FACE} from './face.js';
import {talkingHead,applyHead} from './talk-head.js';

const CLOSED=Object.freeze(Object.fromEntries(VISEMES.map(v=>[v,0])));
const FACE_EASE=.35;    // s her face takes to settle on a new expression
const FETCH_WAIT=10;    // s a clip may take to arrive before she lets the conversation go
const ease=(x,to,dt,s=FACE_EASE)=>x+(to-x)*Math.min(1,dt/s);
const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
/** A light line to you ends with a small nod (as small talk's do); a question waits for your answer instead. */
const endsWithNod=l=>l.kind==='notice'||l.kind==='letgo'||l.kind==='reply'&&l.mood==='light';
/** Her face for a line: smile weight and relaxed eyes. Calm (no smile) for a heavier question, gentle for a soft reply. */
function faceFor(line){
 if(line.kind==='ask'&&line.mood==='dark')return {smile:0,relaxed:.5};
 const smile=line.kind==='reply'&&line.mood==='soft'?CHAT.soft:TALK.smile;
 return {smile,relaxed:smile*FACE.relaxed/TALK.smile};
}

/**
 * @param {{voice:object,reader:object,vrm:object,subtitles?:object,answers?:object,target:object,store?:Storage,
 *  random?:()=>number,now?:()=>number,narrow?:()=>boolean,hidden?:()=>boolean,wait?:number}} o
 */
export function createChat({voice,reader,vrm,subtitles,answers,target,store,random=Math.random,now=()=>performance.now()/1000,
 narrow=()=>false,hidden=()=>document.hidden,wait=CHAT.wait}){
 let memory=loadChat(store),c=null,endedAt=-Infinity,face={smile:0,relaxed:0},presence=0,mouth=CLOSED,lastMotion=null;
 const em=vrm.expressionManager;
 const lines=()=>voice.ids(l=>l.kind==='ask'||l.kind==='notice').map(id=>voice.line(id));
 // A line to say next, once its audio has arrived (never part-way through): `after` is the earliest page time.
 function queue(id,phase,after=now()){
  const q={id,phase,after,since:now(),ready:false,failed:false};
  const p=voice.prefetch(id);
  if(!p)q.failed=true;else p.then(()=>{q.ready=true;},()=>{q.failed=true;});
  c.next=q;
 }
 function say(q){
  const line=voice.line(q.id),speech=voice.say(q.id);
  if(!speech){abort();return;}
  Object.assign(c,{phase:q.phase,line,speech,keys:mouthKeys(line),lineAt:now(),next:null});
  // eyes first: she speaks toward her book and looks up at you partway through (as small talk's "midway" look)
  if(!c.attended&&c.motion==='midway')c.attendAt=now()+Math.max(0,(line.parts?.[1]?.start??line.duration/3)-TALK.ease);
  if(q.phase==='ask'){   // while she asks: her replies and a let-go line come down
   for(const a of line.answers)voice.prefetch(a.reply);
   const go=voice.ids(l=>l.kind==='letgo');c.letgo=go[Math.min(go.length-1,Math.floor(random()*go.length))];
   if(c.letgo)voice.prefetch(c.letgo);
  }
 }
 const lineDone=()=>c.speech&&(c.speech.status()==='done'||now()-c.lineAt>c.line.duration+TALK.stuck);
 function showAnswers(){
  c.phase='answers';c.answersAt=now();
  answers?.show(c.line.answers.map(a=>a.label),i=>pick(i));
 }
 function pick(i){
  if(!c||c.phase!=='answers')return false;
  const a=c.line.answers[i];if(!a)return false;
  answers?.hide();queue(a.reply,'reply');c.phase='picked';c.pickAt=now();return true;
 }
 // Back to her book: the reader first (so nothing can leave her held), then her look, her face and the subtitle.
 function finish(){
  if(!c)return;
  c.speech?.stop();answers?.hide();
  reader.talking=false;reader.lids=0;reader.reading.holdReading(false);reader.cancelAttend();
  applyFace(em,{smile:0,relaxed:0,mouth:CLOSED});subtitles?.set(false);
  face={smile:0,relaxed:0};presence=0;mouth=CLOSED;c=null;endedAt=now();
 }
 // Ended before it was over (a hidden tab, a clip that never came): the line is unheard again.
 function abort(){if(!c)return;memory=forgetChat(memory,c.id);saveChat(store,memory);finish();}
 // Subtle variety: a curious tilt while she waits for your answer (or as she says a notice "with a tilt"), a nod when
 // you pick and at the end of a light line, eyelids lowered over a harder reply's first sentence, eyes closing for a
 // moment as she lets a question go. Offsets on top of her look (applyHead), lids through the reader's blink.
 function motion(t,dt,clip){
  const M=CHAT.motion,l=c.line;
  const tilted=c.phase==='answers'||c.motion==='tilt'&&l?.kind==='notice'&&c.phase!=='linger';
  c.roll=ease(c.roll,tilted?c.sign*M.tilt:0,dt,M.tiltEase/3);
  let pitch=0;
  if(c.pickAt!=null){const u=(t-c.pickAt)/M.nodTime;if(u>0&&u<1)pitch+=M.nod*Math.sin(Math.PI*u);}
  if(l&&c.speech&&endsWithNod(l)){const a=c.lineAt+l.duration*.5,b=c.lineAt+l.duration+.4,u=(t-a)/(b-a);if(u>0&&u<1)pitch+=M.nod*Math.sin(Math.PI*u);}
  c.pitch=pitch;
  if(Math.abs(c.roll)>.001||pitch)applyHead(vrm,{yaw:0,pitch,roll:c.roll});
  let lids=0;
  if(l&&c.speech&&l.kind==='reply'&&l.mood==='soft'){const end=l.parts?.[1]?.start??l.duration*.4;lids=M.lids*smooth(clip/.3)*(1-smooth((clip-end)/.4));}
  else if(l&&c.speech&&l.kind==='letgo')lids=M.closeLids*smooth((clip+.2)/.2)*(1-smooth((clip-M.closeEyes)/.3));
  c.lids=lids;reader.lids=lids;
 }
 const onVisibility=()=>{if(c&&hidden())abort();};
 if(typeof document!=='undefined')document.addEventListener('visibilitychange',onVisibility);

 return {
  /** Start a conversation: the given question or notice, or one picked. @returns {boolean} */
  start({ask,notice,motion}={}){
   if(c)return false;
   const want=ask??notice,kind=ask?'ask':notice?'notice':null;
   let id=null,next=memory;
   if(want){
    const l=voice.line(want);if(!l||l.kind!==kind){console.warn(`chat: no ${kind} "${want}"`);return false;}
    const pool=kind==='ask'?'asks':'notices',p=memory[pool];
    id=want;next={...memory,[pool]:{heard:[...p.heard.filter(x=>x!==id),id],last:id},lastKind:kind};
   }else{
    const r=pickChat(lines(),memory,random);if(!r.id)return false;
    id=r.id;next=r.memory;
   }
   const line=voice.line(id),how=motion??chatMotion(line,{last:lastMotion,random});
   const lookEase=line.kind==='ask'&&line.mood==='dark'?CHAT.motion.slowEase:TALK.ease;   // a heavier question: slower
   const attended=how!=='midway'&&reader.attend({at:target,hold:CHAT.hold,ease:lookEase,tilt:GREET.tilt});
   if(how!=='midway'&&!attended)return false;   // nothing is counted as heard unless she really starts
   memory=next;saveChat(store,memory);if(line.kind==='notice')lastMotion=how;
   reader.talking=true;reader.reading.holdReading(true);
   c={id,kind:line.kind,phase:'look',startAt:now(),line:null,speech:null,next:null,motion:how,attended,attendAt:null,
    sign:random()<.5?-1:1,roll:0,pitch:0,lids:0,pickAt:null};
   queue(id,c.kind==='ask'?'ask':'notice',now()+(how==='midway'?.3:lookEase));   // she speaks once her look has eased in
   return true;
  },
  pick,
  /** Call every frame. @param {number} dt */
  update(dt){
   if(!c)return;
   if(hidden()){abort();return;}
   const t=now(),q=c.next;
   if(q){
    if(q.failed||t-q.since>FETCH_WAIT){abort();return;}
    if(q.ready&&t>=q.after)say(q);
   }
   if(!c)return;
   if(c.attendAt!=null&&t>=c.attendAt){c.attended=reader.attend({at:target,hold:CHAT.hold,ease:TALK.ease,tilt:GREET.tilt});c.attendAt=null;}
   if(c.speech&&lineDone()){
    if(c.phase==='ask'){if(t-c.lineAt>=c.line.duration+CHAT.answersAfter)showAnswers();}
    else if(c.phase==='notice'||c.phase==='reply'||c.phase==='letgo'){c.phase='linger';c.lingerAt=t;}
   }
   if(c.phase==='answers'&&t-c.answersAt>=wait){answers?.hide();if(c.letgo)queue(c.letgo,'letgo');else{finish();return;}c.phase='picked';}
   if(c.phase==='linger'&&t-c.lingerAt>=TALK.linger){finish();return;}
   // her face, mouth and head
   const speaking=c.speech?.status()==='speaking',clip=c.speech?.time()??0;
   const want=c.line&&c.phase!=='linger'?faceFor(c.line):{smile:0,relaxed:0};   // her face settles back as she lingers
   face={smile:ease(face.smile,want.smile,dt),relaxed:ease(face.relaxed,want.relaxed,dt)};
   mouth=c.speech&&c.phase!=='answers'?mouthShape(c.line,c.keys,clip):CLOSED;
   applyFace(em,{smile:face.smile,relaxed:face.relaxed,mouth});
   presence=ease(presence,speaking?1:0,dt,.5);
   if(c.line&&presence>.001)applyHead(vrm,talkingHead(c.line,clip,{weight:presence}));
   motion(t,dt,clip);
   // the subtitle: the line as it is said; while the answers show, the question stays up above them (wide screens)
   if(c.phase==='answers'||c.phase==='picked'&&c.line?.kind==='ask')subtitles?.set(!narrow(),c.line.subtitle,{lifted:true});
   else if(c.line&&c.phase!=='look'){
    const on=clip>=-TALK.subtitleLead&&(c.phase==='ask'||clip<c.line.duration+.3);
    subtitles?.set(on,subtitleAt(c.line,clip));
   }
  },
  active:()=>!!c,
  speaking:()=>!!c?.speech&&c.speech.status()==='speaking',
  endedAt:()=>endedAt,
  stop(){finish();},
  dispose(){finish();if(typeof document!=='undefined')document.removeEventListener('visibilitychange',onVisibility);},
  state:()=>({ready:lines().length>0,active:!!c,phase:c?.phase??'done',kind:c?.kind??null,question:c?.kind==='ask'?c.id:null,
   line:c?.line?.id??null,answers:answers?.visible()?answers.labels():null,subtitle:subtitles?.visible()??false,
   text:subtitles?.text()??'',smile:+face.smile.toFixed(3),speech:c?.speech?.status()??null,clip:+(c?.speech?.time()??0).toFixed(3),
   since:Number.isFinite(endedAt)?+(now()-endedAt).toFixed(1):null,motion:c?.motion??null,
   head:{roll:+(c?.roll??0).toFixed(2),pitch:+(c?.pitch??0).toFixed(2)},lids:+(c?.lids??0).toFixed(3),heard:{asks:[...memory.asks.heard],notices:[...memory.notices.heard]}}),
 };
}
