import * as THREE from 'three';
import {inspectCharacter, expressionValue} from './character-contract.js';

// Scene scripts use these semantic controls, never the asset's J_Bip/J_Adj names.
// Pose changes here are diagnostics. Production actions will use licensed motion clips.
export class CharacterAdapter {
  constructor(vrm) {
    this.vrm = vrm;
    this.report = inspectCharacter(vrm);
    this.time = 0;
    this.pose = 'relaxed';
    this.smile = 0;
    this.smileCurrent = 0;
    this.mouth = 0;
    this.blinkElapsed = Infinity;
    this.autoBlink = true;
    this.nextBlink = 3.4;
    this.paused = false;
    this.lookAtViewer = false;
    this.target = new THREE.Object3D();
    if (vrm.lookAt) vrm.lookAt.target = this.target;
    this.rest = new Map();
    for (const name of ['spine','neck','head','leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftHand','rightHand']) {
      const node = vrm.humanoid.getNormalizedBoneNode(name);
      if (node) this.rest.set(name, node.quaternion.clone());
    }
    this.euler = new THREE.Euler();
    this.rotation = new THREE.Quaternion();
    this.destination = new THREE.Quaternion();
    // VRM 0 and VRM 1 can have opposite rest-space X directions. Derive this
    // from the imported rig rather than baking one version's arm signs in.
    this.armSide = Object.fromEntries(['left','right'].map(side => [side,
      Math.sign(vrm.humanoid.getNormalizedBoneNode(`${side}LowerArm`).position.x) || (side==='left'?1:-1),
    ]));
  }

  setPose(name) {
    if (!['relaxed','tpose','reach'].includes(name)) throw new Error(`Unsupported pose: ${name}`);
    this.pose = name;
  }
  setSmile(value) {this.smile = expressionValue(value);}
  setMouth(value) {this.mouth = expressionValue(value);}
  blink() {this.blinkElapsed = 0;}

  rotate(name, x, y, z, alpha) {
    const node = this.vrm.humanoid.getNormalizedBoneNode(name);
    const rest = this.rest.get(name);
    if (!node || !rest) return;
    this.rotation.setFromEuler(this.euler.set(x,y,z));
    this.destination.copy(rest).multiply(this.rotation);
    node.quaternion.slerp(this.destination, alpha);
  }

  update(dt, camera, reducedMotion = false) {
    const delta = Math.min(dt, .05);
    if (!this.paused) this.time += delta;
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-delta * 10);
    const arm = this.pose === 'tpose' ? 0 : 1.22;
    this.rotate('leftUpperArm',0,0,-this.armSide.left*arm,alpha);
    this.rotate('rightUpperArm',this.pose === 'reach' ? .9*this.armSide.right : 0,0,
      -this.armSide.right*(this.pose === 'reach' ? .48 : arm),alpha);
    this.rotate('rightLowerArm',0,this.pose === 'reach' ? -.4 : 0,0,alpha);
    this.rotate('leftLowerArm',0,0,0,alpha);
    this.rotate('spine', !this.paused && !reducedMotion ? Math.sin(this.time*1.6)*.008 : 0,0,0,alpha);
    if (!this.paused && !reducedMotion && this.autoBlink && this.time >= this.nextBlink) {
      this.blink(); this.nextBlink = this.time + 3.8;
    }
    this.blinkElapsed += delta;
    const blink = this.blinkElapsed < .22 ? Math.sin(Math.PI*this.blinkElapsed/.22) : 0;
    this.smileCurrent = THREE.MathUtils.lerp(this.smileCurrent, this.smile, alpha);
    const expressions = this.vrm.expressionManager;
    if (this.report.capabilities.blink) expressions.setValue('blink',blink);
    if (this.report.capabilities.smile) expressions.setValue('happy',this.smileCurrent);
    if (this.report.capabilities.mouth) expressions.setValue('aa',this.mouth);
    if (this.vrm.lookAt) {
      if (this.lookAtViewer) this.target.position.copy(camera.position);
      else {this.target.position.set(0,1.4,10);}
    }
    this.vrm.update(delta);
  }

  snapshot() {
    return {pose:this.pose, smile:this.smile, smileCurrent:this.smileCurrent, mouth:this.mouth,
      capabilities:this.report.capabilities, requiredBoneCount:this.report.requiredBones.length};
  }
}
