// Opening shot: the scene starts out of focus with a "start" button. Pressing it (or Enter/Space) pulls the camera
// into focus, then hands over to the page: `onStart` runs inside that gesture, so music is allowed to play.
import '@fontsource/dm-mono/latin-400.css';
import './intro.css';

export const INTRO=Object.freeze({
 focusMs:3200,     // the focus pull
 hudAtMs:900,      // the camera display powers on this far into the focus pull
 musicDelay:1.6,   // seconds of silence before the music rises, so it arrives as the picture sharpens
 musicFadeIn:4,    // seconds for the music to rise to full volume
});
const START_KEYS=new Set(['Enter',' ']);

/** @returns {{started:()=>boolean,dispose:()=>void}} */
export function mountIntro({onStart,parent=document.body,stage=document.getElementById('stage')}={}){
 const body=document.body;
 body.classList.add('is-intro');body.style.setProperty('--focus-ms',`${INTRO.focusMs}ms`);body.style.setProperty('--hud-at',`${INTRO.hudAtMs}ms`);
 const root=document.createElement('div');root.className='intro';
 const button=document.createElement('button');button.type='button';button.textContent='start';button.setAttribute('aria-label','start');
 root.append(button);parent.append(root);
 const ready=()=>!stage||stage.classList.contains('ready');
 let started=false,timer=0;

 function go(e){
  e?.preventDefault?.();e?.stopPropagation?.();
  if(started||!ready())return;
  started=true;window.removeEventListener('keydown',onKey,true);
  body.classList.replace('is-intro','is-focusing');root.classList.add('leaving');
  try{onStart?.();}catch(err){console.error('intro: start failed',err);}   // the scene still comes into focus
  timer=setTimeout(()=>{body.classList.remove('is-focusing');root.remove();},INTRO.focusMs);
 }
 function onKey(e){if(START_KEYS.has(e.key)&&!e.repeat&&!e.metaKey&&!e.ctrlKey&&!e.altKey)go(e);}
 button.addEventListener('click',go);
 window.addEventListener('keydown',onKey,true);   // capture: nothing else reacts to the key that starts the page
 return {
  started:()=>started,
  dispose(){clearTimeout(timer);window.removeEventListener('keydown',onKey,true);root.remove();body.classList.remove('is-intro','is-focusing');},
 };
}
