// Playlist parsing and shuffle order for the background music. Pure functions: no DOM, no audio.
import {dbToGain} from './fades.js';

const FORMAT=1;
const FILE=/^[a-z0-9][a-z0-9-]*\.mp3$/;       // plain file names next to playlist.json, nothing else
const GAIN_DB={min:-30,max:6};
const MAX_TEXT=200;   // titles and artists go into the lock-screen metadata
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=MAX_TEXT;
const https=v=>typeof v==='string'&&v.length<=2048&&/^https:\/\/\S+$/.test(v);

/** @returns {string|null} why a playlist entry is unusable, or null when it is fine */
function problem(t){
 if(!t||typeof t!=='object')return 'not an object';
 if(!text(t.id))return 'id';
 if(!FILE.test(t.file??''))return 'file';
 if(!text(t.title)||!text(t.artist))return 'title/artist';
 if(!(Number.isFinite(t.duration)&&t.duration>0))return 'duration';
 if(!(Number.isFinite(t.gain_db)&&t.gain_db>=GAIN_DB.min&&t.gain_db<=GAIN_DB.max))return 'gain_db';
 if(!text(t.license?.name)||!https(t.license?.url))return 'license';
 return null;
}

/**
 * Validate playlist.json and resolve each file against `base` (e.g. '/music/').
 * Throws when the file is unusable as a whole; individual bad entries are dropped and reported in `rejected`.
 * @returns {{tracks:ReadonlyArray<{id:string,url:string,title:string,artist:string,duration:number,gain:number,license:{name:string,url:string},source:string|null}>,rejected:Array<{index:number,reason:string}>}}
 */
export function parsePlaylist(data,base){
 if(!data||data.version!==FORMAT||!Array.isArray(data.tracks))throw new Error('music: unsupported playlist format');
 if(data.tracks.length===0)throw new Error('music: playlist is empty');
 const rejected=[],tracks=[],ids=new Set();
 data.tracks.forEach((t,index)=>{
  const reason=problem(t)??(ids.has(t.id)?'duplicate id':null);
  if(reason){rejected.push({index,reason});return;}
  ids.add(t.id);
  tracks.push(Object.freeze({id:t.id,url:base+t.file,title:t.title.trim(),artist:t.artist.trim(),duration:t.duration,
   gain:dbToGain(t.gain_db),license:Object.freeze({name:t.license.name,url:t.license.url}),source:https(t.source)?t.source:null}));
 });
 if(tracks.length===0)throw new Error('music: no playable tracks in playlist');
 return {tracks:Object.freeze(tracks),rejected};
}

/** A shuffled round of track indices; the first differs from `avoid` so rounds never repeat back to back. */
export function makeBag(count,rng=Math.random,avoid=-1){
 const bag=[...Array(count).keys()];
 for(let i=count-1;i>0;i--){const j=Math.floor(rng()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
 if(count>1&&bag[0]===avoid){const k=1+Math.floor(rng()*(count-1));[bag[0],bag[k]]=[bag[k],bag[0]];}
 return bag;
}

export const EMPTY_QUEUE=Object.freeze({bag:Object.freeze([]),pos:0,last:-1});

/**
 * The next track to play. Returns a new queue (the given one is untouched) and the index, or -1 when every
 * track has failed.
 */
export function advance(queue,count,rng=Math.random,failed=new Set()){
 if(count<=0||failed.size>=count)return {queue,index:-1};
 let {bag,pos,last}=queue;
 for(let tries=0;tries<count*2+1;tries++){
  if(pos>=bag.length){bag=Object.freeze(makeBag(count,rng,last));pos=0;}
  const index=bag[pos++];
  if(!failed.has(index))return {queue:Object.freeze({bag,pos,last:index}),index};
 }
 return {queue:Object.freeze({bag,pos,last}),index:-1};
}
