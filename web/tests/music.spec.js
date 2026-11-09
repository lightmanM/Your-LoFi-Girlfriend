import {test,expect} from '@playwright/test';
// Background music in a real browser: real clicks and keys, real audio decoding. Needs the encoded tracks in
// public/music (git-ignored; built by scripts/music/prepare_music.py); skipped when they are absent.
const music=page=>page.evaluate(()=>window.lofiViewer?.music());
const until=(page,fn,arg,timeout=15000)=>page.waitForFunction(fn,arg,{timeout,polling:100});

async function playlist(request){
 const r=await request.get('/music/playlist.json');
 if(!r.ok())return null;
 const p=await r.json();
 return (await request.get(`/music/${p.tracks[0].file}`)).ok()?p:null;
}

test('music waits for a gesture, then plays, skips, mutes and pauses',async({page,request})=>{
 test.skip(!(await playlist(request)),'music not prepared on this machine');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?intro=0');await until(page,()=>window.lofiViewer?.music()?.tracks>0);
 await page.mouse.move(0,0);
 expect((await music(page)).status).toBe('idle');                       // nothing plays before a gesture
 await expect(page.locator('.hud-ctl')).toBeHidden();                   // controls stay folded until interaction
 await page.mouse.click(40,40);
 await until(page,()=>window.lofiViewer.music().status==='playing');
 const first=await music(page);expect(first.track.title).toBeTruthy();expect(first.track.license).toMatch(/CC/);
 await until(page,t=>window.lofiViewer.music().time>t+.5,first.time);    // the clock is moving: audio is playing
 await page.keyboard.press('n');
 await until(page,id=>window.lofiViewer.music().track.id!==id,first.track.id);
 await page.keyboard.press('m');expect((await music(page)).muted).toBe(true);
 await page.keyboard.press('m');expect((await music(page)).muted).toBe(false);
 await page.keyboard.press(' ');await until(page,()=>window.lofiViewer.music().status==='paused');
 const t=(await music(page)).time;await page.waitForTimeout(800);
 expect(Math.abs((await music(page)).time-t)).toBeLessThan(.6);            // paused means the clock stops
 await page.keyboard.press(' ');await until(page,()=>window.lofiViewer.music().status==='playing');
 expect(errors).toEqual([]);
});

test('music crossfades into the next track near the end',async({page,request})=>{
 test.skip(!(await playlist(request)),'music not prepared on this machine');
 await page.goto('/?intro=0');await until(page,()=>window.lofiViewer?.music()?.tracks>0);
 await page.mouse.click(40,40);await until(page,()=>window.lofiViewer.music().status==='playing');
 const id=(await music(page)).track.id;
 await page.evaluate(()=>window.lofiViewer.musicSeekEnd(9));
 await until(page,()=>window.lofiViewer.music().fading);                  // overlap starts ~6 s before the end
 const mid=await music(page);expect(mid.track.id).not.toBe(id);
 await until(page,()=>!window.lofiViewer.music().fading,null,20000);
 const after=await music(page);expect(after.status).toBe('playing');expect(after.time).toBeGreaterThan(1);
});

test('music skips a broken track and reports when nothing can play',async({page,request})=>{
 const p=await playlist(request);test.skip(!p,'music not prepared on this machine');
 const broken={...p.tracks[0],id:'missing',file:'missing-track.mp3'};
 await page.route('**/music/playlist.json',r=>r.fulfill({json:{...p,tracks:[broken,p.tracks[1]]}}));
 await page.goto('/?intro=0');await until(page,()=>window.lofiViewer?.music()?.tracks===2);
 await page.mouse.click(40,40);
 await until(page,()=>window.lofiViewer.music().status==='playing');
 // the shuffle may pick the good track first; jumping near its end makes the player reach the broken one
 if((await music(page)).failed===0)await page.evaluate(()=>window.lofiViewer.musicSeekEnd(9));
 await until(page,()=>window.lofiViewer.music().status==='playing'&&window.lofiViewer.music().failed===1);
 expect((await music(page)).track.id).toBe(p.tracks[1].id);

 await page.unroute('**/music/playlist.json');
 await page.route('**/music/playlist.json',r=>r.fulfill({json:{...p,tracks:[broken]}}));
 await page.goto('/?intro=0');await until(page,()=>window.lofiViewer?.music()?.tracks===1);
 await page.mouse.click(40,40);
 await until(page,()=>window.lofiViewer.music().status==='error');
 expect((await music(page)).error).toMatch(/no playable/);
});

test('music can be turned off',async({page})=>{
 await page.goto('/?music=0');await page.waitForFunction(()=>window.lofiViewer);
 expect(await music(page)).toBeNull();
});

async function playing(page,url='/?intro=0'){
 await page.goto(url);await until(page,()=>window.lofiViewer?.music()?.tracks>0);
 await page.mouse.click(40,40);await until(page,()=>window.lofiViewer.music().status==='playing');
}

test('music survives rapid skips and keeps one track playing',async({page,request})=>{
 test.skip(!(await playlist(request)),'music not prepared on this machine');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await playing(page);
 for(let i=0;i<5;i++){await page.keyboard.press('n');await page.waitForTimeout(250);}
 await until(page,()=>!window.lofiViewer.music().fading,null,15000);
 const m=await music(page);expect(m.status).toBe('playing');expect(m.failed).toBe(0);
 await until(page,t=>window.lofiViewer.music().time>t+.5,m.time);
 expect(errors).toEqual([]);
});

test('music pauses and resumes in the middle of a crossfade',async({page,request})=>{
 test.skip(!(await playlist(request)),'music not prepared on this machine');
 await playing(page);
 await page.evaluate(()=>window.lofiViewer.musicSeekEnd(8));
 await until(page,()=>window.lofiViewer.music().fading);
 await page.keyboard.press(' ');await until(page,()=>window.lofiViewer.music().status==='paused');
 await page.waitForTimeout(1000);
 await page.keyboard.press(' ');await until(page,()=>window.lofiViewer.music().status==='playing');
 await until(page,()=>!window.lofiViewer.music().fading,null,20000);
 const m=await music(page);await until(page,t=>window.lofiViewer.music().time>t+.5,m.time);
});

test('music gives up on a track that never starts and keeps playing',async({page,request})=>{
 const p=await playlist(request);test.skip(!p,'music not prepared on this machine');
 const hang={...p.tracks[0],id:'hang',file:'hang-track.mp3'};
 const asked=[];page.on('request',r=>{if(r.url().includes('hang-track'))asked.push(r.url());});
 await page.route('**/music/hang-track.mp3',()=>{});   // never answered
 await page.route('**/music/playlist.json',r=>r.fulfill({json:{...p,tracks:[hang,p.tracks[1]]}}));
 await playing(page,'/?intro=0&musicstall=2');                  // if the hanging track comes first, it is skipped after 2 s
 await page.evaluate(()=>window.lofiViewer.musicSeekEnd(9));
 await until(page,()=>!window.lofiViewer.music().fading,null,30000);   // the stalled fade was abandoned or completed
 expect(asked.length).toBeGreaterThan(0);                               // the hanging track was really attempted
 const m=await music(page);expect(m.status).toBe('playing');expect(m.track.id).toBe(p.tracks[1].id);
 await until(page,t=>window.lofiViewer.music().time>t+.5,m.time);       // and music is still playing
});

test('music dips under her voice and comes back; muted stays silent',async({page,request})=>{
 test.skip(!(await playlist(request)),'music not prepared on this machine');
 await page.goto('/?intro=0&greet=0&talk=0');await until(page,()=>window.lofiViewer?.music()?.tracks>0);
 await page.mouse.click(40,40);
 await until(page,()=>window.lofiViewer.music().status==='playing');
 const {volume}=await music(page);
 await page.evaluate(()=>window.lofiViewer.musicDuck(true));
 let m=await music(page);expect(m.ducked).toBe(true);expect(m.level).toBeCloseTo(volume*.5,5);
 await page.evaluate(()=>window.lofiViewer.musicDuck(false));
 m=await music(page);expect(m.ducked).toBe(false);expect(m.level).toBeCloseTo(volume,5);
 await page.keyboard.press('m');await page.evaluate(()=>window.lofiViewer.musicDuck(true));
 expect((await music(page)).level).toBe(0);
});

