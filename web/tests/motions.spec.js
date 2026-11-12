import {test,expect} from '@playwright/test';
// The small things she does while she reads, in a real browser: tucking her hair, looking up when the visitor comes
// back, nodding to the music. All run with the stand-ins too; the nod is given a steady beat (?beat), since what the
// page hears in a real track depends on the track.
const ready=page=>page.waitForFunction(()=>window.lofiViewer?.ready()||window.lofiViewer?.error(),null,{timeout:60000});
const watch=page=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});return errors;};
const QUIET='intro=0&greet=0&talk=0&chat=0&music=0&seed=3';

test('she tucks her hair behind her ear and her hand goes back to the book',async({page})=>{
 const errors=watch(page);
 await page.goto(`/?${QUIET}&tuck=2`);await ready(page);
 const grip=()=>page.evaluate(()=>{const v=window.lofiViewer,h=v.hands().left[0],g=v.grips().left;return Math.hypot(h[0]-g[0],h[1]-g[1],h[2]-g[2]);});
 const held=await grip();
 await page.waitForFunction(()=>window.lofiViewer.tuck().arm>.99,null,{timeout:20000});
 expect(await grip(),'her hand is well off the book').toBeGreaterThan(.2);
 expect((await page.evaluate(()=>window.lofiViewer.reader())).stretch,'no break starts meanwhile').toBe(false);
 await page.waitForFunction(()=>!window.lofiViewer.tuck().active,null,{timeout:10000});
 expect(Math.abs(await grip()-held),'back where it held the book').toBeLessThan(.01);
 expect((await page.evaluate(()=>window.lofiViewer.tuck())).next,'the next one is minutes away').toBeGreaterThan(100);
 expect(errors).toEqual([]);
});

test('she looks up with a smile when the visitor comes back after a while, not after a moment',async({page})=>{
 const errors=watch(page);
 await page.goto(`/?${QUIET}`);await ready(page);
 expect(await page.evaluate(()=>window.lofiViewer.comeBack(10)),'ten seconds away is nothing').toBe(false);
 expect(await page.evaluate(()=>window.lofiViewer.comeBack(120))).toBe(true);
 await page.waitForFunction(()=>window.lofiViewer.welcome().looked,null,{timeout:5000});
 await page.waitForFunction(()=>window.lofiViewer.welcome().smile>.8,null,{timeout:5000});
 expect(await page.evaluate(()=>window.lofiViewer.comeBack(120)),'not twice at once').toBe(false);
 await page.waitForFunction(()=>!window.lofiViewer.welcome().active,null,{timeout:8000});
 expect((await page.evaluate(()=>window.lofiViewer.welcome())).smile).toBe(0);
 expect(errors).toEqual([]);
});

test('she nods to a clear beat for a few bars, and not when there is none',async({page})=>{
 const errors=watch(page);
 await page.goto(`/?${QUIET}&nod=1`);await ready(page);await page.waitForTimeout(2500);
 expect((await page.evaluate(()=>window.lofiViewer.nod())).weight,'no music: no nod').toBe(0);
 await page.goto(`/?${QUIET}&nod=2&beat=84`);await ready(page);
 await page.waitForFunction(()=>window.lofiViewer.nod().weight>.9,null,{timeout:20000});
 await page.waitForFunction(()=>{const n=window.lofiViewer.nod();return !n.on&&n.weight===0;},null,{timeout:30000});
 expect((await page.evaluate(()=>window.lofiViewer.nod())).next,'the next one is minutes away').toBeGreaterThan(60);
 expect(errors).toEqual([]);
});

test('nothing else takes her head while her hand is at her hair',async({page})=>{
 await page.goto(`/?${QUIET}&tuck=2&nod=2&beat=84`);await ready(page);
 await page.waitForFunction(()=>window.lofiViewer.tuck().arm>.99,null,{timeout:20000});
 expect((await page.evaluate(()=>window.lofiViewer.nod())).weight,'no nod during the tuck').toBe(0);
 expect(await page.evaluate(()=>window.lofiViewer.comeBack(120)),'no look-up during the tuck').toBe(false);
 await page.waitForFunction(()=>!window.lofiViewer.tuck().active,null,{timeout:10000});
 await page.waitForFunction(()=>window.lofiViewer.nod().weight>.9,null,{timeout:20000});   // the nod comes after it
});
