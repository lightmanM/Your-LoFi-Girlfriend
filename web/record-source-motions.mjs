import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const out=new URL('../docs/marycia-source-motions',import.meta.url).pathname;await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1050},recordVideo:{dir:out+'/raw-video',size:{width:1440,height:1050}}});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
// Instrument only this recording; the public room retains its fixed camera.
await page.route('**/src/companion/main.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('const loader=','window.qaView=view;const loader=')});});
await page.goto('http://127.0.0.1:5173/room.html');await page.waitForFunction(()=>window.lofiRoom?.ready());await page.waitForTimeout(1500);
await page.screenshot({path:out+'/room-idle.png'});const initial=await page.evaluate(()=>lofiRoom.snapshot());
async function play(action){
 await page.selectOption('#source-action',action);const completed=await page.evaluate(()=>lofiRoom.snapshot().interaction.completed);
 await page.getByRole('button',{name:'Play action',exact:true}).click();
 await page.waitForFunction(()=>lofiRoom.snapshot().interaction.weight>.99);await page.waitForTimeout(350);
 await page.screenshot({path:out+`/room-${action}.png`});
 await page.waitForFunction(end=>lofiRoom.snapshot().interaction.completed>end,completed);await page.waitForTimeout(650);
}
await play('smile');await play('wink');
await page.getByRole('button',{name:'Demonstrate transition',exact:false}).click();
await page.waitForFunction(()=>lofiRoom.snapshot().interaction.completed>=4);await page.waitForTimeout(650);
await page.getByRole('button',{name:'Behind the scene'}).click();
await page.evaluate(()=>{
 const v=qaView;v.camera.position.set(-.35,.90,.12);v.camera.lookAt(-.35,.86,-.57);v.controls.base.copy(v.camera.quaternion);
 document.querySelector('.scene-heading').innerHTML='<p class="eyebrow">CLOSE-UP QA VIEW</p><h1>Supplied facial animation</h1><p>The normal room camera remains fixed.</p>';
});
await play('smile');await play('wink');
await page.evaluate(()=>{
 const v=qaView;v.camera.position.set(-.30,.69,.02);v.camera.lookAt(-.36,.47,-.43);v.controls.base.copy(v.camera.quaternion);
 document.querySelector('.scene-heading').innerHTML='<p class="eyebrow">CLOSE-UP QA VIEW</p><h1>Supplied finger poses</h1><p>Arm placement still needs work; seated hands overlap.</p>';
});
await play('peace');await play('thumbsUp');await play('fingerHeart');
const final=await page.evaluate(()=>lofiRoom.snapshot());
await fs.writeFile(out+'/demo-evidence.json',JSON.stringify({recordedAt:new Date().toISOString(),errors,initial,final},null,2));
const video=page.video();await context.close();await video.saveAs(out+'/demo.webm');await browser.close();console.log('Recorded supplied source actions: '+final.interaction.completed+' cycles; page errors: '+errors.length);
