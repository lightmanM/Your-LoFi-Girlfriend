import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readVRMDocument} from '../src/vrm-file.js';

function binary(document) {
  let json = JSON.stringify(document);
  json += ' '.repeat((4-json.length%4)%4);
  const bytes = new TextEncoder().encode(json);
  const buffer = new ArrayBuffer(20+bytes.length);
  const view = new DataView(buffer);
  [0x46546c67,2,buffer.byteLength,bytes.length,0x4e4f534a].forEach((n,i)=>view.setUint32(i*4,n,true));
  new Uint8Array(buffer,20).set(bytes);
  return buffer;
}

test('rejects invalid and non-VRM files before parsing GPU resources',()=>{
  assert.throws(()=>readVRMDocument(new ArrayBuffer(4)),/valid/);
  assert.throws(()=>readVRMDocument(binary({asset:{version:'2.0'}})),/without VRM/);
});

test('local replacement cannot cause external texture downloads',()=>{
  assert.throws(()=>readVRMDocument(binary({extensions:{VRM:{}},images:[{uri:'https://example.com/image.png'}]})),/embedded/);
});

test('bundled character is self-contained and carries the checked CC0 license', async()=>{
  const data=await readFile(new URL('../public/models/vivi/vivi.vrm',import.meta.url));
  const doc=readVRMDocument(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
  assert.equal(doc.extensions.VRM.meta.title,'Vivi');
  assert.equal(doc.extensions.VRM.meta.licenseName,'CC0');
  assert.equal(doc.extensions.VRM.humanoid.humanBones.length,54);
});
