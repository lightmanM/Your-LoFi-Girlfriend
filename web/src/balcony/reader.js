// The reading character as one unit: the static reading pose with breathing and sway, the reading layer (eyes, head,
// page turns, look-ups, legs), the book in her hands, and her two occasional breaks from reading: the calm one
// (unwind.js) and the overhead stretch (overhead-stretch.js). The viewer drives it with update(dt) once per frame,
// before vrm.update().
import * as THREE from 'three';
import {lifeSignals,applyLife} from '../companion/life.js';
import {ReadingMotion,BookGrip,READING} from './reading.js';
import {reachArm} from './arm-ik.js';
import {aimTurn} from './head-aim.js';
import {Unwind} from './unwind.js';
import {OverheadStretch} from './overhead-stretch.js';
import {BREAKS,gap,due,after} from './breaks.js';

const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion();
const smoothstep=THREE.MathUtils.smoothstep;

// Her breaks from reading, never during a page turn, a look-up or a line she is saying, one at a time and never back to
// back (breaks.js). The calm break (unwind.js: book down to her lap, shoulder rolls, head tilts, book up) every 4 to 8
// minutes; in the code and the hooks it is still called "stretch", after the motion-capture stretch it replaced. The
// overhead stretch (overhead-stretch.js: hands off the book, both arms up) every 5 to 15 minutes, called "reach".
export const STRETCH=BREAKS.unwind,REACH=BREAKS.stretch;
const LIFE={breathDepth:2.8,headDepth:.8,swayDepth:2.2};
// Head during the break: she looks up before the book lands (neck first, the head a beat later, a little overshoot)
// and back down as she takes hold of it again.
const LIFT={pitch:24,roll:5,neckShare:.4};
// Holding the book low (on her lap): wrists this far from the spine (m, past the page edge at about .14) and this high
// in the book's thickness (share of the page surface height), so the fingers reach under the edge, not through it.
const EDGE={out:.19,height:.5};
// While the book lies on her lap, a hand that comes low over it is kept out past its side edge (m from the spine),
// fully below `low` and not at all above `high` (m above the pages), so the hands come down beside it, not over it.
const KEEP_OUT={side:.24,low:.10,high:.45};
// A hand reaching for the book low on her lap never locks the arm straight: no farther from the shoulder than this share
// of the arm's length (about 140 degrees at the elbow).
const SOFT_ARMS={reach:.94};
const READING_TEXT=READING.text;
// Looking at someone (greet): the head makes this share of the turn toward them, the eyes the rest, within these
// limits (degrees on the normalized head; negative pitch is up).
// how her neck and head share the turn toward something she attends to (ReadingMotion then aims her face exactly)
export const ATTEND=Object.freeze({headShare:1,yaw:[-60,60],pitch:[-30,12]});
const backOut=u=>{u=Math.min(1,Math.max(0,u));const c=1.7;return 1+(c+1)*(u-1)**3+c*(u-1)**2;};
// path through points, s 0..1, each leg eased; the legs' shares of s are given
function path(pts,shares,s,out){
 let a=0;for(let i=0;i<shares.length;i++){const b=a+shares[i];if(s<=b||i===shares.length-1)return out.lerpVectors(pts[i],pts[i+1],smoothstep(s,a,b));a=b;}
 return out.copy(pts[pts.length-1]);
}

export class Reader{
 /**
  * @param {import('@pixiv/three-vrm').VRM} vrm placed in the scene, in its reading pose
  * @param {THREE.Object3D} book the book's root (its first child holds the pages)
  * @param {{tracks:object[],blink?:number}} pose the static reading pose (absolute normalized-bone rotations)
  * @param {THREE.Object3D} look the gaze target the VRM's lookAt follows
  * @param {{seed?:number,eventScale?:number,stretchAt?:number,reachAt?:number,lines?:number,random?:()=>number}} o
  *  stretchAt, reachAt: seconds until the first calm break and the first overhead stretch (for checks)
  */
 constructor(vrm,book,pose,look,o={}){
  this.vrm=vrm;this.pose=pose;this.look=look;this.o={eventScale:1,random:Math.random,...o};this.time=0;
  this.grip=new BookGrip(vrm,book);
  this.reading=new ReadingMotion(vrm,book.children[0],{seed:o.seed??7,eventScale:this.o.eventScale});
  if(o.lines)this.reading.linesPerPage=Math.max(1,o.lines);
  this.stretch=new Unwind();           // her calm break (named stretch for the hooks and ?stretch=N that start it)
  this.reach=new OverheadStretch();    // her overhead stretch (?reach=N)
  this.breaks={unwind:this.stretch,stretch:this.reach};
  this.next={unwind:o.stretchAt??this.breakGap('unwind'),stretch:o.reachAt??this.breakGap('stretch')};   // when each is due
  this.playing=null;                   // the break she is taking now: 'unwind', 'stretch' or null
  this.lids=0;          // 0..1: eyes half-closed while she says something (small talk), on top of blinking
  this.talking=false;   // while she talks, her break does not start
  this.lap={local:[new THREE.Matrix4(),new THREE.Matrix4()],legs:['leftUpperLeg','rightUpperLeg'],meshes:null,m:new THREE.Matrix4()};
  this.turnRest={offset:V(),active:false};
  this.tmp={grip:V(),target:V(),gL:V(),pa:V(),pb:V(),p2:V(),cL:V(),left:V(),toLocal:new THREE.Matrix4(),edge:new THREE.Matrix4()};
 }
 bone(n){return this.vrm.humanoid.getNormalizedBoneNode(n);}
 breakGap(name){return gap(BREAKS[name].every,this.o.random,this.o.eventScale);}
 get nextStretch(){return this.next.unwind;}
 get nextReach(){return this.next.stretch;}
 /** The break she is taking now, if any. */
 breakNow(){return this.playing?this.breaks[this.playing]:null;}
 /** The static reading pose plus breathing and sway. */
 applyPose(){
  const v0=this.vrm.meta.metaVersion==='0'&&this.o.mirrorV0!==false;   // false: a VRM 0.x file already turned to face +Z
  for(const t of this.pose.tracks){
   const node=this.bone(t.bone);if(!node)continue;
   node.quaternion.fromArray(t.rotations,0);if(v0){node.quaternion.x*=-1;node.quaternion.z*=-1;}
  }
  applyLife(this.vrm,lifeSignals(this.time,LIFE),1);
 }
 update(dt){
  this.time+=dt;this.applyPose();
  if(this.pendingAttend){this.reading.lookUpAt(this.attendAngles(this.pendingAttend));this.pendingAttend=null;}
  const r0=this.reading;
  if(!this.playing){
   const name=due(this.time,this.next,!(r0.turn||r0.lookUp||this.talking));
   if(name){this.playing=name;this.grip.setLap(this.bookLapPose());this.breaks[name].begin();}
  }
  const st=this.breakNow();st?.advance(dt);
  if(st&&!st.active){this.next=after(this.playing,this.time,this.next,name=>this.breakGap(name),BREAKS.apart*this.o.eventScale);this.playing=null;}
  const sw=st?.weight()??0;
  if(sw>0)st.apply(this.vrm,sw);
  const lift=this.headLift(st),r=r0.update(dt,this.look,Math.max(sw,Math.min(1,lift.head)));   // reading stops as she looks up
  this.applyHeadLift(lift,sw);
  // the book: in her left hand, or on its way to (or resting on) her lap during her break
  if(st?.active)this.grip.setLap(this.lapNow());
  this.grip.update(st?.carry()??0);
  // low on her lap the hands hold the book by its side edges, not under the back cover (they would pass through it)
  const edge=st?.active?smoothstep(st.carry(),.35,.95):0;
  if(st?.active)this.leftHand(1-sw*st.armWeight('left'),edge);
  this.rightHand(st?.active?null:r?.turn,1-sw*(st?.armWeight('right')??1),edge);
  const em=this.vrm.expressionManager;
  if(em)em.setValue('blink',Math.max(this.pose.blink??0,r0.blink(),st?.face('eyeBlinkLeft')??0,this.lids));
  return r;
 }
 /** A break (either one, from the book leaving her hands to its return), a page turn, any look-up or a pending attend: she is in the middle of something. */
 busy(){return !!(this.playing||this.reading.turn||this.reading.lookUp||this.pendingAttend);}
 /**
  * Look up from the book at a point (world space) for `hold` seconds, e.g. the camera when she greets you. Takes
  * effect on the next update(), aimed from her head as the reading pose holds it. Not during a break.
  * @param {{at:THREE.Vector3,hold:number,ease?:number,tilt?:number,share?:number}} o  tilt: most sideways head tilt seen
  *  from `at` (degrees); share < 1: the head turns only that share of the way sideways (it still lifts fully) and her
  *  eyes, widened, do the rest
  * @returns {boolean} whether she will look
  */
 attend(o){if(this.playing)return false;this.pendingAttend={...o,at:o.at.clone()};return true;}
 /** Stop attending: she eases back to her book now. */
 cancelAttend(){this.pendingAttend=null;this.reading.endLookUpAt();}
 /** True while she is looking at something she was asked to attend to. */
 attending(){return !!(this.pendingAttend||this.reading.lookUp?.gaze);}
 // Head angles (degrees, as ReadingMotion applies them) that turn her face toward a point; call after applyPose().
 attendAngles({at,hold,ease,tilt,share=1}){
  const head=this.bone('head'),t=aimTurn(head.getWorldQuaternion(Q()),head.getWorldPosition(V()),at);
  const A=ATTEND,clamp=THREE.MathUtils.clamp;
  // a smaller look takes its share of the turn sideways only: she still lifts her head fully, since looking up from a
  // lowered head hides her eyes under her lids (from the camera they read as closed)
  return {gaze:at,yaw:clamp(t.yaw*A.headShare*share,...A.yaw),pitch:clamp(t.pitch*A.headShare,...A.pitch),tilt,hold,ease,
   aim:share>=1,widen:share<1};
 }
 headLift(st){
  if(!st?.active)return {neck:0,head:0};
  if(st.t<st.pre){const x=st.t/st.pre;return {neck:backOut((x-.38)/.34),head:backOut((x-.46)/.34)};}
  const p=st.t-(st.length-st.post);
  if(p>0)return {neck:1-smoothstep(p,0,st.post*.4),head:1-smoothstep(p,-.1,st.post*.35)};
  return {neck:1,head:1};
 }
 applyHeadLift(l,sw){
  const k=1-sw;if(k<=0||(!l.neck&&!l.head))return;
  const q=Q(),X=new THREE.Vector3(1,0,0),Z=new THREE.Vector3(0,0,1),d=THREE.MathUtils.DEG2RAD;
  this.bone('neck').quaternion.multiply(q.setFromAxisAngle(X,-LIFT.pitch*LIFT.neckShare*l.neck*k*d));
  const head=this.bone('head');head.quaternion.multiply(q.setFromAxisAngle(X,-LIFT.pitch*(1-LIFT.neckShare)*l.head*k*d));
  head.quaternion.multiply(q.setFromAxisAngle(Z,LIFT.roll*Math.sin(Math.PI*Math.min(1,l.head))*k*d));
 }
 leftHand(weight,edge=0){
  this.keepOut('left',edge);
  if(weight<=0)return;
  reachArm(this.vrm,'left',this.edgeGrip(this.grip.leftGrip(this.tmp.left),edge),weight);this.grip.alignLeft(weight);
 }
 // Arm geometry for one side: shoulder, wrist (world) and the arm's full length.
 arm(side){
  const S=this.bone(side+'UpperArm'),E=this.bone(side+'LowerArm'),W=this.bone(side+'Hand');W.updateWorldMatrix(true,false);
  const s=S.getWorldPosition(V()),e=E.getWorldPosition(V()),w=W.getWorldPosition(V());return {s,w,length:s.distanceTo(e)+e.distanceTo(w)};
 }
 // Pull a wrist target in toward the shoulder so that reaching it leaves the elbow bent (SOFT_ARMS.reach of the length).
 softTarget(side,p){
  const a=this.arm(side),d=p.distanceTo(a.s),max=a.length*SOFT_ARMS.reach;
  return d>max?p.sub(a.s).multiplyScalar(max/d).add(a.s):p;
 }
 // With the book low (edge > 0), move the wrist (as the pose holds it) out past the book's side edge where it is low
 // over the pages; the grip reach that follows blends from there, so the hand never travels across the book.
 keepOut(side,edge){
  if(edge<=0)return;
  const K=KEEP_OUT,pages=this.reading.book,t=this.tmp,wrist=this.bone(side+'Hand');
  pages.updateWorldMatrix(true,false);wrist.updateWorldMatrix(true,false);t.edge.copy(pages.matrixWorld).invert();
  const l=wrist.getWorldPosition(V()).applyMatrix4(t.edge),g=(side==='left'?this.grip.leftGrip(V()):this.grip.rightGrip(V())).applyMatrix4(t.edge);
  const s=Math.sign(g.x||1),out=s*l.x;if(out>=K.side)return;
  const k=edge*(1-smoothstep(l.y,K.low,K.high));if(k<=0)return;
  l.x=s*K.side;reachArm(this.vrm,side,this.softTarget(side,l.applyMatrix4(pages.matrixWorld)),k);
 }
 // A wrist target moved from its reading grip (behind the pages) out past the book's side edge, at mid thickness, by k.
 edgeGrip(p,k){
  if(k<=0)return p;
  const pages=this.reading.book,t=this.tmp,T=READING_TEXT;pages.updateWorldMatrix(true,false);t.edge.copy(pages.matrixWorld).invert();
  const l=p.clone().applyMatrix4(t.edge),e=l.clone();
  e.x=Math.sign(l.x||1)*Math.max(Math.abs(l.x),EDGE.out);e.y=Math.max(l.y,T.surface*EDGE.height);
  return p.copy(l.lerp(e,k).applyMatrix4(pages.matrixWorld));
 }
 // The right hand stays on its grip point on the book, with its grip orientation. During a page turn it travels, in
 // the book's own frame, out past the outer edge and up first, then over the page to just above the leaf's outer edge.
 rightHand(turn,weight=1,edge=0){
  this.keepOut('right',edge);
  const t=this.tmp,target=t.target;this.edgeGrip(this.grip.rightGrip(t.grip),edge);target.copy(t.grip);
  if(turn&&turn.hand>0){
   const pages=this.reading.book,leaf=this.reading.leaf;pages.updateWorldMatrix(true,false);t.toLocal.copy(pages.matrixWorld).invert();
   t.gL.copy(t.grip).applyMatrix4(t.toLocal);t.cL.copy(turn.target).applyMatrix4(t.toLocal);
   if(!this.turnRest.active){this.turnRest.offset.subVectors(t.gL,t.cL);this.turnRest.active=true;}
   // fingers wrap behind the cover up to ~4.5 cm in from the edge: slide straight out past that, then up, then over
   t.pa.copy(t.gL);t.pa.x+=leaf.side*.06;t.pb.copy(t.pa);t.pb.y=.10;
   t.p2.copy(this.turnRest.offset).multiplyScalar(.6).add(t.cL);t.p2.y=Math.min(Math.max(t.p2.y,t.cL.y+.03,.075),t.gL.y+.14);
   path([t.gL,t.pa,t.pb,t.p2],[.3,.25,.45],turn.hand,target).applyMatrix4(pages.matrixWorld);
  }else this.turnRest.active=false;
  reachArm(this.vrm,'right',target,weight);this.grip.alignRight(weight);
 }
 // The open book lying flat on her thighs, text toward her: a plane is fitted to the thigh surface under the book
 // (rays straight down onto the model); the pose is then kept relative to both upper legs, so the book rides along.
 bookLapPose(){
  const v=this.vrm,P=n=>this.bone(n).getWorldPosition(V()),L=this.lap;
  const hip=P('leftUpperLeg').add(P('rightUpperLeg')).multiplyScalar(.5),knee=P('leftLowerLeg').add(P('rightLowerLeg')).multiplyScalar(.5);
  const r=P('rightUpperLeg').sub(P('leftUpperLeg')).normalize(),tdir=knee.clone().sub(hip);tdir.addScaledVector(r,-tdir.dot(r)).normalize();
  const n=V().crossVectors(r,tdir).normalize();if(n.y<0)n.negate();
  const centre=hip.clone().lerp(knee,.5);
  if(!L.meshes){L.meshes=[];v.scene.traverse(o=>{if(o.isMesh)L.meshes.push(o);});}
  const rc=new THREE.Raycaster(),pts=[];
  for(const s of [-.08,-.05,.05,.08])for(const u of [-.08,-.03,.03,.08]){
   rc.set(centre.clone().addScaledVector(r,s).addScaledVector(tdir,u).addScaledVector(n,.4),n.clone().negate());
   const hit=rc.intersectObjects(L.meshes,false)[0];if(hit)pts.push({s,u,h:hit.point.clone().sub(centre).dot(n)});
  }
  let normal=n.clone(),lift=.06;
  if(pts.length>=6){
   const mean=k=>pts.reduce((a,p)=>a+p[k],0)/pts.length,mh=mean('h'),ms=mean('s'),mu=mean('u');
   const slope=(k,m)=>pts.reduce((a,p)=>a+(p[k]-m)*(p.h-mh),0)/pts.reduce((a,p)=>a+(p[k]-m)**2,0);
   const gs=slope('s',ms),gu=slope('u',mu);
   normal=n.clone().addScaledVector(r,-gs).addScaledVector(tdir,-gu).normalize();
   lift=mh-gs*ms-gu*mu+Math.max(0,...pts.map(p=>p.h-(mh+gs*(p.s-ms)+gu*(p.u-mu))));   // rest on the highest points
  }
  const origin=centre.clone().addScaledVector(n,lift+.004),along=tdir.clone().addScaledVector(normal,-tdir.dot(normal)).normalize();
  // page side up off the thighs, the top of the text toward her knees
  const root=this.grip.book,pages=this.reading.book;root.updateWorldMatrix(true,true);
  const e=pages.matrixWorld.elements,bx=V().set(e[0],e[1],e[2]).normalize(),by=V().set(e[4],e[5],e[6]).normalize(),bz=V().set(e[8],e[9],e[10]).normalize();
  const hand=Math.sign(bx.dot(V().crossVectors(by,bz)));
  const by2=normal.clone(),bz2=along.clone().multiplyScalar(Math.sign(this.reading.topZ)),bx2=V().crossVectors(by2,bz2).multiplyScalar(hand);
  const R=Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(bx2,by2,bz2).multiply(new THREE.Matrix4().makeBasis(bx,by,bz).invert()));
  const rp=V(),rq=Q(),rs=V();root.matrixWorld.decompose(rp,rq,rs);
  L.m.compose(origin.clone().add(rp.sub(pages.getWorldPosition(V())).applyQuaternion(R)),R.multiply(rq),rs);
  L.legs.forEach((name,i)=>{const leg=this.bone(name);leg.updateWorldMatrix(true,false);L.local[i].copy(leg.matrixWorld).invert().multiply(L.m);});
  return L.m;
 }
 /** Test hook: hand joints and the book's box, in the pages' own frame (to find hands passing through the book). */
 handsLocal(){const pages=this.reading.book;pages.updateWorldMatrix(true,true);const m=pages.matrixWorld.clone().invert(),h=this.vrm.humanoid,out={};
  for(const side of ['left','right'])out[side]=['Hand','MiddleProximal','MiddleDistal','IndexDistal','LittleDistal','ThumbDistal'].map(n=>{const b=h.getRawBoneNode(side+n);return b?b.getWorldPosition(V()).applyMatrix4(m).toArray().map(x=>+x.toFixed(3)):null;});
  if(!this.bookBox){const bb=new THREE.Box3();pages.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();bb.union(o.geometry.boundingBox.clone().applyMatrix4(m.clone().multiply(o.matrixWorld)));}});this.bookBox=bb;}
  out.box=[this.bookBox.min.toArray(),this.bookBox.max.toArray()].map(a=>a.map(x=>+x.toFixed(3)));return out;}
 /** Test hook: both wrist grips in the pages' own frame. */
 gripsLocal(){const pages=this.reading.book;pages.updateWorldMatrix(true,false);const m=pages.matrixWorld.clone().invert();return {left:this.grip.leftGrip(V()).applyMatrix4(m).toArray(),right:this.grip.rightGrip(V()).applyMatrix4(m).toArray()};}
 lapNow(){
  const L=this.lap,a=[V(),Q(),V()],b=[V(),Q(),V()];
  const m=L.legs.map((name,i)=>{const leg=this.bone(name);leg.updateWorldMatrix(true,false);return new THREE.Matrix4().multiplyMatrices(leg.matrixWorld,L.local[i]);});
  m[0].decompose(...a);m[1].decompose(...b);return L.m.compose(a[0].lerp(b[0],.5),a[1].slerp(b[1],.5),a[2]);
 }
}
