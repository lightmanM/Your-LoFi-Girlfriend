import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
// Small talk while she reads: lines to you (she looks at the camera) and to herself (a subtle motion, a murmur), the
// scheduler, and every line playing through. Lines are said on demand with lofiViewer.talk(id,{motion}).
const sceneReady=async request=>(await request.get('/environment/balcony-toon/scene.json')).ok();
const ready=page=>page.waitForFunction(()=>window.lofiViewer?.ready()&&window.lofiViewer.smallTalk(),null,{timeout:60000});
const LINES=JSON.parse(readFileSync(new URL('../public/voice/lines.json',import.meta.url),'utf8')).lines.filter(l=>l.kind==='talk');
const line=id=>LINES.find(l=>l.id===id);
const QUIET='/?intro=0&music=0&greet=0&talkevery=9999';   // no greeting, no music, no line of her own accord
// Say a line and record every frame until it is over: what she says, shows and does.
const talk=(page,id,motion)=>page.evaluate(({id,motion})=>new Promise((resolve,reject)=>{
 const frames=[];if(!window.lofiViewer.talk(id,{motion}))return reject(Error(`could not say ${id}`));
 (function tick(){const s=window.lofiViewer.smallTalk(),r=window.lofiViewer.reader();
  if(s.active){const [shape,w]=Object.entries(s.mouth).sort((a,b)=>b[1]-a[1])[0];
   frames.push({t:s.t,clip:s.clip,speech:s.speech,shape:w>.15?shape:null,w,subtitle:s.subtitle,murmur:s.murmur,text:document.querySelector('.subtitles')?.textContent,
    miss:Math.hypot(s.aim.face.yaw,s.aim.face.pitch),lean:s.lean,eyes:s.aim.eyes,away:r.away,yaw:r.head.yaw,lids:s.lids});requestAnimationFrame(tick);}
  else resolve(frames);})();}),{id,motion});
const after=page=>page.evaluate(()=>({talk:window.lofiViewer.smallTalk(),reader:window.lofiViewer.reader()}));
const settled=page=>page.waitForFunction(()=>window.lofiViewer.reader().away<.05,null,{timeout:4000});

test('a line to you: she faces the camera, the subtitle shows each part as it is said, then she reads on',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto(QUIET);await ready(page);
 const f=await talk(page,'river','look'),L=line('river'),speaking=f.filter(x=>x.speech==='speaking');
 expect(speaking.length).toBeGreaterThan(L.duration*20);
 expect(Math.max(...speaking.map(x=>x.miss)),'face on the camera while she speaks').toBeLessThanOrEqual(3.5);
 expect(speaking.every(x=>x.subtitle&&!x.murmur)).toBe(true);
 const second=f.find(x=>x.text?.includes(L.parts[1].ja));
 expect(f.find(x=>x.text?.includes(L.parts[0].ja))).toBeTruthy();
 expect(Math.abs(second.clip-(L.parts[1].start-.1))).toBeLessThan(.06);
 await settled(page);expect((await after(page)).talk.subtitle).toBe(false);
});

test('while she talks to you her head is never quite still, yet her face stays on you',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto(QUIET);await ready(page);
 const f=await talk(page,'forgotten','look'),speaking=f.filter(x=>x.speech==='speaking'&&x.t>1.6);
 const miss=speaking.map(x=>x.miss),range=Math.max(...miss)-Math.min(...miss);
 expect(range,`her face moved ${range.toFixed(2)}° while she spoke`).toBeGreaterThan(.8);
 expect(Math.max(...miss)).toBeLessThanOrEqual(3.5);
});

test('a glance mid-line: she starts toward her book and looks up at you partway through',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto(QUIET);await ready(page);
 const f=await talk(page,'river','midway'),L=line('river'),look=.3+L.parts[1].start-1.2;   // TALK: speak .3, ease 1.2
 expect(f.filter(x=>x.t<look).every(x=>x.miss>20)).toBe(true);
 const on=f.filter(x=>x.t>look+1.2&&x.clip<L.duration);
 expect(on.length).toBeGreaterThan(5);expect(Math.max(...on.map(x=>x.miss))).toBeLessThanOrEqual(3.5);
});

test('a smaller look: her head stays clearly short of you, her widened eyes do the rest, then rest again',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto(QUIET);await ready(page);
 const rest=(await after(page)).reader.eyeScale;
 const eyes=await talk(page,'seasons','eyes'),speaking=eyes.filter(x=>x.speech==='speaking');
 expect(Math.min(...speaking.map(x=>x.miss)),'her face itself stops short of the camera').toBeGreaterThan(8);
 expect(speaking.length).toBeGreaterThan(3);
 expect(speaking.every(x=>Math.abs(x.eyes.turned.yaw)>=.8*Math.abs(x.eyes.asked.yaw)),'her eyes land on you').toBe(true);
 await settled(page);expect((await after(page)).reader.eyeScale).toBe(rest);
});

test('to herself: murmur subtitles, never at the camera; a glance aside, a tilt, half-closed eyes',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto(QUIET);await ready(page);
 const before=(await after(page)).reader.head.yaw;
 const aside=await talk(page,'wind','aside'),speaking=aside.filter(x=>x.speech==='speaking');
 expect(speaking.every(x=>x.subtitle&&x.murmur)).toBe(true);
 expect(aside.every(x=>x.miss>20)).toBe(true);
 const turn=Math.min(...aside.map(x=>x.yaw-before));
 expect(turn).toBeLessThan(-8);expect(turn).toBeGreaterThanOrEqual(-15);   // toward her right: the daybed side of the picture
 await settled(page);
 const tilt=await talk(page,'warmth','tilt');
 const lean=Math.max(...tilt.map(x=>Math.abs(x.lean-tilt[0].lean)));
 expect(lean).toBeGreaterThanOrEqual(3);expect(lean).toBeLessThanOrEqual(10.5);   // the tilt, plus her calm sway while she murmurs
 await settled(page);
 const lids=await talk(page,'pages','lids'),L=line('pages');
 expect(Math.max(...lids.filter(x=>x.clip>.4*L.duration&&x.clip<.6*L.duration).map(x=>x.lids))).toBeGreaterThanOrEqual(.4);
 expect((await after(page)).talk.lids??0).toBe(0);
});

test('what she says to herself is subtitled as large and clear as what she says to you',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto(QUIET);await ready(page);
 const look=async id=>{await page.evaluate(id=>window.lofiViewer.talk(id,{motion:'page'}),id);
  await page.waitForFunction(()=>window.lofiViewer.smallTalk().subtitle);await page.waitForTimeout(600);
  const style=await page.evaluate(()=>{const ja=getComputedStyle(document.querySelector('.subtitles .ja')),en=getComputedStyle(document.querySelector('.subtitles .en'));
   return {ja:[ja.fontSize,ja.opacity],en:[en.fontSize,en.opacity]};});
  await page.waitForFunction(()=>!window.lofiViewer.smallTalk().active,null,{timeout:20000});await settled(page);return style;};
 expect(await look('wind')).toEqual(await look('seasons'));   // to herself, to you
});

test('the scheduler: she speaks when due, and skips when the tab is hidden or sound is still locked',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto('/?intro=0&music=0&greet=0&talkevery=2');await ready(page);
 await page.waitForFunction(()=>window.lofiViewer.smallTalk().skipped==='locked',null,{timeout:10000});   // no click yet
 await page.mouse.click(30,30);
 await page.waitForFunction(()=>window.lofiViewer.smallTalk().active,null,{timeout:10000});
 await page.waitForFunction(()=>!window.lofiViewer.smallTalk().active,null,{timeout:20000});
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));
 await page.waitForFunction(()=>window.lofiViewer.smallTalk().skipped==='hidden',null,{timeout:10000});
 expect((await after(page)).talk.active).toBe(false);
});

test('the scheduler skips while the music is paused',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 test.skip(!(await request.get('/music/playlist.json')).ok(),'music not prepared on this machine');
 await page.goto('/?intro=0&greet=0&talkevery=4');await ready(page);
 await page.mouse.click(30,30);
 await page.waitForFunction(()=>window.lofiViewer.music()?.status==='playing',null,{timeout:15000});
 await page.keyboard.press('Space');
 await page.waitForFunction(()=>window.lofiViewer.music().status==='paused');
 await page.waitForFunction(()=>window.lofiViewer.smallTalk().skipped==='paused',null,{timeout:12000});
});

test('never over the greeting, a full gap after it, and no stretch starts in the middle of a line',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto('/?music=0&line=okaeri&talkevery=4');await ready(page);
 await page.getByRole('button',{name:'start'}).click();
 const f=await page.evaluate(()=>new Promise(resolve=>{const out=[];const t0=performance.now();
  (function tick(){const v=window.lofiViewer.voice(),s=window.lofiViewer.smallTalk();out.push({t:(performance.now()-t0)/1000,greeting:!!v&&!v.finished,talk:!!s?.active});
   if(s?.active||performance.now()-t0>20000)resolve(out);else requestAnimationFrame(tick);})();}));
 const greetEnd=f.findLast(x=>x.greeting).t,talkStart=f.find(x=>x.talk)?.t;
 expect(f.some(x=>x.greeting&&x.talk)).toBe(false);
 expect(talkStart-greetEnd).toBeGreaterThanOrEqual(3.9);   // her next line comes a whole gap after the greeting
 await page.goto(`${QUIET}&stretch=3`);await ready(page);
 const g=await page.evaluate(()=>new Promise(resolve=>{const out=[];window.lofiViewer.talk('enough',{motion:'page'});
  (function tick(){const s=window.lofiViewer.smallTalk(),r=window.lofiViewer.reader();out.push({talk:s.active,stretch:r.stretch});
   if(r.stretch||out.length>1200)resolve(out);else requestAnimationFrame(tick);})();}));
 expect(g.some(x=>x.talk&&x.stretch)).toBe(false);expect(g.at(-1).stretch).toBe(true);
});

test('she does not talk behind the intro screen, even after a stray key press',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto('/?music=0&talkevery=1');await ready(page);
 await page.keyboard.press('Tab');   // unlocks sound, but the visitor has not pressed start
 const talked=await page.evaluate(()=>new Promise(resolve=>{const t0=performance.now();
  (function tick(){if(window.lofiViewer.smallTalk().active)return resolve(true);if(performance.now()-t0>6000)return resolve(false);requestAnimationFrame(tick);})();}));
 expect(talked).toBe(false);
});

test('the greeting comes first: starting it stops a line she was saying',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto('/?intro=0&music=0&talkevery=9999');await ready(page);
 await page.waitForFunction(()=>window.lofiViewer.greeting()?.line);
 await page.evaluate(()=>window.lofiViewer.talk('river',{motion:'page'}));
 await page.waitForFunction(()=>window.lofiViewer.smallTalk().speech==='speaking');
 expect(await page.evaluate(()=>window.lofiViewer.greet({notice:.2}))).toBe(true);
 expect((await after(page)).talk.active).toBe(false);
});

test('the dip under her greeting does not cut short the music\'s own fade-in',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 test.skip(!(await request.get('/music/playlist.json')).ok(),'music not prepared on this machine');
 await page.goto('/?line=okaeri&talkevery=9999');await ready(page);
 await page.getByRole('button',{name:'start'}).click();
 await page.waitForFunction(()=>window.lofiViewer.music()?.ducked,null,{timeout:15000});
 const g=[];for(let i=0;i<4;i++){g.push((await page.evaluate(()=>window.lofiViewer.music())).gain);await page.waitForTimeout(250);}
 for(let i=1;i<g.length;i++)expect(g[i],`music level ${g.join(' -> ')}`).toBeGreaterThan(g[i-1]);   // still rising on its fade
});

test('the music comes back up after her line even if the page stops drawing (a hidden tab)',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 test.skip(!(await request.get('/music/playlist.json')).ok(),'music not prepared on this machine');
 await page.goto('/?intro=0&greet=0&talkevery=9999');await ready(page);
 await page.mouse.click(30,30);
 await page.waitForFunction(()=>window.lofiViewer.music()?.status==='playing',null,{timeout:15000});
 await page.evaluate(()=>window.lofiViewer.talk('taller',{motion:'page'}));
 await page.waitForFunction(()=>window.lofiViewer.music().ducked,null,{timeout:5000});
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});   // no more frames, as in a hidden tab
 await page.waitForTimeout(7000);                                    // the line (about 4.6 s) is over by now
 expect((await page.evaluate(()=>window.lofiViewer.music())).ducked).toBe(false);
});

test('a key that does not count as a gesture (Escape) does not use up her chance to be heard',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto('/?intro=0&music=0&greet=0&talkevery=9999');await ready(page);
 await page.keyboard.press('Escape');await page.keyboard.press('a');
 await expect.poll(()=>page.evaluate(()=>window.lofiViewer.greeting().context),{timeout:3000}).toBe('running');
});

test('hiding the tab partway through a line: it finishes, and she goes back to reading',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto(QUIET);await ready(page);
 await page.evaluate(()=>window.lofiViewer.talk('river',{motion:'aside'}));
 await page.waitForFunction(()=>window.lofiViewer.smallTalk().speech==='speaking');
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));
 await page.waitForFunction(()=>!window.lofiViewer.smallTalk().active,null,{timeout:15000});
 await settled(page);
 await page.waitForFunction(()=>!window.lofiViewer.reader().busy,null,{timeout:3000});   // her glance has finished
 const {talk:s}=await after(page);
 expect(s.subtitle).toBe(false);expect(s.next).toBeGreaterThan(0);
});

test('she remembers what you have heard across visits and says something new first',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto(QUIET);await ready(page);
 for(const id of ['taller','sky','seasons'])await talk(page,id,id==='seasons'?'look':'page');
 await page.reload();await ready(page);
 expect((await after(page)).talk.heard).toEqual(expect.arrayContaining(['taller','sky','seasons']));
 const f=await talk(page,undefined,undefined);
 expect(f.length).toBeGreaterThan(0);
 expect(['taller','sky','seasons']).not.toContain((await after(page)).talk.last);
});

for(const L of LINES){
 test(`small talk "${L.id}" plays through: subtitle, mouth on the voice, shut through each pause`,async({page,request})=>{
  test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(QUIET);await ready(page);
  const f=await talk(page,L.id,L.to==='self'?'page':'look'),speaking=f.filter(x=>x.speech==='speaking');
  expect(speaking.length).toBeGreaterThan(L.duration*20);
  expect(Math.max(...speaking.map(x=>x.w))).toBeGreaterThan(.3);
  for(const part of L.parts??[L.subtitle])expect(f.some(x=>x.text?.includes(part.ja)&&x.text.includes(part.en))).toBe(true);
  expect(speaking.every(x=>x.subtitle&&x.murmur===(L.to==='self'))).toBe(true);
  for(const p of L.moras.filter(m=>m.vowel==='pau')){
   const inside=speaking.filter(x=>x.clip>p.start+.12&&x.clip<p.end-.12);
   if(p.end-p.start>.3)expect(inside.length,`frames inside the pause at ${p.start}s`).toBeGreaterThan(0);
   if(inside.length)expect(Math.max(...inside.map(x=>x.w)),`mouth during the pause at ${p.start}s`).toBeLessThan(.1);
  }
  expect(errors).toEqual([]);
 });
}
