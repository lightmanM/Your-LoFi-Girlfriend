// Body mechanics layered on an arm-driven clip, on normalized VRM bones:
// - shoulderRhythm: the shoulder (clavicle) lifts and comes forward as the arm rises, as the shoulder blade does
//   in a real body (about one part shoulder to two parts arm above 30 degrees); the arm keeps the clip's direction.
// - torsoFollow: the chest and spine turn toward where the hands go, the hands stay where the clip put them (the
//   arms counter-turn), and the wrists are kept in front of the torso so the forearms do not pass into the body.
import {Quaternion,Vector3,MathUtils} from 'three';
import {reachArm} from './arm-ik.js';

const deg=MathUtils.DEG2RAD;
const V=()=>new Vector3(),Q=()=>new Quaternion();
const pos=(vrm,n,out=V())=>vrm.humanoid.getNormalizedBoneNode(n).getWorldPosition(out);

export const COUPLING={
 rhythm:{start:30,ratio:.3,maxLift:32,maxForward:14},
 // front: chest surface measured by ray casts at 0.11 to 0.12 m in front of the spine bones, plus a forearm radius
 torso:{yawPerMetre:70,maxYaw:22,spineShare:.4,surface:.118,forearm:.037,side:.11},   // side: half the torso width
};

function rotateWorld(node,delta){
 const qw=Q(),qp=Q();node.updateWorldMatrix(true,false);node.getWorldQuaternion(qw);node.parent.getWorldQuaternion(qp);
 node.quaternion.copy(qp.invert().multiply(delta.multiply(qw)));node.updateWorldMatrix(false,true);
}
function setWorldRotation(node,q){
 const qp=Q();node.parent.updateWorldMatrix(true,false);node.parent.getWorldQuaternion(qp);
 node.quaternion.copy(qp.invert().multiply(q));node.updateWorldMatrix(false,true);
}
/** The torso's own axes in world space: up (hips to neck), right (her left shoulder to her right), forward. */
export function torsoFrame(vrm){
 const up=pos(vrm,'neck').sub(pos(vrm,'hips')).normalize();
 const right=pos(vrm,'rightUpperArm').sub(pos(vrm,'leftUpperArm'));right.addScaledVector(up,-right.dot(up)).normalize();
 return {up,right,forward:V().crossVectors(up,right).normalize()};
}

/** base: {left,right} shoulder local rotations without the clip; w: how much the clip owns the body */
export function shoulderRhythm(vrm,base,w){
 if(w<=0)return;
 const R=COUPLING.rhythm,f=torsoFrame(vrm);
 for(const side of ['left','right']){
  const h=vrm.humanoid,sh=h.getNormalizedBoneNode(side+'Shoulder'),ua=h.getNormalizedBoneNode(side+'UpperArm');
  ua.updateWorldMatrix(true,false);const armRot=ua.getWorldQuaternion(Q());
  const dir=pos(vrm,side+'LowerArm').sub(pos(vrm,side+'UpperArm')).normalize();
  const elev=Math.acos(MathUtils.clamp(-dir.dot(f.up),-1,1))/deg;                 // 0 hanging, 180 straight up
  const lift=Math.min(R.maxLift,Math.max(0,elev-R.start)*R.ratio);
  const fwd=Math.min(R.maxForward,Math.max(0,dir.dot(f.forward))*R.maxForward*MathUtils.smoothstep(elev,30,120));
  const clipLocal=sh.quaternion.clone();sh.quaternion.copy(base[side]);sh.updateWorldMatrix(true,false);
  const tip=V().subVectors(pos(vrm,side+'UpperArm'),pos(vrm,side+'Shoulder')).normalize();
  const upAxis=V().crossVectors(tip,f.up).normalize(),fwAxis=V().crossVectors(tip,f.forward).normalize();
  rotateWorld(sh,Q().setFromAxisAngle(upAxis,lift*deg).multiply(Q().setFromAxisAngle(fwAxis,fwd*deg)));
  const want=sh.quaternion.clone();sh.quaternion.copy(clipLocal).slerp(want,w);sh.updateWorldMatrix(false,true);
  setWorldRotation(ua,armRot);                                                     // arm keeps the clip's direction
 }
}

/** Turn the torso toward the hands and keep the wrists in front of it. arms: how much the clip owns each arm. */
export function torsoFollow(vrm,w,arms={left:1,right:1}){
 if(w<=0)return;
 const T=COUPLING.torso,h=vrm.humanoid,f=torsoFrame(vrm),chest=pos(vrm,'chest');
 const hands=['left','right'].map(s=>({s,p:pos(vrm,s+'Hand'),q:h.getNormalizedBoneNode(s+'Hand').getWorldQuaternion(Q())}));
 const mid=hands[0].p.clone().add(hands[1].p).multiplyScalar(.5);
 const lateral=mid.clone().sub(chest).dot(f.right);
 const yaw=MathUtils.clamp(-lateral*T.yawPerMetre,-T.maxYaw,T.maxYaw)*w;         // turn toward the side the hands are on
 for(const [bone,share] of [['spine',T.spineShare],['chest',1-T.spineShare]])rotateWorld(h.getNormalizedBoneNode(bone),Q().setFromAxisAngle(f.up,yaw*share*deg));
 const front=T.surface+T.forearm;
 for(const k of hands){
  const hand=h.getNormalizedBoneNode(k.s+'Hand'),aw=w*arms[k.s];if(aw<=0)continue;
  reachArm(vrm,k.s,k.p,aw);
  // push the wrist out to the front until no point of the forearm is inside the torso (two passes)
  for(let pass=0;pass<2;pass++){
   const d=forearmDepth(vrm,k.s,front);if(d.depth<=.002)break;
   k.p.addScaledVector(d.forward,d.depth*1.1);reachArm(vrm,k.s,k.p,aw);
  }
  setWorldRotation(hand,hand.getWorldQuaternion(Q()).slerp(k.q,aw));
 }
 return yaw;
}

/** How far one forearm reaches inside the torso's front (m), with the torso's forward axis. */
function forearmDepth(vrm,side,front){
 // chest height only (spine bone to neck): that is where the surface was measured; below it the forearm can rest on the lap
 const T=COUPLING.torso,g=torsoFrame(vrm),c=pos(vrm,'chest'),hips=pos(vrm,'hips'),top=pos(vrm,'neck').sub(hips).dot(g.up),low=pos(vrm,'spine').sub(hips).dot(g.up);
 const e=pos(vrm,side+'LowerArm'),wr=pos(vrm,side+'Hand');let depth=0;
 for(let i=0;i<=8;i++){
  const p=e.clone().lerp(wr,i/8),rel=p.clone().sub(c),hgt=p.clone().sub(hips).dot(g.up);
  if(hgt<low||hgt>top||Math.abs(rel.dot(g.right))>T.side)continue;
  depth=Math.max(depth,front-rel.dot(g.forward));
 }
 return {depth:Math.max(0,depth),forward:g.forward};
}
/** Deepest point of either forearm inside the torso (m): into the chest surface plus a forearm radius. */
export function armInTorso(vrm){
 const T=COUPLING.torso,f=T.surface+T.forearm;
 return Math.max(forearmDepth(vrm,'left',f).depth,forearmDepth(vrm,'right',f).depth);
}
