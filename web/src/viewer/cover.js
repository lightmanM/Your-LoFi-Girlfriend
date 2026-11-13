// Lets the picture cover her. The balcony is one flat picture, so on the daybed the door frame beside it would be
// drawn behind her. The picture comes with a cover map (how far the nearest solid thing is at each pixel, the one the
// live plants use): where that is nearer than she is, her pixel is not drawn. Off (her chair is live 3D and needs
// none of this) until the shared switch `on.value` is 1.

/**
 * Add the test to one of her materials (MToon and the standard three.js materials).
 * @param {import('three').Material} m
 * @param {import('three').Texture} cover R + G/255: log distance to the nearest opaque surface (plants.js)
 * @param {{tan:[number,number],depthLog:number,on:{value:number}}} o tan: of half the picture's horizontal and
 *  vertical field of view; depthLog: log2 of the map's range in metres; on: shared by every material
 */
export function coverMaterial(m,cover,{tan,depthLog,on}){
 if(!m||m.userData.lofiCover)return;m.userData.lofiCover=true;
 const prev=m.onBeforeCompile;
 m.onBeforeCompile=(shader,renderer)=>{
  prev?.call(m,shader,renderer);
  Object.assign(shader.uniforms,{lofiCover:{value:cover},lofiCoverOn:on,lofiCoverTan:{value:tan},lofiCoverLog:{value:depthLog}});
  const f=shader.fragmentShader,decl='uniform sampler2D lofiCover;uniform float lofiCoverOn,lofiCoverLog;uniform vec2 lofiCoverTan;\n';
  // the page's camera is the picture's: a pixel's place in the picture and its distance follow from its view position
  const test=`
 if(lofiCoverOn>.5){
  float lofiD=vViewPosition.z;vec2 lofiUv=-vViewPosition.xy/(lofiD*lofiCoverTan)*.5+.5;
  vec2 lofiC=texture2D(lofiCover,lofiUv).rg;
  if(exp2((lofiC.r+lofiC.g/255.)*lofiCoverLog)<lofiD-(.05+.012*lofiD))discard;
 }`;
  shader.fragmentShader=(f.includes('varying vec3 vViewPosition;')?'':'varying vec3 vViewPosition;\n')+decl+f.replace(/void\s+main\s*\(\s*\)\s*\{/,s=>s+test);
 };
 const key=m.customProgramCacheKey?.bind(m);
 m.customProgramCacheKey=()=>(key?key():'')+'|lofiCover';
 m.needsUpdate=true;
}
