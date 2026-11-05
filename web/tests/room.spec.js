import {test,expect} from '@playwright/test';

test('room loads existing assets and completes a blended interaction without fetching',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/room.html?character=vivi');
 await expect.poll(()=>page.evaluate(()=>window.lofiRoom?.ready()),{timeout:45000}).toBe(true);
 const requests=[];page.on('request',r=>requests.push(r.url()));
 await page.getByRole('button',{name:'Play action',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>lofiRoom.snapshot().interaction.state)).toBe('acting');
 await expect.poll(()=>page.evaluate(()=>lofiRoom.snapshot().interaction.weight)).toBeGreaterThan(.8);
 await expect.poll(()=>page.evaluate(()=>lofiRoom.snapshot().interaction.completed),{timeout:15000}).toBe(1);
 expect(await page.evaluate(()=>lofiRoom.snapshot().interaction.state)).toBe('idle');
 expect(requests).toEqual([]);expect(errors).toEqual([]);
});

test('supplied finger pose stays continuous through entry and exit',async({page})=>{
 await page.goto('/room.html?character=vivi');await page.waitForFunction(()=>window.lofiRoom?.ready());
 await page.waitForTimeout(600);
 const samples=await page.evaluate(async()=>{
  const rows=[];lofiRoom.resetMetrics();lofiRoom.greet('thumbsUp');
  return await new Promise(resolve=>{
   function tick(){
    const s=lofiRoom.snapshot();rows.push({t:s.time,...s.interaction,hand:s.joints.rightHand.position,q:s.joints.rightIndexProximal.quaternion});
    if(s.interaction.completed>=1&&s.interaction.state==='idle')resolve(rows);else requestAnimationFrame(tick);
   }requestAnimationFrame(tick);
  });
 });
 let maxStep=0,maxAngle=0,maxWeightStep=0,excursion=0;
 for(let i=1;i<samples.length;i++){
  const a=samples[i-1],b=samples[i];
  maxStep=Math.max(maxStep,Math.hypot(...b.hand.map((v,k)=>v-a.hand[k])));
  const dot=Math.abs(b.q.reduce((sum,v,k)=>sum+v*a.q[k],0));maxAngle=Math.max(maxAngle,2*Math.acos(Math.min(1,dot)));
  maxWeightStep=Math.max(maxWeightStep,Math.abs(b.weight-a.weight));
  excursion=Math.max(excursion,2*Math.acos(Math.min(1,Math.abs(b.q.reduce((sum,v,k)=>sum+v*samples[0].q[k],0)))));
 }
 expect(excursion).toBeGreaterThan(.04);expect(maxStep).toBeLessThan(.04);
 expect(maxAngle).toBeLessThan(.22);expect(maxWeightStep).toBeLessThan(.11);
 expect(samples.some(s=>s.state==='finishing')).toBe(true);
 expect(samples.filter(s=>s.weight>.05&&s.weight<.95).length).toBeGreaterThan(12);
 const {writeFile,mkdir}=await import('node:fs/promises');await mkdir('../docs/scene-mvp',{recursive:true});
 await writeFile('../docs/marycia-source-motions/vivi-transition-metrics.json',JSON.stringify({frames:samples.length,maxStepMeters:maxStep,maxAngleRadians:maxAngle,maxWeightStep,fingerExcursionRadians:excursion,samples},null,2));
});

test('rapid clicks queue only one follow-up and pause freezes the action',async({page})=>{
 await page.goto('/room.html?character=vivi');await page.waitForFunction(()=>window.lofiRoom?.ready());
 await page.evaluate(()=>{for(let i=0;i<12;i++)lofiRoom.greet();});
 await expect.poll(()=>page.evaluate(()=>lofiRoom.snapshot().interaction.weight)).toBeGreaterThan(.5);
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 const frozen=await page.evaluate(()=>lofiRoom.snapshot().interaction.elapsed);
 await page.waitForTimeout(400);expect(await page.evaluate(()=>lofiRoom.snapshot().interaction.elapsed)).toBe(frozen);
 await page.getByRole('button',{name:'Resume',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>lofiRoom.snapshot().interaction.completed),{timeout:18000}).toBe(2);
 await page.waitForTimeout(800);
 const end=await page.evaluate(()=>lofiRoom.snapshot());expect(end.interaction.started).toBe(2);expect(end.interaction.state).toBe('idle');
 expect(end.canvasCount).toBe(1);expect(end.error).toBeNull();
});

test('mobile room controls and reduced-motion startup are usable',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/room.html?character=vivi');await page.waitForFunction(()=>window.lofiRoom?.ready());
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.evaluate(()=>lofiRoom.snapshot().interaction.paused)).toBe(true);
 await page.getByRole('button',{name:'Play action',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>lofiRoom.snapshot().interaction.weight)).toBeGreaterThan(.8);
 await page.screenshot({path:'../docs/scene-mvp/mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Behind the scene'}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('room can replace its character and recover from invalid input',async({page})=>{
 test.skip(!process.env.VRM_SECOND_MODEL,'Optional independent replacement requires a local licensed VRM.');
 await page.goto('/room.html?character=vivi');await page.waitForFunction(()=>window.lofiRoom?.ready());
 await page.getByRole('button',{name:'Behind the scene'}).click();
 await page.locator('#room-model').setInputFiles(process.env.VRM_SECOND_MODEL);
 await expect.poll(()=>page.evaluate(()=>lofiRoom.snapshot().modelLoads)).toBe(2);
 const name=await page.evaluate(()=>lofiRoom.snapshot().modelName);
 await page.evaluate(()=>lofiRoom.greet());
 await expect.poll(()=>page.evaluate(()=>lofiRoom.snapshot().interaction.completed),{timeout:15000}).toBe(1);
 await page.locator('#room-model').setInputFiles({name:'invalid.vrm',mimeType:'application/octet-stream',buffer:Buffer.from('invalid')});
 await expect(page.locator('#model-status')).toContainText('Current character kept');
 expect(await page.evaluate(()=>lofiRoom.snapshot().modelName)).toBe(name);
 await page.getByRole('button',{name:'Restore Vivi'}).click();
 await expect.poll(()=>page.evaluate(()=>lofiRoom.snapshot().modelName)).toBe('Vivi');
 expect(await page.evaluate(()=>lofiRoom.snapshot().canvasCount)).toBe(1);
});
