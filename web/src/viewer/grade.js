// The colour grade the Blender image pass gave the toon picture (warm tint, more saturation, a little darker), applied
// inside her materials and the book's, since she is drawn live over the already-graded picture.
export const GRADE={gain:.72,sat:1.25,warm:[1,.82,.66]};   // matched to the Blender picture by colour samples on her
const glsl=g=>`
vec3 lofiGrade(vec3 c){
 c*=${g.gain.toFixed(3)}*vec3(${g.warm.map(v=>v.toFixed(3)).join(',')});
 float l=dot(c,vec3(.2126,.7152,.0722));
 return max(mix(vec3(l),c,${g.sat.toFixed(3)}),0.);
}`;
/** Add the grade to one material's shader (MToon and the standard three.js materials). */
export function gradeMaterial(m,g=GRADE){
 if(!m||m.userData.lofiGrade)return;m.userData.lofiGrade=true;
 const prev=m.onBeforeCompile;
 m.onBeforeCompile=(shader,renderer)=>{
  prev?.call(m,shader,renderer);
  let f=shader.fragmentShader;
  if(f.includes('void postCorrection() {'))f=f.replace('void postCorrection() {',glsl(g)+'\nvoid postCorrection() {\n  gl_FragColor.rgb=lofiGrade(gl_FragColor.rgb);');
  else f=f.replace('#include <common>','#include <common>\n'+glsl(g)).replace('#include <tonemapping_fragment>','gl_FragColor.rgb=lofiGrade(gl_FragColor.rgb);\n#include <tonemapping_fragment>');
  shader.fragmentShader=f;
 };
 const key=m.customProgramCacheKey?.bind(m);
 m.customProgramCacheKey=()=>(key?key():'')+'|lofiGrade';
 m.needsUpdate=true;
}
