import test from 'node:test';
import assert from 'node:assert/strict';
import {formatTimecode,musicLine,barHeights,BARS} from '../src/hud/format.js';

test('timecode: hh:mm:ss from seconds, clamped at zero',()=>{
 assert.equal(formatTimecode(0),'00:00:00');
 assert.equal(formatTimecode(61.9),'00:01:01');
 assert.equal(formatTimecode(3600*12+59),'12:00:59');
 assert.equal(formatTimecode(-5),'00:00:00');
 assert.equal(formatTimecode(NaN),'00:00:00');
});
test('timecode: wraps after 100 hours like a camera counter',()=>{
 assert.equal(formatTimecode(100*3600+1),'00:00:01');
});

const playing={status:'playing',track:{title:'calm',artist:'VibeDepot',license:'CC BY-ND 4.0'}};
test('music line: describes each state',()=>{
 assert.deepEqual(musicLine({status:'idle',track:null}),{title:'tap for music',artist:'',action:'start'});
 assert.deepEqual(musicLine({status:'loading',track:null}),{title:'tuning in…',artist:'',action:null});
 assert.deepEqual(musicLine(playing),{title:'calm',artist:'vibedepot',action:null});
 assert.deepEqual(musicLine({...playing,status:'paused'}),{title:'paused',artist:'calm',action:'start'});
 assert.deepEqual(musicLine({status:'error',track:null}),{title:'music unavailable · tap to retry',artist:'',action:'start'});
});
test('music line: lowercases titles and artists for the camera text',()=>{
 assert.equal(musicLine({status:'playing',track:{title:'Fine dining BGM',artist:'Lao Ban'}}).title,'fine dining bgm');
});

test('bars: rest flat when silent or still, move with the music',()=>{
 assert.deepEqual(barHeights([0,0,0]),[BARS.min,BARS.min,BARS.min]);
 const loud=barHeights([1,1,1]);assert.ok(loud.every(h=>h===BARS.max));
 const mid=barHeights([.5,.2,.8]);assert.ok(mid[2]>mid[0]&&mid[0]>mid[1]);
 assert.deepEqual(barHeights([1,1,1],{still:true}),BARS.still);
});
test('bars: ignore bad input',()=>{
 assert.deepEqual(barHeights(null),[BARS.min,BARS.min,BARS.min]);
 assert.deepEqual(barHeights([NaN,-1,4]),[BARS.min,BARS.min,BARS.max]);
});

test('a copy without the music says so and offers nothing to tap',()=>{
 assert.deepEqual(musicLine({status:'unavailable'}),{title:'no music in this copy',artist:'',action:null});
});
