// Reading motion for a seated character holding an open book, layered on a static reading pose.
// Eyes step along real text lines (fixations and quick saccades), sweep back to the next line, work down the
// page and across to the facing page; the head follows the eyes with a lag; breathing is visible; occasional
// events (posture settles, looking up from the book) are scheduled by a seeded random generator, so a long
// session never repeats visibly. Everything is an offset on normalized VRM bones after the pose is applied.
import {Quaternion,Vector3,Matrix4,MathUtils} from 'three';
import {PageTurn} from './page-turn.js';
import {levelRoll,aimTurn} from './head-aim.js';
import {widenEyes} from './eye-range.js';
import {lookWeight} from './look-ease.js';

const deg=MathUtils.DEG2RAD;
const axisX=new Vector3(1,0,0),axisY=new Vector3(0,1,0),axisZ=new Vector3(0,0,1);
const q=new Quaternion();
const turn=(node,axis,degrees)=>{if(node&&degrees)node.quaternion.multiply(q.setFromAxisAngle(axis,degrees*deg));};

// Text block on each page, in the book's own frame (metres): see web/public/environment/balcony-plate/book.glb.
export const READING={
 text:{inner:.024,outer:.129,top:.0445,bottom:-.0856,surface:.036},
 lines:22, lineSeconds:[3.2,4.6], fixations:[6,9], fixationSeconds:[.2,.34], regressionChance:.12,
 saccadeSeconds:.05, returnSeconds:.22, pagePause:[1.2,2.2],
 head:{followYaw:6.5, pageYaw:4.5, pagePitch:6.5, lineNod:1.6, lag:.55},
 blinkReading:[4.5,8.5], blinkAway:[2.2,4.2],
 lookUp:{every:[55,120], hold:[2.2,4.5], ease:.7, headPitch:-8, headYaw:7, neckShare:.35},
 settle:{every:[35,80], ease:2.4, hipsRoll:1.6, hipsYaw:1.4, spinePitch:1.2, headRoll:3},
 aim:{yaw:30, pitch:20},   // most the head turns on its own to face a point exactly (degrees), after the neck/head split
 // page turn, in fractions of its length: reach for the corner, carry it over, let go, settle
 turn:{seconds:2.6, reach:.22, start:.14, carry:.40, letGo:.26, land:.80, cornerV:-.34},   // hand lifts the page part way, then it falls over
 // legs: slow drift plus an occasional shift of the feet; degrees on normalized bones
 legs:{every:[18,45], ease:1.6, kneeSpread:5, kneeFlex:5.5, ankle:9, drift:2.2},
};

function mulberry32(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
// Critically damped follow: moves value toward target with a time constant, frame-rate independent.
const follow=(v,target,lag,dt)=>v+(target-v)*(1-Math.exp(-dt/Math.max(lag,1e-3)));

export class ReadingMotion{
 constructor(vrm,bookRoot,{seed=7,eventScale=1}={}){
  this.vrm=vrm;this.book=bookRoot;this.rand=mulberry32(seed);this.eventScale=eventScale;
  this.time=0;this.gaze=new Vector3();this.gazeLocal=new Vector3();this.away=0;
  this.head={yaw:0,pitch:0,roll:0};this.readHead={yaw:0,pitch:0};this.settle={hipsRoll:0,hipsYaw:0,spinePitch:0,headRoll:0};this.settleTarget={...this.settle};
  this.nextBlink=2;this.blinkStart=-1;this.events={lookUp:this.after(R().lookUp.every),settle:this.after(R().settle.every)};
  this.lookUp=null;this.tiltTmp={p:new Vector3(),q:new Quaternion()};this.figurePages();
  this.leaf=new PageTurn(bookRoot,-this.firstSign);this.turn=null;this.turnInfo={progress:0,hand:0,target:new Vector3()};
  this.legs={spread:0,flexL:0,flexR:0,ankleL:0,ankleR:0};this.legsTarget={...this.legs};this.events.legs=this.after(READING.legs.every);
  this.linesPerPage=READING.lines;this.startPage(0);
 }
 range([a,b]){return a+(b-a)*this.rand();}
 after(span){return this.time+this.range(span)*this.eventScale;}
 // Which page is on her left, and which end of a page is the top, read from where the book sits in the world.
 figurePages(){
  const t=READING.text,b=this.book;b.updateWorldMatrix(true,false);
  const w=p=>p.clone().applyMatrix4(b.matrixWorld);
  const left=this.vrm.humanoid.getRawBoneNode('leftHand').getWorldPosition(new Vector3());
  const a=w(new Vector3(-.08,t.surface,0)),c=w(new Vector3(.08,t.surface,0));
  this.firstSign=a.distanceTo(left)<c.distanceTo(left)?-1:1;           // read the page nearer her left hand first
  const up=w(new Vector3(0,t.surface,t.top)).y>w(new Vector3(0,t.surface,t.bottom)).y;
  this.topZ=up?t.top:t.bottom;this.bottomZ=up?t.bottom:t.top;
 }
 startPage(page){this.page=page;this.line=0;this.startLine();}
 startLine(){
  const R0=READING,n=Math.round(this.range(R0.fixations)),d=this.range(R0.lineSeconds),fx=[];
  for(let i=0;i<n;i++){
   let u=(i+.3+this.rand()*.4)/n;
   if(i>1&&this.rand()<R0.regressionChance)u=fx[fx.length-1].u-.12;          // a short look back
   fx.push({u:Math.min(1,Math.max(0,u)),t:0});
  }
  let t=R0.returnSeconds;const per=d/n;
  for(const f of fx){f.t=t;t+=per*this.range([.75,1.25]);}
  this.fix=fx;this.lineStart=this.time;this.lineEnd=this.lineStart+t;
 }
 // Point on the page for (u along the line 0..1, v down the page 0..1), in the book's frame.
 pagePoint(u,v,out){
  const t=READING.text,s=this.page===0?this.firstSign:-this.firstSign;
  // always left to right as she sees it: the left page from its outer edge to the spine, the right page from the spine out
  const inner=t.inner*s,outer=t.outer*s,x=this.page===0?outer+(inner-outer)*u:inner+(outer-inner)*u;
  return out.set(x,t.surface,this.topZ+(this.bottomZ-this.topZ)*v);
 }
 readingTarget(){
  const R0=READING,lt=this.time-this.lineStart,v=(this.line+.5)/this.linesPerPage;
  let i=0;while(i<this.fix.length-1&&this.fix[i+1].t<=lt)i++;
  const cur=this.fix[i],prev=i>0?this.fix[i-1]:{u:0,t:0};
  const k=i===0&&lt<cur.t?0:smooth((lt-cur.t)/R0.saccadeSeconds);
  const u=i===0&&lt<cur.t?smooth(lt/R0.returnSeconds)*cur.u:prev.u+(cur.u-prev.u)*k;
  this.pagePoint(u,v,this.gazeLocal);
  if(this.time>=this.lineEnd){
   this.line++;
   if(this.line>=this.linesPerPage){
    if(this.page===1)this.turn={start:this.time};                      // end of the right page: turn it over
    else{this.pageHold=this.time+this.range(R0.pagePause);this.startPage(1);this.lineStart=this.pageHold;this.lineEnd+=this.pageHold-this.time;}
   }
   else this.startLine();
  }
  return {u,v};
 }
 scheduleEvents(){
  const L=READING.lookUp,S=READING.settle;
  if(!this.lookUp&&this.time>=this.events.lookUp){this.lookUp={start:this.time,hold:this.range(L.hold),yaw:L.headYaw*(this.rand()<.5?-1:1)*this.range([.6,1.2])};this.blinkSoon(.4);}
  if(this.lookUp&&this.time>this.lookUp.start+this.lookUp.hold+2*(this.lookUp.ease??L.ease)){this.lookUp=null;this.events.lookUp=this.after(L.every);this.blinkSoon(.15);}
  if(this.time>=this.events.legs){
   const G=READING.legs,r=()=>this.rand()*2-1;
   this.legsTarget={spread:r()*G.kneeSpread,flexL:r()*G.kneeFlex,flexR:r()*G.kneeFlex,ankleL:r()*G.ankle,ankleR:r()*G.ankle};
   this.events.legs=this.after(G.every);
  }
  if(this.time>=this.events.settle){
   const r=()=>this.rand()*2-1;
   this.settleTarget={hipsRoll:r()*S.hipsRoll,hipsYaw:r()*S.hipsYaw,spinePitch:r()*S.spinePitch,headRoll:r()*S.headRoll};
   this.events.settle=this.after(S.every);
  }
 }
 /**
  * Look up from the book at a point (world space), now: the head turns by yaw/pitch (degrees, normalized bones)
  * and the eyes go to the point; after `hold` seconds at full weight she eases back to the page. Replaces any look-up.
  * With `tilt`, her head is kept from looking tilted sideways by more than that many degrees as seen from the point;
  * `aim` turns her face exactly onto it; `widen` widens her eye range so her eyes can reach it (eye-range.js).
  * @param {{gaze:Vector3,yaw:number,pitch:number,tilt?:number,hold:number,ease?:number,aim?:boolean,widen?:boolean}} o
  */
 lookUpAt({gaze,yaw,pitch,tilt,hold,ease=READING.lookUp.ease,aim=false,widen=false}){
  this.lookUp={start:this.time,hold,yaw,pitch,tilt,ease,aim,widen,gaze:gaze.clone()};this.blinkSoon(.25);
 }
 /**
  * A glance with no point to look at: the head turns by yaw/pitch/roll (degrees; + yaw to her left) from where her
  * reading has it now, held for `hold` seconds at full weight, then back to the page. `eyes:'page'` keeps her eyes on
  * the page. Replaces any look-up.
  * @param {{yaw:number,pitch:number,roll?:number,hold:number,ease?:number,eyes?:'away'|'page'}} o
  */
 glance({yaw,pitch,roll=0,hold,ease=.9,eyes='away'}){
  const from=this.readHead;   // offsets: the same small turn on either page and anywhere along a line
  this.lookUp={start:this.time,hold,yaw:from.yaw+yaw,pitch:from.pitch+pitch,roll,ease,eyes};this.blinkSoon(.3);
 }
 /** While on, her reading stands still (no line progress, page turn, random glance or settle starts); her eyes rest. */
 holdReading(on){this.holding=!!on;}
 /** Ease out of a look-up at a point, or a glance, now (if she is in one), back to the page. */
 endLookUpAt(){
  const l=this.lookUp;if(!l?.gaze&&!l?.eyes)return;   // a look at a point, or a glance (not her own random look-ups)
  l.hold=Math.min(l.hold,this.time-l.start-l.ease);   // the ease back starts now (while still easing up, from there)
 }
 // While she looks at a point, face it exactly: the neck/head split of the turn leaves her short (each bone turns in
 // its own frame), and her eyes cannot make up the rest, so the head turns the remainder.
 aimHead(head,k){
  const l=this.lookUp;
  if(!(k>0&&l?.gaze&&l.aim&&head))return;
  const t=aimTurn(head.getWorldQuaternion(this.tiltTmp.q),head.getWorldPosition(this.tiltTmp.p),l.gaze),A=READING.aim;
  turn(head,axisY,MathUtils.clamp(t.yaw,-A.yaw,A.yaw)*k);turn(head,axisX,MathUtils.clamp(t.pitch,-A.pitch,A.pitch)*k);
 }
 // The head's sideways roll: the settle roll, or, while she looks at a point with a tilt limit, levelled so her head
 // does not look tilted more than that from there (the reading pose leans it toward the book). Call after the yaw/pitch.
 headRoll(head,settle,away){
  const l=this.lookUp;
  if(!(away>0&&l))return settle;
  if(!(l.gaze&&l.tilt!=null&&head?.parent))return settle+(l.roll??0)*away;
  const at=head.getWorldPosition(this.tiltTmp.p),parent=head.parent.getWorldQuaternion(this.tiltTmp.q);
  const level=levelRoll({parent,local:head.quaternion,head:at,eye:l.gaze,start:settle,max:l.tilt});
  return settle+(level-settle)*away;
 }
 blinkSoon(s){this.nextBlink=Math.min(this.nextBlink,this.time+s);}
 blink(){
  const t=this.time-this.blinkStart;
  if(this.blinkStart>=0&&t<.16)return Math.sin(t/.16*Math.PI);
  if(this.time>=this.nextBlink){this.blinkStart=this.time;this.nextBlink=this.time+this.range(this.away>.5?READING.blinkAway:READING.blinkReading);}
  return 0;
 }
 // Page turn: the leaf's progress, how much the right hand reaches for it, and where (its outer edge).
 turning(){
  const T=READING.turn,t=(this.time-this.turn.start)/T.seconds,info=this.turnInfo;
  if(t>=1){this.turn=null;info.progress=0;info.hand=0;this.leaf.set(0);this.startPage(0);return null;}
  info.progress=smooth((t-T.start)/(T.land-T.start));
  info.hand=smooth(t/T.reach)*(1-smooth((t-T.carry)/T.letGo));
  this.leaf.set(info.progress);this.leaf.mesh.updateWorldMatrix(true,false);this.leaf.edgePoint(T.cornerV,info.target);
  this.gazeLocal.copy(this.leaf.corner).setZ(T.cornerV*.21);
  return {u:1-info.progress,v:.85};
 }
 // Advance time, then add offsets to the normalized bones (call after the base pose and breathing are applied).
 // pause 0..1: another action (her break) owns the body; reading stops advancing, its offsets fade, the eyes leave the page
 update(dt,lookTarget,pause=0){
  this.time+=dt;
  if(pause>.01||this.holding){         // freeze the reading schedule while paused or held
   this.lineStart+=dt;this.lineEnd+=dt;if(this.pageHold)this.pageHold+=dt;for(const k in this.events)this.events[k]+=dt;
   if(pause>.01&&this.lookUp)this.lookUp.start+=dt;
  }else this.scheduleEvents();
  const R0=READING,L=R0.lookUp,H=R0.head;
  const reading=this.turn?this.turning()??{u:0,v:0}:this.time<(this.pageHold??-1)?{u:.5,v:1}:this.readingTarget();
  // look-up weight: ease out of the book, hold, ease back
  let away=0;
  if(this.lookUp)away=lookWeight(this.time-this.lookUp.start,{ease:this.lookUp.ease??L.ease,hold:this.lookUp.hold});
  away=Math.max(away,pause);
  this.away=away;
  const wide=this.lookUp?.widen?away:0;   // eyes-only look: her eye range widens with it, and settles back after
  if(wide>0||this.widened){widenEyes(this.vrm.lookAt?.applier,wide);this.widened=wide>0;}
  const pageSide=this.page===0?-1:1;
  // a small dip of the head as each new line starts, fading over the line
  const nod=this.turn?0:H.lineNod*Math.exp(-Math.max(0,this.time-this.lineStart)/.9);
  const want={yaw:(reading.u-.5)*H.followYaw+pageSide*H.pageYaw,pitch:(reading.v-.5)*H.pagePitch+nod,roll:0};
  // the head follows the reading eyes with a lag; a look away is mixed in after that, on its own smooth ease, so the
  // turn settles softly onto what she looks at (a lag there would leave her short and snap her in at the end)
  for(const k of ['yaw','pitch'])this.readHead[k]=follow(this.readHead[k],want[k],H.lag,dt);
  const look={yaw:this.lookUp?.yaw??0,pitch:this.lookUp?.pitch??L.headPitch};
  for(const k of ['yaw','pitch'])this.head[k]=this.readHead[k]*(1-away)+look[k]*away;
  for(const k in this.settle)this.settle[k]=follow(this.settle[k],this.settleTarget[k],R0.settle.ease,dt);
  const bone=n=>this.vrm.humanoid.getNormalizedBoneNode(n),s=this.settle;
  turn(bone('hips'),axisZ,s.hipsRoll);turn(bone('hips'),axisY,s.hipsYaw);turn(bone('spine'),axisX,s.spinePitch);
  // legs: an occasional shift of the feet, plus a slow drift so they are never quite still
  const G=R0.legs,t=this.time,dr=(a,b)=>(Math.sin(t*6.283/a)+.6*Math.sin(t*6.283/b+1.7))/1.6*G.drift;
  for(const k in this.legs)this.legs[k]=follow(this.legs[k],this.legsTarget[k],G.ease,dt);
  const l=this.legs;
  turn(bone('leftUpperLeg'),axisZ,-(l.spread+dr(19,31)));turn(bone('rightUpperLeg'),axisZ,l.spread+dr(23,37));
  turn(bone('leftLowerLeg'),axisX,l.flexL+dr(17,29)*.8);turn(bone('rightLowerLeg'),axisX,l.flexR+dr(21,33)*.8);
  turn(bone('leftFoot'),axisX,l.ankleL+dr(11,17)*1.5);turn(bone('rightFoot'),axisX,l.ankleR+dr(13,19)*1.5);
  const share=L.neckShare,live=1-pause,hy=this.head.yaw*live,hp=this.head.pitch*live;   // scaled for display only
  turn(bone('neck'),axisY,hy*share);turn(bone('neck'),axisX,hp*share);
  turn(bone('head'),axisY,hy*(1-share));turn(bone('head'),axisX,hp*(1-share));this.aimHead(bone('head'),away*away*live);turn(bone('head'),axisZ,this.headRoll(bone('head'),s.headRoll,away)*live);
  // (the exact aim is eased in by away², later than the turn itself: an even, soft approach to your eyes)
  // gaze: the reading point on the page, or a point up and out when looking away
  this.book.updateWorldMatrix(true,false);
  const onPage=this.gazeLocal.clone().applyMatrix4(this.book.matrixWorld);
  if(away>0&&this.lookUp?.gaze)onPage.lerp(this.lookUp.gaze,away);   // at a given point (the camera, when she greets you)
  else if(away>0&&this.lookUp?.eyes!=='page'){
   const head=this.vrm.humanoid.getRawBoneNode('head').getWorldPosition(new Vector3());
   const outward=onPage.clone().sub(head).setY(0).normalize().multiplyScalar(2.5).add(head);outward.y+=.55;
   onPage.lerp(outward,away);
  }
  lookTarget.position.copy(onPage);
  return {away,line:this.line,page:this.page,turn:this.turn?this.turnInfo:null};
 }
}
const R=()=>READING;

// Keeps the book in her hands without sliding: the book is fixed to her left hand (its pose relative to that hand is
// captured once), and the right hand's grip point is stored on the book, so the right arm can be pulled back onto it
// every frame. Works on the normalized bones, so it runs before vrm.update() in the same frame.
export class BookGrip{
 constructor(vrm,book){
  this.book=book;const h=vrm.humanoid;this.left=h.getNormalizedBoneNode('leftHand');this.right=h.getNormalizedBoneNode('rightHand');
  this.left.updateWorldMatrix(true,false);this.right.updateWorldMatrix(true,false);book.updateWorldMatrix(true,true);
  this.offset=new Matrix4().copy(this.left.matrixWorld).invert().multiply(book.matrixWorld);
  this.rightLocal=this.right.getWorldPosition(new Vector3()).applyMatrix4(new Matrix4().copy(book.matrixWorld).invert());
  // the right hand's orientation relative to the book, so it keeps its grip shape (and never sweeps through the cover)
  this.rightRot=book.getWorldQuaternion(new Quaternion()).invert().multiply(this.right.getWorldQuaternion(new Quaternion()));
  this.leftLocal=this.left.getWorldPosition(new Vector3()).applyMatrix4(new Matrix4().copy(book.matrixWorld).invert());
  this.leftRot=book.getWorldQuaternion(new Quaternion()).invert().multiply(this.left.getWorldQuaternion(new Quaternion()));
  book.matrixAutoUpdate=false;this.m=new Matrix4();this.inv=new Matrix4();this.qa=new Quaternion();this.qb=new Quaternion();
  // a frame at the book's centre, in the root's space (translation only)
  const ctr=new Vector3();book.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();ctr.add(o.geometry.boundingBox.getCenter(new Vector3()).applyMatrix4(o.matrixWorld));}});
  let n=0;book.traverse(o=>{if(o.isMesh)n++;});ctr.divideScalar(Math.max(n,1)).applyMatrix4(new Matrix4().copy(book.matrixWorld).invert());
  this.centre=new Matrix4().makeTranslation(ctr.x,ctr.y,ctr.z);
 }
 /** Lap pose for the book (world matrix), used while lap > 0. */
 setLap(m){this.lap=m.clone();}
 update(lap=0){
  this.left.updateWorldMatrix(true,false);this.m.multiplyMatrices(this.left.matrixWorld,this.offset);
  if(lap>0&&this.lap){
   // blend about the book's own centre (its root's origin is far away, at the scene origin)
   const c=this.centre,a=[new Vector3(),new Quaternion(),new Vector3()],b=[new Vector3(),new Quaternion(),new Vector3()];
   const A=new Matrix4().multiplyMatrices(this.m,c),B=new Matrix4().multiplyMatrices(this.lap,c);
   A.decompose(...a);B.decompose(...b);
   this.m.compose(a[0].lerp(b[0],lap),a[1].slerp(b[1],lap),a[2]).multiply(new Matrix4().copy(c).invert());
  }
  if(this.book.parent){this.book.parent.updateWorldMatrix(true,false);this.inv.copy(this.book.parent.matrixWorld).invert();this.m.premultiply(this.inv);}
  this.book.matrix.copy(this.m);this.book.matrixWorldNeedsUpdate=true;this.book.updateMatrixWorld(true);
 }
 /** Turn a hand (normalized bone) to its grip orientation on the book. */
 align(node,rot,weight){
  if(weight<=0)return;
  this.book.getWorldQuaternion(this.qa).multiply(rot);
  node.parent.updateWorldMatrix(true,false);node.parent.getWorldQuaternion(this.qb);
  node.quaternion.slerp(this.qb.invert().multiply(this.qa),weight);node.updateWorldMatrix(false,true);
 }
 alignRight(weight=1){this.align(this.right,this.rightRot,weight);}
 alignLeft(weight=1){this.align(this.left,this.leftRot,weight);}
 /** Where the left wrist belongs on the book, in world space. */
 leftGrip(out=new Vector3()){return out.copy(this.leftLocal).applyMatrix4(this.book.matrixWorld);}
 /** Where the right wrist belongs on the book, in world space. */
 rightGrip(out=new Vector3()){return out.copy(this.rightLocal).applyMatrix4(this.book.matrixWorld);}
}
