// The stand-in reading chair: a seat and a back, the two panels the page fits to the real chair (visible-chair.js),
// kept as numbers in public/standin/chair.json (written by scripts/standins/fit_chair.mjs) and built here in world
// space. Its colour comes from the background picture like the real chair's; it gives her a seat to sit on, something
// to sit in front of, and a surface for her shadow. Used when the balcony's chair mesh is not available.
import * as THREE from 'three';

function fan(ring,name){
 const pts=ring.map(p=>new THREE.Vector3().fromArray(p));
 const mid=pts.reduce((a,p)=>a.add(p),new THREE.Vector3()).divideScalar(pts.length),pos=[];
 pts.forEach((a,i)=>{const b=pts[(i+1)%pts.length];pos.push(...mid.toArray(),...a.toArray(),...b.toArray());});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
 const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.name=name;return m;
}

/** @param {{seat:number[][],back:number[][]}} spec each panel's outline, world-space points in order @returns {THREE.Group} */
export function standinChair({seat,back}){
 if(!Array.isArray(seat)||seat.length<3)throw Error('stand-in chair: the seat outline is missing');
 if(!Array.isArray(back)||back.length<3)throw Error('stand-in chair: the back outline is missing');
 const g=new THREE.Group();g.name='Stand-in chair';
 g.add(fan(seat,'Chair weave panel'),fan(back,'Chair back panel'));   // the seating code looks for 'Chair weave panel'
 return g;
}
