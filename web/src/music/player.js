// Background music engine. Two <audio> decks are routed through Web Audio so tracks can crossfade and be levelled
// (playlist gain) without touching the files, and so volume works on iOS, where element volume is read-only.
// No UI: callers drive it through wake/start/toggle/next/setVolume/toggleMute and read state().
import {parsePlaylist,advance,EMPTY_QUEUE} from './playlist.js';
import {decide,fadeCurve,fadeLength} from './fades.js';

export const MUSIC=Object.freeze({
 url:`${import.meta.env?.BASE_URL??'/'}music/playlist.json`,
 crossfade:6,      // seconds of overlap between tracks
 skipFade:1.5,     // overlap when the visitor skips
 preload:30,       // start loading the next track this many seconds before the end
 fadeIn:2.5,       // first track, and resuming after a pause
 pauseFade:.4,
 interruptFade:.25,// a skip during a crossfade first fades the outgoing track this fast
 startTimeout:8,   // a track that has not started playing by then counts as a failed attempt
 maxStrikes:2,     // network failures allowed per track before it is dropped (decode errors drop it at once)
 volume:.7,
 duck:.5,          // the music's share while she speaks (about -6 dB)
 duckFade:.4,
 album:'Your LoFi Girlfriend',
 curveSteps:16,
 bands:[[1,4],[4,16],[16,48]],   // analyser bins (of 128) for the three level bars: lows, mids, highs
});
const MEDIA_ERR={DECODE:3,UNSUPPORTED:4};

let silentUrl=null;
/** A 0.1 s silent WAV used to unlock audio elements inside the first gesture (iOS gates play() per element). */
function silence(){
 if(silentUrl)return silentUrl;
 const n=800,b=new Uint8Array(44+n*2),v=new DataView(b.buffer),put=(o,s)=>[...s].forEach((c,i)=>{b[o+i]=c.charCodeAt(0);});
 put(0,'RIFF');v.setUint32(4,36+n*2,true);put(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
 v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);put(36,'data');v.setUint32(40,n*2,true);
 silentUrl=URL.createObjectURL(new Blob([b],{type:'audio/wav'}));
 return silentUrl;
}

export function createMusic(options={}){
 const cfg={...MUSIC,...Object.fromEntries(Object.entries(options).filter(([,v])=>v!==undefined))};
 const rng=cfg.random??Math.random,base=cfg.url.slice(0,cfg.url.lastIndexOf('/')+1);
 let tracks=null,loadError=null,ready=loadPlaylist();

 let ctx=null,master=null,dip=null,analyser=null,spectrum=null,decks=null,cur=0,queue=EMPTY_QUEUE,fade=null,fadeId=0,pauseTimer=0,chosen=-1,retryTimer=0;
 let status='idle',error=null,muted=false,ducked=false,volume=cfg.volume,entrance={fadeIn:cfg.fadeIn,delay:0};
 const failed=new Set(),strikes=new Map(),session=typeof navigator!=='undefined'?navigator.mediaSession:undefined;
 const onVisible=()=>{if(document.visibilityState==='visible'&&status==='playing')resumeContext();};
 document.addEventListener('visibilitychange',onVisible);

 function loadPlaylist(){
  const p=fetch(cfg.url)
   .then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();})
   .then(d=>{const r=parsePlaylist(d,base);if(r.rejected.length)console.warn('music: skipped playlist entries',r.rejected);tracks=r.tracks;return tracks;})
   .catch(e=>{loadError=`playlist: ${e.message}`;console.error('music:',loadError);throw e;});
  p.catch(()=>{});   // surfaced through state().error
  return p;
 }
 const resumeContext=()=>{if(ctx&&ctx.state!=='running')ctx.resume().catch(()=>{});};

 function makeDeck(){
  const el=new Audio();el.preload='none';el.crossOrigin='anonymous';   // Web Audio plays cross-origin files silent without CORS
  const gain=ctx.createGain();gain.gain.value=0;
  ctx.createMediaElementSource(el).connect(gain).connect(master);
  const deck={el,gain,track:null,index:-1,watchdog:0};
  el.addEventListener('timeupdate',()=>onTime(deck));
  el.addEventListener('ended',()=>onEnded(deck));
  el.addEventListener('error',()=>onError(deck));
  return deck;
 }
 /** Automate `param` along `curve` over `len` s, starting from wherever it is now (fades can be interrupted). */
 function ramp(param,curve,len){
  const t=ctx.currentTime,v=param.value;   // read before cancelling: the fallback path would otherwise lose a running ramp
  if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(t);else{param.cancelScheduledValues(t);param.setValueAtTime(v,t);}
  for(let i=1;i<curve.length;i++)param.linearRampToValueAtTime(curve[i],t+len*i/(curve.length-1));
 }
 const toLevel=(param,target,len)=>ramp(param,Float32Array.of(param.value,target),len);
 const audible=()=>muted?0:volume;   // the music's own level; the dip under her voice is a separate gain (dip)

 function load(deck){
  // a track the visitor picked plays next; otherwise the shuffle decides (and avoids repeating the picked one)
  const r=chosen>=0?{queue:Object.freeze({...queue,last:chosen}),index:chosen}:advance(queue,tracks.length,rng,failed);
  chosen=-1;queue=r.queue;
  if(r.index<0){giveUp();return false;}
  deck.index=r.index;deck.track=tracks[r.index];
  deck.el.src=deck.track.url;deck.el.preload='auto';deck.el.load();
  return true;
 }
 function release(deck){
  clearTimeout(deck.watchdog);deck.watchdog=0;
  deck.el.pause();deck.el.removeAttribute('src');deck.el.load();
  deck.track=null;deck.index=-1;deck.gain.gain.cancelScheduledValues(0);deck.gain.gain.value=0;
 }
 function prime(deck){
  const url=silence();deck.el.src=url;
  deck.el.play().then(()=>{if(deck.el.src===url)deck.el.pause();},()=>{});
 }
 /** Play a deck; resolves true once it plays. A missing gesture stops the engine until the next tap. */
 function play(deck){
  return deck.el.play().then(()=>true,e=>{if(e.name==='NotAllowedError')blocked();return false;});
 }
 /** Count a failed attempt; decode errors and repeated network failures drop the track. */
 function strike(deck,permanent){
  const n=(strikes.get(deck.index)??0)+1;strikes.set(deck.index,n);
  if(permanent||n>=cfg.maxStrikes)failed.add(deck.index);
  console.warn('music: could not play',deck.track?.url,permanent?'(unplayable)':`(attempt ${n})`);
 }
 /** Call `onStall` if `deck` has not started playing within cfg.startTimeout. */
 function watch(deck,onStall){
  clearTimeout(deck.watchdog);
  const track=deck.track;
  deck.watchdog=setTimeout(()=>{deck.watchdog=0;if(deck.track===track&&(status==='playing'||status==='loading'))onStall();},cfg.startTimeout*1000);
  deck.el.addEventListener('playing',()=>{clearTimeout(deck.watchdog);deck.watchdog=0;},{once:true});
 }

 // --- crossfades: fade = {id, from, to, len, phase: 'pending' (waiting for `to` to play) | 'running' | 'closing'} ---
 function crossfade(len){
  if(fade){if(fade.phase==='running')interrupt(fade,()=>crossfade(len));return;}   // pending/closing: next track already coming
  const from=decks[cur],to=decks[1-cur];
  if(!to.track&&!load(to))return;
  const f={id:++fadeId,from,to,len,phase:'pending',timer:0,endAt:0};
  fade=f;cur=1-cur;announce();
  to.gain.gain.cancelScheduledValues(0);to.gain.gain.value=0;
  to.el.addEventListener('playing',()=>run(f),{once:true});
  watch(to,()=>{if(fade===f&&f.phase==='pending'){strike(to,false);abandon(f);}});
  play(to);   // silent through its gain until run() fades it in; starting now also makes it buffer on iOS
 }
 function run(f){
  if(fade!==f||f.phase!=='pending')return;
  f.phase='running';f.endAt=ctx.currentTime+f.len;
  ramp(f.from.gain.gain,fadeCurve('out',f.from.gain.gain.value,cfg.curveSteps),f.len);
  ramp(f.to.gain.gain,fadeCurve('in',f.to.track.gain,cfg.curveSteps),f.len);
  f.timer=setTimeout(()=>complete(f),f.len*1000+50);
 }
 function complete(f){
  if(fade!==f)return;
  clearTimeout(f.timer);fade=null;release(f.from);
 }
 /** A skip during a running crossfade: fade the outgoing track out quickly, then start the new crossfade. */
 function interrupt(f,then){
  f.phase='closing';clearTimeout(f.timer);
  toLevel(f.from.gain.gain,0,cfg.interruptFade);
  f.timer=setTimeout(()=>{if(fade!==f)return;fade=null;release(f.from);then();},cfg.interruptFade*1000+50);
 }
 /** The incoming track never started: drop it and carry on with the outgoing one (or a new track if it ended). */
 function abandon(f){
  if(fade!==f)return;
  fade=null;release(f.to);cur=decks.indexOf(f.from);
  if(f.from.track&&!f.from.el.ended){toLevel(f.from.gain.gain,f.from.track.gain,.3);announce();}   // the next timeupdate retries
  else startOn(f.from,1);
 }
 function startOn(deck,len){
  if(!load(deck))return;
  deck.gain.gain.cancelScheduledValues(0);deck.gain.gain.value=0;
  ramp(deck.gain.gain,fadeCurve('in',deck.track.gain,cfg.curveSteps),len);
  watch(deck,()=>{if(deck.track){strike(deck,false);release(deck);if(status==='playing')startOn(deck,1);}});
  play(deck);announce();
 }

 function begin(){
  if(status!=='loading')return;
  const d=decks[cur];
  if(!d.track&&!load(d))return;
  d.gain.gain.cancelScheduledValues(0);d.gain.gain.value=d.track.gain;
  watch(d,()=>{if(status==='loading'&&d.track){strike(d,false);release(d);begin();}});
  play(d).then(ok=>{
   if(!ok||status!=='loading')return;
   status='playing';fadeMasterIn(entrance);announce();syncSession();
  });
 }
 /** Bring the music in: silent for `delay` s, then a `fadeIn` s rise (both on the audio clock). */
 function fadeMasterIn({fadeIn,delay}){
  const t=ctx.currentTime,p=master.gain;
  p.cancelScheduledValues(t);p.setValueAtTime(0,t);p.setValueAtTime(0,t+delay);p.linearRampToValueAtTime(audible(),t+delay+fadeIn);
 }
 function stopDecks(){
  if(fade){clearTimeout(fade.timer);fade=null;}
  for(const d of decks??[])release(d);
  if(master){master.gain.cancelScheduledValues(0);master.gain.value=0;}
 }
 function blocked(){
  if(status==='idle'||status==='error')return;
  stopDecks();status='idle';syncSession();
 }
 function giveUp(){
  stopDecks();status='error';error='no playable tracks';syncSession();console.error('music:',error);
 }

 function onTime(d){
  if(status!=='playing'||d!==decks[cur]||!d.track)return;
  if(fade?.phase==='running'&&ctx.currentTime>=fade.endAt+.05)complete(fade);   // timers are throttled in hidden tabs
  const duration=Number.isFinite(d.el.duration)&&d.el.duration>0?d.el.duration:d.track.duration;
  const other=decks[1-cur];
  const act=decide({time:d.el.currentTime,duration,preloaded:!!other.track,fading:fade!==null},cfg);
  if(act==='preload')load(other);
  else if(act==='crossfade')crossfade(fadeLength(duration,cfg.crossfade));
 }
 function onEnded(d){
  if(!d.track)return;
  if(fade&&d===fade.from){if(fade.phase!=='pending')complete(fade);return;}   // pending: the new track or its watchdog takes over
  if(d!==decks[cur]){release(d);return;}
  if(status==='playing')crossfade(.3);   // the crossfade window was missed
 }
 function onError(d){
  if(!d.track)return;
  const code=d.el.error?.code;
  strike(d,code===MEDIA_ERR.DECODE||code===MEDIA_ERR.UNSUPPORTED);
  if(fade&&d===fade.to&&fade.phase==='pending'){abandon(fade);return;}
  if(fade&&d===fade.from){complete(fade);return;}
  const current=d===decks[cur];
  release(d);
  if(!current)return;                     // a preload failed: the next timeupdate loads another
  if(status==='loading')begin();
  else if(status==='playing')startOn(d,1);
  // paused: resume() refills the deck
 }

 function announce(){
  const t=decks?.[cur]?.track;
  if(!t||!session||typeof MediaMetadata==='undefined')return;
  session.metadata=new MediaMetadata({title:t.title,artist:t.artist,album:cfg.album});
 }
 function syncSession(){if(session)session.playbackState=status==='playing'?'playing':status==='paused'?'paused':'none';}
 function bindSession(handlers){
  if(!session)return;
  for(const [action,fn] of Object.entries(handlers)){try{session.setActionHandler(action,fn);}catch{/* not supported here */}}
 }

 /**
  * Start the music (call from a user gesture). `fadeIn` and `delay` shape how the first track comes in, e.g. after
  * an intro: playback starts now, inside the gesture, but stays silent until `delay` has passed.
  */
 function start({fadeIn=cfg.fadeIn,delay=0}={}){
  if(status==='paused'){resume();return;}
  if(status==='error'){   // a tap after a failure tries again from scratch
   failed.clear();strikes.clear();error=null;
   if(loadError){loadError=null;tracks=null;ready=loadPlaylist();}
   status='idle';
  }
  if(status!=='idle')return;
  if(!ctx){
   const AC=window.AudioContext??window.webkitAudioContext;
   if(!AC){status='error';error='Web Audio is not supported';return;}
   ctx=new AC();master=ctx.createGain();master.gain.value=0;dip=ctx.createGain();dip.gain.value=ducked?cfg.duck:1;
   analyser=ctx.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.8;spectrum=new Uint8Array(analyser.frequencyBinCount);
   master.connect(dip).connect(analyser).connect(ctx.destination);   // after both gains: muted or paused reads as silence
   decks=[makeDeck(),makeDeck()];
   bindSession({play:()=>start(),pause:()=>pause(),nexttrack:()=>next()});
  }
  resumeContext();
  // unlock both elements while the gesture is live; the first one plays its real track below when it can
  if(!tracks)prime(decks[cur]);
  prime(decks[1-cur]);
  entrance={fadeIn:Math.max(0,Number(fadeIn)||0),delay:Math.max(0,Number(delay)||0)};
  status='loading';
  if(tracks)begin();
  else ready.then(begin,()=>{if(status==='loading'){status='error';error=loadError;}});
 }
 function pause(){
  if(status==='loading'){stopDecks();status='idle';syncSession();return;}
  if(status!=='playing')return;
  status='paused';toLevel(master.gain,0,cfg.pauseFade);syncSession();
  for(const d of decks){clearTimeout(d.watchdog);d.watchdog=0;}
  pauseTimer=setTimeout(()=>{if(status==='paused')for(const d of decks)d.el.pause();},cfg.pauseFade*1000+30);
 }
 function resume(){
  if(status!=='paused')return;
  clearTimeout(pauseTimer);resumeContext();status='playing';
  const c=decks[cur];
  if(!c.track)startOn(c,1);
  for(const d of decks)if(d.track&&d.el.paused)play(d);
  if(fade?.phase==='pending')watch(fade.to,()=>{if(fade?.phase==='pending'){strike(fade.to,false);abandon(fade);}});
  toLevel(master.gain,audible(),cfg.fadeIn/2);syncSession();
 }
 function toggle(){if(status==='playing')pause();else start();}
 function next(){
  if(status==='paused')resume();
  if(status==='playing')crossfade(cfg.skipFade);else start();
 }
 /** Switch to a particular track (by id), crossfading from the current one; starts the music if it is stopped. */
 function playTrack(id){
  const index=tracks?.findIndex(t=>t.id===id)??-1;
  if(index<0)return false;
  clearTimeout(retryTimer);
  if(status==='paused')resume();
  if(status!=='playing'){chosen=index;start();return true;}
  if(decks[cur].index===index&&!fade)return true;                    // already playing it
  if(fade?.phase==='closing'){retryTimer=setTimeout(()=>playTrack(id),cfg.interruptFade*1000+80);return true;}
  if(fade?.phase==='pending')abandon(fade);                          // drop the track that was still on its way
  if(fade?.phase==='running'){interrupt(fade,()=>playTrack(id));return true;}
  const to=decks[1-cur];
  if(to.track&&to.index!==index)release(to);                          // replace whatever was preloaded
  if(!to.track){chosen=index;if(!load(to))return false;}
  crossfade(cfg.skipFade);
  return true;
 }
 /** For a tap: start if stopped, or wake a context the system suspended (calls, Siri, lock screen). */
 function wake(){
  if(status==='idle'||status==='error')start();else resumeContext();
 }
 function setVolume(v){
  volume=Math.min(1,Math.max(0,Number(v)||0));
  if(ctx&&status==='playing'&&!muted)toLevel(master.gain,audible(),.15);
 }
 /** Dip the music while she speaks, and bring it back after. */
 function duck(on){
  if(!!on===ducked)return;
  ducked=!!on;
  if(dip)toLevel(dip.gain,ducked?cfg.duck:1,cfg.duckFade);   // its own gain: the music's fades run on undisturbed
 }
 function toggleMute(){
  muted=!muted;
  if(ctx&&status==='playing')toLevel(master.gain,audible(),.25);
 }
 function state(){
  const d=decks?.[cur],t=d?.track;
  return {status,error:error??loadError,tracks:tracks?.length??0,failed:failed.size,volume,muted,ducked,level:audible()*(ducked?cfg.duck:1),
   gain:master?+master.gain.value.toFixed(4):0,   // the music's own level now (its fades), for checks
   track:t?{id:t.id,title:t.title,artist:t.artist,license:t.license.name}:null,
   time:d?+d.el.currentTime.toFixed(2):0,duration:t?.duration??0,fading:fade!==null,context:ctx?.state??null};
 }
 /** Three 0..1 levels (lows, mids, highs) of what is audible right now, for level meters. */
 function levels(){
  if(!analyser||status!=='playing')return [0,0,0];
  analyser.getByteFrequencyData(spectrum);
  return cfg.bands.map(([a,b])=>{let s=0;for(let i=a;i<b;i++)s+=spectrum[i];return s/((b-a)*255);});
 }
 /** Every playable track, for credits. */
 function playlist(){
  return (tracks??[]).map(t=>({id:t.id,title:t.title,artist:t.artist,license:t.license,source:t.source}));
 }
 /** For automated checks: jump to `seconds` before the end of the playing track. */
 function seekToEnd(seconds){
  const d=decks?.[cur];if(!d?.track)return;
  const duration=Number.isFinite(d.el.duration)?d.el.duration:d.track.duration;
  d.el.currentTime=Math.max(0,duration-seconds);
 }
 function dispose(){
  clearTimeout(pauseTimer);clearTimeout(retryTimer);stopDecks();status='idle';
  document.removeEventListener('visibilitychange',onVisible);
  bindSession({play:null,pause:null,nexttrack:null});
  ctx?.close().catch(()=>{});ctx=null;decks=null;analyser=null;dip=null;
 }
 return Object.freeze({wake,start,toggle,pause,next,playTrack,setVolume,toggleMute,duck,state,levels,playlist,seekToEnd,dispose});
}
