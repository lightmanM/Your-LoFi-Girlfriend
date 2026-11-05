import {test,expect} from '@playwright/test';

test('camera stays fixed during drag and wheel and settles back to its composed shot',async({page})=>{
 await page.goto('/room.html?character=vivi');await page.waitForFunction(()=>window.lofiRoom?.ready());
 const before=await page.evaluate(()=>lofiRoom.snapshot().view.camera);
 const canvas=page.locator('canvas');const box=await canvas.boundingBox();
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.65);await page.mouse.down();
 await page.mouse.move(box.x+box.width*.9,box.y+box.height*.9,{steps:12});await page.waitForTimeout(500);
 const dragged=await page.evaluate(()=>lofiRoom.snapshot().view.camera);
 expect(dragged.position).toEqual(before.position);expect(Math.abs(dragged.yaw)).toBeGreaterThan(.01);
 expect(Math.abs(dragged.yaw)).toBeLessThanOrEqual(dragged.maxYaw);expect(Math.abs(dragged.pitch)).toBeLessThanOrEqual(dragged.maxPitch);
 await page.mouse.up();await page.mouse.wheel(0,-900);await page.waitForTimeout(1000);
 const after=await page.evaluate(()=>lofiRoom.snapshot().view.camera);
 expect(after.position).toEqual(before.position);expect(Math.abs(after.yaw)).toBeLessThan(.0001);
});

test('mood comparison preserves the character and interaction and renders on mobile',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/room.html?character=vivi');await page.waitForFunction(()=>window.lofiRoom?.ready());
 await page.waitForTimeout(1200);
 await page.screenshot({path:'../docs/lofi-mood/golden-hour.png',fullPage:true});
 await page.getByRole('button',{name:'Behind the scene'}).click();
 await page.selectOption('#mood','baseline');expect(await page.evaluate(()=>lofiRoom.snapshot().view.mood)).toBe('baseline');
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'../docs/lofi-mood/baseline.png',fullPage:false});
 await page.selectOption('#mood','golden-hour');await page.getByRole('button',{name:'Behind the scene'}).click();
 await page.getByRole('button',{name:'Play action',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>lofiRoom.snapshot().interaction.completed),{timeout:15000}).toBe(1);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(800);
 await page.screenshot({path:'../docs/lofi-mood/mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
