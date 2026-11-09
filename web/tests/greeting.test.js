import test from 'node:test';
import assert from 'node:assert/strict';
import {greetPlan,greetFace,GREET} from '../src/voice/greeting-plan.js';
import {settle} from '../src/balcony/look-ease.js';

const LINE={duration:1.2};
const plan=greetPlan(LINE);

test('greeting: she looks up, then speaks once her eyes have arrived, then lingers',()=>{
 assert.equal(plan.look,GREET.notice);
 // the turn settles softly (look-ease.js): its last few percent are an imperceptible creep, so "arrived" is 95% there
 assert.ok(settle((plan.speak-plan.look)/GREET.ease)>=.95,'speaks once her head has (all but) come up');
 assert.equal(+(plan.speakEnd-plan.speak).toFixed(6),LINE.duration);
 assert.ok(plan.release>plan.speakEnd);
 assert.equal(+(plan.end-plan.release).toFixed(6),GREET.ease);
});
test('greeting: the look-up hold covers the whole time between easing up and easing back down',()=>{
 assert.equal(+(plan.look+GREET.ease+plan.hold).toFixed(6),+plan.release.toFixed(6));
});
test('greeting: the smile starts before she speaks and is gone once she is back in her book',()=>{
 assert.equal(greetFace(plan,0).smile,0);
 assert.equal(greetFace(plan,plan.speak-GREET.smile.lead-.01).smile,0);
 assert.ok(greetFace(plan,plan.speak).smile>0,'smiling as she starts');
 assert.equal(greetFace(plan,plan.speakEnd+.3).smile,1,'fully smiling just after');
 assert.equal(greetFace(plan,plan.end+GREET.smile.fall).smile,0);
});
test('greeting: a small nod toward the end of the line, and nothing outside it',()=>{
 assert.equal(greetFace(plan,plan.speak).nod,0);
 assert.equal(greetFace(plan,plan.release).nod,0);
 let peak=0;for(let t=plan.speak;t<plan.release;t+=.01)peak=Math.max(peak,greetFace(plan,t).nod);
 assert.ok(peak>GREET.nod*.9&&peak<=GREET.nod+1e-9);
});
test('greeting: the subtitle shows from just before the first sound until she looks back down',()=>{
 assert.equal(greetFace(plan,plan.speak-.2).subtitle,false);
 assert.equal(greetFace(plan,plan.speak).subtitle,true);
 assert.equal(greetFace(plan,plan.speakEnd+1).subtitle,true);
 assert.equal(greetFace(plan,plan.release+.1).subtitle,false);
});
test('greeting: the plan can start later than the default',()=>{
 const later=greetPlan(LINE,{notice:5});
 assert.equal(later.look,5);assert.equal(+(later.speak-later.look).toFixed(6),+(plan.speak-plan.look).toFixed(6));
});
