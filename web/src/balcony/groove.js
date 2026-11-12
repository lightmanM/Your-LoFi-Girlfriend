// Nodding to the music: now and then, when the music has a clear beat and she is only reading, her head dips a
// little on each beat for a few bars, with a slight tilt from side to side, and then she is still again for minutes.
// The reader feeds it the beat (src/music/beat.js) every frame and layers apply() on her pose.
import {Quaternion,Vector3,MathUtils} from 'three';

export const GROOVE=Object.freeze({
 every:Object.freeze([100,260]),   // s between episodes
 beats:Object.freeze([8,16]),      // how many beats one lasts
 confident:.3,keep:.2,             // the beat must be this clear (beat.js) for her to start; she carries on above `keep`
 head:2.4,neckShare:.35,           // degrees her head dips on the beat; the neck's share of it
 sway:.7,                          // degrees her head tilts, to one side on one beat and the other on the next
 in:1.5,out:2,                     // beats it takes to come in and to fade out
 drop:.5,                          // s to let go of it when she turns to something else
});
const G=GROOVE,smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
const X=new Vector3(1,0,0),Z=new Vector3(0,0,1),q=new Quaternion();
const turn=(node,axis,degrees)=>{if(node&&degrees)node.quaternion.multiply(q.setFromAxisAngle(axis,MathUtils.degToRad(degrees)));};

/** How far down her head is through one beat (phase 0..1): lowest on the beat, up again by the middle. */
export function nodShape(phase){
 const p=phase-Math.floor(phase);
 return p<.45?1-smooth(p/.45):p>.7?smooth((p-.7)/.3):0;
}

export class Groove{
 /** @param {{random?:()=>number,first?:number,scale?:number}} [o] first: s until the first episode; scale: of the waits */
 constructor({random=Math.random,first,scale=1}={}){
  this.random=random;this.scale=scale;this.time=0;this.next=first??this.gap();
  this.on=false;this.total=0;this.count=0;this.phase=0;this.from=0;this.w=0;
 }
 gap(){const [a,b]=G.every;return (a+(b-a)*this.random())*this.scale;}
 /**
  * @param {number} dt seconds
  * @param {{beat:{phase:number,confidence:number}|null,free:boolean}} now  free: she is only reading
  */
 update(dt,{beat,free}){
  this.time+=dt;
  const clear=!!beat&&beat.confidence>=(this.on?G.keep:G.confident);
  if(!this.on&&free&&clear&&this.time>=this.next){
   this.on=true;this.count=0;this.phase=this.from=beat.phase;this.total=Math.round(G.beats[0]+(G.beats[1]-G.beats[0])*this.random());
  }
  if(!this.on){this.w=Math.max(0,this.w-dt/G.drop);return;}
  if(!free||!clear){this.end();this.w=Math.max(0,this.w-dt/G.drop);return;}
  if(beat.phase<this.phase-.5)this.count++;       // a beat went by
  this.phase=beat.phase;
  const done=this.count+this.phase-this.from;   // beats since it began
  if(done>=this.total){this.end();this.w=0;return;}
  this.w=Math.min(smooth(done/G.in),smooth((this.total-done)/G.out));
 }
 end(){this.on=false;this.next=this.time+this.gap();}
 /** Start an episode as soon as she is free and the beat is clear (for checks). */
 startSoon(){this.next=this.time;}
 /** 0..1: how much she is nodding. */
 weight(){return this.w;}
 /** @param {{humanoid:{getNormalizedBoneNode:(n:string)=>object|null}}} vrm */
 apply(vrm){
  if(this.w<=0)return;
  const bone=n=>vrm.humanoid.getNormalizedBoneNode(n),dip=G.head*nodShape(this.phase)*this.w;
  turn(bone('neck'),X,dip*G.neckShare);turn(bone('head'),X,dip*(1-G.neckShare));
  turn(bone('head'),Z,G.sway*Math.cos(Math.PI*(this.count+this.phase))*this.w);
 }
}
