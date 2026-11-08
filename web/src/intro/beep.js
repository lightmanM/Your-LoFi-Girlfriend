// The camera's power-on beep, synthesised with Web Audio (no sound file, nothing to license).
// Must be called from a user gesture (the start button); it creates and closes its own short-lived AudioContext.

export const BEEP=Object.freeze({
 freq:2100,       // Hz: a small camcorder-style pip
 count:2,         // two pips
 length:.06,      // seconds per pip
 gap:.07,         // seconds between pips
 gain:.11,        // quiet: a cue, not an alarm
 attack:.004,
 release:.03,
});

/** When each pip sounds, on an audio clock starting at `start` seconds. */
export function beepPlan(start,b=BEEP){
 return Array.from({length:b.count},(_,i)=>{const s=start+i*(b.length+b.gap);return {freq:b.freq,start:s,end:s+b.length};});
}

/** Schedule the beep `delay` seconds from now. Returns the plan, or null where Web Audio is unavailable. */
export function cameraBeep(delay=0,{volume=1}={}){
 const AC=window.AudioContext??window.webkitAudioContext;
 if(!AC)return null;
 let ctx;
 try{ctx=new AC();}catch(err){console.warn('beep: no audio',err);return null;}
 ctx.resume().catch(()=>{});
 const out=ctx.createGain();out.gain.value=BEEP.gain*Math.min(1,Math.max(0,volume));out.connect(ctx.destination);
 const plan=beepPlan(ctx.currentTime+Math.max(0,delay));
 for(const {freq,start,end} of plan){
  const osc=ctx.createOscillator(),env=ctx.createGain();
  osc.type='sine';osc.frequency.value=freq;
  env.gain.setValueAtTime(0,start);env.gain.linearRampToValueAtTime(1,start+BEEP.attack);
  env.gain.setValueAtTime(1,end-BEEP.release);env.gain.linearRampToValueAtTime(0,end);
  osc.connect(env).connect(out);osc.start(start);osc.stop(end+.01);
 }
 const doneMs=(plan[plan.length-1].end-ctx.currentTime+.4)*1000;
 setTimeout(()=>ctx.close().catch(()=>{}),doneMs);
 return plan;
}
