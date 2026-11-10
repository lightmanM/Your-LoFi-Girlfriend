// Is she under the pointer? A ray from the camera through the pointer against a cheap stand-in for her: capsules along
// her bones (head, neck, body, arms, hands, legs) and the box of the book she holds (click to talk). She is in her quiet
// reading pose whenever she can be clicked, so the stand-in fits her; a ray against her skinned meshes (65k triangles,
// skinned on the CPU) cost ~28 ms and made the page stutter as the pointer moved (final review).
import {Raycaster,Vector2,Vector3} from 'three';

// [from bone, to bone (or null: a short capsule up from `from`), radius in metres at her own size]
export const BODY=Object.freeze([
 ['hips','spine',.14],['spine','chest',.13],['chest','neck',.13],['neck','head',.06],['head',null,.1],
 ['leftUpperArm','leftLowerArm',.055],['leftLowerArm','leftHand',.045],['leftHand',null,.06],
 ['rightUpperArm','rightLowerArm',.055],['rightLowerArm','rightHand',.045],['rightHand',null,.06],
 ['leftUpperLeg','leftLowerLeg',.085],['leftLowerLeg','leftFoot',.06],
 ['rightUpperLeg','rightLowerLeg',.085],['rightLowerLeg','rightFoot',.06],
].map(Object.freeze));
const UP=.16;   // m (at her size) a capsule without an end bone reaches upward: the head's crown, the hand's fingers

/**
 * Capsules along her bones, in world space, sized with her.
 * @param {{scene:import('three').Object3D,humanoid:{getRawBoneNode:(n:string)=>import('three').Object3D|null}}} vrm
 * @returns {{a:Vector3,b:Vector3,r:number}[]}
 */
export function herCapsules(vrm){
 const k=vrm.scene.getWorldScale(new Vector3()).x,at=n=>vrm.humanoid.getRawBoneNode(n)?.getWorldPosition(new Vector3())??null;
 const out=[];
 for(const [from,to,r] of BODY){
  const a=at(from);if(!a)continue;
  const b=to?at(to):a.clone().add(new Vector3(0,UP*k,0));if(!b)continue;
  out.push({a,b,r:r*k});
 }
 return out;
}

/** @param {{dom:HTMLElement,camera:import('three').Camera,capsules:()=>{a:Vector3,b:Vector3,r:number}[],boxes:()=>import('three').Box3[]}} o */
export function createReach({dom,camera,capsules,boxes}){
 const ray=new Raycaster(),ndc=new Vector2();
 return {
  /** @returns {boolean} whether the point (client px) is on her or her book */
  hit(clientX,clientY){
   const r=dom.getBoundingClientRect();if(!r.width||!r.height)return false;
   ndc.set((clientX-r.left)/r.width*2-1,-((clientY-r.top)/r.height)*2+1);
   ray.setFromCamera(ndc,camera);
   for(const c of capsules())if(ray.ray.distanceSqToSegment(c.a,c.b)<=c.r*c.r)return true;
   for(const b of boxes())if(b&&ray.ray.intersectsBox(b))return true;
   return false;
  },
 };
}
