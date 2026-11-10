import {test,expect} from '@playwright/test';
import {ownerFiles} from './owner-files.js';
// Opening shot: out of focus with a start button; pressing it pulls focus, then the music flows in and the HUD appears.
const sceneReady=async request=>(await ownerFiles(request));
const hasMusic=async request=>(await request.get('/music/playlist.json')).ok();
const canvasFilter=page=>page.evaluate(()=>getComputedStyle(document.querySelector('#stage canvas')).filter);

test('the page opens out of focus, with only a start button and no music',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto('/');await page.waitForFunction(()=>window.lofiViewer?.ready(),null,{timeout:60000});
 expect(await canvasFilter(page)).toContain('blur(16px)');
 await expect(page.getByRole('button',{name:'start'})).toBeVisible();
 await expect(page.locator('.hud-corner').first()).toBeHidden();      // the camera display is still off
 await expect(page.locator('.hud-music')).toBeHidden();
 await page.mouse.click(60,60);                                       // a click elsewhere does not start anything
 await page.waitForTimeout(300);
 expect(await page.evaluate(()=>window.lofiViewer.music()?.status)).toBe('idle');
});

test('start pulls focus, then the music flows in and the camera frame appears',async({page,request})=>{
 test.skip(!(await sceneReady(request))||!(await hasMusic(request)),'scene or music not prepared on this machine');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.waitForFunction(()=>window.lofiViewer?.ready(),null,{timeout:60000});
 await page.getByRole('button',{name:'start'}).click();
 await page.waitForFunction(()=>window.lofiViewer.music().status==='playing',null,{timeout:15000});
 // the camera display powers on in order while the picture is still pulling focus, with one beep
 const order=await page.evaluate(()=>new Promise(resolve=>{
  const seen={},t0=performance.now(),parts=['.hud-corner','.hud-rec','.hud-tc','.hud-music'];
  const iv=setInterval(()=>{
   for(const s of parts){const e=document.querySelector(s);if(!seen[s]&&getComputedStyle(e).visibility==='visible'&&+getComputedStyle(e).opacity>.5)seen[s]=performance.now()-t0;}
   if(Object.keys(seen).length===parts.length||performance.now()-t0>4000){clearInterval(iv);resolve({seen,focusing:document.body.classList.contains('is-focusing')});}
  },20);
 }));
 expect(order.focusing).toBe(true);
 const at=['.hud-corner','.hud-rec','.hud-tc','.hud-music'].map(s=>order.seen[s]);
 expect(at.every(Number.isFinite)).toBe(true);
 for(let i=1;i<at.length;i++)expect(at[i]).toBeGreaterThan(at[i-1]);       // corners, then rec, counter, music line
 expect(await page.evaluate(()=>window.lofiViewer.beeps())).toBe(1);
 await expect(page.locator('.hud-ctl')).toBeVisible();                // the controls power on with the music line
 await expect(page.locator('.hud-ctl')).toBeHidden({timeout:6000});   // and fold away a couple of seconds later
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#stage canvas')).filter==='none',null,{timeout:8000});
 await expect(page.getByRole('button',{name:'start'})).toHaveCount(0);
 await expect(page.locator('.hud-music')).toBeVisible();
 expect(await page.locator('.hud-tc').textContent()).toMatch(/^00:00:0\d$/);   // the counter started with the shot
 const t=(await page.evaluate(()=>window.lofiViewer.music())).time;
 await page.waitForFunction(x=>window.lofiViewer.music().time>x+.5,t);
 await page.keyboard.press('m');expect((await page.evaluate(()=>window.lofiViewer.music())).muted).toBe(true);   // page keys now work
 expect(errors).toEqual([]);
});

test('enter starts the page from the keyboard',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto('/');await page.waitForFunction(()=>window.lofiViewer?.ready(),null,{timeout:60000});
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.body.classList.contains('is-focusing'));
});

test('the intro can be skipped',async({page})=>{
 await page.goto('/?intro=0');await page.waitForFunction(()=>window.lofiViewer);
 await expect(page.getByRole('button',{name:'start'})).toHaveCount(0);
 expect(await canvasFilter(page)).toBe('none');
});
