// The greeting's timing, in seconds from the moment the visitor presses start: she notices, looks up from her book
// at the camera, says the line, keeps looking for a moment with a smile, and goes back to reading. Pure functions.

export const GREET=Object.freeze({
 notice:1.9,    // she looks up as the picture comes into focus (the focus pull lasts 3.2 s, src/intro/intro.js)
 ease:1.3,      // to bring her head up, and later back down to the page (a soft settle: look-ease.js)
 speak:1.1,     // after she starts looking up, she speaks: her eyes have all but arrived
 linger:1.6,    // she keeps looking at you this long after the line
 smile:Object.freeze({lead:.35,rise:.6,fall:1.2}),   // starts lead s before she speaks, rises over rise s; fades as she looks down
 nod:2.4,       // degrees: a small nod over the end of the line
 tilt:10,       // most her head may look tilted sideways from the camera while she looks at you, in degrees (her
                // reading pose leans it ~20° from there; she straightens it to this)
 subtitleLead:.1,
});
const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);

/**
 * @param {{duration:number}} line the spoken line (lines.json)
 * @param {Partial<typeof GREET>} options
 * @returns {{look:number,speak:number,speakEnd:number,release:number,end:number,hold:number,o:typeof GREET}}
 */
export function greetPlan(line,options={}){
 const o={...GREET,...options};
 const look=o.notice,speak=look+o.speak,speakEnd=speak+line.duration,release=speakEnd+o.linger;
 return {look,speak,speakEnd,release,end:release+o.ease,hold:release-look-o.ease,o};
}

/**
 * Her face and the subtitle at time t (s since start).
 * @returns {{smile:number,nod:number,subtitle:boolean}} smile 0..1, nod in degrees (head pitch, down)
 */
export function greetFace(plan,t){
 const {o}=plan,s=o.smile;
 const smile=smooth((t-(plan.speak-s.lead))/s.rise)*(1-smooth((t-plan.release)/s.fall));
 const a=plan.speak+(plan.speakEnd-plan.speak)*.5,b=plan.speakEnd+.4,u=(t-a)/(b-a);
 const nod=u>0&&u<1?o.nod*Math.sin(Math.PI*u):0;
 return {smile,nod,subtitle:t>=plan.speak-o.subtitleLead&&t<plan.release};
}
