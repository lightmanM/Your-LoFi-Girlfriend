import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isFile,resolveAssets,probeFile} from '../src/standin/resolve.js';

// Which files the page uses: the owner's when present, a stand-in for each one that is missing.
const SCENE={vrm:'/models/marycia/marycia-web.vrm',pose:'/standin/reading-balcony.json',
 character:{hips:[1,2,3],yaw_deg:10,scale:1.4},wind:{plants:'plants.glb'}};
const STANDIN={vrm:'/standin/vivi.vrm',pose:'/standin/reading-balcony.json',character:{hips:[4,5,6],yaw_deg:20,scale:1},
 poseFix:{},book:{offset:[0,.1,0]},chair:'/standin/chair.json',facesForward:true};
const missing=(...names)=>async url=>!names.some(n=>url.includes(n));

test('with the owner\'s files present nothing is a stand-in',async()=>{
 const r=await resolveAssets(SCENE,STANDIN,{probe:missing()});
 assert.deepEqual(r.using,[]);assert.equal(r.vrm,SCENE.vrm);assert.deepEqual(r.character,SCENE.character);
 assert.deepEqual(r.book.offset,[0,0,0]);assert.equal(r.chair.standin,false);assert.equal(r.plants.standin,false);
});

test('each missing file falls back on its own',async()=>{
 const r=await resolveAssets(SCENE,STANDIN,{probe:missing('plants.glb')});
 assert.deepEqual(r.using,['plants']);assert.equal(r.vrm,SCENE.vrm);assert.equal(r.plants.standin,true);
});

test('a missing character brings Vivi with her placement and book offset',async()=>{
 const r=await resolveAssets(SCENE,STANDIN,{probe:missing('marycia-web')});
 assert.deepEqual(r.using,['character']);assert.equal(r.vrm,STANDIN.vrm);
 assert.deepEqual(r.character,STANDIN.character);assert.deepEqual(r.book.offset,[0,.1,0]);
});

test('force uses every stand-in without asking',async()=>{
 const r=await resolveAssets(SCENE,STANDIN,{probe:()=>{throw Error('asked');},force:true});
 assert.deepEqual(r.using,['character','chair','plants']);
});

test('only the right kind of file counts: a page answered for a missing file is missing',async()=>{
 const res=(body,type,status=200)=>new Response(body,{status,headers:{'content-type':type}});
 assert.equal(await isFile(res('<!doctype html><html></html>','text/html'),'glb'),false);
 assert.equal(await isFile(res('<!doctype html>','text/html; charset=utf-8'),'json'),false);
 assert.equal(await isFile(res(new Uint8Array([0x67,0x6c,0x54,0x46,2,0,0,0]),'model/gltf-binary'),'glb'),true);
 assert.equal(await isFile(res('{"name":"x"}','application/json'),'json'),true);
 assert.equal(await isFile(res('nope','application/octet-stream'),'glb'),false);
 assert.equal(await isFile(res('','text/plain',404),'glb'),false);
});

test('the stand-in\'s facing travels with it, and only with it',async()=>{
 assert.equal((await resolveAssets(SCENE,STANDIN,{probe:missing('marycia-web')})).facesForward,true);
 assert.equal((await resolveAssets(SCENE,STANDIN,{probe:missing()})).facesForward,false);
});

test('the check reads only the first bytes and stops the rest of the download (a host that ignores Range sends it all)',async()=>{
 let pulled=0,cancelled=false;
 const body=new ReadableStream({
  start(c){c.enqueue(new Uint8Array([0x67,0x6c,0x54,0x46,2,0,0,0]));},
  pull(c){pulled++;if(pulled>128)c.close();else c.enqueue(new Uint8Array(64*1024));},   // 8 MB in all
  cancel(){cancelled=true;},
 },{highWaterMark:0});
 const whole=async()=>new Response(body,{status:200,headers:{'content-type':'model/gltf-binary'}});
 assert.equal(await probeFile('/plants.glb','glb',whole),true);
 assert.ok(pulled<=2,`read ${pulled} chunks past the first bytes`);
 assert.equal(cancelled,true);
});

test('only a real "not here" counts as missing: a network error or a server error keeps the owner\'s file (final review)',async()=>{
 const res=(status,type='model/gltf-binary',body='glTF0000')=>async()=>new Response(body,{status,headers:{'content-type':type}});
 assert.equal(await probeFile('/x.glb','glb',async()=>{throw TypeError('network');}),true);
 assert.equal(await probeFile('/x.glb','glb',res(503,'text/plain','busy')),true);
 assert.equal(await probeFile('/x.glb','glb',res(404,'text/plain','')),false);
 assert.equal(await probeFile('/x.glb','glb',res(200,'text/html','<!doctype html>')),false);
 assert.equal(await probeFile('/x.glb','glb',res(200)),true);
});

test('without standin.json the owner\'s files still load, and a needed stand-in says what is missing',async()=>{
 const r=await resolveAssets(SCENE,null,{probe:missing()});
 assert.deepEqual(r.using,[]);assert.equal(r.vrm,SCENE.vrm);assert.equal(r.chair.url.endsWith('chair-visible.glb'),true);
 await assert.rejects(resolveAssets(SCENE,null,{probe:missing('marycia-web')}),/standin\.json/);
});
