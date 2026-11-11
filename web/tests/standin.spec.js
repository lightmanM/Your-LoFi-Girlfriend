import {test,expect} from '@playwright/test';
import {ownerFiles,glbAt} from './owner-files.js';
// The stand-in path: what a fresh clone runs, without the owner's character and the balcony's chair and plant meshes.
// ?standin=1 forces every stand-in, so this runs on the owner's machine too.
const STANDIN='/?intro=0&music=0&greet=0&talkevery=9999&standin=1';
const loaded=page=>page.waitForFunction(()=>window.lofiViewer?.ready()||window.lofiViewer?.error(),null,{timeout:90000});
const errors=page=>{const e=[];page.on('pageerror',x=>e.push(x.message));return e;};

test('with every stand-in the page runs with Vivi',async({page})=>{
 const errs=errors(page);
 await page.goto(STANDIN);await loaded(page);
 expect(await page.evaluate(()=>window.lofiViewer.error())).toBe(null);
 expect((await page.evaluate(()=>window.lofiViewer.standin())).using).toContain('character');
 expect(errs).toEqual([]);
});

test('a missing character alone brings only her stand-in',async({page,request})=>{
 test.skip(!(await ownerFiles(request)&&await glbAt(request,'/environment/balcony-toon/chair-visible.glb')&&await glbAt(request,'/environment/balcony-toon/plants.glb')),'the owner\'s files are not on this machine');
 await page.route('**/models/marycia/marycia-web.vrm',r=>r.fulfill({status:404,body:''}));
 await page.goto('/?intro=0&music=0&greet=0&talkevery=9999');await loaded(page);
 expect(await page.evaluate(()=>window.lofiViewer.error())).toBe(null);
 expect((await page.evaluate(()=>window.lofiViewer.standin())).using).toEqual(['character']);
});

test('a host that answers a missing file with the page itself still runs',async({page})=>{
 await page.route('**/models/marycia/marycia-web.vrm',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>x</title>'}));
 await page.goto('/?intro=0&music=0&greet=0&talkevery=9999');await loaded(page);
 expect(await page.evaluate(()=>window.lofiViewer.error())).toBe(null);
 expect((await page.evaluate(()=>window.lofiViewer.standin())).using).toContain('character');
});

test('a stand-in that fails to load shows the could-not-load message',async({page})=>{
 await page.route('**/standin/vivi.vrm',r=>r.abort());
 await page.goto(STANDIN);await loaded(page);
 expect(await page.evaluate(()=>window.lofiViewer.error())).not.toBe(null);
 await expect(page.locator('#note')).toContainText('could not load');
});

test('on the stand-in chair Marycia sits as she does on the real one',async({page,request})=>{
 test.skip(!(await ownerFiles(request)&&await glbAt(request,'/environment/balcony-toon/chair-visible.glb')),'the owner\'s character and chair are not on this machine');
 const QUIET='/?intro=0&music=0&greet=0&talkevery=9999&seed=3';
 await page.goto(QUIET);await loaded(page);
 const real=await page.evaluate(()=>window.lofiViewer.seat().drop);
 await page.route('**/environment/balcony-toon/chair-visible.glb',r=>r.fulfill({status:404,body:''}));
 await page.goto(QUIET);await loaded(page);
 expect((await page.evaluate(()=>window.lofiViewer.standin())).using).toEqual(['chair']);
 const stand=await page.evaluate(()=>window.lofiViewer.seat().drop);
 expect(Math.abs(stand-real),`drop ${stand} on the stand-in vs ${real} on the real chair`).toBeLessThan(.01);
});

test('with plant cards the plants sway in the wind',async({page})=>{
 await page.goto(STANDIN);await loaded(page);
 const a=await page.evaluate(()=>window.lofiViewer.plants());
 for(const g of ['ivy','roses','pots'])expect(a.cards[g],`${g} cards`).toBeGreaterThan(0);
 await page.waitForTimeout(2000);
 const b=await page.evaluate(()=>window.lofiViewer.plants());
 expect(Object.keys(a.angles).some(g=>Math.abs(a.angles[g]-b.angles[g])>1e-4),'their bend changes').toBe(true);
});

// Mean absolute difference per colour channel (0..255) between two screenshots, measured in the page.
const meanDiff=(page,a,b)=>page.evaluate(async([a,b])=>{
 const load=s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src='data:image/png;base64,'+s;});
 const [x,y]=await Promise.all([load(a),load(b)]),c=document.createElement('canvas');c.width=x.width;c.height=x.height;
 const g=c.getContext('2d');g.drawImage(x,0,0);const A=g.getImageData(0,0,c.width,c.height).data;
 g.drawImage(y,0,0);const B=g.getImageData(0,0,c.width,c.height).data;
 let s=0;for(let i=0;i<A.length;i+=4)s+=Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2]);
 return s/(A.length/4)/3;},[a.toString('base64'),b.toString('base64')]);

test('at rest the plant cards look like the real plants',async({page,request})=>{
 test.skip(!(await glbAt(request,'/environment/balcony-toon/plants.glb')),'the real plants are not on this machine');
 const clip={x:280,y:200,width:500,height:420},shot=async(source)=>{await loaded(page);
  await page.waitForFunction(s=>window.lofiViewer.plants().source===s,source,{timeout:60000});   // the full plants come after ready
  await page.waitForTimeout(800);return page.screenshot({clip});};
 await page.setViewportSize({width:1280,height:720});
 await page.goto('/?intro=0&music=0&greet=0&talk=0&hud=0&seed=3&wind=0');const real=await shot('full');
 await page.route('**/environment/balcony-toon/plants.glb',r=>r.fulfill({status:404,body:''}));
 await page.goto('/?intro=0&music=0&greet=0&talk=0&hud=0&seed=3&wind=0');const cards=await shot('cards');
 const d=await meanDiff(page,real,cards);
 expect(d,`mean difference ${d.toFixed(2)} per channel`).toBeLessThan(3.5);
});

// Vivi's fit: her hands on the book, her face reaching you, her expressions, her break, and a phone-sized screen.
const VIVI='/?intro=0&music=0&greet=0&talkevery=9999&standin=1';
test('her hands hold the book while she reads',async({page})=>{
 test.setTimeout(60000);
 await page.goto(VIVI+'&events=4');await loaded(page);
 const far=await page.evaluate(()=>new Promise(resolve=>{let worst=0;const t0=performance.now();
  (function tick(){const g=window.lofiViewer.grips(),h=window.lofiViewer.hands(),d=k=>Math.hypot(...h[k][0].map((x,i)=>x-g[k][i]));
   worst=Math.max(worst,d('left'),d('right'));if(performance.now()-t0<10000)requestAnimationFrame(tick);else resolve(worst);})();}));
 expect(far,`a hand came ${(far*100).toFixed(1)} cm off its grip`).toBeLessThanOrEqual(.04);
});

test('her face reaches you when she looks up, and her smile and mouth work',async({page})=>{
 await page.goto(VIVI);await loaded(page);
 const f=await page.evaluate(()=>new Promise((resolve,reject)=>{const out=[];
  if(!window.lofiViewer.talk('basil',{motion:'look'}))return reject(Error('could not say basil'));
  (function tick(){const s=window.lofiViewer.smallTalk();
   if(s.active){if(s.speech==='speaking')out.push({miss:Math.hypot(s.aim.face.yaw,s.aim.face.pitch),smile:s.smile,mouth:Math.max(...Object.values(s.mouth))});requestAnimationFrame(tick);}
   else resolve(out);})();}));
 expect(f.length).toBeGreaterThan(30);
 const late=f.slice(Math.floor(f.length/3));   // once her look has eased in
 expect(Math.max(...late.map(x=>x.miss)),'her face on the camera').toBeLessThanOrEqual(5);
 expect(Math.max(...f.map(x=>x.smile))).toBeGreaterThan(.3);
 expect(Math.max(...f.map(x=>x.mouth))).toBeGreaterThan(.3);
});

test('her overhead stretch runs: both hands above her head, then she reads on',async({page})=>{
 test.setTimeout(60000);
 const errs=errors(page);
 await page.goto(VIVI+'&reach=1');await loaded(page);
 await page.waitForFunction(()=>window.lofiViewer.reader().reach,null,{timeout:10000});
 const up=await page.evaluate(()=>new Promise(resolve=>{let best=-1,fastest=0,last=null;
  (function tick(){const v=window.lofiViewer,p=v.pose(),now=performance.now()/1000;
   best=Math.max(best,Math.min(p.leftHand[1],p.rightHand[1])-p.head[1]);
   if(last){const dt=Math.max(1/240,now-last.now);for(const k of ['leftHand','rightHand'])fastest=Math.max(fastest,Math.hypot(...p[k].map((x,i)=>x-last.p[k][i]))/dt);}
   last={p,now};
   if(v.reader().reach)requestAnimationFrame(tick);else resolve({best,fastest});})();}));
 expect(up.best,'both hands above her head at the top').toBeGreaterThan(.1);
 expect(up.fastest,`fastest hand ${up.fastest.toFixed(2)} m/s`).toBeLessThan(1.8);
 expect(await page.evaluate(()=>window.lofiViewer.error())).toBe(null);
 expect(errs).toEqual([]);
});

test('her break runs and she reads on',async({page})=>{
 test.setTimeout(60000);
 await page.goto(VIVI+'&stretch=1');await loaded(page);
 await page.waitForFunction(()=>window.lofiViewer.reader().stretch,null,{timeout:10000});
 await page.waitForFunction(()=>!window.lofiViewer.reader().stretch,null,{timeout:40000});
 expect(await page.evaluate(()=>window.lofiViewer.error())).toBe(null);
});

test('on a phone she stays in frame and can be clicked',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto(VIVI);await loaded(page);
 await page.waitForFunction(()=>window.lofiViewer.chat()?.free,null,{timeout:10000});
 const p=await page.evaluate(()=>window.lofiViewer.chatPoint());
 expect(p.x>0&&p.x<390&&p.y>0&&p.y<844,`her chest at ${Math.round(p.x)},${Math.round(p.y)}`).toBe(true);
 await page.mouse.click(p.x,p.y);
 await page.waitForFunction(()=>window.lofiViewer.chat().active,null,{timeout:3000});
});

test('her eyes face the way her face does, so they turn toward what she looks at (final review)',async({page})=>{
 await page.goto(VIVI);await loaded(page);
 const e=await page.evaluate(()=>window.lofiViewer.eyes());
 expect(e.front).toEqual([0,0,1]);expect(e.applierFront).toEqual([0,0,1]);
});
