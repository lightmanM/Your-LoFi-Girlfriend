import {Quaternion,Euler,Vector3,MathUtils} from 'three';
const YAW=2.5*Math.PI/180,PITCH=1.5*Math.PI/180;

// Fixed eye position. Only a bounded pointing offset can change at runtime.
export class FixedCamera {
 constructor(camera){this.camera=camera;this.base=new Quaternion();this.offset=new Quaternion();this.euler=new Euler(0,0,0,'YXZ');this.yaw=0;this.pitch=0;this.targetYaw=0;this.targetPitch=0;}
 frame(mobile){
  this.camera.position.set(mobile?.30:.85,mobile?1.42:1.42,mobile?2.9:2.45);
  this.camera.lookAt(new Vector3(-.35,.86,-.55));this.base.copy(this.camera.quaternion);
  this.yaw=this.pitch=this.targetYaw=this.targetPitch=0;
 }
 look(x,y){this.targetYaw=MathUtils.clamp(x,-1,1)*YAW;this.targetPitch=MathUtils.clamp(y,-1,1)*PITCH;}
 reset(){this.targetYaw=this.targetPitch=0;}
 update(dt){
  const a=1-Math.exp(-Math.max(0,dt)*7);
  this.yaw=MathUtils.lerp(this.yaw,this.targetYaw,a);this.pitch=MathUtils.lerp(this.pitch,this.targetPitch,a);
  this.offset.setFromEuler(this.euler.set(this.pitch,this.yaw,0));this.camera.quaternion.copy(this.base).multiply(this.offset);
 }
 snapshot(){return {position:this.camera.position.toArray(),quaternion:this.camera.quaternion.toArray(),yaw:this.yaw,pitch:this.pitch,maxYaw:YAW,maxPitch:PITCH,mode:'fixed-position'};}
}
export function bindCameraLook(element,rig){
 let drag=null;
 element.style.touchAction='pan-y';
 const down=e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};element.setPointerCapture(e.pointerId);};
 const move=e=>{if(!drag||drag.id!==e.pointerId)return;rig.look(-(e.clientX-drag.x)/160,-(e.clientY-drag.y)/140);};
 const up=e=>{if(!drag||drag.id!==e.pointerId)return;drag=null;rig.reset();};
 element.addEventListener('pointerdown',down);element.addEventListener('pointermove',move);element.addEventListener('pointerup',up);element.addEventListener('pointercancel',up);
 return ()=>{element.removeEventListener('pointerdown',down);element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',up);element.removeEventListener('pointercancel',up);};
}
