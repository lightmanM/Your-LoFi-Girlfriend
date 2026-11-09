import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3,Euler,MathUtils} from 'three';
import {screenTilt,levelRoll,aimTurn} from '../src/balcony/head-aim.js';

// Her head at the origin, facing +Z (normalized VRM bones); the camera in front of her.
const head=new Vector3(0,0,0),eye=new Vector3(0,0,3);
const d=MathUtils.degToRad;
const rot=(yaw,pitch,roll)=>new Quaternion().setFromEuler(new Euler(d(pitch),d(yaw),d(roll),'YXZ'));
const near=(a,b,tol=.05)=>assert.ok(Math.abs(a-b)<=tol,`${a} is not within ${tol} of ${b}`);

test('a level head facing the camera looks level',()=>{
 near(screenTilt(new Quaternion(),head,eye),0);
});

test('rolling toward her right shoulder raises her left side on screen: positive tilt',()=>{
 near(screenTilt(rot(0,0,10),head,eye),10);
 near(screenTilt(rot(0,0,-12),head,eye),-12);
});

test('a head turned away keeps the sign of its tilt',()=>{
 assert.ok(screenTilt(rot(35,-8,15),head,eye)>8);
 assert.ok(screenTilt(rot(-35,-8,-15),head,eye)<-8);
});

test('seen from above, a roll looks a little smaller (foreshortened by the view angle)',()=>{
 const up=new Vector3(0,1.2,3),view=Math.atan2(1.2,3);
 near(screenTilt(rot(0,0,10),head,up),MathUtils.radToDeg(Math.atan(Math.tan(d(10))*Math.cos(view))),.05);
});

test('levelRoll leaves a head that already looks upright enough alone',()=>{
 const parent=new Quaternion(),local=rot(20,-6,0);
 assert.equal(levelRoll({parent,local,head,eye,start:2,max:6}),2);
});

test('levelRoll straightens a leaning head to the most tilt allowed, on the same side',()=>{
 const parent=rot(0,0,14),local=rot(30,-8,0);                 // the lean comes from above the head (neck, spine)
 const before=screenTilt(parent.clone().multiply(local),head,eye);
 assert.ok(before>10,`starts leaning (${before})`);
 const r=levelRoll({parent,local,head,eye,start:0,max:6});
 const after=parent.clone().multiply(local).multiply(rot(0,0,r));
 near(screenTilt(after,head,eye),6,.1);
 assert.ok(r<0,'rolls back against the lean');
});

test('levelRoll works the other way round, and from a nonzero start',()=>{
 const parent=rot(0,0,-20),local=rot(-25,-5,0);
 const r=levelRoll({parent,local,head,eye,start:3,max:5});
 near(screenTilt(parent.clone().multiply(local).multiply(rot(0,0,r)),head,eye),-5,.1);
});

test('levelRoll never rolls the head more than it can',()=>{
 const parent=rot(0,0,80),local=new Quaternion();
 const r=levelRoll({parent,local,head,eye,start:0,max:0,limit:25});
 assert.ok(Math.abs(r)<=25);
});

test('a camera at her head (no direction to look from) gives no tilt and leaves the roll alone, never NaN',()=>{
 assert.equal(screenTilt(rot(0,0,15),head,head.clone()),0);
 assert.equal(levelRoll({parent:rot(0,0,30),local:new Quaternion(),head,eye:head.clone(),start:2,max:5}),2);
});

test('aimTurn: a point straight ahead needs no turn; up and to her left gives +yaw and an upward (negative) pitch',()=>{
 const z=aimTurn(new Quaternion(),head,new Vector3(0,0,2));
 near(z.yaw,0);near(z.pitch,0);
 const t=aimTurn(new Quaternion(),head,new Vector3(1,1,1));
 near(t.yaw,45);near(t.pitch,-MathUtils.radToDeg(Math.atan2(1,Math.SQRT2)));
});

test('turning by aimTurn (yaw about her up axis, then pitch about her side axis) faces the point exactly',()=>{
 for(const [q,at] of [[rot(20,-15,12),new Vector3(.8,1.4,2.5)],[rot(-40,25,-20),new Vector3(-2,.3,.4)],[rot(5,60,0),new Vector3(0,-1,3)]]){
  const t=aimTurn(q,head,at);
  const turned=q.clone().multiply(rot(t.yaw,0,0)).multiply(rot(0,t.pitch,0));
  const left=aimTurn(turned,head,at);
  near(left.yaw,0,.01);near(left.pitch,0,.01);
 }
});
