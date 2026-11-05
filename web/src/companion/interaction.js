const smooth = t => {const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};

// Pure playback state: no timers, model names, rendering or network access.
export class Interaction {
  constructor({duration=4,blendIn=.75,blendOut=.9}={}) {
    if(duration<=blendIn+blendOut||blendIn<=0||blendOut<=0)throw new Error('Clip must be longer than its positive blends');
    this.duration=duration;this.blendIn=blendIn;this.blendOut=blendOut;
    this.state='idle';this.elapsed=0;this.weight=0;this.queued=false;this.paused=false;
    this.completed=0;this.started=0;this.cooldown=0;
  }
  request(){
    if(this.state!=='idle'||this.cooldown>0){this.queued=true;return 'queued';}
    this.state='acting';this.elapsed=0;this.weight=0;this.started++;return 'started';
  }
  update(dt){
    if(!Number.isFinite(dt)||dt<0)throw new Error('Delta must be finite and nonnegative');
    if(this.paused)return;
    if(this.state==='idle'){
      this.cooldown=Math.max(0,this.cooldown-dt);
      if(this.queued&&this.cooldown===0){this.queued=false;this.request();}
      return;
    }
    this.elapsed=Math.min(this.duration,this.elapsed+dt);
    this.weight=smooth(this.elapsed/this.blendIn)*smooth((this.duration-this.elapsed)/this.blendOut);
    this.state=this.elapsed>=this.duration-this.blendOut?'finishing':'acting';
    if(this.elapsed>=this.duration){this.state='idle';this.weight=0;this.completed++;this.cooldown=.4;}
  }
  snapshot(){return {state:this.state,elapsed:this.elapsed,duration:this.duration,weight:this.weight,
    idleWeight:1-this.weight,queued:this.queued,paused:this.paused,completed:this.completed,started:this.started};}
}
