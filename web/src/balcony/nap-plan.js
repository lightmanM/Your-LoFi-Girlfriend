// When she naps, and how she gets to the daybed and back. Now and then she closes her book, gets up and walks out to
// the daybed; 15 to 20 minutes later she wakes, gets up and walks back to her chair and her book (nap-walk.js).
// A character those walks were not made for goes each way by a cut: the picture dips to dark like a camera cut, and
// when it comes back she has changed places.
// Pure: the viewer keeps the clock and asks these what to do.

export const NAP=Object.freeze({
 first:Object.freeze([1200,2100]),              // s of the visit before her first nap
 every:Object.freeze([1800,3000]),              // s from waking to her next nap
 length:Object.freeze([900,1200]),              // s asleep: 15 to 20 minutes
 cut:Object.freeze({out:.9,dark:.6,in:1.4}),    // s: the picture goes dark, stays dark, comes back
 stretchAfter:6,                                // s after she is back in her chair that she stretches
});
const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);

/**
 * Seconds until something next comes due.
 * @param {readonly [number,number]} range shortest and longest wait @param {()=>number} random 0..1 @returns {number}
 */
export function napGap([a,b],random){return a+(b-a)*random();}

/**
 * Whether a nap may start now: it is due, the page has started and is on screen, and she is only reading (no
 * greeting, line, chat, welcome, break or page turn).
 * @param {number} now @param {number} next when the nap is due
 * @param {{started:boolean,greeting:boolean,talking:boolean,chatting:boolean,welcoming:boolean,busy:boolean,frozen:boolean,hidden:boolean}} g
 * @returns {boolean}
 */
export function napDue(now,next,g){
 return now>=next&&g.started&&!g.greeting&&!g.talking&&!g.chatting&&!g.welcoming&&!g.busy&&!g.frozen&&!g.hidden;
}

/** How long a cut lasts. @param {typeof NAP.cut} [c] @returns {number} */
export function cutLength(c=NAP.cut){return c.out+c.dark+c.in;}

/**
 * How dark the picture is t seconds into a cut, 0..1. She changes places at the middle of the dark (napStep).
 * @param {number} t @param {typeof NAP.cut} [c] @returns {number}
 */
export function cutDark(t,c=NAP.cut){
 return t<=0?0:t<c.out?smooth(t/c.out):t<c.out+c.dark?1:1-smooth((t-c.out-c.dark)/c.in);
}

/** Her nap at the start of a visit. @returns {{phase:'awake'|'toBed'|'asleep'|'toChair',t:number}} */
export function napStart(){return {phase:'awake',t:0};}

/**
 * One step of her nap. Phases: awake (in her chair), toBed (her walk out, or the cut out), asleep, toChair (her way
 * back, or the cut back). Events: 'walk' as she starts to walk out, 'lie' as she arrives on the daybed (at the end of
 * her walk, or as she changes places in the dark), 'getup' as she starts on her way back, 'rise' as she changes back
 * in the dark, 'woke' when she is back at her book (her way back, or the cut back, is over).
 * @param {{phase:string,t:number,walk?:number,walked?:boolean}} s @param {number} dt
 * @param {{due?:boolean,length?:number,cut?:typeof NAP.cut,walk?:number,back?:number}} [o] due: a nap may start now;
 *  length: s asleep; walk, back: s her walk out and her way back take (0: she goes by the cut; she walks back only
 *  if she walked out)
 * @returns {{phase:string,t:number,walk?:number,walked?:boolean,event?:'walk'|'lie'|'getup'|'rise'|'woke'}} a new state
 */
export function napStep(s,dt,{due=false,length=NAP.length[0],cut=NAP.cut,walk=0,back=0}={}){
 const t=s.t+dt,mid=cut.out+cut.dark/2,crossed=s.t<mid&&t>=mid;
 if(s.phase==='awake')return due?(walk>0?{phase:'toBed',t:0,walk,event:'walk'}:{phase:'toBed',t:0}):{phase:'awake',t};
 if(s.phase==='toBed'&&s.walk>0)return t>=s.walk?{phase:'asleep',t:0,walked:true,event:'lie'}:{phase:'toBed',t,walk:s.walk};
 if(s.phase==='toBed'){
  if(t>=cutLength(cut))return {phase:'asleep',t:0,...(crossed?{event:'lie'}:{})};
  return {phase:'toBed',t,...(crossed?{event:'lie'}:{})};
 }
 // she walks back only if she walked out: placed there by the cut, she and her book are not as her way back starts
 if(s.phase==='asleep')return t<length?{phase:'asleep',t,...(s.walked?{walked:true}:{})}:back>0&&s.walked?{phase:'toChair',t:0,walk:back,event:'getup'}:{phase:'toChair',t:0};
 if(s.walk>0)return t>=s.walk?{phase:'awake',t:0,event:'woke'}:{phase:'toChair',t,walk:s.walk};   // on her way back
 if(t>=cutLength(cut))return {phase:'awake',t:0,event:crossed?'rise':'woke'};
 return {phase:'toChair',t,...(crossed?{event:'rise'}:{})};
}

/** How dark the picture is in this state, 0..1 (never dark while she walks). */
export function darkness(s,cut=NAP.cut){return (s.phase==='toBed'||s.phase==='toChair')&&!(s.walk>0)?cutDark(s.t,cut):0;}
