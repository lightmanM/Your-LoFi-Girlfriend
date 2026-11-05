import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';

export function createAtmosphere(renderer,scene,camera){
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:Math.min(2,renderer.capabilities.maxSamples)});
 const composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));
 const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.13,.65,1.6);composer.addPass(bloom);composer.addPass(new OutputPass());
 const finish=new ShaderPass({uniforms:{tDiffuse:{value:null},amount:{value:1}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform float amount;varying vec2 vUv;
   float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;vec2 p=vUv-.5;
    float vignette=1.0-amount*.23*smoothstep(.10,.68,length(p));
    c=c*vignette+amount*(noise(gl_FragCoord.xy)-.5)*.009;
    gl_FragColor=vec4(c,1.0);}`});composer.addPass(finish);
 const positions=new Float32Array(42*3),seed=[];
 for(let i=0;i<42;i++){const a=(i*.61803398875)%1,b=(i*.4142135623)%1,c=(i*.7320508)%1;seed.push([a,b,c]);positions.set([-1.6+a*2.6,.4+b*1.65,-1.4+c*1.9],i*3);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const dust=new THREE.Points(geometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,
  uniforms:{pixelRatio:{value:renderer.getPixelRatio()}},
  vertexShader:'uniform float pixelRatio;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=2.1*pixelRatio;}',
  fragmentShader:'void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(1.0,.86,.58,(1.0-smoothstep(.05,.5,d))*.24);}'}));
 dust.name='Quiet sunlit dust';scene.add(dust);
 let active=true,time=0;
 return {composer,
  setEnabled(enabled){active=enabled;bloom.enabled=enabled;finish.uniforms.amount.value=enabled?1:0;dust.visible=enabled;},
  resize(w,h){composer.setSize(w,h);},
  update(dt,{paused=false,reducedMotion=false}={}){
   dust.visible=active&&!reducedMotion;if(paused||reducedMotion)return;time+=Math.min(dt,.05);
   seed.forEach(([a,b,c],i)=>positions.set([-1.6+a*2.6+.025*Math.sin(time*.25+i),.4+((b*1.65+time*.018)%1.65),-1.4+c*1.9],i*3));geometry.attributes.position.needsUpdate=true;
  },
  render(){renderer.info.reset();composer.render();},
 };
}

export function createWindowSky(){
 return new THREE.ShaderMaterial({side:THREE.DoubleSide,
  vertexShader:'varying vec3 world;void main(){world=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.0);}',
  fragmentShader:`varying vec3 world;
   void main(){vec2 p=vec2((world.x+2.2)/3.05,(world.y-.83)/1.67);
    vec3 c=mix(vec3(.72,.45,.24),vec3(.19,.32,.40),smoothstep(.0,1.,p.y));
    float d=length((p-vec2(.76,.51))*vec2(1.45,1.));
    c+=vec3(.55,.26,.07)*exp(-d*6.);c+=vec3(1.0,.64,.30)*(1.-smoothstep(.052,.068,d));
    float ridge=.18+.028*sin(p.x*12.)+.035*sin(p.x*5.+1.);
    c=mix(c,vec3(.16,.25,.23),1.-smoothstep(ridge,ridge+.013,p.y));
    float foreground=.065+.018*sin(p.x*19.)+.025*sin(p.x*7.);
    c=mix(c,vec3(.09,.17,.14),1.-smoothstep(foreground,foreground+.009,p.y));
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
}
