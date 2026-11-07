// Balcony page check: screenshots (full frame, character close-up, look offset) and a bounded frame-time run.
//   node bench-balcony.mjs   (dev server on 127.0.0.1:5174)  -> docs/design/balcony-web/browser-*.png + benchmark.json
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const out=new URL('../docs/design/balcony-web',import.meta.url).pathname;await fs.mkdir(out,{recursive:true});
const url=process.env.BALCONY_URL??'http://127.0.0.1:5174/balcony.html';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const page=await (await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1})).newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const t0=Date.now();await page.goto(url);await page.waitForFunction(()=>window.lofiBalcony?.ready(),null,{timeout:60000});const loadMs=Date.now()-t0;
await page.evaluate(()=>document.getElementById('status').style.display='none');
await page.waitForTimeout(1500);
await page.screenshot({path:`${out}/browser-main.png`});
await page.screenshot({path:`${out}/browser-character.png`,clip:{x:820,y:250,width:560,height:650}});
await page.evaluate(()=>window.lofiBalcony.resetFrames());await page.waitForTimeout(5000);
const snap=await page.evaluate(()=>window.lofiBalcony.snapshot());
const gpu=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2');const e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
const heap=await page.evaluate(()=>performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null);
await page.evaluate(()=>window.lofiBalcony.look(1,1));await page.waitForTimeout(1500);
await page.screenshot({path:`${out}/browser-look-offset.png`});
const result={url,loadMs,gpu,jsHeapMiB:heap,errors,...snap,resources:snap.resources};
await fs.writeFile(`${out}/benchmark.json`,JSON.stringify(result,null,1));
console.log(JSON.stringify({loadMs,gpu,calls:snap.calls,triangles:snap.triangles,textures:snap.textures,median:snap.medianFrameMs,p95:snap.p95FrameMs,frames:snap.frames,transferBytes:snap.transferBytes,drawingBuffer:snap.drawingBuffer,errors}));
await browser.close();
