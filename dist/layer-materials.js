import * as THREE from './vendor/three.module.js';

export function createLayerMaterials(color, roughness, fabricUniforms) {
  const reference = new THREE.MeshStandardMaterial({ map: color, roughnessMap: roughness, roughness: 1, side: THREE.DoubleSide });
  const skin = new THREE.MeshStandardMaterial({ map: color, roughness: .6, side: THREE.DoubleSide });
  skin.name = 'Fixed reconstructed skin';
  // No grab, force, lift, stocking type, or camera uniforms enter the skin shader.
  skin.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vSkinSurface;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkinSurface=position;');
    shader.fragmentShader = 'varying vec3 vSkinSurface;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
float skinRegion=1.-smoothstep(1.84,1.99,vSkinSurface.y);
vec3 lowFrequency=texture2D(map,vMapUv,5.).rgb;
float skinTone=clamp(dot(lowFrequency,vec3(.2126,.7152,.0722)),.24,.75);
vec3 stableSkin=vec3(.69,.46,.35)*(.76+skinTone*.50);
diffuseColor.rgb=mix(diffuseColor.rgb,stableSkin,skinRegion);
`);
  };
  skin.customProgramCacheKey = () => 'immutable-skin-v1';

  const stocking = new THREE.MeshPhysicalMaterial({ map: color, color: 0x242024, roughness: .72, transparent: true, depthWrite: false, side: THREE.DoubleSide, sheen: .4, sheenColor: 0x85808a, sheenRoughness: .7 });
  stocking.name = 'Fabric only — no skin RGB';
  stocking.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { fabricKind: fabricUniforms.kind, fabricDensity: fabricUniforms.density });
    shader.vertexShader = 'attribute float stretch;attribute vec2 clothUv;varying float vStretch;varying vec2 vFabric;varying float vHeight;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStretch=stretch;vFabric=clothUv;vHeight=position.y;');
    shader.fragmentShader = 'varying float vStretch;varying vec2 vFabric;varying float vHeight;uniform float fabricKind;uniform float fabricDensity;\n' + shader.fragmentShader;
    // Replace the map chunk completely. RGB from the original skin/stocking photo
    // must NEVER be painted onto the movable mesh. Only a scalar thread mask is used.
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
float coverage=fabricDensity;
vec2 thread=abs(sin(vFabric*vec2(380.,1450.)*3.14159));
float weave=1.-smoothstep(.15,.42,min(thread.x,thread.y));
if(fabricKind<-.5){
 vec3 source=texture2D(map,vMapUv).rgb;
 vec3 low=texture2D(map,vMapUv,4.).rgb;
 float ratio=dot(source,vec3(.2126,.7152,.0722))/max(.03,dot(low,vec3(.2126,.7152,.0722)));
 float sourceThread=1.-smoothstep(.70,1.0,ratio);
 coverage=clamp(fabricDensity*.6+sourceThread*.45,.04,.9);
 weave=sourceThread;
}
diffuseColor.rgb=diffuse*(.85+.15*weave);
if(fabricKind>2.5&&fabricKind<3.5){
 vec2 net=vFabric*vec2(24.,58.);
 float d=min(abs(sin((net.x+net.y)*3.14159)),abs(sin((net.x-net.y)*3.14159)));
 float aa=max(fwidth(d),.008);
 coverage=1.-smoothstep(.1-aa,.1+aa,d);
 if(coverage<.02)discard;
}
if(fabricKind>3.5&&vHeight>1.35){
 vec2 lace=vFabric*vec2(20.,65.);
 float flower=sin(lace.x*6.283)*sin(lace.y*6.283);
 coverage=max(.18,smoothstep(-.25,.4,flower));
}
diffuseColor.a*=coverage/(1.+vStretch*.6);
diffuseColor.a*=1.-smoothstep(1.84,1.99,vHeight);
`);
  };
  stocking.customProgramCacheKey = () => 'fabric-without-skin-v1';
  return { skin, stocking, reference };
}
