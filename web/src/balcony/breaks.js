// When her two breaks from reading happen. The calm break (unwind.js) comes every 4 to 8 minutes, the overhead stretch
// (overhead-stretch.js) every 5 to 15; one at a time, only when she is doing nothing else, and never back to back.
// Pure: the reader keeps the schedule and asks these what to do with it.

export const BREAKS=Object.freeze({
 unwind:Object.freeze({every:Object.freeze([240,480])}),
 stretch:Object.freeze({every:Object.freeze([300,900])}),
 apart:60,     // s: after one break ends, the other waits at least this long
});

/**
 * Seconds until a break next comes due.
 * @param {readonly [number,number]} every shortest and longest wait @param {()=>number} random 0..1 @param {number} [scale]
 * @returns {number}
 */
export function gap([a,b],random,scale=1){return (a+(b-a)*random())*scale;}

/**
 * The break that starts now, if any: none while she is in the middle of something; of those due, the one that has
 * waited longest.
 * @param {number} now @param {Record<string,number>} next when each break is due @param {boolean} free
 * @returns {string|null}
 */
export function due(now,next,free){
 if(!free)return null;
 const waiting=Object.keys(next).filter(name=>now>=next[name]);
 return waiting.length?waiting.reduce((a,b)=>next[b]<next[a]?b:a):null;
}

/**
 * The schedule after a break has ended: its own next time, and every other break no sooner than `apart` from now.
 * @param {string} ended @param {number} now @param {Record<string,number>} next @param {(name:string)=>number} gapOf
 * @param {number} [apart]
 * @returns {Record<string,number>} a new schedule
 */
export function after(ended,now,next,gapOf,apart=BREAKS.apart){
 return Object.fromEntries(Object.keys(next).map(name=>[name,name===ended?now+gapOf(name):Math.max(next[name],now+apart)]));
}
