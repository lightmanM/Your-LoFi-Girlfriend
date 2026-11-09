// Aiming her face at a point (the camera) when she looks at you: aimTurn() is the head turn that faces it exactly
// (her eyes cannot make up the difference: the model turns them by only a tenth of what they are asked), and
// screenTilt()/levelRoll() keep her head from looking tilted from there (her reading pose leans it toward the book).
// Normalized VRM bones: +X is her left, +Y up, +Z the way she faces. Angles in degrees. Pure functions.
import {Quaternion,Vector3,MathUtils} from 'three';

const UP=new Vector3(0,1,0),X=new Vector3(1,0,0),Z=new Vector3(0,0,1);
export const TILT=Object.freeze({limit:25,iterations:4,tolerance:.02});   // limit: most roll levelRoll will add

/**
 * The turn, in the head's own frame, that faces a point: yaw about her up axis (+ to her left), then pitch about her
 * side axis (negative looks up), as ReadingMotion turns bones. Turning by both, in that order, faces `at` exactly.
 * @param {Quaternion} q head world rotation @param {Vector3} head head world position @param {Vector3} at
 * @returns {{yaw:number,pitch:number}} degrees
 */
export function aimTurn(q,head,at){
 const d=at.clone().sub(head).applyQuaternion(q.clone().invert());
 return {yaw:MathUtils.radToDeg(Math.atan2(d.x,d.z)),pitch:-MathUtils.radToDeg(Math.atan2(d.y,Math.hypot(d.x,d.z)))};
}

/**
 * The tilt of her head seen from `eye`: 0 when her ears look level; positive when her left side (on your right) is
 * higher, i.e. her head leans toward her right shoulder.
 * @param {Quaternion} q head world rotation @param {Vector3} head head world position @param {Vector3} eye
 * @returns {number} degrees
 */
export function screenTilt(q,head,eye){
 const ahead=head.clone().sub(eye).normalize();               // looking from the eye at her head
 const right=new Vector3().crossVectors(ahead,UP);
 if(right.lengthSq()<1e-8)return 0;                          // straight above or below her: no screen horizontal
 right.normalize();
 const up=new Vector3().crossVectors(right,ahead),ears=X.clone().applyQuaternion(q);
 return MathUtils.radToDeg(Math.atan2(ears.dot(up),ears.dot(right)));
}

/**
 * The roll about her head's own forward axis (applied last, after `local`) that keeps her head from looking tilted
 * by more than `max` degrees from `eye`. A head already within `max` keeps its `start` roll; one beyond it is rolled
 * back to `max` on the side it leans, never by more than `limit` from `start`.
 * @param {{parent:Quaternion,local:Quaternion,head:Vector3,eye:Vector3,start?:number,max:number,limit?:number}} o
 *  parent: the head's parent world rotation; local: the head's local rotation before the roll
 * @returns {number} roll in degrees
 */
export function levelRoll({parent,local,head,eye,start=0,max,limit=TILT.limit}){
 const base=parent.clone().multiply(local),q=new Quaternion(),spin=new Quaternion();
 const tilt=r=>screenTilt(q.copy(base).multiply(spin.setFromAxisAngle(Z,MathUtils.degToRad(r))),head,eye);
 const now=tilt(start);
 if(Math.abs(now)<=max)return start;
 const want=Math.sign(now)*max,miss=r=>tilt(r)-want;
 // secant steps: rolling about her forward axis moves the on-screen tilt about one for one when she faces you
 let a=start,fa=now-want,b=start-fa,fb=miss(b);
 for(let i=0;i<TILT.iterations&&Math.abs(fb)>TILT.tolerance&&fb!==fa;i++){const c=b-fb*(b-a)/(fb-fa);a=b;fa=fb;b=c;fb=miss(b);}
 return MathUtils.clamp(b,start-limit,start+limit);
}
