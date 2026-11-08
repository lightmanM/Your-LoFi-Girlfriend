// The music line of the camera HUD: level bars and the song, plus controls and credits that unfold on interaction.
import {musicLine,barHeights} from './format.js';

const SVG='http://www.w3.org/2000/svg';
const ICONS={
 pause:'<rect class="fill" x="3.5" y="2.5" width="3" height="11" rx=".6"/><rect class="fill" x="9.5" y="2.5" width="3" height="11" rx=".6"/>',
 play:'<path class="fill" d="M4 2.5l9 5.5-9 5.5z"/>',
 next:'<path class="fill" d="M2 3l6 5-6 5zM8 3l6 5-6 5z"/>',
 volume:'<path d="M2 6h3l4-3v10l-4-3H2z"/><path d="M11.5 5.5a3.5 3.5 0 010 5"/>',
 muted:'<path d="M2 6h3l4-3v10l-4-3H2z"/><path d="M11 6l4 4M15 6l-4 4"/>',
 info:'<circle cx="8" cy="8" r="6.2"/><path d="M8 7.2v4M8 4.8v.1"/>',
 list:'<path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><circle class="fill" cx="2.6" cy="4" r=".9"/><circle class="fill" cx="2.6" cy="8" r=".9"/><circle class="fill" cx="2.6" cy="12" r=".9"/>',
};
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
function icon(name){const s=document.createElementNS(SVG,'svg');s.setAttribute('viewBox','0 0 16 16');s.setAttribute('aria-hidden','true');s.innerHTML=ICONS[name];return s;}
function setIcon(button,name){if(button.dataset.icon!==name){button.replaceChildren(icon(name));button.dataset.icon=name;}}
function button(cls,label,iconName,onClick){
 const b=el('button',cls);b.type='button';b.setAttribute('aria-label',label);if(iconName)setIcon(b,iconName);
 b.addEventListener('click',e=>{e.stopPropagation();onClick(e);});   // HUD clicks are not "tap anywhere" clicks
 return b;
}
/** A HUD press is a user gesture: let it wake audio the system suspended (calls, lock screen). */
const gesture=music=>{const s=music.state().status;if(s==='playing'||s==='paused')music.wake();};
function link(text,href,cls=null){const a=el('a',cls,text);a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;}

/** The playlist panel: every track; pick one to play it, "source" opens its page on Free Music Archive. */
function playlistPanel(music){
 const panel=el('div','hud-playlist');panel.hidden=true;panel.tabIndex=-1;panel.id='hud-playlist';
 panel.setAttribute('role','dialog');panel.setAttribute('aria-label','playlist');
 panel.addEventListener('click',e=>e.stopPropagation());
 let rows=[];
 const fill=()=>{
  const list=el('ol');
  rows=music.playlist().map(t=>{
   const li=el('li');
   const pick=el('button','hud-pick');pick.type='button';pick.dataset.id=t.id;
   pick.append(el('span','hud-pick-title',t.title),el('span','hud-pick-artist',` — ${t.artist}`));
   pick.setAttribute('aria-label',`play ${t.title} by ${t.artist}`);
   pick.addEventListener('click',e=>{e.stopPropagation();music.playTrack(t.id);mark(t.id);});
   li.append(pick);
   if(t.source){
    const src=link('',t.source,'hud-source');src.append(icon('info'));
    src.setAttribute('aria-label',`source of ${t.title}`);src.title='source';
    li.append(src);
   }
   list.append(li);
   return {id:t.id,li,pick};
  });
  panel.replaceChildren(el('h2',null,'PLAYLIST · FREE MUSIC ARCHIVE'),list);
 };
 /** Highlight the playing track. */
 function mark(id){
  for(const r of rows){const on=r.id===id;r.li.classList.toggle('playing',on);if(on)r.pick.setAttribute('aria-current','true');else r.pick.removeAttribute('aria-current');}
 }
 return {panel,fill,mark};
}

/** @returns {{update:(nowMs:number)=>void,isOpen:()=>boolean,close:()=>void}} */
export function mountMusicLine(root,music,{still=false}={}){
 const wrap=el('div','hud-music');
 const eq=el('div','hud-eq');const bars=[el('b'),el('b'),el('b')];eq.append(...bars);eq.setAttribute('aria-hidden','true');
 const note=el('span','hud-note','♪');note.setAttribute('aria-hidden','true');
 const title=el('span','hud-title');
 const now=button('hud-now','music',null,()=>{if(musicLine(music.state()).action==='start')music.start();});
 now.append(note,eq,title);
 const toggle=button('','pause','pause',()=>{gesture(music);music.toggle();});
 const next=button('','next song','next',()=>{gesture(music);music.next();});
 const mute=button('','mute','volume',()=>{gesture(music);music.toggleMute();});
 const vol=el('input','hud-vol');Object.assign(vol,{type:'range',min:'0',max:'1',step:'0.01'});vol.setAttribute('aria-label','volume');
 vol.addEventListener('input',()=>{gesture(music);music.setVolume(+vol.value);vol.style.setProperty('--v',`${vol.value*100}%`);});
 vol.addEventListener('click',e=>e.stopPropagation());
 const {panel,fill,mark}=playlistPanel(music);
 const setOpen=open=>{
  const hadFocus=panel.contains(document.activeElement);
  panel.hidden=!open;info.setAttribute('aria-expanded',String(open));
  if(open){fill();mark(music.state().track?.id);panel.focus({preventScroll:true});panel.querySelector('li.playing')?.scrollIntoView({block:'center'});}else if(hadFocus)info.focus();
 };
 const info=button('','playlist','list',()=>setOpen(panel.hidden));
 info.setAttribute('aria-controls',panel.id);info.setAttribute('aria-expanded','false');
 const ctl=el('div','hud-ctl');ctl.append(toggle,next,mute,vol,info);
 const row=el('div','hud-row');row.append(now,ctl);
 wrap.append(row,panel);root.append(wrap);
 // 2. hover keeps the controls open, for mice and pens only (touch has no hover; iOS keeps a sticky one)
 let hovered=false;
 wrap.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')hovered=true;});
 wrap.addEventListener('pointerleave',()=>{hovered=false;});
 window.addEventListener('blur',()=>{hovered=false;});

 let shown='',level=[0,0,0];
 function text(s){
  const line=musicLine(s),key=`${s.status}|${s.track?.id}|${line.title}|${line.artist}|${s.muted}|${s.volume}`;
  if(key===shown)return;shown=key;
  if(!panel.hidden)mark(s.track?.id);
  title.replaceChildren(document.createTextNode(line.title));
  if(line.artist)title.append(el('span',null,` · ${line.artist}`));
  now.setAttribute('aria-label',line.artist?`${line.title}, ${line.artist}`:line.title);
  now.setAttribute('aria-disabled',String(line.action!=='start'));
  const active=s.status==='playing'||s.status==='paused';
  eq.hidden=!active;note.hidden=active;
  ctl.classList.toggle('ready',active);
  ctl.inert=!active;
  if(!active&&!panel.hidden)setOpen(false);
  setIcon(toggle,s.status==='playing'?'pause':'play');toggle.setAttribute('aria-label',s.status==='playing'?'pause':'play');
  setIcon(mute,s.muted?'muted':'volume');mute.setAttribute('aria-label',s.muted?'unmute':'mute');
  if(document.activeElement!==vol){vol.value=String(s.volume);vol.style.setProperty('--v',`${s.volume*100}%`);}
 }
 function meter(s){
  const target=s.status==='playing'&&!s.muted?music.levels():[0,0,0];
  level=level.map((v,i)=>v+(target[i]-v)*(target[i]>v?.5:.12));   // quick rise, slow fall
  const h=barHeights(level,{still:still&&s.status==='playing'});
  bars.forEach((b,i)=>{const v=`${h[i]}px`;if(b.style.height!==v)b.style.height=v;});
 }
 return {
  update(){const s=music.state();text(s);if(!eq.hidden)meter(s);},
  isOpen:()=>!panel.hidden,
  isHovered:()=>hovered,
  close:()=>setOpen(false),
  contains:node=>wrap.contains(node),
 };
}
