import {test,expect} from '@playwright/test';
import {ownerFiles} from './owner-files.js';
import {readFileSync} from 'node:fs';
// Click to talk: a question with answers to pick and her reply, a notice, letting an unanswered question go, her face,
// the pills by keyboard and on a phone, and the ways a conversation ends early. Conversations are started with
// lofiViewer.poke({ask|notice}) here; clicking her is checked in the tests at the end.
const sceneReady=async request=>(await ownerFiles(request));
const LINES=JSON.parse(readFileSync(new URL('../public/voice/lines.json',import.meta.url),'utf8')).lines;
const line=id=>LINES.find(l=>l.id===id);
const QUIET='/?intro=0&music=0&greet=0&talkevery=9999';
const ready=page=>page.waitForFunction(()=>window.lofiViewer?.ready()&&window.lofiViewer.chat()&&window.lofiViewer.chat().ready,null,{timeout:60000});
const chat=page=>page.evaluate(()=>window.lofiViewer.chat());
const phase=(page,p,timeout=20000)=>page.waitForFunction(p=>window.lofiViewer.chat().phase===p,p,{timeout});
const over=(page,timeout=30000)=>page.waitForFunction(()=>!window.lofiViewer.chat().active,null,{timeout});
const settled=page=>page.waitForFunction(()=>window.lofiViewer.reader().away<.05,null,{timeout:5000});
// Record every frame of the conversation until it is over (or `until` phase is reached).
const record=(page,until=null)=>page.evaluate(until=>new Promise(resolve=>{
 const frames=[];(function tick(){const c=window.lofiViewer.chat();
  frames.push({phase:c.phase,line:c.line,pills:c.answers,subtitle:c.subtitle,text:c.text,smile:c.smile,speech:c.speech,clip:c.clip,
   head:c.head,lids:c.lids,motion:c.motion,away:window.lofiViewer.reader().away,t:performance.now()/1000});
  if(c.active&&c.phase!==until)requestAnimationFrame(tick);else resolve(frames);})();}),until);
// she is briefly not free during her own page turns and glances: wait for a free moment, as a visitor would
const free=page=>page.waitForFunction(()=>window.lofiViewer.chat().free,null,{timeout:8000});
const poke=async(page,o)=>{await free(page);return page.evaluate(o=>window.lofiViewer.poke(o),o);};
const pillBoxes=page=>page.$$eval('.answers button',b=>b.map(x=>{const r=x.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};}));
const overlaps=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;

test.beforeEach(async({request})=>{test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');});

test('a question waits for its answer and replies to the pick',async({page})=>{
 await page.goto(QUIET);await ready(page);
 expect(await poke(page,{ask:'q-meal'})).toBe(true);
 const asking=await record(page,'answers');
 expect(asking.some(f=>f.phase==='ask'&&f.speech==='speaking')).toBe(true);
 expect(asking.filter(f=>f.phase!=='answers').every(f=>!f.pills),'no answers while she is still asking').toBe(true);
 const c=await chat(page);
 expect(c.answers).toEqual(['食べたよ','まだ','お菓子だけ']);
 expect(c.subtitle,'the question stays up on a wide screen').toBe(true);
 await page.evaluate(()=>window.lofiViewer.answer(1));
 const replying=await record(page);
 expect(replying.some(f=>f.line==='q-meal-b'&&f.text?.includes('少しでいいから、何か食べてきて。'))).toBe(true);
 expect(replying.every(f=>!f.pills||f.phase==='answers')).toBe(true);
 await over(page);await settled(page);
 expect((await chat(page)).subtitle).toBe(false);
});

test('a notice is just her line',async({page})=>{
 await page.goto(QUIET);await ready(page);
 expect(await poke(page,{notice:'notice-05'})).toBe(true);
 const f=await record(page);
 expect(f.some(x=>x.text?.includes('来てくれてありがとう。'))).toBe(true);
 expect(f.every(x=>!x.pills)).toBe(true);
 await settled(page);
});

test('no answer lets it go gently',async({page})=>{
 await page.goto(QUIET+'&chatwait=2');await ready(page);
 await poke(page,{ask:'q-day'});await phase(page,'answers');
 const f=await record(page),letgo=new Set(LINES.filter(l=>l.kind==='letgo').map(l=>l.id));
 expect(f.some(x=>x.phase==='letgo'&&letgo.has(x.line)&&x.subtitle)).toBe(true);
 expect(f.filter(x=>x.phase==='letgo').every(x=>!x.pills)).toBe(true);
 await settled(page);
});

test('a heavier question is asked without a smile, and a reply to a harder answer smiles gently',async({page})=>{
 await page.goto(QUIET);await ready(page);
 await poke(page,{ask:'q-mind'});
 const asking=await record(page,'answers');
 expect(Math.max(...asking.map(f=>f.smile))).toBeLessThan(.03);
 await page.evaluate(()=>window.lofiViewer.answer(0));   // ある: a soft reply
 const replying=(await record(page)).filter(f=>f.line==='q-mind-a'&&f.speech==='speaking');
 const top=Math.max(...replying.map(f=>f.smile));
 expect(top).toBeGreaterThan(.30);expect(top).toBeLessThan(.40);
});

test('the answers can be picked with the keyboard',async({page})=>{
 await page.goto(QUIET);await ready(page);
 await poke(page,{ask:'q-stay'});await phase(page,'answers');
 for(let i=0;i<12&&!(await page.evaluate(()=>!!document.activeElement?.closest('.answers')));i++)await page.keyboard.press('Tab');
 expect(await page.evaluate(()=>document.activeElement?.closest('.answers')?document.activeElement.textContent:null)).toContain('いるよ');
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.lofiViewer.chat().line==='q-stay-a',null,{timeout:5000});
});

test('on a phone the answers take the subtitle\'s place and stay clear of the book',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto(QUIET);await ready(page);
 await poke(page,{ask:'q-meal'});await phase(page,'answers');
 await page.waitForTimeout(600);   // the fades
 expect((await chat(page)).subtitle).toBe(false);
 const book=await page.evaluate(()=>window.lofiViewer.bookRect());
 for(const p of await pillBoxes(page)){
  expect(overlaps(p,book),`a pill over the book ${JSON.stringify({p,book})}`).toBe(false);
  expect(p.left>=0&&p.right<=390&&p.bottom<=844).toBe(true);
 }
});

test('turning the phone with the answers up keeps them on screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto(QUIET);await ready(page);
 await poke(page,{ask:'q-sleep'});await phase(page,'answers');
 for(const [w,h] of [[844,390],[390,844]]){
  await page.setViewportSize({width:w,height:h});await page.waitForTimeout(600);
  for(const p of await pillBoxes(page))expect(p.left>=0&&p.right<=w&&p.top>=0&&p.bottom<=h,`${w}×${h}: ${JSON.stringify(p)}`).toBe(true);
 }
 expect((await chat(page)).subtitle,'narrow again: the subtitle stays hidden').toBe(false);
});

test('a question whose clip fails ends quietly, and stays unheard',async({page})=>{
 await page.route('**/voice/q-laugh.wav',r=>r.abort());
 await page.goto(QUIET);await ready(page);
 await poke(page,{ask:'q-laugh'});
 const f=await record(page);
 expect(f.every(x=>!x.pills)).toBe(true);
 await settled(page);
 expect((await chat(page)).heard.asks).not.toContain('q-laugh');
});

test('a slow clip is waited for, and she starts from its first word',async({page})=>{
 await page.route('**/voice/q-day.wav',async r=>{await new Promise(x=>setTimeout(x,2500));await r.continue();});
 await page.goto(QUIET);await ready(page);
 await poke(page,{ask:'q-day'});
 const f=await record(page,'answers'),first=f.find(x=>x.speech==='speaking');
 expect(first.clip).toBeLessThan(.15);
});

test('hiding the tab ends it quietly, and the question stays unheard',async({page})=>{
 await page.goto(QUIET);await ready(page);
 await poke(page,{ask:'q-day'});await phase(page,'answers');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
 await over(page,3000);
 const c=await chat(page);
 expect(c.answers).toBe(null);expect(c.heard.asks).not.toContain('q-day');
});

test('she answers a click even with the music paused',async({page,request})=>{
 test.skip(!(await request.get('/music/playlist.json')).ok(),'music not prepared on this machine');
 await page.goto('/?intro=0&greet=0&talkevery=9999');await ready(page);
 await page.locator('.hud-now').click();await page.waitForFunction(()=>window.lofiViewer.music().status==='playing',null,{timeout:15000});
 await page.evaluate(()=>document.activeElement?.blur());   // Space on the focused music button would press it instead
 await page.keyboard.press(' ');await page.waitForFunction(()=>window.lofiViewer.music().status==='paused');
 expect(await poke(page,{notice:'notice-03'})).toBe(true);
});

// Clicking her: the hand cursor and the faint glow only while she can be clicked, and a click on her starts one.
const point=page=>page.evaluate(()=>window.lofiViewer.chatPoint());
const cursor=page=>page.evaluate(()=>getComputedStyle(document.querySelector('#stage canvas')).cursor);
const hoverOn=async page=>{const p=await point(page);await page.mouse.move(p.x-4,p.y);await page.mouse.move(p.x,p.y);};
const clickable=(page,yes,timeout=3000)=>page.waitForFunction(yes=>{
 const c=window.lofiViewer.chat(),cur=getComputedStyle(document.querySelector('#stage canvas')).cursor;
 return yes?cur==='pointer'&&c.glow>.5:cur!=='pointer'&&c.glow<.01;},yes,{timeout});

test('the pointer turns to a hand over her, with a faint glow, and not over the balcony',async({page})=>{
 await page.goto(QUIET);await ready(page);await free(page);
 await hoverOn(page);await clickable(page,true);
 await page.mouse.move(60,300);await clickable(page,false);
});

test('clicking her starts a conversation',async({page})=>{
 await page.goto(QUIET);await ready(page);
 await free(page);const p=await point(page);await page.mouse.click(p.x,p.y);
 await page.waitForFunction(()=>window.lofiViewer.chat().active,null,{timeout:2000});
 await page.mouse.click(60,300);   // a click on the balcony starts nothing
});

test('she is not clickable while she is busy, or just after a conversation',async({page})=>{
 const tryIt=async why=>{await hoverOn(page);await page.waitForTimeout(400);
  expect(await cursor(page),why).not.toBe('pointer');
  await page.waitForFunction(()=>window.lofiViewer.chat().glow<.01,null,{timeout:2000});   // any glow fades out (~1 s)
  const before=(await chat(page)).heard;const p=await point(page);await page.mouse.click(p.x,p.y);await page.waitForTimeout(300);
  expect((await chat(page)).heard,why).toEqual(before);};
 await page.goto('/?intro=0&music=0&talkevery=9999&line=okaeri&chatcool=3');await ready(page);
 expect(await page.evaluate(()=>window.lofiViewer.greet())).toBe(true);await tryIt('greeting');
 await page.waitForFunction(()=>!window.lofiViewer.chat().active&&window.lofiViewer.voice()&&window.lofiViewer.reader().away<.05,null,{timeout:20000}).catch(()=>{});
 await page.evaluate(()=>window.lofiViewer.hush?.());await settled(page);
 expect(await page.evaluate(()=>window.lofiViewer.talk('basil',{motion:'look'}))).toBe(true);await tryIt('small talk');
 await page.waitForFunction(()=>!window.lofiViewer.smallTalk().active,null,{timeout:20000});await settled(page);
 expect(await poke(page,{notice:'notice-07'})).toBe(true);await tryIt('in a conversation');
 await over(page);await tryIt('cool-down');
 await page.waitForTimeout(3200);await hoverOn(page);await clickable(page,true);
});

test('she is not clickable during her break',async({page})=>{
 await page.goto(QUIET+'&stretch=1');await ready(page);
 await page.waitForFunction(()=>window.lofiViewer.reader().stretch,null,{timeout:10000});
 await hoverOn(page);await page.waitForTimeout(400);
 expect(await cursor(page)).not.toBe('pointer');
 const p=await point(page);await page.mouse.click(p.x,p.y);await page.waitForTimeout(300);
 expect((await chat(page)).active).toBe(false);
});

test('a double click starts one conversation',async({page})=>{
 await page.goto(QUIET);await ready(page);
 await free(page);const p=await point(page);await page.mouse.dblclick(p.x,p.y);
 await page.waitForFunction(()=>window.lofiViewer.chat().active,null,{timeout:2000});
 const h=(await chat(page)).heard;expect(h.asks.length+h.notices.length).toBe(1);
});

// Motion variety: a curious tilt while she waits, a nod when you pick, eyelids lowered over a harder reply's first
// sentence, and notices that look up in different ways.
test('while she waits her head tilts a little, and she nods when you pick',async({page})=>{
 await page.goto(QUIET+'&chatwait=60');await ready(page);
 await poke(page,{ask:'q-stay'});await phase(page,'answers');await page.waitForTimeout(1300);
 expect(Math.abs((await chat(page)).head.roll)).toBeGreaterThanOrEqual(3);
 const t0=await page.evaluate(()=>{window.lofiViewer.answer(0);return performance.now()/1000;});
 const f=await record(page);
 expect(Math.max(...f.filter(x=>x.t-t0<.8).map(x=>x.head.pitch)),'a nod').toBeGreaterThan(1);
 await settled(page);const end=await chat(page);
 expect(Math.abs(end.head.roll)+Math.abs(end.head.pitch)).toBeLessThan(.3);
});

test('a reply to a harder answer lowers her eyelids for a moment',async({page})=>{
 await page.goto(QUIET);await ready(page);
 await poke(page,{ask:'q-mind'});await phase(page,'answers');
 await page.evaluate(()=>window.lofiViewer.answer(0));
 const L=line('q-mind-a'),f=(await record(page)).filter(x=>x.line==='q-mind-a'&&x.speech==='speaking');
 expect(Math.max(...f.filter(x=>x.clip<L.parts[1].start).map(x=>x.lids))).toBeGreaterThan(.3);
 expect(Math.max(...f.filter(x=>x.clip>L.parts[1].start+.6).map(x=>x.lids))).toBeLessThan(.05);
});

test('eyes first: she starts toward her book and looks up at you partway',async({page})=>{
 await page.goto(QUIET);await ready(page);
 expect(await poke(page,{notice:'notice-19',motion:'midway'})).toBe(true);
 const f=(await record(page)).filter(x=>x.speech==='speaking');
 expect(f[0].away,'at her first word').toBeLessThan(.3);
 expect(Math.max(...f.map(x=>x.away)),'later in the line').toBeGreaterThan(.7);
});

test('with a tilt: a notice said with her head a little to one side',async({page})=>{
 await page.goto(QUIET);await ready(page);
 expect(await poke(page,{notice:'notice-03',motion:'tilt'})).toBe(true);
 const f=(await record(page)).filter(x=>x.speech==='speaking');
 expect(Math.max(...f.map(x=>Math.abs(x.head.roll)))).toBeGreaterThanOrEqual(3);
});

// Final review: the book's box is the whole book (both covers and the pages), and on a phone held sideways (wider than
// 600 px but short) the answers stay clear of the book too, with the subtitle making way as on an upright phone.
test('the book\'s box on screen is the whole book',async({page})=>{
 await page.setViewportSize({width:1280,height:720});
 await page.goto(QUIET+'&seed=3');await ready(page);
 const b=await page.evaluate(()=>window.lofiViewer.bookRect());
 expect(b.left,'its left cover (seen at x ≈ 778)').toBeLessThanOrEqual(795);
 expect(b.right).toBeGreaterThanOrEqual(925);
});

for(const [w,h] of [[844,390],[667,375]])test(`on a phone held sideways (${w}×${h}) the answers stay clear of the book`,async({page})=>{
 await page.setViewportSize({width:w,height:h});
 await page.goto(QUIET);await ready(page);
 await poke(page,{ask:'q-meal'});await phase(page,'answers');await page.waitForTimeout(600);
 expect((await chat(page)).subtitle,'the answers take the subtitle\'s place').toBe(false);
 const book=await page.evaluate(()=>window.lofiViewer.bookRect());
 for(const p of await pillBoxes(page)){
  expect(overlaps(p,book),`a pill over the book ${JSON.stringify({p,book})}`).toBe(false);
  expect(p.left>=0&&p.right<=w&&p.top>=0&&p.bottom<=h).toBe(true);
 }
});
