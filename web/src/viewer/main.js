// The viewer: what a visitor sees. A warm afternoon on the balcony, rendered once in Blender as a toon picture, with
// Marycia live in front of it: reading most of the time (page turns, looking up, shifting in her seat) and now and
// then putting the book down for a short break. No controls; the camera stays still, like a video that never repeats.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm';
import {Reader} from '../balcony/reader.js';
import {GRADE,gradeMaterial} from './grade.js';
import {seatCharacter} from '../balcony/seat.js';
import {Wind,PLANTS,plateMaterial,leavesMaterial} from './wind.js';
import {livePlants,PLANTS3D} from './plants.js';
import {createMusic} from '../music/player.js';
import {bindMusicControls} from '../music/controls.js';
import {mountHud} from '../hud/hud.js';
import {mountIntro,INTRO} from '../intro/intro.js';
import {cameraBeep} from '../intro/beep.js';
import {createVoice} from '../voice/speech.js';
import {startGreeting} from '../voice/greeting.js';
import {GREET} from '../voice/greeting-plan.js';
import {voiceLevel} from '../voice/level.js';
import {createSmallTalk} from '../voice/small-talk.js';
import {mountSubtitles} from '../voice/subtitles.js';
import {createChat} from '../voice/chat.js';
import {mountAnswers} from '../voice/answers.js';
import {CHAT,canStart} from '../voice/chat-plan.js';
import {createReach,herCapsules} from '../voice/reach.js';
import {setGlow} from '../voice/glow.js';
import {pickLine,lastLine,rememberLine} from '../voice/pick-line.js';
import {VISIBLE_CHAIR,CHAIR_SHADOW,CHAIR_CONTACT,prepareChair,pictureCamera,enableChairShadows,updateChairContact,calibrateChairContact} from '../balcony/visible-chair.js';

const BASE='/environment/balcony-toon/';
// Light on her, matched by eye to the toon picture: warm low sun through the door, a sky fill, warm bounce below.
const LIGHT={sunIntensity:2.0,sunColor:[1,.72,.5],sky:[.95,.78,.62],ground:[.59,.48,.38],fill:.6};
// ?light=sun,fill,r,g,b,sr,sg,sb for tuning against the Blender picture
if(new URLSearchParams(location.search).has('light')){const v=new URLSearchParams(location.search).get('light').split(',').map(Number);
 Object.assign(LIGHT,{sunIntensity:v[0],fill:v[1],sky:v.slice(2,5),sunColor:v.length>=8?v.slice(5,8):null,ground:v.slice(2,5).map(x=>x*.62)});}
const FOCUS_X=.74;            // where she sits across the picture (0 left, 1 right): narrow screens crop around her
const host=document.getElementById('stage'),note=document.getElementById('note');
const params=new URLSearchParams(location.search);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;
host.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(17,16/9,.05,120);
const loader=new GLTFLoader();loader.register(p=>new VRMLoaderPlugin(p));
const state={data:null,vrm:null,reader:null,ready:false,error:null,frames:[]};
const rad=THREE.MathUtils.degToRad;

// Cover the screen with the authored 16:9 frame; on narrower screens keep her in view rather than the frame's centre.
function fit(){
 const w=host.clientWidth,h=host.clientHeight,a=w/h,c=state.data.camera,k=16/9;
 camera.fov=c.vfov_deg;camera.aspect=k;
 if(a>=k){const fullH=w/k;camera.setViewOffset(w,fullH,0,(fullH-h)/2,w,h);}
 else{const fullW=h*k,x=THREE.MathUtils.clamp(fullW*FOCUS_X-w/2,0,fullW-w);camera.setViewOffset(fullW,h,x,0,w,h);}
 camera.updateProjectionMatrix();renderer.setSize(w,h);
}
// A picture layer: a plane filling the camera's view at a distance, drawn in a fixed order around her.
function layer(material,distance,order){
 const c=state.data.camera,q=new THREE.Quaternion().fromArray(c.quaternion);
 const geo=new THREE.PlaneGeometry(2*distance*Math.tan(rad(c.hfov_deg)/2),2*distance*Math.tan(rad(c.vfov_deg)/2));
 const mesh=new THREE.Mesh(geo,material);
 mesh.quaternion.copy(q);mesh.position.fromArray(c.position).add(new THREE.Vector3(0,0,-distance).applyQuaternion(q));
 mesh.renderOrder=order;mesh.frustumCulled=false;scene.add(mesh);return mesh;
}
function place(vrm,pose,c){
 vrm.scene.scale.setScalar(c.scale);vrm.scene.rotation.y+=rad(c.yaw_deg);
 for(const t of pose.tracks){const n=vrm.humanoid.getNormalizedBoneNode(t.bone);if(n)n.quaternion.fromArray(t.rotations,0);}
 vrm.update(0);vrm.scene.updateMatrixWorld(true);
 const hip=vrm.humanoid.getRawBoneNode('hips').getWorldPosition(new THREE.Vector3());
 vrm.scene.position.add(new THREE.Vector3().fromArray(c.hips).sub(hip));vrm.scene.updateMatrixWorld(true);
}
// Test hooks (not shown to visitors): ?character=<file>.vrm in the same folder, ?seed=N, ?still=T freezes her at
// T seconds, stepped at a fixed rate so every run shows exactly the same pose.
const character=d=>{const c=params.get('character');return c&&/^[\w.-]+\.vrm$/.test(c)?d.vrm.replace(/[^/]+$/,c):d.vrm;};
const json=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`${url}: HTTP ${r.status}`);return r.json();};
async function load(){
 const d=state.data=await json(BASE+'scene.json');
 // framing (scripts/balcony-toon/framing.json): the chair and she sit offset along the floor; palm and leaves bend points
 const F=d.framing??{},off=new THREE.Vector3().fromArray(F.character_offset??[0,0,0]);
 d.character={...d.character,hips:new THREE.Vector3().fromArray(d.character.hips).add(off).toArray()};
 d.look_target=new THREE.Vector3().fromArray(d.look_target).add(off).toArray();
 if(F.palm_pivot)PLANTS.palm.pivots=[F.palm_pivot];
 if(F.leaves_pivot_shift)PLANTS.leaves.pivots=PLANTS.leaves.pivots.map(([x,y])=>[x+F.leaves_pivot_shift[0],y+F.leaves_pivot_shift[1]]);
 camera.position.fromArray(d.camera.position);camera.quaternion.fromArray(d.camera.quaternion);fit();new ResizeObserver(fit).observe(host);
 const tex=new THREE.TextureLoader();
 const [plate,leaves,chair,book,pose,vrmBuffer,clean,field,plantMask,plants,cover,plantsFull,palmFull]=await Promise.all([
  tex.loadAsync(BASE+d.plate),tex.loadAsync(BASE+d.leaves),loader.loadAsync(VISIBLE_CHAIR),loader.loadAsync(BASE+d.book),json(d.pose),
  fetch(character(d)).then(r=>{if(!r.ok)throw Error('character: HTTP '+r.status);return r.arrayBuffer();}),
  tex.loadAsync(BASE+d.wind.clean),tex.loadAsync(BASE+d.wind.field),tex.loadAsync(BASE+d.wind.mask),loader.loadAsync(BASE+d.wind.plants),
  tex.loadAsync(BASE+d.wind.cover),tex.loadAsync(BASE+d.wind.full),tex.loadAsync(BASE+d.wind.palm_full),
 ]);
 // the picture and the near leaves sway in one wind (wind.js)
 state.wind=new Wind();const palm={full:palmFull,overscan:d.wind.overscan,cover,near:d.wind.palm_near,depthRange:d.wind.depth_range};
 state.plateMat=plateMaterial(plate,clean,field,plantMask,false,palm);state.leavesMat=leavesMaterial(leaves);
 state.palmMat=plateMaterial(plate,clean,field,plantMask,true,palm);
 layer(state.plateMat,60,0);layer(state.palmMat,59,1.5);layer(state.leavesMat,1,10);
 // roses, balcony plants and ivy: live 3D, coloured from the picture at their rest position (whole where it hid them)
 const picCam=pictureCamera(d.camera.position,d.camera.quaternion,d.camera.hfov_deg,d.camera.vfov_deg);
 const windDir=new THREE.Vector3(1,0,0).applyQuaternion(picCam.quaternion).setY(0).normalize();   // toward screen right
 state.plants=livePlants(plants.scene,plate,plantMask,picCam,windDir,cover,plantsFull,d.wind.depth_range,d.wind.sheer_near);scene.add(state.plants);
 // ?shadow=r,g,b,opacity[,elevation,radius] for tuning her shadow on the chair against the Blender picture
 if(params.has('contact')){const v=params.get('contact').split(',').map(Number);CHAIR_CONTACT.strength=v[0];CHAIR_CONTACT.capsules.forEach(c=>{c[3]*=v[1]??1;});if(v.length>=5)CHAIR_CONTACT.color=v.slice(2,5);}
 if(params.has('shadow')){const v=params.get('shadow').split(',').map(Number);Object.assign(CHAIR_SHADOW,{color:v.slice(0,3),opacity:v[3],...(v.length>4?{elevation:v[4],radius:v[5]??7}:{})});}
 chair.scene.position.add(off);chair.scene.updateMatrixWorld(true);
 state.chair=prepareChair(chair.scene,plate,pictureCamera(d.camera.position,d.camera.quaternion,d.camera.hfov_deg,d.camera.vfov_deg));scene.add(state.chair);
 book.scene.position.add(off);book.scene.updateMatrixWorld(true);   // the book was exported at her old seat: it moves with her
 book.scene.traverse(o=>{if(o.isMesh){o.renderOrder=2;o.castShadow=true;state.bookMesh??=o;}});scene.add(book.scene);state.book=book.scene;
 const vrm=state.vrm=(await loader.parseAsync(vrmBuffer,'')).userData.vrm;
 VRMUtils.removeUnnecessaryVertices(vrm.scene);VRMUtils.combineSkeletons(vrm.scene);VRMUtils.rotateVRM0(vrm);
 vrm.scene.traverse(o=>{if(o.isMesh){o.renderOrder=2;o.frustumCulled=false;o.castShadow=true;}});
 if(params.has('grade')){const v=params.get('grade').split(',').map(Number);Object.assign(GRADE,{gain:v[0],sat:v[1],warm:v.slice(2,5)});}
 for(const root of [vrm.scene,book.scene])root.traverse(o=>{if(o.isMesh)[o.material].flat().forEach(m=>gradeMaterial(m));});
 place(vrm,pose,d.character);scene.add(vrm.scene);
 state.seat=params.get('seat')==='0'?{drop:0,update(){}}:seatCharacter(vrm,state.chair);   // sit on the seat, not above it
 // the book was exported in her hands at her unseated height: it drops with her, before its grip is captured
 book.scene.position.y-=state.seat.drop;book.scene.updateMatrixWorld(true);
 state.contactRadii=calibrateChairContact(state.chair,vrm);
 const look=new THREE.Object3D();look.position.fromArray(d.look_target);scene.add(look);
 if(vrm.lookAt){vrm.lookAt.target=look;vrm.lookAt.autoUpdate=true;}
 const hips=new THREE.Vector3().fromArray(d.character.hips);
 const sun=new THREE.DirectionalLight(new THREE.Color().fromArray(LIGHT.sunColor??d.sun.color),LIGHT.sunIntensity);
 sun.position.copy(hips).addScaledVector(new THREE.Vector3().fromArray(d.sun.direction),10);sun.target.position.copy(hips);enableChairShadows(renderer,scene,hips,d.sun.direction);
 scene.add(sun,sun.target,new THREE.HemisphereLight(new THREE.Color().fromArray(LIGHT.sky),new THREE.Color().fromArray(LIGHT.ground),LIGHT.fill));
 state.reader=new Reader(vrm,book.scene,pose,look,{seed:params.has('seed')?+params.get('seed'):(Math.random()*1e9)|0,
  random:params.has('seed')?()=>.5:Math.random,
  eventScale:+(params.get('events')??1),stretchAt:params.has('stretch')?+params.get('stretch'):undefined});
 if(params.has('still')){const n=Math.round(+params.get('still')*60);for(let i=0;i<n;i++){state.reader.update(1/60);state.seat.update();vrm.update(1/60);}state.frozen=true;updateChairContact(state.chair,vrm);}
 state.ready=true;requestAnimationFrame(()=>host.classList.add('ready'));
}
let last=performance.now();
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.1);last=now;
 if(state.wind&&params.get('wind')!=='0'){
  const w=state.wind;w.update(state.frozen?0:dt);const u=state.plateMat.userData.uniforms,l=state.leavesMat.userData.uniforms;
  for(const U of [u,state.palmMat.userData.uniforms]){U.time.value=w.t;U.angPalm.value=-w.angle('palm');U.act.value.set(w.activity('palm'),0,0,0);}
  l.time.value=w.t;
  const deg=Math.PI/180*+(params.get('plantgain')??1);   // ?plantgain exaggerates the 3D plants' bend for checks
  state.plants?.userData.update(w.t,{ivy:w.sway('ivy')*PLANTS3D.ivy.bend*deg,roses:w.sway('roses')*PLANTS3D.roses.bend*deg,pots:w.sway('balcony')*PLANTS3D.pots.bend*deg},
   {ivy:w.activity('ivy'),roses:w.activity('roses'),pots:w.activity('balcony')});
  l.ang.value=w.angle('leaves');l.act.value=w.activity('leaves');
 }
 soundFrame();
 if(state.reader&&!state.frozen&&!state.held){state.reader.update(dt);greetingFrame();talkFrame(dt);chatFrame(dt);state.seat.update();state.vrm.update(dt);updateChairContact(state.chair,state.vrm);if(state.frames.length<600)state.frames.push(dt*1000);}
 renderer.render(scene,camera);
}
requestAnimationFrame(frame);
// Background music: starts on the first click or tap (browsers block sound before a gesture). ?music=0 turns it off.
// ?musicstall=<s> shortens the wait before a track that will not start is skipped (for checks).
const music=params.get('music')==='0'?null:createMusic({startTimeout:params.has('musicstall')?+params.get('musicstall'):undefined});
// Opening shot: out of focus with a start button; pressing it pulls focus, the camera display powers on with a beep and
// the music flows in. ?intro=0 skips it (the display then powers on by itself and the first click or tap starts the
// music). Page controls are bound only once the page has started. ?hud=0 hides the camera display.
const withIntro=params.get('intro')!=='0';
const hud=params.get('hud')==='0'?null:mountHud(music,{autoPower:!withIntro});
let unbindMusic=null,beeps=0;
// Her greeting: as the start button pulls focus she looks up at you and says one of her greetings, with subtitles:
// picked at random each visit, never last visit's. Lines and voice: public/voice/ (scripts/voice/generate_lines.py).
// ?line=<id> picks one (e.g. ?line=otsukare); ?greet=0 turns the greeting off.
const greetOn=params.get('greet')!=='0',talkOn=params.get('talk')!=='0',chatOn=params.get('chat')!=='0';   // all share her voice
const voice=greetOn||talkOn||chatOn?createVoice():null;
const subtitles=voice?mountSubtitles():null;
const answerPills=voice&&chatOn?mountAnswers():null;   // her question's answers (click to talk)
const store=(()=>{try{return window.localStorage;}catch{return undefined;}})();   // blocked site data: no memory
const GREET_LATE=4;   // s: if her lines arrive later than this after start, the moment has passed and she skips it
let greetingLine=null,greetingPicked=false;   // picked: chosen at random (remembered), not asked for with ?line=
const voiceReady=voice?.load().then(()=>{
 const want=params.get('line'),ids=voice.ids(l=>l.kind==='greeting');
 if(want&&!ids.includes(want))console.warn(`voice: no line "${want}"; she picks one. Lines: ${ids.join(', ')}`);
 greetingLine=pickLine(ids,{want,last:lastLine(store)});greetingPicked=!!greetingLine&&greetingLine!==want;
 if(greetingLine)voice.prefetch(greetingLine);   // only this visit's line is downloaded
}).catch(e=>console.warn('voice: lines unavailable, she will not speak',e.message));
function greet({line=greetingLine,...options}={}){
 if(!voice||!greetOn||!line||!state.reader||state.frozen||(state.greeting&&!state.greetingDone()))return false;
 smallTalk?.stop();chat?.stop();   // the greeting comes first: never two voices at once
 state.greeting=startGreeting({reader:state.reader,vrm:state.vrm,voice,lineId:line,target:camera.position,subtitles,options});
 if(state.greeting&&greetingPicked&&line===greetingLine)rememberLine(store,line);
 return !!state.greeting;
}
// From the start button: her voice is unlocked in the click, and if her lines are still downloading she greets as soon
// as they arrive, looking up that much sooner so the line lands where it would have.
function greetOnStart(){
 voice?.unlock();
 if(greet()||!voice||greetingLine)return;
 const t0=performance.now();
 voiceReady.then(()=>{const late=(performance.now()-t0)/1000;if(late<=GREET_LATE)greet({notice:Math.max(.2,GREET.notice-late)});});
}
// Her voice follows the music's volume and mute, and the music dips while she speaks.
let heardLevel=null,dipped=false;
function soundFrame(){
 const level=voiceLevel(music?.state()??null);if(level!==heardLevel){heardLevel=level;voice?.setLevel(level);}
 const speaking=state.greeting?.speech?.status()==='speaking'||!!smallTalk?.speaking()||!!chat?.speaking();if(speaking!==dipped){dipped=speaking;music?.duck(speaking);}
}
// Small talk while she reads (src/voice/small-talk.js): a line every 1 to 2 minutes, to you or to herself. ?talk=0
// turns it off; ?talkevery=<s> makes her talk every <s> seconds instead, to check it.
const talkEvery=params.has('talkevery')?[1,1].map(()=>Math.max(1,+params.get('talkevery')||1)):undefined;
let smallTalk=null,talkBroken=false,talkStarted=!withIntro;   // she may talk once the page has started
function talkFrame(dt){
 if(talkBroken)return;
 try{
  if(!smallTalk&&voice&&talkOn&&state.reader)
  {smallTalk=createSmallTalk({voice,reader:state.reader,vrm:state.vrm,subtitles,target:camera.position,music,store,every:talkEvery});if(talkStarted)smallTalk.start();}
  smallTalk?.update(dt,{greeting:!!state.greeting&&!state.greetingDone(),chatting:!!chat?.active()});
 }catch(e){   // a failure in small talk ends it for this visit, never the page
  console.error('small talk failed',e);talkBroken=true;try{smallTalk?.dispose();}catch{/* already broken */}smallTalk=null;
 }
}
// Click to talk (src/voice/chat.js): clicking her while she quietly reads starts a conversation: usually a warm line,
// about one time in three a question with answers to pick. ?chat=0 turns it off; ?ask=<id> or ?notice=<id> picks the
// first one; ?chatwait=<s> shortens the wait for an answer and ?chatcool=<s> the cool-down after a conversation.
const chatCool=params.has('chatcool')?+params.get('chatcool'):CHAT.cooldown;
const NARROW='(max-width:600px),(max-height:500px)';   // a phone, upright or sideways: the answers take the subtitle's place (answers.css)
let chat=null,chatBroken=false,chatFirstUsed=false;
function chatFrame(dt){
 if(chatBroken)return;
 try{
  if(!chat&&voice&&chatOn&&state.reader)chat=createChat({voice,reader:state.reader,vrm:state.vrm,subtitles,answers:answerPills,
   target:camera.position,store,narrow:()=>matchMedia(NARROW).matches,wait:params.has('chatwait')?+params.get('chatwait'):undefined});
  chat?.update(dt);
  if(chat)reachFrame(dt);
 }catch(e){   // a failure in a conversation ends click to talk for this visit, never the page
  console.error('click to talk failed',e);chatBroken=true;try{chat?.dispose();}catch{/* already broken */}chat=null;
 }
}
/** Whether a click on her starts a conversation now: she is only reading, past the cool-down (chat-plan.js). */
const chatGates=()=>chat&&state.reader?{ready:chat.state().ready,started:talkStarted,greeting:!!state.greeting&&!state.greetingDone(),
 talking:!!smallTalk?.state().active,chatting:chat.active(),busy:state.reader.busy(),frozen:!!(state.frozen||state.held),
 since:performance.now()/1000-chat.endedAt()}:null;
function chatFree(){const g=chatGates();return !!g&&canStart(g,chatCool);}
function pokeChat(o){
 if(!chatFree())return false;
 voice.unlock();
 const first=chatFirstUsed?null:{ask:params.get('ask')??undefined,notice:params.get('notice')??undefined};chatFirstUsed=true;
 return chat.start(o??(first?.ask||first?.notice?first:undefined));
}
// The pointer over her: a hand cursor and a very faint warm glow while a click would start a conversation (glow.js);
// the hit test (reach.js) runs at most once a frame, only when the pointer has moved. Touch has no hover: a tap is a click.
let reach=null,pointer=null,hover=false,glow=0,glowShown=0;
const canvas=renderer.domElement;
canvas.addEventListener('pointermove',e=>{if(e.pointerType!=='touch')pointer={x:e.clientX,y:e.clientY,moved:true};});
canvas.addEventListener('pointerleave',()=>{pointer=null;hover=false;});
canvas.addEventListener('click',e=>{if(chatFree()&&reach?.hit(e.clientX,e.clientY))pokeChat();});
const bookBox=()=>state.book?new THREE.Box3().setFromObject(state.book):null;   // the whole book: covers and pages
let wasFree=false;
function reachFrame(dt){
 reach??=createReach({dom:canvas,camera,capsules:()=>state.vrm?herCapsules(state.vrm):[],boxes:()=>[bookBox()]});
 const free=chatFree();   // she is only tested for while a click would start a conversation
 if(free&&pointer&&(pointer.moved||!wasFree)){hover=reach.hit(pointer.x,pointer.y);pointer.moved=false;}
 wasFree=free;
 const want=hover&&free;
 if(canvas.style.cursor!==(want?'pointer':''))canvas.style.cursor=want?'pointer':'';
 glow+=((want?1:0)-glow)*Math.min(1,dt/.25);if(glow<.005)glow=0;
 if(Math.abs(glow-glowShown)>.005||(glow===0&&glowShown!==0)){setGlow(state.vrm,glow);glowShown=glow;}
}
// Her chest on screen (CSS px), for checks that click her.
function chatPoint(){
 const b=state.vrm?.humanoid.getRawBoneNode('chest');if(!b)return null;
 const p=b.getWorldPosition(new THREE.Vector3()).project(camera),r=canvas.getBoundingClientRect();
 return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height};
}
// The book's box on screen (CSS px), for checks: nothing of a conversation may cover it.
function bookRect(){
 const box=bookBox();if(!box)return null;
 const r=renderer.domElement.getBoundingClientRect(),p=new THREE.Vector3();
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(let i=0;i<8;i++){
  p.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).project(camera);
  const x=r.left+(p.x+1)/2*r.width,y=r.top+(1-p.y)/2*r.height;
  left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
 }
 return {left,top,right,bottom};
}
// sound is allowed only after a click or key press: her voice is unlocked by the first one (the start button does too)
for(const type of ['pointerdown','keydown'])addEventListener(type,()=>voice?.unlock(),{once:true,capture:true});
setInterval(soundFrame,250);   // also without frames (a hidden tab): the music comes back up when she has finished
state.greetingDone=()=>!state.greeting||state.greeting.state().finished;
// a failure in the greeting ends it, never the page
function greetingFrame(){try{state.greeting?.update();}catch(e){console.error('greeting failed',e);try{state.greeting?.stop();}catch{/* already broken */}state.greeting=null;}}
const bindControls=()=>{if(music&&!unbindMusic)unbindMusic=bindMusicControls(music);};
const intro=withIntro?mountIntro({onStart:()=>{
 music?.start({delay:INTRO.musicDelay,fadeIn:INTRO.musicFadeIn});
 if(cameraBeep(INTRO.hudAtMs/1000))beeps++;
 greetOnStart();
 talkStarted=true;smallTalk?.start();
 hud?.powerOn(INTRO.hudAtMs);
 bindControls();
}}):null;
if(!intro)bindControls();
import.meta.hot?.dispose(()=>{intro?.dispose();hud?.unmount();unbindMusic?.();music?.dispose();state.greeting?.stop();smallTalk?.dispose();voice?.dispose();subtitles?.unmount();});
// For automated checks only; nothing here is shown to visitors.
window.lofiViewer={wind:()=>state.wind&&{t:+state.wind.t.toFixed(1),force:+state.wind.force(state.wind.t).toFixed(2),palmDeg:+(state.wind.angle('palm')*57.3).toFixed(2),leavesDeg:+(state.wind.angle('leaves')*57.3).toFixed(2),gusts:state.wind.gusts?.length??0,next:+(state.wind.next-state.wind.t).toFixed(1)},pose:()=>{const h=state.vrm.humanoid,P=n=>h.getNormalizedBoneNode(n).getWorldPosition(new THREE.Vector3()).toArray().map(x=>+x.toFixed(3));
 const out=Object.fromEntries(['neck','chest','leftShoulder','rightShoulder','leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftHand','rightHand','head'].map(n=>[n,P(n)]));
 out.rot=Object.fromEntries(['leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftHand','rightHand','leftShoulder','rightShoulder'].map(n=>[n,h.getRawBoneNode(n).getWorldQuaternion(new THREE.Quaternion()).toArray().map(x=>+x.toFixed(4))]));
 out.book=state.bookMesh&&new THREE.Box3().setFromObject(state.bookMesh).getCenter(new THREE.Vector3()).toArray().map(x=>+x.toFixed(3));
 out.shoulderQ=['leftShoulder','rightShoulder'].map(n=>h.getNormalizedBoneNode(n).quaternion.toArray().map(x=>+x.toFixed(3)));out.stretch=state.reader.stretch&&{active:state.reader.stretch.active,w:+state.reader.stretch.weight().toFixed(2),t:+state.reader.stretch.t.toFixed(2)};return out;},seat:()=>({drop:+(state.seat?.drop??0).toFixed(3),contactRadii:state.contactRadii}),ready:()=>state.ready,error:()=>state.error,
 chair:()=>{const meshes=[];state.chair?.traverse(o=>{if(o.isMesh)meshes.push(o);});return {meshes:meshes.length,visible:meshes.every(o=>o.visible&&[o.material].flat().every(m=>m.colorWrite)),receivesShadows:meshes.some(o=>o.receiveShadow),shadowMap:renderer.shadowMap.enabled};},
 stats:()=>{const f=[...state.frames].sort((a,b)=>a-b),i=renderer.info;return {calls:i.render.calls,triangles:i.render.triangles,textures:i.memory.textures,medianFrameMs:f[f.length>>1]??null,p95FrameMs:f[Math.floor(f.length*.95)]??null};},
 greet:o=>greet(o),talk:(id,o)=>smallTalk?.say(id,o)??false,smallTalk:()=>smallTalk?.state()??null,greeting:()=>voice&&{line:greetingLine,ids:voice.ids(l=>l.kind==='greeting'),...voice.state()},hush:()=>state.greeting?.stop(),voice:()=>state.greeting?.state()??null,hold:on=>{state.held=!!on;},
 grips:()=>state.reader?.gripsLocal(),hands:()=>state.reader?.handsLocal(),music:()=>music?.state()??null,beeps:()=>beeps,musicSeekEnd:s=>music?.seekToEnd(s),musicDuck:on=>music?.duck(on),
 reader:()=>{const r=state.reader;return r&&{time:+r.time.toFixed(1),line:r.reading.line,page:r.reading.page,stretch:!!r.stretch?.active,nextStretch:+(r.nextStretch-r.time).toFixed(1),
  busy:r.busy(),away:+r.reading.away.toFixed(3),eyeScale:state.vrm.lookAt?.applier?.rangeMapHorizontalOuter?.outputScale??null,head:{yaw:+r.reading.head.yaw.toFixed(2),pitch:+r.reading.head.pitch.toFixed(2)}};},
 glance:o=>state.reader?.reading.glance(o),holdReading:on=>state.reader?.reading.holdReading(on),talking:on=>{if(state.reader)state.reader.talking=!!on;}};
// click to talk, for checks: its state, start one as if she were clicked, pick an answer, the book's box on screen
Object.assign(window.lofiViewer,{chat:()=>chat&&{...chat.state(),glow:+glow.toFixed(3),free:chatFree(),gates:chatGates()},poke:o=>pokeChat(o),answer:i=>chat?.pick(i)??false,bookRect,chatPoint});
load().catch(e=>{state.error=e.message;note.textContent='The balcony could not load. Please refresh.';console.error(e);});
