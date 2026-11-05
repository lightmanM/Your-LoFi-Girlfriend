// Local QA only: instrument the served modules without changing the runtime API.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const out=new URL('../docs/marycia-source-motions',import.meta.url).pathname;await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1000,height:900}});
await page.route('**/src/companion/main.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace("const loader=",'window.qaView=view;const loader=')});});
await page.route('**/src/companion/character.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('this.vrm=vrm;', 'window.qaCharacter=this;this.vrm=vrm;')});});
await page.goto('http://127.0.0.1:5173/room.html');await page.waitForFunction(()=>window.lofiRoom?.ready());
await page.evaluate(()=>{
 qaCharacter.interaction.paused=true;
 for(const el of document.querySelectorAll('.scene-heading,.scene-tag,.room-bottom'))el.style.display='none';
});
const evidence={};
for(const action of ['idle','smile','wink','relax','peace','thumbsUp','fingerHeart']){
 await page.evaluate(action=>{
  const c=qaCharacter,v=qaView;c.time=2;c.setAction(action==='idle'?'smile':action);c.interaction.elapsed=action==='relax'?3:1;c.interaction.weight=action==='idle'?0:1;
  if(['peace','thumbsUp','fingerHeart'].includes(action)){v.camera.position.set(-.30,.65,-.10);v.camera.lookAt(-.36,.46,-.43);}else{v.camera.position.set(-.35,.90,-.10);v.camera.lookAt(-.35,.87,-.57);}
  v.controls.base.copy(v.camera.quaternion);
 },action);
 await page.waitForTimeout(200);await page.locator('#room-canvas').screenshot({path:out+'/detail-'+action+'.png'});
 evidence[action]=await page.evaluate(()=>lofiRoom.snapshot());
}
// Full-body source inspection. These are not added to the sofa action selector.
for(const action of ['stand','afk','heart']){
 for(const time of action==='afk'?[0,1,2]:[0]){
  await page.evaluate(({action,time})=>{
   const c=qaCharacter,v=qaView;c.interaction.weight=0;
   c.applyPose=function(){this.applyTracks(this.library.clips.sit,0);this.applyTracks(this.library.clips.handsIdle,0);this.applyTracks(this.library.clips[action],time);};
   v.camera.position.set(.1,1.05,1.5);v.camera.lookAt(-.35,.7,-.55);v.controls.base.copy(v.camera.quaternion);
  },{action,time});
  await page.waitForTimeout(200);await page.locator('#room-canvas').screenshot({path:out+`/excluded-${action}-${time}.png`});
  evidence[action+'-'+time]=await page.evaluate(()=>lofiRoom.snapshot());
 }
}
await fs.writeFile(out+'/inspection.json',JSON.stringify(evidence,null,2));await browser.close();
