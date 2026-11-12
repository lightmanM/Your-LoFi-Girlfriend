// Welcome back: when the visitor returns to the page after a while away (its tab was hidden), she looks up from her
// book at them with a small smile, says nothing, and reads on. The viewer measures the absence and asks welcomeDue();
// update(dt) runs every frame after the reader's update() and before vrm.update().
import {FACE} from '../voice/face.js';

export const WELCOME=Object.freeze({
 away:60,      // s the page must have been hidden for her to notice the return
 notice:.7,    // s after the return before she looks up
 ease:1.2,     // s to bring her head up, and later back down to the page
 hold:2.2,     // s she keeps looking
 tilt:10,      // most her head may look tilted sideways from the camera (degrees), as in her greeting
 giveUp:2,     // s she keeps trying to look up while something else has her busy
 smile:Object.freeze({amount:.8,after:.5,rise:.7,fall:1}),   // of her greeting smile; s after she starts to look up
});
const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);

/**
 * Whether a return after `away` seconds gets a welcome: only after a real absence, once the page has started, and
 * never over her greeting, a line she is saying, a chat or a break.
 * @param {number} away
 * @param {{started:boolean,greeting:boolean,talking:boolean,chatting:boolean,busy:boolean,frozen:boolean}} gates
 * @param {typeof WELCOME} [o]
 * @returns {boolean}
 */
export function welcomeDue(away,gates,o=WELCOME){
 return away>=o.away&&gates.started&&!gates.greeting&&!gates.talking&&!gates.chatting&&!gates.busy&&!gates.frozen;
}

/** Her smile 0..1, t seconds after she starts to look up: it comes once her eyes are nearly on you and goes as she looks down. */
export function welcomeSmile(t,o=WELCOME){
 const s=o.smile,down=o.ease+o.hold;
 return smooth((t-s.after)/s.rise)*(1-smooth((t-down+s.fall*.3)/s.fall));
}

/**
 * @param {{reader:{attend:(o:object)=>boolean,cancelAttend:()=>void},vrm:{expressionManager?:{setValue:(n:string,v:number)=>void}|null},
 *  target:object,options?:Partial<typeof WELCOME>}} o  target: the point she looks at (the camera's position)
 */
export function createWelcome({reader,vrm,target,options}){
 const o={...WELCOME,...options};
 let t=-1,lookedAt=-1,smile=0;   // t: seconds since she was asked (-1: idle); lookedAt: when her look began
 const face=v=>{smile=v;const em=vrm.expressionManager;if(!em)return;em.setValue('happy',v*o.smile.amount*FACE.happy);em.setValue('relaxed',v*o.smile.amount*FACE.relaxed);};
 const end=()=>{const was=t>=0;t=-1;lookedAt=-1;if(was)face(0);};
 return {
  /** Start a welcome (the viewer has checked welcomeDue). */
  greet(){t=0;lookedAt=-1;},
  /** @param {number} dt seconds */
  update(dt){
   if(t<0)return;
   t+=dt;
   if(lookedAt<0){
    if(t<o.notice)return;
    if(t>o.notice+o.giveUp){end();return;}                         // she stayed busy: no welcome this time
    if(!reader.attend({at:target,hold:o.hold,ease:o.ease,tilt:o.tilt}))return;
    lookedAt=t;
   }
   const since=t-lookedAt;
   if(since>=o.ease+o.hold+o.ease){end();return;}
   face(welcomeSmile(since,o));
  },
  active:()=>t>=0,
  /** End it now and send her eyes back to the book. */
  stop(){const looking=lookedAt>=0;end();if(looking)reader.cancelAttend();},
  /** End it now, leaving her look to whatever took over (a chat, a line she starts to say). */
  yield(){end();},
  state:()=>({active:t>=0,t:+t.toFixed(2),looked:lookedAt>=0,smile:+smile.toFixed(3)}),
 };
}
