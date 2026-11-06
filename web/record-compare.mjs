// Side-by-side recording of two stretch clips from the same reference video
// (MediaPipe, Rokoko rotation retarget, Rokoko IK retarget). QA-only camera.
//   node record-compare.mjs [clipA clipB]   -> docs/motion-spike/compare-<clipA>-<clipB>.mp4 (needs ffmpeg)
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const [clipA='stretch',clipB='stretchRokoko']=process.argv.slice(2);
const labels={stretch:'MediaPipe pose, Blender retarget',stretchRokoko:'Rokoko Vision, rotation retarget',stretchRokokoIk:'Rokoko Vision, torso by rotation + arms by IK'};
const out=new URL('../docs/motion-spike',import.meta.url).pathname;const raw=out+'/raw-video';await fs.mkdir(raw,{recursive:true});
const base=process.env.ROOM_URL??'http://127.0.0.1:5174/room.html';
const browser=await chromium.launch({channel:'chrome',headless:true});
async function record(clip){
 const context=await browser.newContext({viewport:{width:720,height:900},recordVideo:{dir:raw,size:{width:720,height:900}}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/companion/main.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('const loader=','window.qaView=view;const loader=')});});
 await page.goto(base);await page.waitForFunction(()=>window.lofiRoom?.ready());
 await page.evaluate(([clip,label])=>{document.querySelector('.scene-heading').innerHTML=`<p class="eyebrow">SAME REFERENCE VIDEO</p><h1>${clip}</h1><p>${label}</p>`;const v=qaView;v.camera.position.set(-.15,1.2,.95);v.camera.lookAt(-.35,.9,-.57);v.controls.base.copy(v.camera.quaternion);},[clip,labels[clip]??clip]);
 await page.waitForTimeout(1500);
 await page.evaluate(clip=>lofiRoom.greet(clip),clip);
 await page.waitForFunction(()=>lofiRoom.snapshot().interaction.completed>=1);await page.waitForTimeout(1500);
 const video=page.video();await context.close();const file=`${raw}/${clip}.webm`;await video.saveAs(file);return {file,errors};
}
const a=await record(clipA),b=await record(clipB);await browser.close();
const mp4=`${out}/compare-${clipA}-${clipB}.mp4`;
execFileSync('ffmpeg',['-y','-loglevel','error','-i',a.file,'-i',b.file,'-filter_complex','[0:v][1:v]hstack=inputs=2:shortest=1','-c:v','libx264','-pix_fmt','yuv420p','-crf','23',mp4]);
console.log('recorded '+mp4+' errors='+(a.errors.length+b.errors.length));
