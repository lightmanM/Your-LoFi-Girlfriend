import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProgress,percent,detail} from '../src/loading/progress.js';

// First load: how much of her room has arrived, counted from the downloads themselves.
const bytes=n=>new Uint8Array(n);
/** A response whose body arrives in the given chunk sizes; `gate` (a promise) holds the body back until it resolves. */
const reply=(chunks,{status=200,headers={},gate=null,fail=false}={})=>new Response(new ReadableStream({
 async start(c){
  if(gate)await gate;
  for(const n of chunks)c.enqueue(bytes(n));
  if(fail)c.error(Error('connection lost'));else c.close();
 },
}),{status,headers});
/** A fetcher answering each url from `table` (a function per url), and a log of the calls it got. */
const fetcherOf=table=>{
 const calls=[];
 const fetcher=async(url,init)=>{calls.push({url,range:init?.headers?.Range??null});return table[url](init);};
 return {fetcher,calls};
};
const hold=()=>{let open;const gate=new Promise(r=>{open=r;});return {gate,open};};

test('bytes are counted as they arrive, against the size the server announced',async()=>{
 const seen=[];
 const {fetcher}=fetcherOf({'/a.glb':()=>reply([300,700],{headers:{'content-length':'1000'}})});
 const p=createProgress({fetcher,onChange:s=>seen.push([s.loaded,s.total])});
 const r=await p.fetch('/a.glb');
 assert.equal((await r.arrayBuffer()).byteLength,1000);
 assert.deepEqual(seen.filter(([l])=>l>0),[[300,1000],[1000,1000]]);
 assert.deepEqual(p.snapshot(),{loaded:1000,total:1000,fraction:1,pending:0});
});

test('the total is the sum over every file, each at least what has arrived',async()=>{
 const {fetcher}=fetcherOf({
  '/a.webp':()=>reply([400],{headers:{'content-length':'400'}}),
  '/b.json':()=>reply([50,50]),                                          // no size announced
 });
 const p=createProgress({fetcher});
 await Promise.all([p.fetch('/a.webp'),p.fetch('/b.json')]);
 assert.deepEqual(p.snapshot(),{loaded:500,total:500,fraction:1,pending:0});
});

test('a compressed answer\'s announced size is ignored: it counts the packed bytes, not the ones that arrive',async()=>{
 const h=hold();
 const {fetcher}=fetcherOf({'/a.json':()=>reply([900],{gate:h.gate,headers:{'content-length':'120','content-encoding':'br'}})});
 const p=createProgress({fetcher});
 const going=p.fetch('/a.json');
 await new Promise(r=>setTimeout(r,5));
 assert.equal(p.snapshot().total,0);
 h.open();await going;
 assert.deepEqual(p.snapshot(),{loaded:900,total:900,fraction:1,pending:0});
});

test('a ranged answer tells the file\'s size and is handed back untouched; the real download then counts',async()=>{
 const {fetcher,calls}=fetcherOf({'/her.vrm':init=>init?.headers?.Range
  ?reply([64],{status:206,headers:{'content-range':'bytes 0-63/5000'}})
  :reply([2000,3000],{headers:{'content-length':'5000'}})});
 const p=createProgress({fetcher});
 const probe=await p.fetch('/her.vrm',{headers:{Range:'bytes=0-63'}});
 assert.equal(probe.status,206);
 assert.equal((await probe.arrayBuffer()).byteLength,64);
 assert.deepEqual(p.snapshot(),{loaded:0,total:5000,fraction:0,pending:0});
 const full=await p.fetch('/her.vrm');
 assert.equal((await full.arrayBuffer()).byteLength,5000);
 assert.deepEqual(p.snapshot(),{loaded:5000,total:5000,fraction:1,pending:0});
 assert.equal(calls.length,2);
});

test('a file that has arrived is never downloaded twice',async()=>{
 const {fetcher,calls}=fetcherOf({'/plants.glb':()=>reply([800],{headers:{'content-length':'800','content-type':'model/gltf-binary'}})});
 const p=createProgress({fetcher});
 const first=await p.fetch('/plants.glb',{headers:{Range:'bytes=0-63'}});   // a host that ignores Range sends it all
 const second=await p.fetch('/plants.glb');
 assert.equal((await first.arrayBuffer()).byteLength,800);
 assert.equal((await second.arrayBuffer()).byteLength,800);
 assert.equal(second.status,200);
 assert.equal(second.headers.get('content-type'),'model/gltf-binary');
 assert.equal(calls.length,1);
 assert.equal(p.snapshot().loaded,800);
});

test('a second request joins a download still on its way',async()=>{
 const h=hold();
 const {fetcher,calls}=fetcherOf({'/plate.webp':()=>reply([600],{gate:h.gate,headers:{'content-length':'600'}})});
 const p=createProgress({fetcher});
 const a=p.fetch('/plate.webp'),b=p.fetch('/plate.webp');
 h.open();
 const [ra,rb]=await Promise.all([a,b]);
 assert.equal((await ra.arrayBuffer()).byteLength,600);
 assert.equal((await rb.arrayBuffer()).byteLength,600);
 assert.equal(calls.length,1);
 assert.equal(p.snapshot().loaded,600);
});

test('a file that is not there is handed back as it came and counts for nothing',async()=>{
 const {fetcher}=fetcherOf({'/chair.glb':()=>reply([20],{status:404,headers:{'content-length':'20'}})});
 const p=createProgress({fetcher});
 const r=await p.fetch('/chair.glb');
 assert.equal(r.status,404);
 assert.deepEqual(p.snapshot(),{loaded:0,total:0,fraction:0,pending:0});
});

test('a download that breaks rejects, stops counting, and can be tried again',async()=>{
 let n=0;
 const {fetcher,calls}=fetcherOf({'/her.vrm':()=>n++===0
  ?reply([100],{fail:true,headers:{'content-length':'400'}})
  :reply([400],{headers:{'content-length':'400'}})});
 const p=createProgress({fetcher});
 await assert.rejects(p.fetch('/her.vrm'),/connection lost/);
 assert.deepEqual(p.snapshot(),{loaded:0,total:0,fraction:0,pending:0});
 const r=await p.fetch('/her.vrm');
 assert.equal((await r.arrayBuffer()).byteLength,400);
 assert.equal(calls.length,2);
 assert.equal(p.snapshot().loaded,400);
});

test('a request that never reaches the server rejects and leaves nothing behind',async()=>{
 const p=createProgress({fetcher:async()=>{throw TypeError('offline');}});
 await assert.rejects(p.fetch('/a.glb'),/offline/);
 assert.deepEqual(p.snapshot(),{loaded:0,total:0,fraction:0,pending:0});
});

test('pending counts the files asked for whose answer has not started',async()=>{
 const h=hold();
 const p=createProgress({fetcher:async()=>{await h.gate;return reply([10],{headers:{'content-length':'10'}});}});
 const going=p.fetch('/a.webp');
 assert.equal(p.snapshot().pending,1);
 h.open();await going;
 assert.equal(p.snapshot().pending,0);
});

test('after release the kept files are let go and requests pass straight through, uncounted',async()=>{
 const {fetcher,calls}=fetcherOf({'/a.glb':()=>reply([100],{headers:{'content-length':'100'}})});
 const p=createProgress({fetcher});
 await p.fetch('/a.glb');
 p.release();
 const r=await p.fetch('/a.glb');
 assert.equal((await r.arrayBuffer()).byteLength,100);
 assert.equal(calls.length,2);
 assert.deepEqual(p.snapshot(),{loaded:100,total:100,fraction:1,pending:0});
});

test('the percentage is whole, stops at 99 until she is ready, and never runs backwards',()=>{
 const at=(loaded,total,pending=0)=>({loaded,total,fraction:total?loaded/total:0,pending});
 assert.equal(percent(at(0,0)),0);
 assert.equal(percent(at(419,1000)),41);
 assert.equal(percent(at(1000,1000)),99);
 assert.equal(percent(at(1000,1000),{done:true}),100);
 assert.equal(percent(at(300,1000),{shown:41}),41);          // a late file grew the total: hold, do not drop
 assert.equal(percent({loaded:900,total:1000,fraction:.45,pending:1},{shown:10}),45);   // it goes by the fraction alone
 assert.equal(percent(at(0,0),{done:true}),100);
});

test('a file with no answer yet is counted at the average size of the ones that have answered',async()=>{
 const h=hold();
 const {fetcher}=fetcherOf({
  '/a.webp':()=>reply([1000],{headers:{'content-length':'1000'}}),
  '/b.webp':()=>reply([3000],{headers:{'content-length':'3000'}}),
  '/late.glb':async()=>{await h.gate;return reply([500],{headers:{'content-length':'500'}});},
 });
 const p=createProgress({fetcher});
 const late=p.fetch('/late.glb');
 assert.equal(p.snapshot().fraction,0);                      // nothing has answered: nothing to go by
 await Promise.all([p.fetch('/a.webp'),p.fetch('/b.webp')]);
 assert.deepEqual(p.snapshot(),{loaded:4000,total:4000,fraction:4000/6000,pending:1});
 h.open();await late;
 assert.deepEqual(p.snapshot(),{loaded:4500,total:4500,fraction:1,pending:0});
});

test('the detail line gives megabytes arrived of megabytes in all, and is empty before anything is known',()=>{
 assert.equal(detail({loaded:0,total:0}),'');
 assert.equal(detail({loaded:7_840_000,total:18_610_000}),'7.8 / 18.6 mb');
 assert.equal(detail({loaded:0,total:5_289_616}),'0.0 / 5.3 mb');
});
