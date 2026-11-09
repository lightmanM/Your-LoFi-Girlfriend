// How loud her voice plays against the music controls: at the default music volume she is at her full level, she
// follows the volume down from there (capped at full when the music is turned up), and muted or volume 0 is silent.
// No music at all: full level. Pure.
import {MUSIC} from '../music/player.js';

/** @param {{volume:number,muted:boolean}|null} music the music's state @returns {number} 0..1 */
export function voiceLevel(music,base=MUSIC.volume){
 if(!music)return 1;
 if(music.muted)return 0;
 return Math.min(1,Math.max(0,music.volume/base));
}
