// Stand-in controls until the player UI is designed. Nothing is drawn: a click or tap anywhere starts the music
// (browsers only allow sound after a gesture); Space plays or pauses, N skips, M mutes.
export const MUSIC_KEYS=Object.freeze({toggle:' ',next:'n',mute:'m'});
const TYPING=/^(INPUT|TEXTAREA|SELECT)$/;
const ACTIVATES=/^(BUTTON|A|SUMMARY)$/;   // Space already presses these: let it, rather than also toggling

/** @returns {() => void} removes the listeners */
export function bindMusicControls(music,target=window){
 const onClick=()=>music.wake();   // starts the music, or wakes audio the system suspended
 const onKey=e=>{
  if(e.repeat||e.metaKey||e.ctrlKey||e.altKey||e.defaultPrevented)return;
  if(e.target?.isContentEditable||TYPING.test(e.target?.tagName??''))return;
  const k=e.key?.toLowerCase();
  if(k===MUSIC_KEYS.toggle){if(ACTIVATES.test(e.target?.tagName??'')||e.target?.closest?.('[role=dialog]'))return;e.preventDefault();music.toggle();}
  else if(k===MUSIC_KEYS.next)music.next();
  else if(k===MUSIC_KEYS.mute)music.toggleMute();
 };
 target.addEventListener('click',onClick);target.addEventListener('keydown',onKey);
 return ()=>{target.removeEventListener('click',onClick);target.removeEventListener('keydown',onKey);};
}
