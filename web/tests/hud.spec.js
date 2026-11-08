import {test,expect} from '@playwright/test';
// The camera-frame HUD: frame, counter and the music line with controls that unfold on interaction.
const music=page=>page.evaluate(()=>window.lofiViewer?.music());
const until=(page,fn,arg,timeout=15000)=>page.waitForFunction(fn,arg,{timeout,polling:100});
const hasMusic=async request=>(await request.get('/music/playlist.json')).ok();

test('hud shows the frame and a counter that runs',async({page})=>{
 await page.goto('/?music=0&intro=0');
 await expect(page.locator('.hud-corner')).toHaveCount(4);
 await expect(page.locator('.hud-rec')).toHaveText('rec');
 const t0=await page.locator('.hud-tc').textContent();expect(t0).toMatch(/^\d\d:\d\d:\d\d$/);
 await page.waitForTimeout(2100);
 expect(await page.locator('.hud-tc').textContent()).not.toBe(t0);
 await expect(page.locator('.hud-music')).toHaveCount(0);           // no music line when music is off
});

test('hud can be hidden',async({page})=>{
 await page.goto('/?hud=0');await page.waitForFunction(()=>window.lofiViewer);
 await expect(page.locator('.hud')).toHaveCount(0);
});

test('music line: tap for music, then controls unfold and fold away',async({page,request})=>{
 test.skip(!(await hasMusic(request)),'music not prepared on this machine');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?intro=0');await until(page,()=>window.lofiViewer?.ready()&&window.lofiViewer.music()?.tracks>0,null,60000);
 const now=page.locator('.hud-now');
 await expect(now).toHaveAttribute('aria-label','tap for music');
 await now.click();
 await until(page,()=>window.lofiViewer.music().status==='playing');
 const m=await music(page);
 await expect(now).toHaveAttribute('aria-label',`${m.track.title.toLowerCase()}, ${m.track.artist.toLowerCase()}`);
 await page.mouse.move(400,500);await page.mouse.move(420,520);
 await expect(page.locator('.hud-ctl')).toBeVisible();
 await page.mouse.move(800,300);await page.waitForTimeout(3800);   // 3 s without activity
 await expect(page.locator('.hud-ctl')).toBeHidden();
 expect(errors).toEqual([]);
});

test('music line: buttons pause, skip, mute, set volume and list credits',async({page,request})=>{
 test.skip(!(await hasMusic(request)),'music not prepared on this machine');
 await page.goto('/?intro=0');await until(page,()=>window.lofiViewer?.ready()&&window.lofiViewer.music()?.tracks>0,null,60000);
 await page.locator('.hud-now').click();await until(page,()=>window.lofiViewer.music().status==='playing');
 const show=async()=>{await page.mouse.move(300,860);await page.mouse.move(310,862);};
 await show();
 await page.getByRole('button',{name:'pause'}).click();await until(page,()=>window.lofiViewer.music().status==='paused');
 await expect(page.locator('.hud-now')).toHaveAttribute('aria-label',/^paused, /);
 await page.getByRole('button',{name:'play'}).click();await until(page,()=>window.lofiViewer.music().status==='playing');
 const id=(await music(page)).track.id;
 await page.getByRole('button',{name:'next song'}).click();await until(page,x=>window.lofiViewer.music().track.id!==x,id);
 await page.getByRole('button',{name:'mute'}).click();expect((await music(page)).muted).toBe(true);
 await page.getByRole('button',{name:'unmute'}).click();expect((await music(page)).muted).toBe(false);
 await page.getByRole('slider',{name:'volume'}).fill('0.3');expect((await music(page)).volume).toBeCloseTo(.3);
 await page.getByRole('button',{name:'credits'}).click();
 const panel=page.getByRole('dialog',{name:'music credits'});
 await expect(panel).toBeVisible();
 const p=await (await request.get('/music/playlist.json')).json();
 await expect(panel.locator('li')).toHaveCount(p.tracks.length);
 await expect(panel.locator('a[href^="https://creativecommons.org/"]').first()).toBeVisible();
 await expect(panel).toBeFocused();                                  // focus moves into the credits
 await page.keyboard.press('Escape');await expect(panel).toBeHidden();
 await expect(page.getByRole('button',{name:'credits'})).toBeFocused();   // and back to the button
 expect((await music(page)).status).toBe('playing');               // HUD clicks did not count as "tap anywhere"
});

test('hud fits a phone screen',async({browser,request})=>{
 test.skip(!(await hasMusic(request)),'music not prepared on this machine');
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await ctx.newPage();
 await page.goto('/?intro=0');await until(page,()=>window.lofiViewer?.ready()&&window.lofiViewer.music()?.tracks>0,null,60000);
 await page.locator('.hud-now').tap();await until(page,()=>window.lofiViewer.music().status==='playing');
 await page.locator('#stage').tap();
 await expect(page.locator('.hud-ctl')).toBeVisible();
 await expect(page.locator('.hud-tc')).toBeHidden();               // the counter makes way on narrow screens
 for(const b of await page.locator('.hud-ctl button').all()){
  const box=await b.boundingBox();expect(box.width).toBeGreaterThanOrEqual(39.5);   // 40 px touch targets (sub-pixel while sliding in)
  expect(box.x+box.width).toBeLessThanOrEqual(390);
 }
 await ctx.close();
});

test('space on a focused HUD button presses only that button',async({page,request})=>{
 test.skip(!(await hasMusic(request)),'music not prepared on this machine');
 await page.goto('/?intro=0');await until(page,()=>window.lofiViewer?.ready()&&window.lofiViewer.music()?.tracks>0,null,60000);
 await page.locator('.hud-now').click();await until(page,()=>window.lofiViewer.music().status==='playing');
 await page.mouse.move(300,860);await page.mouse.move(310,862);
 await page.getByRole('button',{name:'mute'}).focus();
 await page.keyboard.press(' ');
 const m=await music(page);expect(m.muted).toBe(true);expect(m.status).toBe('playing');   // muted, not also paused
 await page.getByRole('button',{name:'pause'}).focus();await page.keyboard.press(' ');
 await page.waitForTimeout(300);expect((await music(page)).status).toBe('paused');       // paused once, not paused+resumed
});
