// The beat of the music as the page hears it. Fed one level per frame (the level meter's numbers), it keeps the last
// few seconds of how sharply the level rose, finds the spacing those rises repeat at (the tempo) and where they fall
// (the phase), and runs a steady clock on them so the phase moves on evenly between estimates. Pure: no audio here.

export const BEAT=Object.freeze({
 rate:100,            // samples a second the level is kept at
 window:8,            // s of sound it listens back over
 warm:5,              // s it needs before the first estimate
 bpm:Object.freeze([58,112]),   // tempos it looks for: under one octave, so half and double time cannot be confused
 every:.5,            // s between estimates
 confident:.3,        // how alike the level is one beat apart (0..1) for the beat to count as clear
 quiet:1e-7,          // mean square rise below which there is no sound to speak of
 gap:1,               // s without a level (a hidden tab): what it heard is too old, start over
 follow:.3,pull:.25,  // share of the way its clock moves toward each new tempo and phase
 snap:.06,changed:3,  // a tempo this far off (share), this many estimates running, is a new track: take it at once
 latency:.03,         // s the meter shows a hit after it sounds
});
const frac=x=>x-Math.floor(x),wrap=x=>x-Math.round(x);
// the top of a parabola through three evenly spaced values (offset from the middle one, -0.5..0.5)
const peak=(a,b,c)=>{const d=a-2*b+c;return d<0?Math.max(-.5,Math.min(.5,.5*(a-c)/d)):0;};

/** @param {Partial<typeof BEAT>} [options] */
export function createBeat(options){
 const o={...BEAT,...options},size=Math.round(o.rate*o.window),rises=new Float32Array(size),line=new Float32Array(size);
 const lagMin=Math.floor(o.rate*60/o.bpm[1]),lagMax=Math.ceil(o.rate*60/o.bpm[0]);
 let head=0,count=0,sinceEstimate=0,lastT=null,lastLevel=0,gridT=0,gridLevel=0,clock=null,off=0;
 const reset=()=>{head=0;count=0;sinceEstimate=0;lastT=null;clock=null;off=0;};
 // how alike the rises are `lag` samples apart (-1..1), over the n samples in `line`
 const alike=(n,lag,energy)=>{let s=0;for(let i=lag;i<n;i++)s+=line[i]*line[i-lag];return s/energy*n/(n-lag);};
 function estimate(){
  const n=Math.min(count,size);let mean=0;
  for(let i=0;i<n;i++){line[i]=rises[(head-n+i+size)%size];mean+=line[i];}
  mean/=n;let energy=0;for(let i=0;i<n;i++){line[i]-=mean;energy+=line[i]*line[i];}
  if(energy/n<o.quiet){clock=null;return;}
  // the tempo: the spacing the rises repeat at, helped by the same repeat two beats apart
  let best=lagMin,bestScore=-Infinity;const scores=[];
  for(let lag=lagMin-1;lag<=lagMax+1;lag++){
   const s=alike(n,lag,energy)+(2*lag<n*.75?.5*alike(n,2*lag,energy):0);scores.push(s);
   if(lag>=lagMin&&lag<=lagMax&&s>bestScore){bestScore=s;best=lag;}
  }
  const i=best-(lagMin-1),lag=best+peak(scores[i-1],scores[i],scores[i+1]),confidence=Math.max(0,Math.min(1,alike(n,best,energy)));
  // the phase: how long before the newest sample a comb of that spacing catches the most rise
  const span=Math.ceil(lag),comb=p=>{let s=0;for(let k=0;;k++){const j=n-1-p-Math.round(k*lag);if(j<0)break;s+=line[j];}return s;};
  let at=0,top=-Infinity;const sums=[];for(let p=0;p<span;p++){const s=comb(p);sums.push(s);if(s>top){top=s;at=p;}}
  const back=at+peak(sums[(at+1)%span],sums[at],sums[(at-1+span)%span])*-1;
  const period=lag/o.rate,beatT=gridT-back/o.rate-o.latency;
  if(!clock){clock={period,anchor:beatT,confidence};return;}
  if(Math.abs(period-clock.period)/clock.period>o.snap){
   clock.confidence+=(Math.min(confidence,o.confident*.5)-clock.confidence)*.5;   // unsure while the tempo is in question
   if(++off>=o.changed){clock={period,anchor:beatT,confidence};off=0;}
   return;
  }
  off=0;
  clock.period+=(period-clock.period)*o.follow;
  clock.anchor+=Math.round((gridT-clock.anchor)/clock.period)*clock.period;        // keep the reference beat near now
  clock.anchor+=wrap((beatT-clock.anchor)/clock.period)*clock.period*o.pull;
  clock.confidence+=(confidence-clock.confidence)*.5;
 }
 return {
  /** One level (0..1 or so) at time t (s, any steady clock), once a frame. */
  push(level,t){
   if(lastT===null||t-lastT>o.gap||t<lastT){reset();lastT=t;lastLevel=level;gridT=t;gridLevel=level;return;}
   const step=1/o.rate;
   while(gridT+step<=t){
    gridT+=step;
    const v=lastLevel+(level-lastLevel)*(gridT-lastT)/(t-lastT);
    rises[head]=Math.max(0,v-gridLevel);gridLevel=v;head=(head+1)%size;count++;sinceEstimate++;
   }
   lastT=t;lastLevel=level;
   if(count>=o.warm*o.rate&&sinceEstimate>=o.every*o.rate){sinceEstimate=0;estimate();}
  },
  /**
   * The beat at time t, or null when none is heard.
   * @returns {{bpm:number,phase:number,confidence:number}|null} phase 0..1, 0 on the beat
   */
  read(t){return clock?{bpm:60/clock.period,phase:frac((t-clock.anchor)/clock.period),confidence:clock.confidence}:null;},
  reset,
 };
}
