// When she says something while she reads: every 1 to 2 minutes at random, from when the page starts, never over anything else she is doing
// (the greeting, a conversation, her break, a page turn, a glance), and not at all when nobody is listening (the tab hidden, the
// music paused, or sound not yet allowed by a click). Which line and which motion: talk-plan.js; the line itself:
// talk.js. What she has said is remembered in the browser, so a returning visitor hears new lines first.
import {TALK,nextDelay,pickNext,pickMotion,loadHeard,saveHeard,forget} from './talk-plan.js';
import {startTalk} from './talk.js';

/**
 * @param {{voice:object,reader:object,vrm:object,subtitles?:object,target:object,music?:object|null,store?:Storage,
 *  random?:()=>number,every?:number[],hidden?:()=>boolean}} o
 */
export function createSmallTalk({voice,reader,vrm,subtitles,target,music=null,store,random=Math.random,every=TALK.every,hidden=()=>document.hidden}){
 let memory=loadHeard(store);   // kept here too, so blocked storage still gives a full round per visit
 let clock=0,next=Infinity,freeSince=-Infinity,chosen=null,active=null,lastMotion=null,skipped=null,saidLast=memory.last;
 let armed=false,greeted=false;   // armed: the page has started (start pressed); greeted: the greeting or a conversation is on
 const lines=()=>voice.ids(l=>l.kind==='talk').map(id=>voice.line(id));
 const remember=id=>{memory={heard:[...memory.heard.filter(x=>x!==id),id],last:id};saveHeard(store,memory);};
 function choose(){
  const r=pickNext(lines(),{...memory,random});
  if(r.id){saidLast=memory.last;memory={heard:r.heard,last:r.id};saveHeard(store,memory);}
  return r.id;
 }
 // a fresh wait; a line already chosen (and counted as heard) but not said is forgotten
 function reschedule(){if(chosen){memory=forget(memory,chosen,saidLast);saveHeard(store,memory);}chosen=null;next=clock+nextDelay(random,every);}
 function begin(id,motion){
  const line=voice.line(id);if(!line)return false;
  const m=motion??pickMotion(line,{last:lastMotion,random});
  active=startTalk({reader,vrm,voice,line,motion:m,target,subtitles,random});
  if(active){lastMotion=m;skipped=null;}
  return !!active;
 }
 const why=()=>hidden()?'hidden':music?.state().status==='paused'?'paused':voice.state().context!=='running'?'locked':null;
 return {
  /** Call every frame, after the reader's update. @param {number} dt @param {{greeting?:boolean,chatting?:boolean}} now
   *  chatting: she is in a conversation the visitor started (click to talk); like the greeting, a fresh wait follows */
  update(dt,{greeting=false,chatting=false}={}){
   const held=greeting||chatting;
   clock+=dt;
   if(active){if(!active.update()){active=null;reschedule();}return;}
   if(!armed)return;                                                // not before the page has started
   if(held!==greeted){greeted=held;if(!held)reschedule();}           // a whole wait after the greeting or a conversation
   if(!lines().length)return;                                       // her lines are still loading
   if(!chosen&&clock>=next-TALK.prefetch){chosen=choose();if(chosen)voice.prefetch(chosen);}
   if(clock<next||!chosen)return;
   if(held||reader.busy()){freeSince=clock;return;}                 // wait until she is free...
   if(clock-freeSince<TALK.breath)return;                           // ...and has had a breath
   const reason=why();
   if(reason){   // nobody to hear it: the line stays unheard for next time
    skipped=reason;memory=forget(memory,chosen,saidLast);saveHeard(store,memory);reschedule();return;
   }
   const said=chosen;chosen=null;
   if(!begin(said))reschedule();
  },
  /** Say a line now (for checks): a given id or the next one, with a given motion or a picked one. */
  say(id,{motion}={}){
   if(active||!lines().length)return false;
   const pick=id??choose();if(!pick)return false;
   if(id)remember(id);
   return begin(pick,motion);
  },
  /** The page has started (start pressed, or no intro): from now on she may talk. */
  start(){if(!armed){armed=true;reschedule();}},
  /** Stop a line she is saying now (the greeting comes first). */
  stop(){if(active){active.stop();active=null;reschedule();}},
  speaking:()=>!!active?.speaking(),
  state:()=>({...(active?.state()??{subtitle:subtitles?.visible()??false}),active:!!active,armed,next:+Math.max(0,next-clock).toFixed(1),
   skipped,heard:[...memory.heard],last:memory.last}),
  dispose(){active?.stop();active=null;},
 };
}
