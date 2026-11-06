import {Quaternion,Vector3,MathUtils} from 'three';

// Procedural "life" layer: deterministic, time-based, no randomness. Sums of
// incommensurate sines give drift that never visibly repeats. Everything here
// is small: it is meant to sit under authored clips, not replace them.
const TAU=Math.PI*2;
const deg=MathUtils.DEG2RAD;
const drift=(t,a,b,c)=>(Math.sin(t*TAU/a)+.6*Math.sin(t*TAU/b+1.3)+.35*Math.sin(t*TAU/c+2.1))/1.95;

export const LIFE_DEFAULTS={breathPeriod:4.6,breathDepth:1,swayDepth:1,headDepth:1,gazeDepth:1};

export function lifeSignals(time,options={}){
 const o={...LIFE_DEFAULTS,...options};
 const breathPhase=(time/o.breathPeriod)%1;
 // Inhale is quicker than the exhale: asymmetric ease.
 const breath=breathPhase<.42?Math.sin(breathPhase/.42*Math.PI/2):Math.cos((breathPhase-.42)/.58*Math.PI/2);
 return {
  breath:breath*o.breathDepth,                        // 0..1, chest rise
  swayRoll:drift(time,23,37,61)*o.swayDepth,           // -1..1, slow weight shift
  swayYaw:drift(time+9,31,47,73)*o.swayDepth,
  headYaw:drift(time+3,11,17,29)*o.headDepth,          // -1..1, idle looking
  headPitch:drift(time+5,13,19,31)*o.headDepth,
  headRoll:drift(time+7,17,23,41)*o.headDepth,
  gazeX:drift(time+2,5,8.5,13)*o.gazeDepth,            // -1..1, eye wander
  gazeY:drift(time+4,6,9.5,15)*o.gazeDepth,
 };
}

// Angles in degrees that the signals map to. Small on purpose.
export const LIFE_RANGE={breathSpinePitch:-.9,breathChestPitch:1.6,breathShoulderLift:.7,swayRoll:1.1,swayYaw:1.4,headYaw:5,headPitch:2.5,headRoll:1.6,gazeX:.11,gazeY:.06};

const q=new Quaternion(),axisX=new Vector3(1,0,0),axisY=new Vector3(0,1,0),axisZ=new Vector3(0,0,1);
function turn(node,axis,degrees){if(!node||!degrees)return;node.quaternion.multiply(q.setFromAxisAngle(axis,degrees*deg));}

// Multiplies small offsets onto normalized VRM bones. Call after the base pose
// is set each frame; nothing accumulates because the pose is re-applied first.
export function applyLife(vrm,s,amount=1){
 if(amount<=0)return;
 const bone=n=>vrm.humanoid.getNormalizedBoneNode(n);
 const r=LIFE_RANGE,a=amount;
 turn(bone('hips'),axisZ,s.swayRoll*r.swayRoll*a);turn(bone('hips'),axisY,s.swayYaw*r.swayYaw*a);
 turn(bone('spine'),axisX,s.breath*r.breathSpinePitch*a);turn(bone('spine'),axisZ,-s.swayRoll*r.swayRoll*.6*a);
 turn(bone('chest'),axisX,s.breath*r.breathChestPitch*a);
 for(const side of ['left','right'])turn(bone(side+'Shoulder'),axisZ,(side==='left'?-1:1)*s.breath*r.breathShoulderLift*a);
 turn(bone('neck'),axisY,s.headYaw*r.headYaw*.35*a);turn(bone('neck'),axisX,-s.breath*r.breathChestPitch*.5*a);
 const head=bone('head');turn(head,axisY,s.headYaw*r.headYaw*.65*a);turn(head,axisX,s.headPitch*r.headPitch*a);turn(head,axisZ,s.headRoll*r.headRoll*a);
}

// Gaze: a point the eyes track, wandering around a focus with occasional glances
// elsewhere. Returns the target position for vrm.lookAt in world space.
export function gazePoint(time,s,{focus,glance,glanceEvery=13,glanceHold=2.2,out=new Vector3()}){
 const cycle=((time/glanceEvery)%1)*glanceEvery;
 const away=glance?MathUtils.smoothstep(cycle,glanceEvery-glanceHold-.6,glanceEvery-glanceHold)*(1-MathUtils.smoothstep(cycle,glanceEvery-.6,glanceEvery)):0;
 out.copy(focus);if(glance)out.lerp(glance,away);
 out.x+=s.gazeX*LIFE_RANGE.gazeX*(1-away);out.y+=s.gazeY*LIFE_RANGE.gazeY*(1-away);
 return out;
}
