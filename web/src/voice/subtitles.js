// Subtitles for her lines: the Japanese as she says it, the English beneath. Announced politely to screen readers.
import '@fontsource/dm-mono/latin-400.css';
import './subtitles.css';

// murmur: something she says to herself (styled like the rest since the owner found it hard to read); lifted: raised
// to make room for her question's answers beneath it on a wide screen (subtitles.css, answers.js).
/** @returns {{set:(visible:boolean,subtitle?:{ja:string,en?:string},o?:{murmur?:boolean,lifted?:boolean})=>void,visible:()=>boolean,murmur:()=>boolean,text:()=>string,unmount:()=>void}} */
export function mountSubtitles(parent=document.body){
 const root=document.createElement('div');root.className='subtitles';root.setAttribute('aria-live','polite');
 const ja=document.createElement('p'),en=document.createElement('p');
 ja.className='ja';ja.lang='ja';en.className='en';en.lang='en';root.append(ja,en);parent.append(root);
 let shown=null;
 return {
  set(visible,subtitle,{murmur=false,lifted=false}={}){
   // compared by text: a line in parts hands a new object every frame, and rewriting it would re-announce it
   if(visible&&subtitle&&(subtitle.ja!==shown?.ja||subtitle.en!==shown?.en)){shown=subtitle;ja.textContent=subtitle.ja;en.textContent=subtitle.en??'';en.hidden=!subtitle.en;}
   if(visible){root.classList.toggle('murmur',!!murmur);root.classList.toggle('lifted',!!lifted);}   // kept while fading out, so nothing jumps
   root.classList.toggle('on',!!visible);
  },
  visible:()=>root.classList.contains('on'),
  murmur:()=>root.classList.contains('murmur'),
  text:()=>`${ja.textContent}${en.textContent?` / ${en.textContent}`:''}`,
  unmount(){root.remove();},
 };
}
