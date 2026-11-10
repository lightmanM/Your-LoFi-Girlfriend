// Click to talk, decided: whether she can be clicked now, and what a click brings: usually a notice (a warm line that
// asks nothing), about one time in three a question with answers to pick. Questions and notices each go round without
// repeats (remembered across visits); never two questions in a row, never two heavier questions one after the other.
// Pure functions, apart from the storage passed in. Lines: the ask / notice lines of public/voice/lines.json.
import {pickNext,TALK} from './talk-plan.js';

export const CHAT=Object.freeze({
 ask:1/3,               // share of clicks that bring a question (the owner: questions on every click were too many)
 wait:15,               // s she waits for an answer before letting it go
 cooldown:3,            // s after a conversation before she can be clicked again (the owner: 20 s was too long)
 answersAfter:.2,       // s after her question's last word before the answers show
 soft:.35,              // her gentler smile, for a reply to a harder answer (against TALK.smile .7)
 hold:90,               // s her look at you is held for; the conversation cancels it when it ends
 key:'lofi-girlfriend.chat.heard',
 // subtle variety (the owner: "All your subtle varieties are fine to me"): degrees of head roll / pitch, s, lid weight
 motion:Object.freeze({
  tilt:4,tiltEase:.8,   // a curious tilt while she waits for your answer, or as she says a notice "with a tilt"
  nod:2,nodTime:.6,     // the nod when you pick, and at the end of a light line to you
  lids:.45,             // eyelids lowered over the first sentence of a reply to a harder answer
  slowEase:1.6,         // s: a heavier question is looked up into a little more slowly
  closeEyes:.5,closeLids:.85,   // a let-go line starts with her eyes closing for a moment
 }),
});

const FRESH=Object.freeze({asks:Object.freeze({heard:[],last:null}),notices:Object.freeze({heard:[],last:null}),lastKind:null});
const POOL={ask:'asks',notice:'notices'};

/**
 * What a click brings.
 * @param {{id:string,kind:string,mood?:string}[]} lines
 * @param {{asks:{heard:string[],last:string|null},notices:{heard:string[],last:string|null},lastKind:string|null}} memory
 * @returns {{kind:'ask'|'notice',id:string|null,memory:object}} the line and the new memory (a new object)
 */
export function pickChat(lines,memory,random=Math.random){
 const asks=lines.filter(l=>l.kind==='ask'),notices=lines.filter(l=>l.kind==='notice');
 // a question can only follow a notice, so the chance after a notice is ask/(1-ask): one in three clicks overall
 const wantAsk=memory.lastKind!=='ask'&&random()<CHAT.ask/(1-CHAT.ask);
 const kind=!notices.length||(wantAsk&&asks.length)?'ask':'notice';
 const pool=POOL[kind],r=pickNext(kind==='ask'?asks:notices,{...memory[pool],random});
 return {kind,id:r.id,memory:{...memory,[pool]:{heard:r.heard,last:r.id},lastKind:kind}};
}

const MOTIONS=['look','midway','tilt'];
/**
 * How she looks up for a line: questions, replies and let-go lines a full look; a notice a full look, eyes first
 * (looking up partway through: only for a line long enough, as small talk does) or with a tilt, never the same way
 * as the last notice when another way is allowed.
 * @returns {'look'|'midway'|'tilt'}
 */
export function chatMotion(line,{last=null,random=Math.random}={}){
 if(line.kind!=='notice')return 'look';
 let ways=MOTIONS.filter(m=>m!=='midway'||line.duration>=TALK.short);
 if(ways.length>1)ways=ways.filter(m=>m!==last);
 return ways[Math.min(ways.length-1,Math.floor(random()*ways.length))];
}

/**
 * Whether a click on her starts a conversation now: the page has started and her lines are in, and she is only
 * reading (no greeting, small talk, conversation, page turn, look or break), past the cool-down.
 * @param {{ready:boolean,started:boolean,greeting:boolean,talking:boolean,chatting:boolean,busy:boolean,frozen:boolean,since:number}} s
 *  since: s since the last conversation ended (Infinity before the first)
 */
export function canStart({ready,started,greeting,talking,chatting,busy,frozen,since},cooldown=CHAT.cooldown){
 return !!(ready&&started)&&!greeting&&!talking&&!chatting&&!busy&&!frozen&&since>=cooldown;
}

/** A conversation that did not finish (a hidden tab, a failed clip): its line is unheard again. @returns a new memory */
export function forgetChat(memory,id){
 const out={...memory};
 for(const pool of Object.values(POOL)){
  const p=memory[pool];
  if(p.heard.includes(id)||p.last===id)out[pool]={heard:p.heard.filter(x=>x!==id),last:p.last===id?null:p.last};
 }
 return out;
}

const validPool=p=>Array.isArray(p?.heard)&&p.heard.every(x=>typeof x==='string')&&(p.last===null||p.last===undefined||typeof p.last==='string');
// Storage can be missing, blocked or hold anything: then she starts fresh rounds.
/** @param {Storage|undefined} storage */
export function loadChat(storage){
 try{
  const m=JSON.parse(storage?.getItem(CHAT.key)??'null');
  if(validPool(m?.asks)&&validPool(m?.notices))
   return {asks:{heard:m.asks.heard,last:m.asks.last??null},notices:{heard:m.notices.heard,last:m.notices.last??null},
    lastKind:m.lastKind==='ask'||m.lastKind==='notice'?m.lastKind:null};
 }catch{/* fresh rounds */}
 return {asks:{...FRESH.asks,heard:[]},notices:{...FRESH.notices,heard:[]},lastKind:null};
}
/** @param {Storage|undefined} storage */
export function saveChat(storage,memory){
 try{storage?.setItem(CHAT.key,JSON.stringify(memory));}catch{/* no memory this time: a later visit may repeat */}
}
