// The reading character as one unit: the static reading pose with breathing and sway, the reading layer (eyes, head,
// page turns, look-ups, legs), the book in her hands, and the occasional stretch break. Both the Balcony development
// page and the viewer drive it with update(dt) once per frame, before vrm.update().
import * as THREE from 'three';
import {lifeSignals,applyLife} from '../companion/life.js';
import {ReadingMotion,BookGrip,READING} from './reading.js';
import {reachArm} from './arm-ik.js';
import {ClipEvent} from './clip-player.js';
import {shoulderRhythm,torsoFollow} from './body-coupling.js';

const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion();
const smoothstep=THREE.MathUtils.smoothstep;

// Stretch break: every 4 to 8 minutes of reading, never during a page turn or a look-up. The clip's two-arm overhead
// stretch: from 10.4 s (hands resting on the lap) until the arms come down (19.4 s). Two moments play slower: the
// swing up with a forearm snap (10.85 to 11.7 s) and the quick drop at the end (18.3 to 19.4 s). pre/post: both hands
// carry the book down to her lap and back up; easeIn/easeOut: they let go of it and move into (and out of) the clip.
export const STRETCH={clip:'stretchRokokoIk',every:[240,480],options:{pre:2.3,easeIn:1.2,easeOut:1.2,post:1.7,start:10.4,end:19.4,
 slow:[[10.85,11.7,.4],[18.3,19.4,.35]]}};
const LIFE={breathDepth:2.8,headDepth:.8,swayDepth:2.2};
// Head during the stretch: she looks up before the book lands (neck first, the head a beat later, a little overshoot)
// and back down as she takes hold of it again.
const LIFT={pitch:24,roll:5,neckShare:.4};
// Holding the book low (on her lap): wrists this far from the spine (m, past the page edge at about .14) and this high
// in the book's thickness (share of the page surface height), so the fingers reach under the edge, not through it.
const EDGE={out:.19,height:.5};
// While the book lies on her lap, a hand that comes low over it is kept out past its side edge (m from the spine),
// fully below `low` and not at all above `high` (m above the pages), so the hands come down beside it, not over it.
const KEEP_OUT={side:.24,low:.10,high:.45};
// Below shoulder height during a stretch break the arms never lock straight: no hand reaches farther from the shoulder
// than this share of the arm's length (about 140 degrees at the elbow); fades out as the hand rises past the shoulder.
const SOFT_ARMS={reach:.94,below:-.10,above:.10};
const READING_TEXT=READING.text;
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
  * @param {{seed?:number,eventScale?:number,authored?:object,stretchAt?:number,lines?:number,shoulders?:boolean,torso?:boolean,random?:()=>number}} o
  */
 constructor(vrm,book,pose,look,o={}){
  this.vrm=vrm;this.pose=pose;this.look=look;this.o={shoulders:true,torso:true,eventScale:1,random:Math.random,...o};this.time=0;
  this.grip=new BookGrip(vrm,book);
  this.reading=new ReadingMotion(vrm,book.children[0],{seed:o.seed??7,eventScale:this.o.eventScale});
  if(o.lines)this.reading.linesPerPage=Math.max(1,o.lines);
  const clip=o.authored?.clips?.[STRETCH.clip];
  this.stretch=clip?new ClipEvent(clip,STRETCH.options):null;
  this.nextStretch=this.stretch?(o.stretchAt??this.stretchGap()):Infinity;
  this.lap={local:[new THREE.Matrix4(),new THREE.Matrix4()],legs:['leftUpperLeg','rightUpperLeg'],meshes:null,m:new THREE.Matrix4()};
  this.baseShoulders={left:Q(),right:Q()};this.turnRest={offset:V(),active:false};
  this.tmp={grip:V(),target:V(),gL:V(),pa:V(),pb:V(),p2:V(),cL:V(),left:V(),toLocal:new THREE.Matrix4(),edge:new THREE.Matrix4()};
 }
 bone(n){return this.vrm.humanoid.getNormalizedBoneNode(n);}
 stretchGap(){const [a,b]=STRETCH.every;return this.time+(a+(b-a)*this.o.random())*this.o.eventScale;}
 /** The static reading pose plus breathing and sway. */
 applyPose(){
  const v0=this.vrm.meta.metaVersion==='0';
  for(const t of this.pose.tracks){
   const node=this.bone(t.bone);if(!node)continue;
   node.quaternion.fromArray(t.rotations,0);if(v0){node.quaternion.x*=-1;node.quaternion.z*=-1;}
  }
  applyLife(this.vrm,lifeSignals(this.time,LIFE),1);
 }
 update(dt){
  this.time+=dt;this.applyPose();
  const st=this.stretch,r0=this.reading,busy=r0.turn||r0.lookUp;
  if(st&&!st.active&&this.time>=this.nextStretch&&!busy){this.grip.setLap(this.bookLapPose());st.begin();}
  const was=st?.active;st?.advance(dt);if(was&&!st.active)this.nextStretch=this.stretchGap();
  const sw=st?.weight()??0;
  if(sw>0){
   this.baseShoulders.left.copy(this.bone('leftShoulder').quaternion);this.baseShoulders.right.copy(this.bone('rightShoulder').quaternion);
   st.apply(this.vrm,sw);
   if(this.o.shoulders)shoulderRhythm(this.vrm,this.baseShoulders,sw);
   if(this.o.torso)torsoFollow(this.vrm,sw,{left:st.armWeight('left'),right:st.armWeight('right')});
   for(const side of ['left','right'])this.softArm(side,sw);
  }
  const lift=this.headLift(st),r=r0.update(dt,this.look,Math.max(sw,Math.min(1,lift.head)));   // reading stops as she looks up
  this.applyHeadLift(lift,sw);
  // the book: in her left hand, or on its way to (or resting on) her lap during a stretch
  if(st?.active)this.grip.setLap(this.lapNow());
  this.grip.update(st?.carry()??0);
  // low on her lap the hands hold the book by its side edges, not under the back cover (they would pass through it)
  const edge=st?.active?smoothstep(st.carry(),.35,.95):0;
  if(st?.active)this.leftHand(1-sw*st.armWeight('left'),edge);
  this.rightHand(st?.active?null:r?.turn,1-sw*(st?.armWeight('right')??1),edge);
  const em=this.vrm.expressionManager;
  if(em)em.setValue('blink',Math.max(this.pose.blink??0,r0.blink(),st?.face('eyeBlinkLeft')??0));
  return r;
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
 // While the clip holds her hands low, keep her elbows from locking straight (weight w: the clip's weight).
 softArm(side,w){
  const a=this.arm(side),A=SOFT_ARMS,k=w*(1-smoothstep(a.w.y-a.s.y,A.below,A.above)),max=a.length*A.reach,d=a.w.distanceTo(a.s);
  if(k<=0||d<=max)return;
  reachArm(this.vrm,side,a.w.sub(a.s).multiplyScalar(max/d).add(a.s),k);
 }
 // With the book low (edge > 0), move the wrist (as the clip has it) out past the book's side edge where it is low
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
