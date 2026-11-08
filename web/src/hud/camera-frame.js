// The camcorder frame: corner marks, a blinking "rec" and a counter running since the page opened.
import {formatTimecode} from './format.js';

const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};

/** @returns {{update:(nowMs:number)=>void,restart:(nowMs:number)=>void}} */
export function mountCameraFrame(root,startMs=performance.now()){
 root.append(el('div','hud-exposure'));   // the brief over-exposure as the camera wakes
 for(const c of ['tl','tr','bl','br'])root.append(el('div',`hud-corner ${c}`));
 const rec=el('div','hud-rec');rec.setAttribute('aria-hidden','true');rec.append(el('i'),document.createTextNode('rec'));
 const tc=el('div','hud-tc',formatTimecode(0));tc.setAttribute('aria-hidden','true');
 root.append(rec,tc);
 let shown='';
 return {
  update(nowMs){const s=formatTimecode((nowMs-startMs)/1000);if(s!==shown){tc.textContent=s;shown=s;}},
  restart(nowMs){startMs=nowMs;},
 };
}
