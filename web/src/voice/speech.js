// Her voice: plays the generated lines (public/voice/, made by scripts/voice/generate_lines.py) through Web Audio and
// reports how far into a line the listener is, on the audio clock, so her mouth follows what is heard. If sound is
// blocked or fails, the line still runs on the page clock (mouth and subtitle, no sound) rather than not at all.

export const VOICE=Object.freeze({base:'/voice/',gain:1,resumeWaitMs:400,minLeft:.15,levelFade:.15});   // minLeft: s of a line worth starting late
const now=()=>performance.now()/1000;

/**
 * @typedef {{id:string,text:string,duration:number,audio:string,subtitle:{ja:string,en?:string},moras:object[],envelope:{fps:number,values:number[]}}} Line
 * @typedef {{line:Line,time:()=>number,status:()=>'waiting'|'speaking'|'done',audible:()=>boolean,stop:()=>void}} Speech
 */
export function createVoice({base=VOICE.base}={}){
 let index=null,ctx=null,out=null,level=1;   // level: 0..1, follows the music's volume and mute (level.js)
 const audio=new Map();   // line id -> Promise<ArrayBuffer>
 async function load(){
  const r=await fetch(base+'lines.json');if(!r.ok)throw Error(`voice lines: HTTP ${r.status}`);
  index=await r.json();
  return index;
 }
 /** @returns {Line|null} */
 const line=id=>index?.lines.find(l=>l.id===id)??null;
 /** Start downloading a line's audio (only the lines she will say are fetched). @returns {Promise<ArrayBuffer>|null} */
 function prefetch(id){
  const l=line(id);if(!l)return null;
  if(!audio.has(id)){
   const p=fetch(base+l.audio).then(a=>{if(!a.ok)throw Error(`${l.audio}: HTTP ${a.status}`);return a.arrayBuffer();});
   p.catch(()=>{if(audio.get(id)===p)audio.delete(id);});   // failures surface when the line is said; the next try refetches
   audio.set(id,p);
  }
  return audio.get(id);
 }
 function context(){
  if(!ctx){
   const AC=window.AudioContext??window.webkitAudioContext;if(!AC)return null;
   ctx=new AC();out=ctx.createGain();out.gain.value=VOICE.gain*level;out.connect(ctx.destination);
  }
  return ctx;
 }
 const running=(c,waitMs)=>c.state==='running'?Promise.resolve(true):
  Promise.race([c.resume().then(()=>c.state==='running',()=>false),new Promise(r=>setTimeout(()=>r(c.state==='running'),waitMs))]);

 /**
  * Let her voice play: call inside the click or key press that starts the page, when the line may only be said later
  * (browsers allow sound only after a gesture).
  */
 function unlock(){const c=context();if(c&&c.state!=='running')c.resume().catch(e=>console.warn('voice: audio not unlocked',e.message));}
 /**
  * Say a line `delay` seconds from now. Call it inside a click or key press the first time, so the browser lets it play.
  * @returns {Speech|null}
  */
 function say(id,{delay=0}={}){
  const l=line(id);if(!l){console.warn(`voice: no line "${id}"`);return null;}
  const c=context(),startAt=now()+delay;
  let mode='page',ctxStart=0,source=null,stopped=false;
  const latency=()=>(c?.outputLatency||0)+(c?.baseLatency||0);
  let last=-Infinity;   // never runs backwards (switching to the audio clock subtracts the output latency)
  const time=()=>{const t=mode==='audio'?c.currentTime-latency()-ctxStart:now()-startAt;return last=Math.max(last,t);};
  const silent=why=>console.warn(`voice: "${id}" plays without sound (${why})`);
  (async()=>{
   if(!c)return silent('no Web Audio');
   const ok=await running(c,Math.max(VOICE.resumeWaitMs,delay*1000));   // runs up to here synchronously: resume() inside the gesture
   if(stopped)return;if(!ok)return silent('audio blocked until the page is clicked');
   try{
    const buffer=await c.decodeAudioData((await prefetch(id)).slice(0));
    if(stopped)return;
    const ahead=startAt-now();   // late (negative): start part-way in, so the sound stays on her mouth
    if(-ahead>l.duration-VOICE.minLeft)return silent('audio was not ready in time');
    source=c.createBufferSource();source.buffer=buffer;source.connect(out);
    ctxStart=c.currentTime+ahead;source.start(c.currentTime+Math.max(0,ahead),Math.max(0,-ahead));mode='audio';
   }catch(e){silent(e.message);}
  })();
  return {
   line:l,time,
   status(){if(stopped)return 'done';const t=time();return t<0?'waiting':t<l.duration?'speaking':'done';},
   audible:()=>mode==='audio',
   stop(){stopped=true;try{source?.stop();}catch{/* the line had already ended */}},
  };
 }
 return {
  load,line,prefetch,unlock,say,
  /** @param {(line:Line)=>boolean} [filter] @returns {string[]} the ids of every line, or of those the filter keeps */
  ids:(filter=()=>true)=>index?.lines.filter(filter).map(l=>l.id)??[],
  /** How loud she plays, 0..1, eased in over a moment. */
  setLevel(x){
   x=Math.min(1,Math.max(0,Number(x)||0));if(x===level)return;level=x;
   if(!ctx||!out)return;
   const t=ctx.currentTime,g=out.gain;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(VOICE.gain*level,t+VOICE.levelFade);
  },
  state:()=>({lines:index?.lines.length??0,fetched:[...audio.keys()],context:ctx?.state??null,level}),
  dispose(){ctx?.close().catch(()=>{});ctx=null;},
 };
}
