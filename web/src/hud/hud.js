// Mounts the camera-frame HUD over the scene. Controls unfold on mouse movement, taps or keys, and fold away again.
import '@fontsource/dm-mono/latin-400.css';
import './hud.css';
import {mountCameraFrame} from './camera-frame.js';
import {mountMusicLine} from './music-line.js';

export const HUD=Object.freeze({awakeMs:3000});

/** @returns {{unmount:()=>void,restartCounter:()=>void}} */
export function mountHud(music,{parent=document.body,stage=document.getElementById('stage'),now=()=>performance.now()}={}){
 const root=document.createElement('div');root.className='hud';root.inert=true;parent.append(root);
 const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const frame=mountCameraFrame(root,now());
 const line=music?mountMusicLine(root,music,{still}):null;
 let awakeUntil=0,raf=0,keyboardFocus=false;
 const poke=()=>{awakeUntil=now()+HUD.awakeMs;};
 const setAwake=()=>root.classList.toggle('awake',now()<awakeUntil||keyboardFocus||line?.isHovered()||line?.isOpen());
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
  if(root.inert&&(!stage||stage.classList.contains('ready')))root.inert=false;   // not clickable while still invisible
  setAwake();
  const t=now();frame.update(t);line?.update(t);
 }
 tick();
 return {
  restartCounter:()=>frame.restart(now()),   // the camera "starts recording" (after the intro)
  unmount(){cancelAnimationFrame(raf);for(const [t,f] of events)window.removeEventListener(t,f);root.remove();},
 };
}
