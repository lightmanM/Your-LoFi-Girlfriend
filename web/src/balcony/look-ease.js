// The timing of a look away from the book (a glance, or turning to look at you): out, hold, back. The ease is the
// "smootherstep" curve: it starts and stops with no speed and no acceleration, so a head turn settles softly onto
// what she looks at instead of stopping with a jolt. Pure.

/** 0 → 1 over x = 0 → 1, with zero speed and zero acceleration at both ends. */
export function settle(x){
 if(x<=0)return 0;
 if(x>=1)return 1;
 return x*x*x*(x*(x*6-15)+10);
}

/**
 * How far into the look she is at t s from its start: eases out over `ease`, holds for `hold`, eases back over `back`.
 * @param {number} t @param {{ease:number,hold:number,back?:number}} o @returns {number} 0..1
 */
export function lookWeight(t,{ease,hold,back=ease}){
 return settle(t/ease)*(1-settle((t-ease-hold)/back));
}
