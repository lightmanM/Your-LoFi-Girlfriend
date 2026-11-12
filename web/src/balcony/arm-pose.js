// Posing a free arm on a VRM's normalized bones, shared by the motions that take a hand off the book (the overhead
// stretch, the hair tuck): the elbow as a hinge, and the hand turned the way a choreography points it.
import {Quaternion,Vector3,Matrix4,MathUtils} from 'three';
import {rotateWorld} from './arm-ik.js';

export const worldPos=node=>node.getWorldPosition(new Vector3()),worldQuat=node=>node.getWorldQuaternion(new Quaternion());
/** Give a bone a world rotation (its children follow). */
export function setWorld(node,world){
 node.parent.updateWorldMatrix(true,false);
 node.quaternion.copy(worldQuat(node.parent).invert().multiply(world));node.updateWorldMatrix(false,true);
}

/**
 * Turn the upper and lower arm about their own length so the elbow is a hinge: it folds the forearm toward the front
 * of the upper arm (as in the T-pose, where the hand comes forward), whatever way the arm points. The joints stay put.
 * @param {number} sign 1 for her left arm, -1 for her right @param {Vector3} elbow the way the elbow points (world)
 */
export function hingeRoll(upper,lower,hand,sign,elbow){
 const S=worldPos(upper),E=worldPos(lower),W=worldPos(hand),u=E.clone().sub(S).normalize(),v=W.clone().sub(E).normalize();
 const fold=v.clone().addScaledVector(u,-v.dot(u));
 if(fold.lengthSq()<1e-8)fold.copy(elbow).negate().addScaledVector(u,elbow.dot(u));   // a straight arm: away from the elbow's side
 if(fold.lengthSq()<1e-8)return;
 fold.normalize();
 const basis=(along,front)=>{const x=along.clone().multiplyScalar(sign),z=front.clone().addScaledVector(x,-front.dot(x)).normalize(),y=new Vector3().crossVectors(z,x);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));};
 setWorld(upper,basis(u,fold));
 const hinge=new Vector3().crossVectors(fold,u.clone().multiplyScalar(sign)).normalize();     // the upper arm's own up: the elbow's axis
 setWorld(lower,basis(v,new Vector3().crossVectors(v.clone().multiplyScalar(sign),hinge)));
}

/**
 * Turn the hand so its fingers point along `fingers` and its back faces `back` (world directions). The forearm takes
 * the hand's roll, as far as a forearm turns (`forearmRoll` degrees); the wrist bends for the rest.
 */
export function orientHand(lower,hand,sign,fingers,back,forearmRoll){
 const f=fingers.clone().normalize(),b=back.clone();b.addScaledVector(f,-b.dot(f)).normalize();
 const palm=new Vector3().crossVectors(f,b);
 const want=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(f.clone().multiplyScalar(sign),b,palm.multiplyScalar(sign)));
 const axis=worldPos(hand).sub(worldPos(lower)).normalize(),rel=want.clone().multiply(worldQuat(lower).invert());
 const along=axis.x*rel.x+axis.y*rel.y+axis.z*rel.z,most=MathUtils.degToRad(forearmRoll);
 let twist=2*Math.atan2(along,rel.w);if(twist>Math.PI)twist-=2*Math.PI;if(twist<-Math.PI)twist+=2*Math.PI;
 rotateWorld(lower,new Quaternion().setFromAxisAngle(axis,MathUtils.clamp(twist,-most,most)));
 setWorld(hand,want);
}
