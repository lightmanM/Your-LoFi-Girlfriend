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
