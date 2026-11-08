// Pure helpers for the camera-frame HUD: timecode, the music line text and the level-bar heights.

const WRAP=100*3600;   // a camera counter rolls over after 99:59:59
const pad=n=>String(n).padStart(2,'0');

/** Seconds since the page opened, as a camcorder counter (hh:mm:ss). */
export function formatTimecode(seconds){
 const s=Number.isFinite(seconds)&&seconds>0?Math.floor(seconds)%WRAP:0;
 return `${pad(Math.floor(s/3600))}:${pad(Math.floor(s/60)%60)}:${pad(s%60)}`;
}

const lower=s=>(s??'').toLowerCase();

/**
 * What the music line says for an engine state. `action:'start'` means tapping the line should start or resume.
 * @returns {{title:string,artist:string,action:'start'|null}}
 */
export function musicLine(state){
 const t=state?.track;
 switch(state?.status){
  case 'playing':return {title:lower(t?.title),artist:lower(t?.artist),action:null};
  case 'paused':return {title:'paused',artist:lower(t?.title),action:'start'};
  case 'loading':return {title:'tuning in…',artist:'',action:null};
  case 'error':return {title:'music unavailable · tap to retry',artist:'',action:'start'};
  default:return {title:'tap for music',artist:'',action:'start'};
 }
}

/** Heights (px) of the three level bars. */
export const BARS=Object.freeze({min:2,max:13,still:Object.freeze([6,11,8])});

/** Map three 0..1 band levels to bar heights; `still` (reduced motion) gives a fixed, calm shape. */
export function barHeights(levels,{still=false}={}){
 if(still)return BARS.still;
 return [0,1,2].map(i=>{
  const v=Number(levels?.[i]);
  const x=Number.isFinite(v)?Math.min(1,Math.max(0,v)):0;
  return Math.round(BARS.min+(BARS.max-BARS.min)*x);
 });
}
