// Lip sync from a spoken line's timing (scripts/voice/generate_lines.py): every Japanese mora ends in one of five
// vowels, so the mouth moves through the five VRM vowel shapes (aa, ih, ou, ee, oh). Consonants shape the transitions
// (lips close for m/b/p, narrow for s/sh/ts, round for w/f), pauses close the mouth, and the voice's loudness scales
// how far it opens. The mouth leads the sound a little, as in animation: a lag reads as out of sync, a lead does not.
// Pure functions: no three.js, no DOM.

export const VISEMES=Object.freeze(['aa','ih','ou','ee','oh']);
export const VOWEL_VISEME=Object.freeze({a:'aa',i:'ih',u:'ou',e:'ee',o:'oh'});
export const LIPSYNC=Object.freeze({
 lead:.045,               // s the mouth moves ahead of the sound
 gain:Object.freeze({aa:.8,ih:.5,ou:.6,ee:.6,oh:.7}),   // how far each shape opens at most (the full shapes are wide)
 attack:.05,release:.04,  // s to reach a vowel's shape, and to start leaving it
 fullOpen:.08,shortOpen:.6,   // vowels shorter than fullOpen (s) open less, down to shortOpen of the shape
 devoiced:.18,            // whispered vowels (VOICEVOX writes them in capitals: ツ in つかれ): barely open
 nasal:Object.freeze({ou:.14}),   // ん: nearly closed
 close:.08,               // s to close before the first sound and after the last
 quiet:.45,               // share of the opening kept when the voice is at its quietest
});
const CLOSED=Object.freeze({aa:0,ih:0,ou:0,ee:0,oh:0});
const LIPS=new Set(['m','my','b','by','p','py']);
const ROUND=new Set(['w','f']);
const TEETH=new Set(['s','sh','z','j','ts','ch']);
const LIGHT=new Set(['r','ry','y','h','hy']);   // the mouth barely changes through these

const shape=(w={})=>({...CLOSED,...w});
const mix=(a,b,k)=>Object.fromEntries(VISEMES.map(v=>[v,a[v]+(b[v]-a[v])*k]));
const scale=(a,k)=>Object.fromEntries(VISEMES.map(v=>[v,a[v]*k]));
const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);

function vowelShape(m,o){
 const len=m.end-m.vowelStart,amp=o.shortOpen+(1-o.shortOpen)*Math.min(1,len/o.fullOpen);
 if(m.vowel==='N')return shape(o.nasal);
 const v=VOWEL_VISEME[m.vowel.toLowerCase()];
 if(!v)return shape();                                   // pau, cl (っ), anything unknown: closed
 return shape({[v]:(m.vowel===m.vowel.toUpperCase()?o.devoiced:1)*amp});
}
function consonantShape(c,before,after){
 if(LIPS.has(c))return shape();
 if(ROUND.has(c))return shape({ou:.45});
 if(TEETH.has(c))return shape({ih:.3});
 return scale(mix(before,after,.5),LIGHT.has(c)?.7:.4);
}

/**
 * Mouth keyframes for a line: {t (s, in the audio), w (weight per viseme, 0..1 before gain)}, in time order.
 * @param {{moras:{consonant:string|null,vowel:string,start:number,vowelStart:number,end:number}[]}} line
 * @returns {{t:number,w:Record<string,number>}[]}
 */
export function mouthKeys(line,o=LIPSYNC){
 const m=line.moras??[];if(!m.length)return [{t:0,w:shape()}];
 const keys=[{t:m[0].start-o.close,w:shape()}];
 let before=shape();
 for(const x of m){
  const w=vowelShape(x,o),len=x.end-x.vowelStart;
  if(x.consonant&&x.vowelStart>x.start)keys.push({t:(x.start+x.vowelStart)/2,w:consonantShape(x.consonant,before,w)});
  const a=Math.min(o.attack,len*.45),r=Math.min(o.release,len*.45);
  keys.push({t:x.vowelStart+a,w});
  if(len-a-r>.005)keys.push({t:x.end-r,w});
  before=w;
 }
 keys.push({t:m[m.length-1].end+o.close,w:shape()});
 return keys;
}

function mouthAt(keys,t){
 if(t<=keys[0].t)return keys[0].w;
 for(let i=1;i<keys.length;i++){const b=keys[i];if(t<=b.t){const a=keys[i-1];return mix(a.w,b.w,smooth((t-a.t)/(b.t-a.t)));}}
 return keys[keys.length-1].w;
}

/** The voice's loudness at t (s into the audio), 0..1, from the line's envelope. */
export function loudness(line,t){
 const e=line.envelope;if(!e?.values?.length)return 1;
 const x=t*e.fps,i=Math.floor(x);if(i<0||i>=e.values.length)return 0;
 const a=e.values[i],b=e.values[Math.min(i+1,e.values.length-1)];
 return (a+(b-a)*(x-i))/100;
}

/**
 * Viseme weights to set on the VRM at playback time t (s into the audio), already led and gained.
 * @returns {Record<'aa'|'ih'|'ou'|'ee'|'oh',number>}
 */
export function mouthShape(line,keys,t,o=LIPSYNC){
 const tt=t+o.lead,w=mouthAt(keys,tt),k=o.quiet+(1-o.quiet)*loudness(line,tt);
 return Object.fromEntries(VISEMES.map(v=>[v,Math.min(o.gain[v],Math.max(0,w[v]*k*o.gain[v]))]));
}
