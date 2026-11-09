import {test} from 'node:test';
import assert from 'node:assert/strict';
import {voiceLevel} from '../src/voice/level.js';

test('her voice is at full level at the default music volume and with no music at all',()=>{
 assert.equal(voiceLevel(null),1);
 assert.equal(voiceLevel({volume:.7,muted:false}),1);
});
test('her voice follows the music volume down, and is capped at full level when it goes up',()=>{
 assert.equal(voiceLevel({volume:.35,muted:false}),.5);
 assert.equal(voiceLevel({volume:1,muted:false}),1);
});
test('volume 0 or muted: silent',()=>{
 assert.equal(voiceLevel({volume:0,muted:false}),0);
 assert.equal(voiceLevel({volume:.7,muted:true}),0);
});
