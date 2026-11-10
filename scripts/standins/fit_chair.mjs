// Measure the balcony chair's seat and back panels from the page (with the real chair) and save them as the stand-in
// chair: web/public/standin/chair.json (numbers only; the chair mesh itself stays private).
//   cd web && npm run dev   (port 5173, or set URL)   then:   node scripts/standins/fit_chair.mjs
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(new URL('../../web/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const URL_=process.env.URL??'http://localhost:5173',OUT=new URL('../../web/public/standin/chair.json',import.meta.url);
const browser=await chromium.launch({channel:process.env.CHANNEL??'chrome'});
try{
 const page=await browser.newPage();
 await page.goto(URL_+'/?intro=0&music=0&greet=0&talk=0&chat=0&hud=0');
 await page.waitForFunction(()=>window.lofiViewer?.ready()||window.lofiViewer?.error(),null,{timeout:90000});
 const using=await page.evaluate(()=>window.lofiViewer.standin().using);
 if(using.includes('chair'))throw Error('the real chair is not available here: run this where the private chair-visible.glb is');
 const panels=await page.evaluate(()=>window.lofiViewer.chairPanels());
 writeFileSync(OUT,JSON.stringify(panels)+'\n');
 console.log(`chair.json: seat ${panels.seat.length} points, back ${panels.back.length} points`);
}finally{await browser.close();}
