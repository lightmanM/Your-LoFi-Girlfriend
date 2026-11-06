import {Quaternion} from 'three';
const smooth=x=>x*x*(3-2*x);
function interval(times,time){
 if(times.length===1||time<=times[0])return [0,0,0];
 const last=times.length-1;if(time>=times[last])return [last,last,0];
 let lo=0,hi=last;while(hi-lo>1){const mid=(lo+hi)>>1;if(times[mid]<=time)lo=mid;else hi=mid;}
 return [lo,hi,(time-times[lo])/(times[hi]-times[lo])];
}
export function sampleScalar(times,values,time){const [a,b,t]=interval(times,time);return values[a]*(1-t)+values[b]*t;}
export function sampleRotation(times,values,time){const [a,b,t]=interval(times,time);return new Quaternion().fromArray(values,a*4).slerp(new Quaternion().fromArray(values,b*4),t).normalize();}
// A short blend to the first sample closes source loops whose endpoints differ.
export function loopTime(time,duration,fade=.3){
 if(duration<=0)return {time:0,wrap:0};
 const t=time%duration,span=Math.min(fade,duration/2);
 return {time:t,wrap:t>duration-span?smooth((t-duration+span)/span):0};
}
export const actionTime=(elapsed,duration)=>Math.min(Math.max(0,elapsed),duration);
// Supplied clips: duration is the clip length (held on its last frame) plus a little
// settle, never shorter than the blend envelope allows.
export const SOURCE_ACTIONS={
 smile:{label:'Smile',clip:'smile',duration:3},
 smile2:{label:'Smile (slow)',clip:'smile2',duration:9},
 wink:{label:'Wink',clip:'wink',duration:2.7},
 relax:{label:'Relaxed expression',clip:'relax',duration:11},
 laugh:{label:'Laugh',clip:'laugh',duration:12.5},
 ask:{label:'Curious',clip:'ask',duration:8.5},
 smug:{label:'Smug',clip:'smug',duration:3.5},
 star:{label:'Starry eyes',clip:'star',duration:9},
 ahoge:{label:'Ahoge wiggle',clip:'ahoge',duration:10.5},
 sad:{label:'Sad',clip:'sad',duration:12.5},
 cry:{label:'Cry',clip:'cry',duration:11.8},
 anger:{label:'Angry',clip:'anger',duration:8.5},
 serious:{label:'Serious',clip:'serious',duration:17.5},
 scared:{label:'Scared',clip:'scared',duration:7},
 eyesClosed:{label:'Eyes closed',clip:'eyesClosed',duration:3.5},
 eyesClosedSoft:{label:'Eyes closed (soft)',clip:'eyesClosedSoft',duration:3.5},
 eyeClosedLeft:{label:'Left eye closed',clip:'eyeClosedLeft',duration:4.8},
 eyeClosedRight:{label:'Right eye closed',clip:'eyeClosedRight',duration:4.8},
 faceAfk:{label:'Dozing face',clip:'faceAfk',duration:3.5},
 peace:{label:'Peace fingers',clip:'peace',duration:3.5},
 thumbsUp:{label:'Thumbs up fingers',clip:'thumbsUp',duration:3.5},
 fingerHeart:{label:'Finger heart',clip:'fingerHeart',duration:3.5},
 point:{label:'Point fingers',clip:'point',duration:3.5},
 open:{label:'Open hands',clip:'open',duration:4},
 fist:{label:'Fist',clip:'fist',duration:3.5},
 rock:{label:'Rock fingers',clip:'rock',duration:3.5},
 gun:{label:'Finger gun',clip:'gun',duration:3.5},
 // Authored clips (web/public/models/marycia/authored-motions.json); options vanish when the file is absent.
 stretch:{label:'Stretch break (reference)',clip:'stretch',duration:19.7,authored:true},
 stretchRokoko:{label:'Stretch break (Rokoko Vision)',clip:'stretchRokoko',duration:19.7,authored:true},
 stretchRokokoIk:{label:'Stretch break (Rokoko, IK arms)',clip:'stretchRokokoIk',duration:19.7,authored:true}
};
