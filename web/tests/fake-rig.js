// A bare humanoid for unit tests: the bones a motion touches as plain Object3Ds in a T-pose (facing +Z, her left
// along +X, as VRM 1.0 normalized bones are), put into a seated reading-like pose (elbows down, forearms forward).
import {Object3D,Quaternion,Vector3} from 'three';

const FINGERS=['Index','Middle','Ring','Little'],SEGMENTS=['Proximal','Intermediate','Distal'];
const Z=new Vector3(0,0,1),Y=new Vector3(0,1,0);

export function fakeRig(){
 const nodes={},add=(name,parent,x,y,z)=>{const n=new Object3D();n.name=name;n.position.set(x,y,z);(parent?nodes[parent]:root).add(n);nodes[name]=n;return n;};
 const root=new Object3D();
 add('hips',null,0,.9,0);add('spine','hips',0,.1,0);add('chest','spine',0,.14,0);add('neck','chest',0,.2,0);add('head','neck',0,.08,0);
 for(const [side,s] of [['left',1],['right',-1]]){
  add(side+'Shoulder','chest',s*.03,.16,0);add(side+'UpperArm',side+'Shoulder',s*.1,0,0);
  add(side+'LowerArm',side+'UpperArm',s*.26,0,0);add(side+'Hand',side+'LowerArm',s*.24,0,0);
  FINGERS.forEach((f,i)=>{let parent=side+'Hand';SEGMENTS.forEach((seg,j)=>{add(side+f+seg,parent,s*(j?.03:.08),0,.03-.02*i);parent=side+f+seg;});});
  let parent=side+'Hand';for(const seg of ['Metacarpal','Proximal','Distal']){add(side+'Thumb'+seg,parent,s*.03,0,.03);parent=side+'Thumb'+seg;}
 }
 const pose=()=>{
  for(const n of Object.values(nodes))n.quaternion.identity();
  for(const [side,s] of [['left',1],['right',-1]]){
   nodes[side+'UpperArm'].quaternion.setFromAxisAngle(Z,-s*75*Math.PI/180);                 // arm down by her side
   nodes[side+'LowerArm'].quaternion.setFromAxisAngle(Y,-s*80*Math.PI/180);                 // forearm forward
   for(const f of FINGERS)for(const seg of SEGMENTS)nodes[side+f+seg].quaternion.setFromAxisAngle(Z,-s*.5);   // holding the book
  }
  root.updateMatrixWorld(true);
 };
 pose();
 const world=name=>nodes[name].getWorldPosition(new Vector3());
 return {nodes,root,pose,world,humanoid:{getNormalizedBoneNode:n=>nodes[n]??null},
  /** Every bone's rotation, to compare poses. */
  snapshot:()=>Object.fromEntries(Object.entries(nodes).map(([k,n])=>[k,n.quaternion.clone()]))};
}
// the angle between two rotations, in degrees (exactly 0 for equal ones: angleTo's arc cosine is noisy near 0)
export const degrees=(a,b)=>a.equals(b)?0:a.angleTo(b)*180/Math.PI;
export const still=new Quaternion();
