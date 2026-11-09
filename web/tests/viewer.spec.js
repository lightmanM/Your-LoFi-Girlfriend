import {test,expect} from '@playwright/test';
// The visitor page: fullscreen scene, no controls, the character reading. Needs the private Marycia files and the
// rendered balcony layers (git-ignored); skipped when they are absent.
test('viewer shows the scene with no controls and keeps reading',async({page,request})=>{
 test.skip(!(await request.get('/environment/balcony-toon/scene.json')).ok(),'balcony layers not rendered on this machine');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');await page.waitForFunction(()=>window.lofiViewer?.ready()||window.lofiViewer?.error(),null,{timeout:60000});
 expect(await page.evaluate(()=>window.lofiViewer.error())).toBeNull();
 // the only controls are the camera HUD's music line; its buttons stay folded away until the visitor interacts
 await expect(page.locator('.hud-ctl')).toBeHidden();
 expect(await page.locator('button:visible,input:visible,select:visible,a:visible').count()).toBe(1);   // "tap for music"
 const t0=await page.evaluate(()=>window.lofiViewer.reader().time);await page.waitForTimeout(1500);
 const r=await page.evaluate(()=>window.lofiViewer.reader());
 expect(r.time).toBeGreaterThan(t0);expect(r.stretch).toBe(false);expect(r.nextStretch).toBeGreaterThan(200);
 expect(errors).toEqual([]);
});
test('viewer plays a stretch break when asked',async({page,request})=>{
 test.skip(!(await request.get('/environment/balcony-toon/scene.json')).ok(),'balcony layers not rendered on this machine');
 await page.goto('/?stretch=1');await page.waitForFunction(()=>window.lofiViewer?.ready(),null,{timeout:60000});
 await page.waitForFunction(()=>window.lofiViewer.reader().stretch,null,{timeout:10000});
});
test('viewer seats her on the chair',async({page,request})=>{
 test.skip(!(await request.get('/environment/balcony-toon/scene.json')).ok(),'balcony layers not rendered on this machine');
 await page.goto('/');await page.waitForFunction(()=>window.lofiViewer?.ready(),null,{timeout:60000});
 const s=await page.evaluate(()=>window.lofiViewer.seat());
 expect(s.drop).toBeGreaterThan(.02);expect(s.drop).toBeLessThan(.12);
 const c=await page.evaluate(()=>window.lofiViewer.chair());expect(c.receivesShadows).toBe(true);expect(c.shadowMap).toBe(true);
});

test('a glance turns her head a little and brings her back to the book',async({page,request})=>{
 test.skip(!(await request.get('/environment/balcony-toon/scene.json')).ok(),'balcony layers not rendered on this machine');
 await page.goto('/?intro=0&greet=0&talk=0');await page.waitForFunction(()=>window.lofiViewer?.ready(),null,{timeout:60000});
 const before=await page.evaluate(()=>window.lofiViewer.reader().head);
 await page.evaluate(()=>window.lofiViewer.glance({yaw:-14,pitch:-4,hold:1}));
 await page.waitForFunction(()=>window.lofiViewer.reader().away>.95,null,{timeout:3000});
 const r=await page.evaluate(()=>window.lofiViewer.reader());
 expect(r.busy).toBe(true);
 expect(Math.abs(r.head.yaw-before.yaw)).toBeLessThanOrEqual(15);expect(Math.abs(r.head.yaw-before.yaw)).toBeGreaterThan(5);
 await page.waitForFunction(()=>window.lofiViewer.reader().away<.05&&!window.lofiViewer.reader().busy,null,{timeout:4000});
});

test('no stretch starts while she is talking; it comes once she has finished',async({page,request})=>{
 test.skip(!(await request.get('/environment/balcony-toon/scene.json')).ok(),'balcony layers not rendered on this machine');
 await page.goto('/?intro=0&greet=0&talk=0&stretch=4');await page.waitForFunction(()=>window.lofiViewer?.ready(),null,{timeout:60000});
 await page.evaluate(()=>window.lofiViewer.talking(true));
 await page.waitForTimeout(5500);
 expect((await page.evaluate(()=>window.lofiViewer.reader())).stretch).toBe(false);
 await page.evaluate(()=>window.lofiViewer.talking(false));
 await page.waitForFunction(()=>window.lofiViewer.reader().stretch,null,{timeout:3000});
});

test('a glance turns from where her head already is (a tilt alone does not turn her head)',async({page,request})=>{
 test.skip(!(await request.get('/environment/balcony-toon/scene.json')).ok(),'balcony layers not rendered on this machine');
 await page.goto('/?intro=0&greet=0&talk=0');await page.waitForFunction(()=>window.lofiViewer?.ready(),null,{timeout:60000});
 await page.evaluate(()=>window.lofiViewer.holdReading(true));await page.waitForTimeout(800);   // her reading head settles
 const before=await page.evaluate(()=>window.lofiViewer.reader().head);
 await page.evaluate(()=>window.lofiViewer.glance({yaw:0,pitch:0,roll:6,hold:1,eyes:'page'}));
 await page.waitForFunction(()=>window.lofiViewer.reader().away>.95,null,{timeout:3000});
 const during=await page.evaluate(()=>window.lofiViewer.reader().head);
 expect(Math.abs(during.yaw-before.yaw),`head yaw ${before.yaw} -> ${during.yaw}`).toBeLessThan(1.5);
 expect(Math.abs(during.pitch-before.pitch)).toBeLessThan(1.5);
});

test('her break from reading: hands stay on the book, shoulders never sink, then she reads on',async({page,request})=>{
 test.skip(!(await request.get('/environment/balcony-toon/scene.json')).ok(),'balcony layers not rendered on this machine');
 test.setTimeout(60000);
 const clips=[];page.on('request',r=>{if(r.url().includes('stretch-break'))clips.push(r.url());});
 await page.goto('/?intro=0&music=0&greet=0&talk=0&stretch=2');await page.waitForFunction(()=>window.lofiViewer?.ready(),null,{timeout:60000});
 const f=await page.evaluate(()=>new Promise(resolve=>{const out=[];let seen=false,rest=null;
  (function tick(){const v=window.lofiViewer,p=v.pose(),s=p.stretch,sh=k=>p[k+'UpperArm'][1]-p.neck[1];
   if(!s?.active&&!seen)rest={left:sh('left'),right:sh('right')};
   if(s?.active){seen=true;const g=v.grips(),h=v.hands(),d=k=>Math.hypot(...h[k][0].map((x,i)=>x-g[k][i]));
    out.push({t:s.t,grip:Math.max(d('left'),d('right')),low:Math.min(sh('left')-rest.left,sh('right')-rest.right)});}
   if(seen&&!s?.active)resolve(out);else requestAnimationFrame(tick);})();}));
 expect(f.length).toBeGreaterThan(100);
 const grip=Math.max(...f.map(x=>x.grip)),low=Math.min(...f.map(x=>x.low));
 expect(grip,`a hand came ${(grip*100).toFixed(1)} cm off the book`).toBeLessThanOrEqual(.03);
 expect(low,`her shoulders sank ${(-low*100).toFixed(1)} cm`).toBeGreaterThanOrEqual(-.005);
 expect(clips,'the old stretch clip is no longer downloaded').toEqual([]);
 const r=await page.evaluate(()=>window.lofiViewer.reader());expect(r.stretch).toBe(false);
});

