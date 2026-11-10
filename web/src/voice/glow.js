// A very faint warm glow on her while the pointer is over her and she can be clicked (click to talk): a small lift of
// her materials' own emissive colour, never a highlight outline. amount 0 restores each material exactly.
const WARM=Object.freeze([.07,.05,.03]);   // emissive added at full glow (linear RGB)
const base=new WeakMap();                  // each material's own emissive colour

/** @param {import('@pixiv/three-vrm').VRM} vrm @param {number} amount 0..1 */
export function setGlow(vrm,amount){
 const k=Math.min(1,Math.max(0,amount));
 vrm.scene.traverse(o=>{
  if(!o.isMesh)return;
  for(const m of [o.material].flat()){
   if(!m?.emissive?.isColor)continue;
   if(!base.has(m))base.set(m,m.emissive.clone());
   const b=base.get(m);m.emissive.setRGB(b.r+WARM[0]*k,b.g+WARM[1]*k,b.b+WARM[2]*k);
  }
 });
}
