// Mounts the camera-frame HUD over the scene. Controls unfold on mouse movement, taps or keys, and fold away again.
import '@fontsource/dm-mono/latin-400.css';
import './hud.css';
import {mountCameraFrame} from './camera-frame.js';
import {mountMusicLine} from './music-line.js';

export const HUD=Object.freeze({awakeMs:3000,autoPowerMs:200,introShowMs:2500});   // introShowMs: controls stay up after power-on
/** Power-on order, ms after it starts: corners first, then rec, the counter (starting at 00:00:00) and the music line. */
export const POWER=Object.freeze({rec:500,counter:700,music:900,done:1300});   // done: the last part has settled

/**
 * `autoPower`: power on by itself once the scene shows; otherwise wait for powerOn() (the intro calls it).
 * @returns {{powerOn:(delayMs?:number)=>void,unmount:()=>void}}
 */
export function mountHud(music,{autoPower=true,parent=document.body,stage=document.getElementById('stage'),now=()=>performance.now()}={}){
 const root=document.createElement('div');root.className='hud';root.inert=true;parent.append(root);
 for(const [k,v] of Object.entries(POWER))root.style.setProperty(`--p-${k}`,`${v}ms`);
 const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const frame=mountCameraFrame(root,now());
 const line=music?mountMusicLine(root,music,{still}):null;
 // At power-on the controls wake with the music line, stay up briefly, then fold. Until the music line appears,
 // activity is ignored, so the click that started the page does not count.
 let awakeUntil=0,raf=0,keyboardFocus=false,powered=false,powerTimer=0,doneTimer=0,controlsFrom=Infinity;
 function powerOn(delayMs=0){
  if(powered)return;powered=true;
  const wait=Math.max(0,delayMs);
  controlsFrom=now()+wait+POWER.music;
  awakeUntil=controlsFrom+(POWER.done-POWER.music)+HUD.introShowMs;
  powerTimer=setTimeout(()=>{root.classList.add('power');frame.restart(now()+POWER.counter);},wait);
  doneTimer=setTimeout(()=>root.classList.add('powered'),wait+POWER.done);
 }
 const poke=()=>{const t=now();if(t>=controlsFrom)awakeUntil=t+HUD.awakeMs;};
 const setAwake=()=>{const t=now();root.classList.toggle('awake',t>=controlsFrom&&(t<awakeUntil||keyboardFocus||line?.isHovered()||line?.isOpen()));};
 const onKey=e=>{if(e.key==='Escape')line?.close();poke();};
 const onDown=e=>{if(line?.isOpen()&&!line.contains(e.target))line.close();poke();};
 // keyboard focus inside the HUD keeps it open; wake synchronously so Tab never lands on hidden controls
 const onFocusIn=e=>{keyboardFocus=e.target.matches?.(':focus-visible')??false;poke();setAwake();};
 const onFocusOut=()=>{keyboardFocus=false;};
 const events=[['pointermove',poke],['pointerdown',onDown],['keydown',onKey]];
 for(const [t,f] of events)window.addEventListener(t,f,{passive:true});
 root.addEventListener('focusin',onFocusIn);root.addEventListener('focusout',onFocusOut);
 function tick(){
  raf=requestAnimationFrame(tick);
  if(root.inert&&(!stage||stage.classList.contains('ready'))){root.inert=false;if(autoPower)powerOn(HUD.autoPowerMs);}   // not clickable while still invisible
  setAwake();
  const t=now();frame.update(t);line?.update(t);
 }
 tick();
 return {
  powerOn,
  unmount(){clearTimeout(powerTimer);clearTimeout(doneTimer);cancelAnimationFrame(raf);for(const [t,f] of events)window.removeEventListener(t,f);root.remove();},
 };
}
