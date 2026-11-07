// Camera view study: render the room from candidate camera placements (QA only; the public
// room keeps its fixed camera) and dump the room layout for the camera plan drawing.
//   node view-study.mjs  -> docs/design/views/*.png + docs/design/views/layout.json
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const out=new URL('../docs/design/views',import.meta.url).pathname;await fs.mkdir(out,{recursive:true});
const base=process.env.ROOM_URL??'http://127.0.0.1:5174/room.html';
// Each view: eye position, look-at point, note. Character hips sit near (-0.35, 0.48, -0.57), chest ~0.9 m, head ~1.2 m.
export const VIEWS={
 current:{eye:[.85,1.42,2.45],at:[-.35,.86,-.55],note:'Current fixed camera (41° fov)'},
 chill:{eye:[.9,1.22,1.3],at:[-.35,.92,-.57],note:'"Chill With You" style: three-quarter front, mid-shot, room around her'},
 lofi:{eye:[-1.3,1.02,0.42],at:[-.35,.9,-.55],note:'"Lofi Girl" style: close side view at desk height, face in three-quarter profile'},
 top:{eye:[-.35,5.2,-.4],at:[-.35,0,-.4],up:[0,0,-1],note:'Plan view for the camera diagram'},
};
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
const page=await context.newPage();
await page.route('**/src/companion/main.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('const loader=','window.qaView=view;window.qaTHREE=THREE;const loader=')});});
await page.route('**/src/companion/character.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('this.vrm=vrm;','window.qaCharacter=this;this.vrm=vrm;')});});
await page.goto(base);await page.waitForFunction(()=>window.lofiRoom?.ready());
// Clean frames: only the canvas, full viewport (QA page state only).
await page.evaluate(()=>{const canvas=document.querySelector('canvas');for(const el of document.body.querySelectorAll('*'))if(el!==canvas&&!el.contains(canvas))el.style.visibility='hidden';
 const host=canvas.parentElement;host.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:9999;visibility:visible';canvas.style.cssText='width:100vw;height:100vh;visibility:visible';window.dispatchEvent(new Event('resize'));});
await page.waitForTimeout(500);
// Layout dump (THREE exposed by the route rewrite above).
const dump=await page.evaluate(async()=>{
 const three=window.qaTHREE;
 const items=[];const scene=window.qaView.scene;
 const env=scene.children.find(o=>o.name==='environment'||o.children?.length>5&&o!==window.qaCharacter.vrm.scene)||scene;
 const b=new three.Box3();const size=new three.Vector3();const center=new three.Vector3();
 for(const o of env.children){
  if(!(o.isMesh||o.isGroup||o.isObject3D)||o.isLight||o.isCamera)continue;b.setFromObject(o);if(b.isEmpty())continue;b.getSize(size);b.getCenter(center);
  if(size.length()<.05)continue;items.push({name:o.name||o.type,center:center.toArray().map(v=>+v.toFixed(2)),size:size.toArray().map(v=>+v.toFixed(2))});
 }
 b.setFromObject(env);b.getSize(size);b.getCenter(center);
 const c=window.qaCharacter.vrm.scene;const cb=new three.Box3().setFromObject(c);const cc=new three.Vector3();cb.getCenter(cc);const cs=new three.Vector3();cb.getSize(cs);
 const head=window.qaCharacter.vrm.humanoid.getRawBoneNode('head').getWorldPosition(new three.Vector3());
 return {room:{center:center.toArray().map(v=>+v.toFixed(2)),size:size.toArray().map(v=>+v.toFixed(2)),envName:env.name,childCount:env.children.length},character:{center:cc.toArray().map(v=>+v.toFixed(2)),size:cs.toArray().map(v=>+v.toFixed(2)),head:head.toArray().map(v=>+v.toFixed(2)),forward:c.getWorldDirection(new three.Vector3()).toArray().map(v=>+v.toFixed(2))},fov:window.qaView.camera.fov,items:items.sort((a,b)=>b.size[0]*b.size[2]-a.size[0]*a.size[2]).slice(0,40)};
});
await fs.writeFile(out+'/layout.json',JSON.stringify({views:VIEWS,...dump},null,1));
for(const [name,v] of Object.entries(VIEWS)){
 await page.evaluate(v=>{const cam=window.qaView.camera;cam.up.set(...(v.up??[0,1,0]));cam.position.set(...v.eye);cam.lookAt(...v.at);window.qaView.controls.base.copy(cam.quaternion);},v);
 await page.waitForTimeout(700);
 await page.screenshot({path:`${out}/${name}.png`});
}
await browser.close();console.log('views written to '+out);
