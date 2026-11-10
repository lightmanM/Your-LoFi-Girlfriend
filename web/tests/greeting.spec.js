import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
// The greeting: after start she looks up at the camera, says "okaeri" with her mouth on the voice, and the subtitle shows.
const sceneReady=async request=>(await request.get('/environment/balcony-toon/scene.json')).ok();
const ready=page=>page.waitForFunction(()=>window.lofiViewer?.ready(),null,{timeout:60000});
// Dominant mouth shape each frame until the greeting ends (or `until` s), with what she and the subtitle were doing.
const watch=(page,until=99)=>page.evaluate(until=>new Promise(resolve=>{
 const frames=[];
 (function tick(){const v=window.lofiViewer.voice();
  if(v){const [shape,w]=Object.entries(v.mouth).sort((a,b)=>b[1]-a[1])[0];frames.push({t:v.t,clip:v.clip,speech:v.speech,shape:w>.15?shape:null,w,away:v.away,subtitle:v.subtitle,lean:v.lean,miss:v.aim&&Math.hypot(v.aim.face.yaw,v.aim.face.pitch),text:document.querySelector('.subtitles')?.textContent,audible:v.audible});}
  if(v?.finished||v?.t>until)resolve(frames);else requestAnimationFrame(tick);})();
}),until);
const collapse=a=>a.filter((x,i)=>x&&x!==a[i-1]);
const isSubsequence=(a,of)=>{let j=0;for(const x of of)if(x===a[j])j++;return j===a.length;};
const OKAERI=['oh','aa','ee','ih','aa','aa','ih'];   // お か え り な さ い (the s between な and さ narrows the mouth)
const LINES=JSON.parse(readFileSync(new URL('../public/voice/lines.json',import.meta.url),'utf8')).lines.filter(l=>l.kind==='greeting');

test('after start she looks up and greets you, mouth on the voice, with subtitles',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?music=0&line=okaeri');await ready(page);
 await expect(page.locator('.subtitles')).not.toHaveClass(/on/);
 await page.getByRole('button',{name:'start'}).click();
 const frames=await watch(page);
 const speaking=frames.filter(f=>f.speech==='speaking');
 expect(speaking.length).toBeGreaterThan(5);
 expect(speaking.some(f=>f.audible)).toBe(true);                         // real sound: the start click allowed it
 expect(frames.filter(f=>f.speech==='waiting'&&f.t<frames.find(x=>x.away>.9).t).every(f=>!f.shape)).toBe(true);   // silent until she has looked up
 expect(speaking.every(f=>f.away>.9)).toBe(true);                         // she looks at you the whole time she speaks
 const lean=Math.max(...speaking.map(f=>Math.abs(f.lean)));                // her head held nearly upright, not leaning
 expect(lean,`head looked tilted ${lean}° from the camera`).toBeLessThanOrEqual(11.5);
 const shapes=collapse(speaking.map(f=>f.shape));
 expect(shapes.length).toBeGreaterThanOrEqual(4);
 expect(isSubsequence(shapes,OKAERI),`mouth went ${shapes.join(' ')}`).toBe(true);
 expect(speaking.every(f=>f.subtitle)).toBe(true);
 expect(speaking[0].text).toContain('おかえりなさい');expect(speaking[0].text).toContain('Welcome back.');
 const last=frames.at(-1);
 expect(last.shape).toBeNull();expect(last.subtitle).toBe(false);expect(last.away).toBeLessThan(.05);   // back in her book
 expect(errors).toEqual([]);
});

test('the greeting can be turned off',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto('/?music=0&greet=0&talk=0&chat=0');await ready(page);   // every use of her voice off
 await page.getByRole('button',{name:'start'}).click();
 await page.waitForTimeout(3500);
 expect(await page.evaluate(()=>window.lofiViewer.voice())).toBeNull();
 await expect(page.locator('.subtitles')).toHaveCount(0);
});

test('stopping the greeting mid-line sends her straight back to her book',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto('/?intro=0&music=0');await ready(page);
 expect(await page.evaluate(()=>window.lofiViewer.greet({notice:.2}))).toBe(true);
 await page.waitForFunction(()=>window.lofiViewer.voice()?.speech==='speaking');
 await page.evaluate(()=>window.lofiViewer.hush());
 const v=await page.evaluate(()=>window.lofiViewer.voice());
 expect(v.finished).toBe(true);expect(Math.max(...Object.values(v.mouth))).toBe(0);
 await expect(page.locator('.subtitles')).not.toHaveClass(/on/);
 await page.waitForFunction(()=>window.lofiViewer.voice().away<.05,null,{timeout:3000});   // eyes back on the page within an ease
});

test('without the intro she does not greet by herself',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto('/?intro=0&music=0');await ready(page);
 await page.waitForTimeout(2500);
 expect(await page.evaluate(()=>window.lofiViewer.voice())).toBeNull();
});

test('each visit she picks a greeting at random, never last visit\'s, and downloads only that one',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 const clips=[];page.on('request',r=>{if(r.url().endsWith('.wav'))clips.push(r.url().split('/').pop());});
 const said=[];
 for(let visit=0;visit<4;visit++){
  clips.length=0;
  await page.goto('/?intro=0&music=0');await ready(page);
  const g=await page.waitForFunction(()=>window.lofiViewer.greeting()?.line&&window.lofiViewer.greeting(),null,{timeout:10000}).then(h=>h.jsonValue());
  expect(g.ids.sort()).toEqual(LINES.map(l=>l.id).sort());
  expect(g.fetched).toEqual([g.line]);
  expect(await page.evaluate(()=>window.lofiViewer.greet({notice:.1}))).toBe(true);   // she says it: remembered
  await page.waitForFunction(()=>window.lofiViewer.voice()?.speech==='speaking');
  expect(clips).toEqual([`${g.line}.wav`]);
  if(said.length)expect(g.line,`visit ${visit} repeated ${g.line}`).not.toBe(said.at(-1));
  said.push(g.line);
 }
});

test('?line= picks a greeting by name; an unknown name falls back to a random one',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 const warnings=[];page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text());});
 await page.goto('/?intro=0&music=0&line=yukkuri');await ready(page);
 await expect.poll(()=>page.evaluate(()=>window.lofiViewer.greeting()?.line)).toBe('yukkuri');
 expect(await page.evaluate(()=>window.lofiViewer.greet({notice:.1}))).toBe(true);
 expect(await page.evaluate(()=>localStorage.getItem('lofi-girlfriend.greeting.last'))).toBeNull();   // asked for, not picked: not remembered
 await page.goto('/?intro=0&music=0&line=nope');await ready(page);
 await expect.poll(()=>page.evaluate(()=>window.lofiViewer.greeting()?.line)).not.toBeNull();
 expect(LINES.map(l=>l.id)).toContain(await page.evaluate(()=>window.lofiViewer.greeting().line));
 expect(warnings.some(w=>w.includes('no line "nope"'))).toBe(true);
});

test('pressing start before her lines have loaded still gets the greeting, with sound',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 let release;const gate=new Promise(r=>{release=r;});
 await page.route('**/voice/lines.json',async route=>{await gate;await route.continue();});
 await page.goto('/?music=0');await ready(page);
 expect(await page.evaluate(()=>window.lofiViewer.greeting()?.line??null)).toBeNull();   // not loaded yet
 await page.getByRole('button',{name:'start'}).click();
 await page.waitForTimeout(700);release();
 await page.waitForFunction(()=>window.lofiViewer.voice()?.speech==='speaking',null,{timeout:10000});
 expect(await page.evaluate(()=>window.lofiViewer.voice().audible)).toBe(true);   // the click unlocked her voice
});

for(const line of LINES){
 test(`greeting "${line.id}" plays through with its subtitle, her mouth closing on each pause`,async({page,request})=>{
  test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`/?intro=0&music=0&line=${line.id}`);await ready(page);
  await page.waitForFunction(()=>window.lofiViewer.greeting()?.line);
  expect(await page.evaluate(id=>window.lofiViewer.greet({line:id,notice:.2}),line.id)).toBe(true);
  const frames=await watch(page);
  const speaking=frames.filter(f=>f.speech==='speaking');
  expect(speaking.length).toBeGreaterThan(line.duration*20);              // runs the whole line (headless frames)
  expect(Math.max(...speaking.map(f=>f.w))).toBeGreaterThan(.3);          // her mouth opens
  expect(speaking.every(f=>f.subtitle&&f.text.includes(line.subtitle.ja)&&f.text.includes(line.subtitle.en))).toBe(true);
  expect(speaking.every(f=>f.away>.9&&Math.abs(f.lean)<=11.5)).toBe(true);    // looking at you, head nearly upright
  const miss=Math.max(...speaking.map(f=>f.miss));                          // her face right on the camera (the nod: 2.4°)
  expect(miss,`face pointed ${miss}° off the camera`).toBeLessThanOrEqual(3.5);
  for(const p of line.moras.filter(m=>m.vowel==='pau')){                   // shut through the middle of each pause
   const inside=speaking.filter(f=>f.clip>p.start+.12&&f.clip<p.end-.12);
   expect(inside.length,`frames inside the pause at ${p.start}s`).toBeGreaterThan(0);
   expect(Math.max(...inside.map(f=>f.w)),`mouth during the pause at ${p.start}s`).toBeLessThan(.1);
  }
  const last=frames.at(-1);
  expect(last.shape).toBeNull();expect(last.subtitle).toBe(false);expect(last.away).toBeLessThan(.05);
  expect(errors).toEqual([]);
 });
}

test('while she greets, the music dips; muting silences her voice too, the subtitle stays',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 const playlist=await request.get('/music/playlist.json');test.skip(!playlist.ok(),'music not prepared on this machine');
 await page.goto('/?line=iitokoro&talk=0');await ready(page);
 await page.getByRole('button',{name:'start'}).click();
 await page.waitForFunction(()=>window.lofiViewer.voice()?.speech==='speaking'&&window.lofiViewer.music()?.status==='playing',null,{timeout:15000});
 await expect.poll(()=>page.evaluate(()=>window.lofiViewer.music().ducked)).toBe(true);
 expect(await page.evaluate(()=>window.lofiViewer.greeting().level)).toBe(1);
 await page.keyboard.press('m');
 await expect.poll(()=>page.evaluate(()=>window.lofiViewer.greeting().level),{timeout:300}).toBe(0);
 expect(await page.evaluate(()=>window.lofiViewer.voice().subtitle)).toBe(true);
 await page.waitForFunction(()=>window.lofiViewer.voice().finished,null,{timeout:15000});
 await expect.poll(()=>page.evaluate(()=>window.lofiViewer.music().ducked)).toBe(false);
});

test('her head slows down gently before it meets your eyes, no sudden stop',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto('/?intro=0&music=0&talk=0&line=okaeri');await ready(page);
 await page.waitForFunction(()=>window.lofiViewer.greeting()?.line);
 const f=await page.evaluate(()=>new Promise(res=>{const out=[];window.lofiViewer.greet({notice:.2});const t0=performance.now();
  (function tick(){const v=window.lofiViewer.voice();if(v?.aim)out.push([(performance.now()-t0)/1000,Math.hypot(v.aim.face.yaw,v.aim.face.pitch)]);
   if(performance.now()-t0<2600)requestAnimationFrame(tick);else res(out);})();}));
 const speed=f.map((x,i)=>i<3?0:(f[i-3][1]-x[1])/(x[0]-f[i-3][0]));   // degrees per second, over 3 frames
 const peak=Math.max(...speed),near=f.findIndex(x=>x[1]<3);
 expect(near).toBeGreaterThan(0);
 expect(speed[near]/peak,`speed within 3° of you: ${speed[near].toFixed(0)}°/s of a ${peak.toFixed(0)}°/s peak`).toBeLessThan(.4);
});

