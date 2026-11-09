// Her eye range, widened for a moment. This model turns its eyes by only about a tenth of the angle they are asked to
// (its VRM look-at range maps: 90° in, 10° out), so on their own her eyes cannot meet yours. While she gives you an
// eyes-only look, the maps are eased toward one for one (up to `wide`), then back to the model's own values exactly.

export const EYES=Object.freeze({wide:Object.freeze({inputMaxValue:15,outputScale:15})});   // beyond ~15° her irises slip under the lids
const MAPS=Object.freeze(['rangeMapHorizontalInner','rangeMapHorizontalOuter','rangeMapVerticalDown','rangeMapVerticalUp']);
const rest=new WeakMap();   // applier -> the model's own values, captured the first time

/**
 * @param {object|undefined} applier vrm.lookAt.applier (bone or expression type; anything without range maps is left alone)
 * @param {number} k 0 = the model's own range, 1 = fully widened
 */
export function widenEyes(applier,k,wide=EYES.wide){
 if(!applier)return;
 const names=MAPS.filter(n=>applier[n]);if(!names.length)return;
 if(!rest.has(applier))rest.set(applier,Object.fromEntries(names.map(n=>[n,{inputMaxValue:applier[n].inputMaxValue,outputScale:applier[n].outputScale}])));
 const r=rest.get(applier),x=Math.min(1,Math.max(0,k));
 for(const n of names){
  applier[n].inputMaxValue=r[n].inputMaxValue+(wide.inputMaxValue-r[n].inputMaxValue)*x;
  applier[n].outputScale=r[n].outputScale+(wide.outputScale-r[n].outputScale)*x;
 }
}
