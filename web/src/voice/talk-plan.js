// Small talk, decided: when her next line falls due, which line it is (each once per round, never two dark lines in a
// row, remembered across visits), which subtle motion goes with it, its timing, and which subtitle part is showing.
// Pure functions, apart from the storage passed in. Lines: the talk lines of public/voice/lines.json.

export const TALK=Object.freeze({
 every:Object.freeze([60,120]),    // s between lines, at random (the owner's choice: every 1 to 2 minutes)
 breath:3,                          // s after anything else she was doing
 prefetch:20,                       // s before a line is due, its audio starts downloading
 short:4.5,                         // s: shorter lines to you may be an eyes-only look; longer ones a glance mid-line
 linger:1,                          // s she keeps her look after the line
 ease:1.2,                          // s each motion eases in and out (soft settle: look-ease.js)
 selfLead:.6,                       // s from the start of a motion to herself to her first word
 subtitleLead:.1,
 key:'lofi-girlfriend.talk.heard',
 aside:Object.freeze({yaw:-14,pitch:-4}),   // glance toward the daybed side of the picture (her right)
 up:Object.freeze({yaw:5,pitch:-9}),        // thinking up (yaw sign at random)
 tilt:Object.freeze({roll:2.5}),               // a small tilt (side at random): ~8° as seen from the camera, since her head points down at the book
 lids:Object.freeze({weight:.5,from:.2,to:.8}),   // eyes half-closed over this share of a dark line
 eyes:Object.freeze({share:.75}),            // a smaller look: the head takes this share, her widened eyes the rest
                                             // (the camera is ~52° off her reading direction; eyes stay within 24°)
 stuck:5,                                    // s past a line's end, on the page clock, after which it is ended anyway
                                             // (its voice clock stopped: sound suspended, e.g. a phone locked)
 smile:.7,                                   // her smile to you, against the greeting's
 nod:1.8,                                    // degrees
});

const SELF=Object.freeze({page:l=>l.about==='book'?3:1,aside:()=>1,up:l=>l.about==='thought'?2:1,tilt:()=>1,lids:l=>l.mood==='dark'?1:0});
// 'eyes' (a smaller look: head partway, widened eyes the rest) is not picked: from this camera her eyes read as
// narrowed rather than meeting yours. It can still be asked for (lofiViewer.talk(id,{motion:'eyes'})).
const YOU=Object.freeze({look:()=>2,midway:l=>l.duration>=TALK.short?1:0});
const pick=(items,random)=>items[Math.min(items.length-1,Math.floor(random()*items.length))];

/** Seconds until the next line, at random within `every`. */
export function nextDelay(random=Math.random,every=TALK.every){
 return every[0]+(every[1]-every[0])*random();
}

/**
 * The next line: one not yet heard this round; never a dark line after a dark one (also across rounds), keeping the
 * rest of the round arrangeable that way; never the line just said.
 * @param {{id:string,mood:string}[]} lines
 * @param {{heard?:string[],last?:string|null,random?:()=>number}} [o]
 * @returns {{id:string|null,heard:string[]}} the line and the round's new memory (a new array)
 */
export function pickNext(lines,{heard=[],last=null,random=Math.random}={}){
 if(!lines.length)return {id:null,heard:[]};
 const ids=new Set(lines.map(l=>l.id)),isDark=l=>l.mood==='dark';
 const prev=ids.has(last)?lines.find(l=>l.id===last):null;
 let done=heard.filter(id=>ids.has(id)),left=lines.filter(l=>!done.includes(l.id));
 if(!left.length){done=[];left=[...lines];}
 const pool=left.length>1?left.filter(l=>l!==prev):left;
 const D=left.filter(isDark).length,L=left.length-D;
 let cand=pool;
 if(prev&&isDark(prev))cand=pool.filter(l=>!isDark(l)).length?pool.filter(l=>!isDark(l)):lines.filter(l=>!isDark(l)&&l!==prev);
 else if(D>0&&D>=L+1)cand=pool.filter(isDark);   // otherwise two dark lines would have to meet later this round
 if(!cand.length)cand=pool;
 const id=pick(cand,random).id;
 return {id,heard:[...done,id]};
}

/**
 * A subtle motion for a line, never the one used last time when another is allowed.
 * @param {{to:string,about:string,mood:string,duration:number}} line
 * @returns {'page'|'aside'|'up'|'tilt'|'lids'|'look'|'midway'|'eyes'}
 */
export function pickMotion(line,{last=null,random=Math.random}={}){
 let w=Object.entries(line.to==='you'?YOU:SELF).map(([m,f])=>[m,f(line)]).filter(([,x])=>x>0);
 if(w.length>1)w=w.filter(([m])=>m!==last);
 let r=random()*w.reduce((s,[,x])=>s+x,0);
 for(const [m,x] of w)if((r-=x)<0)return m;
 return w[w.length-1][0];
}

/**
 * A talk's timing, in s from its start: when she speaks, when she looks at you (null: she doesn't), when it is over.
 * @param {{duration:number,parts?:{start:number}[]}} line
 */
export function talkPlan(line,motion,o=TALK){
 const looks=motion==='look'||motion==='eyes',mid=motion==='midway';
 const speak=looks?o.ease:mid?.3:o.selfLead;
 const look=looks?0:mid?speak+(line.parts?.[1]?.start??line.duration/3)-o.ease:null;
 return {speak,look,end:speak+line.duration+o.linger+o.ease};
}

/** The subtitle showing at t (s into the audio): the whole line, or the part being spoken. */
export function subtitleAt(line,t,lead=TALK.subtitleLead){
 if(!line.parts?.length)return line.subtitle;
 let part=line.parts[0];
 for(const p of line.parts)if(p.start-lead<=t)part=p;
 return {ja:part.ja,en:part.en};
}

/**
 * A line chosen but not said (nobody was listening): unheard again, and the line said before it is the last again,
 * so the no-two-dark-lines rule still sees what she really said last.
 * @returns {{heard:string[],last:string|null}} a new memory
 */
export function forget({heard},id,last){
 return {heard:heard.filter(x=>x!==id),last};
}

// Storage can be missing, blocked or hold anything: then she starts a fresh round.
/** @param {Storage|undefined} storage @returns {{heard:string[],last:string|null}} */
export function loadHeard(storage){
 try{
  const m=JSON.parse(storage?.getItem(TALK.key)??'null');
  if(Array.isArray(m?.heard)&&m.heard.every(x=>typeof x==='string'))return {heard:m.heard,last:typeof m.last==='string'?m.last:null};
 }catch{/* fresh round */}
 return {heard:[],last:null};
}
/** @param {Storage|undefined} storage @param {{heard:string[],last:string|null}} memory */
export function saveHeard(storage,{heard,last}){
 try{storage?.setItem(TALK.key,JSON.stringify({heard,last}));}catch{/* no memory this time: a later visit may repeat */}
}
