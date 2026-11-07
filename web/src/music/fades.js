// Loudness and crossfade maths for the background music. Pure functions: no DOM, no audio.

export const dbToGain=db=>10**(db/20);

/** Crossfade length for a track: the configured length, but never more than a quarter of a short track. */
export const fadeLength=(duration,crossfade)=>Math.min(crossfade,duration/4);

/**
 * Equal-power fade from 0 to `gain` ('in') or from `gain` to 0 ('out'), for AudioParam.setValueCurveAtTime.
 * The two curves of a crossfade keep the summed power constant, so the mix does not dip in the middle.
 */
export function fadeCurve(kind,gain,steps=64){
 const c=new Float32Array(steps);
 for(let i=0;i<steps;i++){const x=i/(steps-1)*Math.PI/2;c[i]=gain*(kind==='in'?Math.sin(x):Math.cos(x));}
 c[kind==='in'?steps-1:0]=gain;
 return c;
}

/**
 * What the player should do now for the playing track: 'preload' the next one, start the 'crossfade', or nothing.
 * @param {{time:number,duration:number,preloaded:boolean,fading:boolean}} s
 * @param {{crossfade:number,preload:number}} cfg seconds before the end
 */
export function decide({time,duration,preloaded,fading},cfg){
 if(!(Number.isFinite(duration)&&duration>0)||fading)return null;
 const left=duration-time;
 if(left<=fadeLength(duration,cfg.crossfade))return 'crossfade';
 if(!preloaded&&left<=cfg.preload)return 'preload';
 return null;
}
