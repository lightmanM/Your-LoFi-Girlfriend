import {test,expect} from '@playwright/test';

test('Marycia uses source face animation and finger poses without additional downloads',async({page})=>{
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto('/room.html');await page.waitForFunction(()=>window.lofiRoom?.ready(),null,{timeout:60000});
 const initial=await page.evaluate(()=>lofiRoom.snapshot());
 expect(initial.modelName).toBe('Marycia');expect(initial.source).toContain('supplied Unity');
 expect(initial.missingFaceMorphs).toEqual([]);expect(initial.clips.some(c=>c.name==='Sitting_Talking_Loop')).toBe(false);
 expect(requests.some(url=>url.includes('/motions/seated.json'))).toBe(false);
 requests.length=0;
 const evidence={};
 for(const action of ['smile','wink','peace','thumbsUp','fingerHeart']){
  const samples=await page.evaluate(async action=>{
   const end=lofiRoom.snapshot().interaction.completed+1;lofiRoom.greet(action);const frames=[];
   return new Promise(resolve=>{function tick(){const s=lofiRoom.snapshot();frames.push({time:s.time,...s.interaction,p:s.joints.rightHand.position,finger:s.joints.rightIndexProximal.rawQuaternion,face:s.faceMorphs});
    if(s.interaction.completed===end)resolve(frames);else requestAnimationFrame(tick);
   }requestAnimationFrame(tick);});
  },action);
  expect(samples.some(s=>s.state==='finishing')).toBe(true);expect(samples.at(-1).state).toBe('idle');
  let maxStep=0,maxAngle=0;for(let i=1;i<samples.length;i++){
   maxStep=Math.max(maxStep,Math.hypot(...samples[i].p.map((v,j)=>v-samples[i-1].p[j])));
   maxAngle=Math.max(maxAngle,2*Math.acos(Math.min(1,Math.abs(samples[i].finger.reduce((sum,v,k)=>sum+v*samples[i-1].finger[k],0)))));
  }
  const fingerRange=Math.max(...samples.map(s=>2*Math.acos(Math.min(1,Math.abs(s.finger.reduce((sum,v,k)=>sum+v*samples[0].finger[k],0))))));
  expect(maxStep).toBeLessThan(.005);expect(maxAngle).toBeLessThan(.4);
  if(['thumbsUp','fingerHeart'].includes(action))expect(fingerRange).toBeGreaterThan(.2);
  if(action==='smile')expect(Math.max(...samples.map(s=>s.face.Mouth_Smile1))).toBeGreaterThan(.3);
  if(action==='wink')expect(Math.max(...samples.map(s=>s.face['ウィンク右']))).toBeGreaterThan(.3);
  evidence[action]={frames:samples.length,maxHandStepMeters:maxStep,maxFingerStepRadians:maxAngle,fingerExcursionRadians:fingerRange};
 }
 const {writeFile,mkdir}=await import('node:fs/promises');await mkdir('../docs/marycia-source-motions',{recursive:true});
 await writeFile('../docs/marycia-source-motions/transition-metrics.json',JSON.stringify(evidence,null,2));
 expect(requests).toEqual([]);expect(errors).toEqual([]);
});

test('Marycia studio link opens the converted model and its facial controls respond',async({page})=>{
 await page.goto('/studio.html?character=marycia');await page.waitForFunction(()=>window.characterLab?.ready());
 const first=await page.evaluate(()=>characterLab.snapshot());expect(first.name).toBe('Marycia');
 expect(first.mappedBones.length).toBe(53);
 await page.locator('#face-view').click();await page.locator('#smile').fill('0.9');await page.locator('#smile').dispatchEvent('input');
 await expect.poll(()=>page.evaluate(()=>characterLab.snapshot().facialWeights.happy)).toBeGreaterThan(.85);
 await page.locator('#mouth').fill('0.6');await page.locator('#mouth').dispatchEvent('input');
 expect(await page.evaluate(()=>characterLab.snapshot().character.mouth)).toBe(.6);
 await page.locator('#blink').click();await page.waitForFunction(()=>characterLab.snapshot().facialWeights.blink>.5);
 await expect.poll(()=>page.evaluate(()=>characterLab.snapshot().facialWeights.blink)).toBe(0);
});

test('Marycia supports queued greetings, pause, and recovery after an invalid replacement',async({page})=>{
 await page.goto('/room.html');await page.waitForFunction(()=>window.lofiRoom?.ready());
 await page.evaluate(()=>{for(let i=0;i<10;i++)lofiRoom.greet()});await page.waitForFunction(()=>lofiRoom.snapshot().interaction.weight>.5);
 await page.getByRole('button',{name:'Pause',exact:true}).click();const elapsed=await page.evaluate(()=>lofiRoom.snapshot().interaction.elapsed);
 await page.waitForTimeout(250);expect(await page.evaluate(()=>lofiRoom.snapshot().interaction.elapsed)).toBe(elapsed);
 await page.getByRole('button',{name:'Resume',exact:true}).click();await page.waitForFunction(()=>lofiRoom.snapshot().interaction.completed===2);
 await page.waitForTimeout(600);expect(await page.evaluate(()=>lofiRoom.snapshot().interaction.started)).toBe(2);
 await page.getByRole('button',{name:'Behind the scene'}).click();
 await page.locator('#room-model').setInputFiles({name:'bad.vrm',mimeType:'application/octet-stream',buffer:Buffer.from('bad')});
 await expect(page.locator('#model-status')).toContainText('Current character kept');
 expect(await page.evaluate(()=>lofiRoom.snapshot().modelName)).toBe('Marycia');
 await page.getByRole('button',{name:'Restore Vivi',exact:true}).click();await page.waitForFunction(()=>lofiRoom.snapshot().modelName==='Vivi');
 await page.getByRole('button',{name:'Load Marycia',exact:true}).click();await page.waitForFunction(()=>lofiRoom.snapshot().modelName==='Marycia');
 expect(await page.evaluate(()=>lofiRoom.snapshot().canvasCount)).toBe(1);
});

test('Marycia renders on mobile with reduced-motion startup and a fixed camera',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/room.html');await page.waitForFunction(()=>window.lofiRoom?.ready());
 const before=await page.evaluate(()=>lofiRoom.snapshot());expect(before.interaction.paused).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Play action',exact:true}).click();await page.waitForFunction(()=>lofiRoom.snapshot().interaction.weight>.9);
 await page.screenshot({path:'../docs/marycia/mobile.png'});
 const after=await page.evaluate(()=>lofiRoom.snapshot());expect(after.view.camera.position).toEqual(before.view.camera.position);expect(after.error).toBeNull();
});

test('character selection locks through download so an older request cannot replace a later selection',async({page})=>{
 await page.goto('/room.html?character=vivi');await page.waitForFunction(()=>window.lofiRoom?.ready());
 await page.getByRole('button',{name:'Behind the scene'}).click();
 let release;const pending=new Promise(resolve=>{release=resolve});
 await page.route('**/models/marycia/marycia.vrm',async route=>{await pending;await route.continue()});
 await page.getByRole('button',{name:'Load Marycia',exact:true}).click();
 try{
  await expect(page.getByRole('button',{name:'Restore Vivi',exact:true})).toBeDisabled({timeout:1000});
  await expect(page.locator('#room-model')).toBeDisabled();
 }finally{release()}
 await page.waitForFunction(()=>lofiRoom.snapshot().modelName==='Marycia');
 await expect(page.getByRole('button',{name:'Restore Vivi',exact:true})).toBeEnabled();
});

test('mixed queued actions keep their own duration and face idle loops without a seam',async({page})=>{
 await page.goto('/room.html');await page.waitForFunction(()=>window.lofiRoom?.ready());
 await page.evaluate(()=>{lofiRoom.greet('smile');lofiRoom.greet('relax');lofiRoom.greet('thumbsUp');});
 await page.waitForFunction(()=>lofiRoom.snapshot().interaction.started===2);
 const queued=await page.evaluate(()=>lofiRoom.snapshot());expect(queued.action).toBe('thumbsUp');expect(queued.interaction.duration).toBe(3.5);
 await page.waitForFunction(()=>lofiRoom.snapshot().interaction.completed===2);
 const loop=await page.evaluate(async()=>{
  let prev=lofiRoom.snapshot(),maxBlink=0,seam=null;
  return new Promise(resolve=>{function tick(){const next=lofiRoom.snapshot();maxBlink=Math.max(maxBlink,next.faceMorphs['まばたき']);
   if(Math.floor(next.time/12.016666)>Math.floor(prev.time/12.016666))seam=Math.max(...Object.keys(next.faceMorphs).map(k=>Math.abs(next.faceMorphs[k]-prev.faceMorphs[k])));
   prev=next;if(seam!==null&&maxBlink>.8)resolve({seam,maxBlink});else requestAnimationFrame(tick);
  }requestAnimationFrame(tick);});
 });
 expect(loop.seam).toBeLessThan(.02);expect(loop.maxBlink).toBeGreaterThan(.8);
 await page.getByRole('button',{name:'Pause',exact:true}).click();const before=await page.evaluate(()=>lofiRoom.snapshot());await page.waitForTimeout(250);
 const after=await page.evaluate(()=>lofiRoom.snapshot());expect(after.time).toBe(before.time);expect(after.faceMorphs).toEqual(before.faceMorphs);
});
