// Timing curves for authored motion. A Track is a start value plus moves; each move adds its change over its own time
// window with its own ease, so moves whose windows overlap blend into one continuous motion with no stop at the pose
// in between. Values are numbers or arrays of numbers. Ported from scripts/balcony-stretch/tracks.py.

const clamped=f=>x=>x<=0?0:x>=1?1:f(x);
export const smooth=clamped(x=>x*x*(3-2*x));
export const smoother=clamped(x=>x*x*x*(x*(6*x-15)+10));
// a quick (but not instant) start that slows, passes the goal a little and settles
const back=clamped(x=>{const u=x**1.7,c=1.6;return 1+(c+1)*(u-1)**3+c*(u-1)**2;});
/** Eases by name: all go from 0 to 1 over 0..1 and hold outside it. */
export const EASE=Object.freeze({
 io:smoother,
 soft:smooth,
 out:clamped(x=>1-(1-x)**3),          // leaves at speed, arrives softly
 in:clamped(x=>x**2.4),
 back,
 down:clamped(x=>smooth(x**1.7)),     // slow at first, faster, then a soft arrival
});

export class Track{
 /** @param {number|number[]} v0 the value before the first move @param {object[]} [moves] */
 constructor(v0,moves=[]){this.v0=v0;this.moves=moves;Object.freeze(this);}
 /**
  * A new track that also moves to `v` between times `a` and `b` (this track is left as it was).
  * @param {number|number[]} v @param {number} a @param {number} b @param {keyof typeof EASE} [ease]
  * @returns {Track}
  */
 to(v,a,b,ease='io'){
  if(!EASE[ease])throw new Error(`unknown ease "${ease}"`);
  if(!(b>a))throw new Error(`a move needs its end after its start (${a} to ${b})`);
  return new Track(this.v0,[...this.moves,{v,a,b,ease:EASE[ease]}]);
 }
 /** @param {number} t @returns {number|number[]} the value at time t */
 at(t){
  const vector=Array.isArray(this.v0);
  let out=vector?[...this.v0]:this.v0,prev=this.v0;
  for(const m of this.moves){
   const k=m.ease((t-m.a)/(m.b-m.a));
   if(k)out=vector?out.map((x,i)=>x+(m.v[i]-prev[i])*k):out+(m.v-prev)*k;
   prev=m.v;
  }
  return out;
 }
}

/** 0 before a, 1 between b and c, 0 after d. */
export function pulse(t,a,b,c,d){return smooth((t-a)/(b-a))*(1-smooth((t-c)/(d-c)));}
