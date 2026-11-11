// The camera standing by while her room loads: "stby" and a blinking light top left, the percentage top right, and
// under the picture how many megabytes have arrived. Its markup and look are in index.html, so they are on screen
// before any script arrives; this module only writes the figures (from progress.js) and the final state.
import {percent,detail} from './progress.js';

/**
 * @param {ParentNode} [root] where #standby and #note are
 * @returns {{update:(s:import('./progress.js').Snapshot)=>void,ready:()=>void,fail:()=>void}} `update` shows a
 *  snapshot of the load; `ready` and `fail` end it, and later updates are ignored
 */
export function mountStandby(root=document){
 const box=root.querySelector('#standby'),word=box?.querySelector('.sb-word'),figure=box?.querySelector('.sb-pct');
 let shown=0,over=false;
 const write=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text;};
 const end=(state,label,pct)=>{over=true;if(box)box.dataset.state=state;write(word,label);write(figure,pct);};
 return {
  update(snapshot){
   if(over)return;
   shown=percent(snapshot,{shown});
   write(figure,shown+'%');
   write(root.querySelector('#note .sb-detail'),detail(snapshot));   // looked up each time: a failure message replaces it
  },
  ready(){end('ready','ready','100%');},
  fail(){end('failed','no signal','--%');},
 };
}
