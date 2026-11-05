import {test,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

const reportDir=path.resolve('../docs/character-baseline');
async function ready(page){
  await expect.poll(()=>page.evaluate(()=>window.characterLab?.ready()),{timeout:45000}).toBe(true);
  // Decoding can finish between frames; wait for the character's first draw too.
  await expect.poll(()=>page.evaluate(()=>characterLab.snapshot().render.triangles),{timeout:45000}).toBeGreaterThan(1000);
}
async function save(name,data){await mkdir(reportDir,{recursive:true});await writeFile(path.join(reportDir,`${name}.json`),JSON.stringify(data,null,2)+'\n');}
function renameRig(source){
  const n=source.readUInt32LE(12);
  const doc=JSON.parse(source.subarray(20,20+n).toString());
  doc.nodes.forEach((node,i)=>node.name=`ReplacementRig_Node_${i}`);
  let text=JSON.stringify(doc);text+=' '.repeat((4-Buffer.byteLength(text)%4)%4);
  const json=Buffer.from(text),tail=source.subarray(20+n);
  const header=Buffer.alloc(20);[0x46546c67,2,20+json.length+tail.length,json.length,0x4e4f534a].forEach((value,i)=>header.writeUInt32LE(value,i*4));
  return Buffer.concat([header,json,tail]);
}

test('renders the existing asset and drives mapped bones and facial expressions',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await ready(page);
  await expect.poll(()=>page.evaluate(()=>{
    const j=characterLab.snapshot().joints;
    return j.leftHand.world[1]<j.leftUpperArm.world[1]&&j.rightHand.world[1]<j.rightUpperArm.world[1];
  })).toBe(true);
  const initial=await page.evaluate(()=>characterLab.snapshot());
  expect(initial.character.capabilities).toEqual({blink:true,smile:true,mouth:true,fingers:true});
  expect(initial.render.triangles).toBeGreaterThan(20000);
  await page.locator('#smile').fill('0.7');
  await expect.poll(()=>page.evaluate(()=>characterLab.snapshot().facialWeights.happy)).toBeGreaterThan(.65);
  await page.locator('[data-pose=tpose]').click();
  await expect.poll(()=>page.evaluate(()=>{
    const j=characterLab.snapshot().joints;return Math.abs(j.leftHand.world[1]-j.leftUpperArm.world[1]);
  })).toBeLessThan(.05);
  await page.locator('[data-pose=relaxed]').click();
  await page.locator('#look').click();await expect(page.locator('#look')).toHaveAttribute('aria-pressed','true');
  await page.locator('#face-view').click();await expect(page.locator('#view-label')).toHaveText('FACE & EXPRESSIONS');
  await page.screenshot({path:path.join(reportDir,'face-preview.png'),fullPage:false});
  await page.locator('#body-view').click();
  await page.locator('#smile').fill('0.2');
  await page.screenshot({path:path.join(reportDir,'studio-preview.png'),fullPage:true});
  expect(errors).toEqual([]);
  await save('browser-controls',{initial,final:await page.evaluate(()=>characterLab.snapshot()),pageErrors:errors});
});

test('renamed skeleton replacement and invalid-file recovery preserve the scene contract',async({page})=>{
  await page.goto('/');await ready(page);
  const initial=await page.evaluate(()=>characterLab.snapshot());
  const original=await readFile('public/models/vivi/vivi.vrm');
  await page.locator('#model-file').setInputFiles({name:'renamed-rig.vrm',mimeType:'application/octet-stream',buffer:renameRig(original)});
  await expect(page.locator('#model-title')).toHaveText('renamed-rig');await ready(page);
  await page.locator('#smile').fill('0.8');
  await expect.poll(()=>page.evaluate(()=>characterLab.snapshot().facialWeights.happy)).toBeGreaterThan(.75);
  const swapped=await page.evaluate(()=>characterLab.snapshot());
  expect(swapped.disposedCharacters).toBe(1);
  await page.locator('#model-file').setInputFiles({name:'invalid.vrm',mimeType:'application/octet-stream',buffer:Buffer.from('not a model')});
  await expect(page.locator('#message')).toContainText('current character has been kept');
  expect(await page.locator('#model-title').textContent()).toBe('renamed-rig');
  await page.locator('#restore').click();await expect(page.locator('#model-title')).toHaveText('Vivi');await ready(page);
  await page.waitForTimeout(300);
  const restored=await page.evaluate(()=>characterLab.snapshot());
  expect(restored.canvasCount).toBe(1);
  expect(restored.disposedCharacters).toBe(2);
  expect(restored.memory.textures).toBeLessThanOrEqual(initial.memory.textures+1);
  expect(restored.memory.geometries).toBeLessThanOrEqual(initial.memory.geometries+1);
  await save('browser-replacement',{initial,swapped,restored});
});

test('mobile layout fits and controls remain usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');await ready(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#blink').click();
  await page.locator('#smile').fill('0.5');
  await expect.poll(()=>page.evaluate(()=>characterLab.snapshot().facialWeights.happy)).toBeGreaterThan(.49);
  await page.screenshot({path:path.join(reportDir,'mobile-preview.png'),fullPage:true});
  await save('browser-mobile',{width:390,snapshot:await page.evaluate(()=>characterLab.snapshot()),overflow:false});
});

test('optional independent VRM can replace the placeholder',async({page})=>{
  test.skip(!process.env.VRM_SECOND_MODEL,'Set VRM_SECOND_MODEL to a separately licensed local VRM to test another actual character.');
  await page.goto('/');await ready(page);
  await page.locator('#model-file').setInputFiles(process.env.VRM_SECOND_MODEL);await ready(page);
  await expect(page.locator('#model-title')).not.toHaveText('Vivi');
  await page.locator('#smile').fill('0.5');
  await expect.poll(()=>page.evaluate(()=>characterLab.snapshot().facialWeights.happy)).toBeGreaterThan(.45);
  await expect.poll(()=>page.evaluate(()=>{
    const j=characterLab.snapshot().joints;return j.leftHand.world[1]<j.leftUpperArm.world[1];
  })).toBe(true);
  await save(`browser-second-model-${path.basename(process.env.VRM_SECOND_MODEL,'.vrm')}`,await page.evaluate(()=>characterLab.snapshot()));
});
