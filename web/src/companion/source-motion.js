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
export const SOURCE_ACTIONS={
 smile:{label:'Smile',clip:'smile',duration:3},
 wink:{label:'Wink',clip:'wink',duration:2.7},
 relax:{label:'Relaxed expression',clip:'relax',duration:11},
 peace:{label:'Peace fingers',clip:'peace',duration:3.5},
 thumbsUp:{label:'Thumbs up fingers',clip:'thumbsUp',duration:3.5},
 fingerHeart:{label:'Finger heart',clip:'fingerHeart',duration:3.5},
};
