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

// The balcony's own plant meshes (plants.glb, 8 MB) come after she is ready; plant cards stand in until then.
const PLANTS_GLB='**/environment/balcony-toon/plants.glb';
/** Hold the full download of plants.glb back (its first-bytes check goes through); the returned function lets it go. */
const holdPlants=async page=>{
 let open;const gate=new Promise(r=>{open=r;});
 await page.route(PLANTS_GLB,async route=>{if(!route.request().headers().range)await gate;await route.continue();});
 return open;
};
const plantsHere=async request=>{const r=await request.get('/environment/balcony-toon/plants.glb',{headers:{Range:'bytes=0-3'}});return r.ok()&&(await r.body()).toString('latin1')==='glTF';};

test('she is ready before the full plants arrive; they then take the plant cards\' place',async({page,request})=>{
 test.skip(!(await plantsHere(request)),'the balcony\'s plant meshes are not on this machine');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const open=await holdPlants(page);
 await page.goto('/?intro=0&music=0&greet=0&talkevery=9999');await ready(page);
 const before=await page.evaluate(()=>({plants:window.lofiViewer.plants(),progress:window.lofiViewer.progress(),using:window.lofiViewer.standin().using}));
 expect(before.plants.source).toBe('cards');
 expect(before.progress.total).toBeLessThan(12e6);                     // the 8 MB of plants is not in the first load
 expect(before.using).toEqual([]);                                      // the owner's plants are still the ones to show
 open();
 await page.waitForFunction(()=>window.lofiViewer.plants().source==='full',null,{timeout:60000});
 const after=await page.evaluate(()=>window.lofiViewer.plants());
 for(const g of ['ivy','roses','pots'])expect(after.cards[g],`${g} meshes`).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});

test('if the full plants cannot be loaded later, the plant cards stay and nothing breaks',async({page,request})=>{
 test.skip(!(await plantsHere(request)),'the balcony\'s plant meshes are not on this machine');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(PLANTS_GLB,route=>route.request().headers().range?route.continue():route.abort());
 await page.goto('/?intro=0&music=0&greet=0&talkevery=9999');await ready(page);
 await page.waitForFunction(()=>window.lofiViewer.standin().using.includes('plants'),null,{timeout:30000});
 const s=await page.evaluate(()=>({plants:window.lofiViewer.plants(),error:window.lofiViewer.error()}));
 expect(s.plants.source).toBe('cards');
 expect(s.error).toBe(null);
 expect(errors).toEqual([]);
});

test('with reduced motion the stand-by light does not blink',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/src/viewer/main.js',route=>route.abort());
 await page.goto('/');
 expect(await page.evaluate(()=>getComputedStyle(document.querySelector('#standby .sb-state i')).animationName)).toBe('none');
});
