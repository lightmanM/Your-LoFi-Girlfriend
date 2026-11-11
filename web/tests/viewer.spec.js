import {test,expect} from '@playwright/test';
import {ownerFiles} from './owner-files.js';
// The visitor page: fullscreen scene, no controls, the character reading. Needs the private Marycia files and the
// rendered balcony layers (git-ignored); skipped when they are absent.
test('viewer shows the scene with no controls and keeps reading',async({page,request})=>{
 test.skip(!(await ownerFiles(request)),'balcony layers not rendered on this machine');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');await page.waitForFunction(()=>window.lofiViewer?.ready()||window.lofiViewer?.error(),null,{timeout:60000});
 expect(await page.evaluate(()=>window.lofiViewer.error())).toBeNull();
 // the only controls are the camera HUD's music line; its buttons stay folded away until the visitor interacts
 await expect(page.locator('.hud-ctl')).toBeHidden();
 expect(await page.locator('button:visible,input:visible,select:visible,a:visible').count()).toBe(1);   // "tap for music"
 const t0=await page.evaluate(()=>window.lofiViewer.reader().time);await page.waitForTimeout(1500);
 const r=await page.evaluate(()=>window.lofiViewer.reader());
 expect(r.time).toBeGreaterThan(t0);expect(r.stretch).toBe(false);expect(r.nextStretch).toBeGreaterThan(200);
 expect(r.reach).toBe(false);expect(r.nextReach,'the overhead stretch is 5 to 15 minutes away').toBeGreaterThan(290);expect(r.nextReach).toBeLessThanOrEqual(900);
 expect(errors).toEqual([]);
});
test('viewer plays a stretch break when asked',async({page,request})=>{
 test.skip(!(await ownerFiles(request)),'balcony layers not rendered on this machine');
 await page.goto('/?stretch=1');await page.waitForFunction(()=>window.lofiViewer?.ready(),null,{timeout:60000});
 await page.waitForFunction(()=>window.lofiViewer.reader().stretch,null,{timeout:10000});
});
test('viewer seats her on the chair',async({page,request})=>{
 test.skip(!(await ownerFiles(request)),'balcony layers not rendered on this machine');
 await page.goto('/');await page.waitForFunction(()=>window.lofiViewer?.ready(),null,{timeout:60000});
 const s=await page.evaluate(()=>window.lofiViewer.seat());
 expect(s.drop).toBeGreaterThan(.02);expect(s.drop).toBeLessThan(.12);
 const c=await page.evaluate(()=>window.lofiViewer.chair());expect(c.receivesShadows).toBe(true);expect(c.shadowMap).toBe(true);
});

test('a glance turns her head a little and brings her back to the book',async({page,request})=>{
 test.skip(!(await ownerFiles(request)),'balcony layers not rendered on this machine');
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
 test.skip(!(await ownerFiles(request)),'balcony layers not rendered on this machine');
 await page.goto('/?intro=0&greet=0&talk=0&stretch=4');await page.waitForFunction(()=>window.lofiViewer?.ready(),null,{timeout:60000});
 await page.evaluate(()=>window.lofiViewer.talking(true));
 await page.waitForTimeout(5500);
 expect((await page.evaluate(()=>window.lofiViewer.reader())).stretch).toBe(false);
 await page.evaluate(()=>window.lofiViewer.talking(false));
 await page.waitForFunction(()=>window.lofiViewer.reader().stretch,null,{timeout:3000});
});

test('a glance turns from where her head already is (a tilt alone does not turn her head)',async({page,request})=>{
 test.skip(!(await ownerFiles(request)),'balcony layers not rendered on this machine');
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
 test.skip(!(await ownerFiles(request)),'balcony layers not rendered on this machine');
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

// The overhead stretch (?reach=N starts one after N seconds): recorded frame by frame until it is over.
const recordReach=page=>page.evaluate(()=>new Promise(resolve=>{const out=[];
 (function tick(){const v=window.lofiViewer,p=v.pose(),r=v.reader();
  if(p.reach.active){const g=v.grips(),h=v.hands(),off=k=>Math.hypot(...h[k][0].map((x,i)=>x-g[k][i]));
   out.push({t:p.reach.t,now:performance.now()/1000,left:p.leftHand,right:p.rightHand,head:p.head,
    arms:['left','right'].map(k=>{const d=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i])),s=p[k+'UpperArm'],e=p[k+'LowerArm'],w=p[k+'Hand'];return d(s,w)/(d(s,e)+d(e,w));}),
    off:Math.max(off('left'),off('right')),busy:r.busy,hands:r.hands});}
  if(out.length&&!p.reach.active)resolve(out);else requestAnimationFrame(tick);})();}));
const reachChecks=f=>{
 const dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i])),top=f.reduce((a,b)=>b.left[1]>a.left[1]?b:a);
 let fastest=0;for(let i=1;i<f.length;i++){const dt=Math.max(1/240,f[i].now-f[i-1].now);for(const k of ['left','right','head'])fastest=Math.max(fastest,dist(f[i][k],f[i-1][k])/dt);}
 return {seconds:f.at(-1).t,top,fastest,straightest:Math.max(...f.flatMap(x=>x.arms)),
  onBookWhileCarried:Math.max(...f.filter(x=>x.hands.left===0&&x.hands.right===0).map(x=>x.off)),busy:f.every(x=>x.busy)};
};

test('her overhead stretch: hands off the book and above her head, no jump, then back on the book and reading',async({page,request})=>{
 test.skip(!(await ownerFiles(request)),'balcony layers not rendered on this machine');
 test.setTimeout(60000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // the calm break comes due while she stretches (?stretch=6): it has to wait its minute after the stretch
 await page.goto('/?intro=0&music=0&greet=0&talk=0&reach=1&stretch=6');await page.waitForFunction(()=>window.lofiViewer?.ready(),null,{timeout:60000});
 await page.waitForFunction(()=>window.lofiViewer.reader().reach,null,{timeout:10000});
 const f=await recordReach(page),c=reachChecks(f);
 expect(f.length).toBeGreaterThan(100);
 expect(c.seconds).toBeGreaterThan(11.5);
 expect(c.top.t,'the top of the stretch is in its middle').toBeGreaterThan(4.5);expect(c.top.t).toBeLessThan(8);
 for(const k of ['left','right'])expect(c.top[k][1]-c.top.head[1],`her ${k} hand above her head`).toBeGreaterThan(.15);
 expect(c.fastest,`fastest hand or head ${c.fastest.toFixed(2)} m/s`).toBeLessThan(1.8);
 expect(c.straightest,'her elbows never lock').toBeLessThanOrEqual(.985);
 expect(c.onBookWhileCarried,`a hand came ${(c.onBookWhileCarried*100).toFixed(1)} cm off the book while carrying it`).toBeLessThanOrEqual(.03);
 expect(c.busy,'she is busy from the book going down to its return').toBe(true);
 const r=await page.evaluate(()=>window.lofiViewer.reader());
 expect(r.reach).toBe(false);expect(r.nextReach).toBeGreaterThan(290);
 expect(r.stretch,'the calm break does not follow at once').toBe(false);
 expect(r.nextStretch,'it waits a minute').toBeGreaterThanOrEqual(58);expect(r.nextStretch).toBeLessThanOrEqual(60);
 expect(errors).toEqual([]);
});
