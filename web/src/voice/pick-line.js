// Which greeting she says this visit: one at random, never the one from last visit (remembered in the browser), or
// the one asked for by name (?line=<id>). Pure, apart from the storage passed in.

export const PICK=Object.freeze({key:'lofi-girlfriend.greeting.last'});

/**
 * @param {string[]} ids the lines to choose from
 * @param {{want?:string|null,last?:string|null,random?:()=>number}} [o] want: a line by name; last: last visit's line
 * @returns {string|null}
 */
export function pickLine(ids,{want=null,last=null,random=Math.random}={}){
 if(want&&ids.includes(want))return want;
 const fresh=ids.length>1?ids.filter(id=>id!==last):ids;
 if(!fresh.length)return null;
 return fresh[Math.min(fresh.length-1,Math.floor(random()*fresh.length))];
}

// Storage can be missing or throw (private windows, blocked site data): then she simply has no memory of last time.
/** @param {Storage|undefined} storage @returns {string|null} */
export function lastLine(storage){
 try{return storage?.getItem(PICK.key)??null;}catch{return null;}
}
/** @param {Storage|undefined} storage @param {string} id */
export function rememberLine(storage,id){
 try{storage?.setItem(PICK.key,id);}catch{/* no memory this time: the next visit may repeat this line */}
}
