// Her face while she speaks: the five mouth shapes from lip sync, plus a smile and a relaxed look, as VRM expression
// weights. Neither the smile nor the relaxed look overrides the mouth; while her mouth is open the smile's pull on the
// mouth corners eases off (talking), so o and u stay round, and her eyes keep smiling.
import {VISEMES} from './lipsync.js';

export const FACE=Object.freeze({happy:.42,relaxed:.6,talkingEase:.7,fullOpen:.6});

/**
 * @param {{setValue:(name:string,weight:number)=>void}|null} em vrm.expressionManager
 * @param {{smile?:number,relaxed?:number,mouth:Record<string,number>}} o smile 0..1 (of FACE.happy), relaxed 0..1
 */
export function applyFace(em,{smile=0,relaxed=0,mouth},o=FACE){
 if(!em)return;
 for(const v of VISEMES)em.setValue(v,mouth[v]??0);
 const open=Math.min(1,Math.max(...VISEMES.map(v=>mouth[v]??0))/o.fullOpen);
 em.setValue('happy',smile*o.happy*(1-o.talkingEase*open));em.setValue('relaxed',relaxed);
}
