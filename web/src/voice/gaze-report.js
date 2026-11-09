// For checks: how she looks at a point (the camera). lean: how tilted her head looks from there (degrees, + toward her
// right shoulder). aim.face: where the point is from her face (head frame: yaw + to her left, pitch + up); aim.eyes:
// what her eyes were asked to do and could do (VRM eyes turn only a mapped share of the asked angle).
import * as THREE from 'three';
import {screenTilt} from '../balcony/head-aim.js';

const q=new THREE.Quaternion(),p=new THREE.Vector3(),D=THREE.MathUtils.RAD2DEG;
const r=x=>+x.toFixed(1);
const map=(x,pos,neg)=>x>=0?pos.map(x):-neg.map(-x);

/** @returns {{lean:number|null,aim:{face:{yaw:number,pitch:number},eyes:object|null}|null}} */
export function gazeReport(vrm,target){
 const h=vrm.humanoid.getNormalizedBoneNode('head');
 if(!h)return {lean:null,aim:null};
 const lean=r(screenTilt(h.getWorldQuaternion(q),h.getWorldPosition(p),target));
 const d=target.clone().sub(h.getWorldPosition(p)).applyQuaternion(h.getWorldQuaternion(q).invert());
 const la=vrm.lookAt,a=la?.applier;
 const eyes=la?{asked:{yaw:r(la.yaw),pitch:r(la.pitch)},turned:a?.rangeMapVerticalUp?{yaw:r(map(la.yaw,a.rangeMapHorizontalOuter,a.rangeMapHorizontalInner)),
  pitch:r(map(la.pitch,a.rangeMapVerticalUp,a.rangeMapVerticalDown))}:null,type:a?.constructor?.name}:null;
 return {lean,aim:{face:{yaw:r(Math.atan2(d.x,d.z)*D),pitch:r(Math.atan2(d.y,Math.hypot(d.x,d.z))*D)},eyes}};
}
