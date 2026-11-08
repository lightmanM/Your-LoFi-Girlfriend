import {test,expect} from '@playwright/test';
// Opening shot: out of focus with a start button; pressing it pulls focus, then the music flows in and the HUD appears.
const sceneReady=async request=>(await request.get('/environment/balcony-toon/scene.json')).ok();
const hasMusic=async request=>(await request.get('/music/playlist.json')).ok();
const canvasFilter=page=>page.evaluate(()=>getComputedStyle(document.querySelector('#stage canvas')).filter);

test('the page opens out of focus, with only a start button and no music',async({page,request})=>{
 test.skip(!(await sceneReady(request)),'balcony layers not rendered on this machine');
 await page.goto('/');await page.waitForFunction(()=>window.lofiViewer?.ready(),null,{timeout:60000});
 expect(await canvasFilter(page)).toContain('blur(16px)');
 await expect(page.getByRole('button',{name:'start'})).toBeVisible();
 await expect(page.locator('.hud')).toBeHidden();                    // the camera frame waits for focus
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
 // the camera display flashes on while the picture is still pulling focus
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.hud')).opacity==='1'&&document.body.classList.contains('is-focusing'),null,{timeout:4000});
 expect(await canvasFilter(page)).not.toBe('none');
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#stage canvas')).filter==='none',null,{timeout:8000});
 await expect(page.getByRole('button',{name:'start'})).toHaveCount(0);
 await expect(page.locator('.hud')).toBeVisible();
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
