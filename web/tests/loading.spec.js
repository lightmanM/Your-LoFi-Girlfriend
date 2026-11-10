import {test,expect} from '@playwright/test';
// First load: the camera stands by over a blurred picture of her room and shows how much has really arrived, then
// hands over to the start button and the camera display.
const PLATE='**/environment/balcony-toon/plate.webp';
const ready=page=>page.waitForFunction(()=>window.lofiViewer?.ready(),null,{timeout:60000});
/** Hold one picture layer back so the page stays loading; the returned function lets it through. */
const holdPlate=async page=>{
 let open;const gate=new Promise(r=>{open=r;});
 await page.route(PLATE,async route=>{await gate;await route.continue();});
 return open;
};
const standbyOpacity=page=>page.evaluate(()=>+getComputedStyle(document.getElementById('standby')).opacity);

test('the page shell alone shows the camera standing by over a blurred picture',async({page,request})=>{
 const html=await (await request.get('/')).text();
 expect(html).toContain('id="standby"');
 expect(html).toContain('data:image/jpeg;base64,');
 await page.route('**/src/viewer/main.js',route=>route.abort());      // nothing of the app arrives
 await page.goto('/');
 await expect(page.locator('#standby .sb-state')).toHaveText('stby');
 await expect(page.locator('#standby .sb-pct')).toHaveText('0%');
 await expect(page.locator('#standby .sb-c')).toHaveCount(4);
 await expect(page.locator('#note')).toContainText('loading her room');
 const picture=await page.evaluate(()=>{const s=getComputedStyle(document.getElementById('stage'),'::before');return {image:s.backgroundImage,filter:s.filter};});
 expect(picture.image).toContain('data:image/jpeg');
 expect(picture.filter).toContain('blur(');
});

test('while her room loads the camera stands by with a real percentage',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const open=await holdPlate(page);
 await page.goto('/');
 await expect(page.locator('#standby .sb-state')).toHaveText('stby');
 await expect(page.locator('#standby .sb-pct')).toHaveText(/^[1-9]\d?%$/,{timeout:30000});   // some has arrived, not all
 await expect(page.locator('#note')).toContainText('loading her room');
 await expect(page.locator('#note')).toContainText(/\d+\.\d \/ \d+\.\d mb/);
 const during=await page.evaluate(()=>({ready:window.lofiViewer.ready(),progress:window.lofiViewer.progress(),
  intro:+getComputedStyle(document.querySelector('.intro')).opacity}));
 expect(during.ready).toBe(false);
 expect(during.intro).toBe(0);                                         // no start button yet
 expect(during.progress.fraction).toBeLessThan(1);
 expect(during.progress.pending).toBeGreaterThanOrEqual(1);          // the held picture has not answered
 open();
 await ready(page);
 await expect(page.locator('#standby .sb-state')).toHaveText('ready');
 await expect(page.locator('#standby .sb-pct')).toHaveText('100%');
 await expect(page.locator('#note')).toBeHidden();
 expect(await standbyOpacity(page)).toBe(1);                           // it stays on behind the start button
 const done=await page.evaluate(()=>window.lofiViewer.progress());
 expect(done.loaded).toBe(done.total);
 expect(done.total).toBeGreaterThan(1e6);
 expect(errors).toEqual([]);
});

test('start switches the stand-by display off before the camera display powers on',async({page})=>{
 await page.goto('/');await ready(page);
 await expect(page.locator('#standby')).toBeVisible();
 await page.getByRole('button',{name:'start'}).click();
 await expect(page.locator('#standby')).toBeHidden({timeout:2000});
});

test('with the intro skipped the stand-by display goes when she is ready',async({page})=>{
 await page.goto('/?intro=0');await ready(page);
 await expect(page.locator('#standby')).toBeHidden({timeout:2000});
 await expect(page.locator('#note')).toBeHidden();
});

test('every picture layer is downloaded once',async({page})=>{
 const count={};
 page.on('request',r=>{const m=/\/environment\/balcony-toon\/([\w-]+\.(?:webp|glb))$/.exec(new URL(r.url()).pathname);if(m&&!r.headers().range)count[m[1]]=(count[m[1]]??0)+1;});
 await page.goto('/');await ready(page);
 expect(count['plate.webp']).toBe(1);
 expect(count['book.glb']).toBe(1);
 expect(Object.values(count).every(n=>n===1)).toBe(true);
});

test('a picture layer that cannot be loaded says so on the stand-by display',async({page})=>{
 await page.route(PLATE,route=>route.abort());
 await page.goto('/');
 await expect(page.locator('#note')).toContainText('could not load',{timeout:30000});
 await expect(page.locator('#standby .sb-state')).toHaveText('no signal');
 await expect(page.locator('#standby')).toBeVisible();
});

test('with reduced motion the stand-by light does not blink',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/src/viewer/main.js',route=>route.abort());
 await page.goto('/');
 expect(await page.evaluate(()=>getComputedStyle(document.querySelector('#standby .sb-state i')).animationName)).toBe('none');
});
