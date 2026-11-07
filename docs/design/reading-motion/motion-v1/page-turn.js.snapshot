// A single paper leaf that turns over from one page of the open book to the other, curling as it goes.
// It lives in the book's own frame (so it moves with the book) and is hidden except while turning.
import {DoubleSide,Mesh,PlaneGeometry,Vector3} from 'three';

const SEGMENTS=28;

// Top surface of one page block: height at the spine and at the outer edge, read from the book mesh itself.
function pageSurface(pages,side,width){
 const p=pages.geometry.attributes.position;let y0=-Infinity,y1=-Infinity;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)*side,y=p.getY(i);
  if(x>=0&&x<width*.06)y0=Math.max(y0,y);
  if(x>width*.94)y1=Math.max(y1,y);
 }
 return {y0,y1};
}

export class PageTurn{
 /** @param {import('three').Object3D} bookRoot @param {number} side +1 or -1: the page block (local x sign) the leaf starts on */
 constructor(bookRoot,side,{width=.145,height=.21,curl=.38,lift=.0016}={}){
  this.side=side;this.width=width;this.curl=curl;this.lift=lift;
  const reach=o=>{o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;return side>0?b.max.x:-b.min.x;};
  const pages=bookRoot.children.find(o=>o.isMesh&&/pages/.test(o.name)&&reach(o)>.01);
  if(!pages)throw Error('page turn: no page block on side '+side);
  const s=pageSurface(pages,side,width);
  this.hingeY=s.y0;this.slope=Math.atan2(s.y1-s.y0,width);
  this.geometry=new PlaneGeometry(1,height,SEGMENTS,1);
  this.material=pages.material.clone();this.material.side=DoubleSide;
  this.mesh=new Mesh(this.geometry,this.material);this.mesh.visible=false;this.mesh.renderOrder=2;this.mesh.frustumCulled=false;
  bookRoot.add(this.mesh);this.corner=new Vector3();this.set(0);
 }
 // progress 0 = lying on its starting page, 1 = lying on the other page.
 set(progress){
  const p=Math.min(1,Math.max(0,progress)),pos=this.geometry.attributes.position,n=SEGMENTS+1;
  const start=this.slope,end=Math.PI-this.slope,mid=Math.sin(Math.PI*p);
  const ds=this.width/SEGMENTS;let x=0,y=this.hingeY+this.lift;
  for(let i=0;i<n;i++){
   const u=i/SEGMENTS;
   // the outer part lags behind the part near the spine mid-turn: the page curls
   const a=start+(end-start)*Math.min(1,Math.max(0,p-this.curl*u*mid));
   if(i>0){x+=Math.cos(a)*ds;y+=Math.sin(a)*ds;}
   for(const row of [0,1]){const k=row*n+i;pos.setX(k,x*this.side);pos.setY(k,y);pos.setZ(k,row===0?this.geometry.parameters.height/2:-this.geometry.parameters.height/2);}
   if(i===SEGMENTS)this.corner.set(x*this.side,y,0);
  }
  pos.needsUpdate=true;this.geometry.computeVertexNormals();this.geometry.computeBoundingSphere();
  this.mesh.visible=p>0&&p<1;
 }
 /** World position of a point on the outer edge (v: -0.5 bottom .. 0.5 top in local z). */
 edgePoint(v,out=new Vector3()){return out.set(this.corner.x,this.corner.y,v*this.geometry.parameters.height).applyMatrix4(this.mesh.matrixWorld);}
}
