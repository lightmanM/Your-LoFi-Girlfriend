// The README's screenshot: the real scene with Marycia as she greets you, subtitles showing (needs the owner's files).
//   cd web && npm run dev   then:   node scripts/standins/screenshot.mjs        (URL defaults to http://localhost:5173)
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../web/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const URL_=process.env.URL??'http://localhost:5173',OUT=new URL('../../.github/readme/screenshot.jpg',import.meta.url).pathname;
const browser=await chromium.launch({channel:process.env.CHANNEL??'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 await page.goto(URL_+'/?intro=0&music=0&talk=0&chat=0&seed=3&line=iitokoro');
 await page.waitForFunction(()=>window.lofiViewer?.ready()||window.lofiViewer?.error(),null,{timeout:90000});
 if((await page.evaluate(()=>window.lofiViewer.standin().using)).length)throw Error('the owner\'s files are not all here: the screenshot shows the real scene');
 if(!(await page.evaluate(()=>window.lofiViewer.greet())))throw Error('could not start the greeting');
 await page.waitForFunction(()=>window.lofiViewer.voice()?.subtitle,null,{timeout:20000});
 await page.waitForTimeout(900);   // the subtitle's fade-in, and her look settling on you
 await page.screenshot({path:OUT,type:'jpeg',quality:82});
 console.log('wrote',OUT);
}finally{await browser.close();}
