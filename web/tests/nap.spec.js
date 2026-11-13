import {test,expect} from '@playwright/test';

// Her nap on the real page. With the character her walks were made for she walks out to the daybed and back again in
// full view; any other (the stand-ins, ?napwalk=0) goes each way in the dark of a cut.
// her first nap is set far off and asked for (napSoon) once the page is ready and looked at, so nothing races it
const URL='/?intro=0&music=0&greet=0&talk=0&welcome=0&seed=3&nap=900&napfor=3';
const soon=page=>page.evaluate(()=>window.lofiViewer.napSoon());
const ready=page=>page.waitForFunction(()=>window.lofiViewer?.nap?.().ready&&document.getElementById('stage').classList.contains('ready'),null,{timeout:60000});
const nap=page=>page.evaluate(()=>window.lofiViewer.nap());
const reader=page=>page.evaluate(()=>window.lofiViewer.reader());
const BED=[5.97,.69,-24.12];   // where her hips lie (nap.json)

/** Asleep on the daybed, then back in her chair (walked: on her own feet, in full view; else by the cut), reading on. */
async function sleepsAndComesBack(page,before,{walked=false}={}){
 await page.waitForFunction(()=>window.lofiViewer.nap().phase==='asleep'&&window.lofiViewer.nap().dark===0,null,{timeout:10000});
 const lying=await nap(page);
 expect(lying.asleep).toBe(true);expect(lying.covered).toBe(true);
 lying.hips.forEach((x,i)=>expect(Math.abs(x-BED[i])).toBeLessThan(.02));
 // she does not read, and a click on her starts nothing
 const t1=(await reader(page)).time;
 await page.waitForTimeout(600);
 expect((await reader(page)).time).toBe(t1);
 expect(await page.evaluate(()=>window.lofiViewer.poke())).toBe(false);
 await page.waitForFunction(()=>!window.lofiViewer.nap().asleep,null,{timeout:20000});
 if(walked){   // her way back: never dark, and she gets steadily nearer her chair once she is on her feet
  const seen=[];
  for(;;){
   const n=await nap(page);
   if(n.phase!=='toChair')break;
   expect(n.dark).toBe(0);expect(n.walking).toBe(true);
   seen.push(n.hips);
   await page.waitForTimeout(700);
  }
  expect(seen.length).toBeGreaterThan(10);
  const far=h=>Math.hypot(h[0]-before.hips[0],h[2]-before.hips[2]),up=seen.findIndex(h=>h[1]>.95);
  expect(up).toBeGreaterThan(0);
  expect(far(seen[0])).toBeGreaterThan(3);
  for(let i=up+4;i<seen.length;i++)expect(far(seen[i]),'nearer her chair than a few seconds before, or already there').toBeLessThan(Math.max(far(seen[i-4])-.2,.6));
 }else expect((await nap(page)).dark,'the cut back: she changes places only in the dark').toBeGreaterThan(.8);
 await page.waitForFunction(()=>window.lofiViewer.nap().phase==='awake',null,{timeout:10000});
 const after=await nap(page);
 expect(after.covered).toBe(false);expect(after.dark).toBe(0);expect(after.walking).toBe(false);
 expect(after.next).toBeGreaterThan(600);
 expect(Math.abs(after.hips[0]-before.hips[0])).toBeLessThan(.01);expect(Math.abs(after.hips[2]-before.hips[2])).toBeLessThan(.01);
 await page.waitForTimeout(500);
 expect((await reader(page)).time).toBeGreaterThan(t1);
 expect(await page.evaluate(()=>document.querySelector('#stage canvas').style.filter)).toBe('');
}

test('she walks out to the daybed in full view, sleeps, and walks back to her chair and her book',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(URL);await ready(page);
 const before=await nap(page);
 test.skip(before.walk===0,'the walk is for the character it was made with (this page runs a stand-in)');
 expect(before.phase).toBe('awake');
 await soon(page);
 await page.waitForFunction(()=>window.lofiViewer.nap().walking,null,{timeout:15000});
 // on her way: never dark, her reading rests, and she gets steadily nearer the daybed
 const seen=[];let readerAt=null,bookAt=null;
 for(;;){
  const n=await nap(page);
  if(!n.walking)break;
  expect(n.dark).toBe(0);expect(n.phase).toBe('toBed');
  const r=(await reader(page)).time;if(readerAt!==null)expect(r).toBe(readerAt);readerAt=r;
  seen.push(n.hips);bookAt=n.book;
  await page.waitForTimeout(700);
 }
 expect(seen.length).toBeGreaterThan(10);
 const far=h=>Math.hypot(h[0]-BED[0],h[2]-BED[2]);
 expect(far(seen[0])).toBeGreaterThan(3);
 // she first stands up out of her chair (a little toward the camera); from there on she only gets nearer
 const up=seen.findIndex(h=>h[1]>.95);
 expect(up).toBeGreaterThan(0);
 expect(far(seen[up])).toBeLessThan(far(seen[0])+.6);
 for(let i=up+4;i<seen.length;i++)expect(far(seen[i]),'nearer the daybed than a few seconds before, or already there').toBeLessThan(Math.max(far(seen[i-4])-.2,.6));
 expect(Math.max(...seen.map(h=>h[1])),'she stood up on the way').toBeGreaterThan(.95);
 // as she falls asleep nothing jumps: the book she carried lies where her hand put it
 await page.waitForFunction(()=>window.lofiViewer.nap().asleep,null,{timeout:10000});
 const asleep=await nap(page);
 expect(Math.hypot(...asleep.book.map((x,i)=>x-bookAt[i])),'the book stays where her walk left it').toBeLessThan(.03);
 expect(before.back,'her way back is ready too').toBeGreaterThan(5);
 await sleepsAndComesBack(page,before,{walked:true});
 // the book is open in her hands again, where it was
 const after=await nap(page);
 expect(Math.hypot(...after.book.map((x,i)=>x-before.book[i])),'the book is back where she reads it').toBeLessThan(.05);
 expect(errors).toEqual([]);
});

test('by the cut (?napwalk=0, and every stand-in) she changes places only in the dark, both ways',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(URL+'&napwalk=0');await ready(page);
 const before=await nap(page);
 expect(before.walk).toBe(0);expect(before.back).toBe(0);expect(before.phase).toBe('awake');
 await soon(page);
 await page.waitForFunction(()=>window.lofiViewer.nap().asleep,null,{timeout:15000});
 const lying=await nap(page);
 expect(lying.dark).toBeGreaterThan(.8);expect(lying.walking).toBe(false);
 await sleepsAndComesBack(page,before);
 expect(errors).toEqual([]);
});

test('?nap=0 turns it off',async({page})=>{
 await page.goto('/?intro=0&music=0&greet=0&talk=0&nap=0');
 await page.waitForFunction(()=>document.getElementById('stage').classList.contains('ready'),null,{timeout:60000});
 await page.evaluate(()=>window.lofiViewer.napSoon());
 await page.waitForTimeout(2500);
 expect((await nap(page)).phase).toBe('awake');
});
