// The answers to her question: soft pills under her words (answers.css). Real buttons: Tab reaches them, Enter or Space
// picks one. A pick is not a "tap anywhere" click (it does not reach the page's own click handlers), the same rule as the
// HUD buttons. Hidden, they are inert, so focus never lands on a pill nobody can see.
import './answers.css';

/** @returns {{show:(answers:{ja:string,en:string}[],onPick:(i:number)=>void)=>void,hide:()=>void,visible:()=>boolean,labels:()=>string[],unmount:()=>void}} */
export function mountAnswers(parent=document.body){
 const root=document.createElement('div');root.className='answers';root.setAttribute('role','group');
 root.setAttribute('aria-label','answers');root.inert=true;parent.append(root);
 let picked=false;
 return {
  show(answers,onPick){
   picked=false;
   root.replaceChildren(...answers.map(({ja,en},i)=>{
    const b=document.createElement('button');b.type='button';
    const j=document.createElement('span'),e=document.createElement('span');
    j.className='ja';j.lang='ja';j.textContent=ja;e.className='en';e.lang='en';e.textContent=en;b.append(j,e);
    b.addEventListener('click',ev=>{ev.stopPropagation();if(picked)return;picked=true;b.classList.add('picked');onPick(i);});
    return b;
   }));
   root.inert=false;root.classList.add('on');
  },
  /** Fade out (a picked pill keeps its highlight while it goes). */
  hide(){if(root.contains(document.activeElement))document.activeElement.blur();root.inert=true;root.classList.remove('on');},
  visible:()=>root.classList.contains('on'),
  labels:()=>[...root.querySelectorAll('.ja')].map(x=>x.textContent),
  unmount(){root.remove();},
 };
}
