import * as THREE from './vendor/three.module.js';
import { createHand } from './hand.js';
import { loadGeometry,loadTexture } from './model-loader.js';
import { createGarmentLayers } from './garment-layers.js';
import { createLayerMaterials } from './layer-materials.js';
const $=s=>document.getElementById(s),host=$('viewport'),hand=createHand(host),status=$('loadStatus');
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,60);camera.position.set(0,.2,12.8);camera.lookAt(0,0,0);
let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true})}catch(e){status.textContent='WebGL 不可用，请用 Chrome / Edge 打开';throw e}renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;host.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xfff6ee,0x777481,1.8));for(const [color,intensity,xyz] of [[0xffecdf,2.2,[-4,5,6]],[0xe4eaff,1.4,[4,3,-3]]]){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...xyz);scene.add(l)}
const rig=new THREE.Group();scene.add(rig);let body,cloth,physics,layers,materials,ready=false,comparing=false,hovering=false,drag=null,orbit=null,grab=null,anchorIndex=0,demo=0,pull=new THREE.Vector3(),last=performance.now(),qualityRequest=0;
const uniforms={kind:{value:-1},density:{value:.4}};
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();const floor=new THREE.Mesh(new THREE.CircleGeometry(3,80),new THREE.MeshBasicMaterial({color:0x8d867b,transparent:true,opacity:.1}));floor.rotation.x=-Math.PI/2;floor.position.y=-3.43;floor.scale.y=.6;scene.add(floor);
function syncLayerVisibility(){
 if(!ready)return;
 const view=$('layerView').value;
 body.material=comparing?materials.reference:materials.skin;
 body.visible=comparing||view!=='stocking';
 cloth.visible=!comparing&&view!=='skin';
 $('layerView').disabled=comparing;
 if(!cloth.visible){release();demo=0;hand.hide();hovering=false;}
}
function updateStats(){ $('distance').textContent=((physics?.max||0)*5).toFixed(1);$('force').textContent=((physics?.max||0)*(.4+Number($('elastic').value)/80)).toFixed(2);$('meter').style.width=Math.min(100,(physics?.max||0)/1.6*100)+'%';$('state').textContent=!ready?'● 模型加载中':comparing?'● 原始模型对照':!cloth.visible?'● 皮肤固定，不参与拉伸':drag||demo?'● 手部捏持中':physics.max>.015?'● 弹性回弹中':'● 织物贴合中'}
function showError(e){status.hidden=false;status.textContent=e.message+'。请刷新重试，或打开下载的离线文件。';console.error(e)}
async function start(){
 try{
  status.textContent='正在载入独立皮肤层与丝袜层…';
  const [g,shell,color,roughness]=await Promise.all([loadGeometry('preview'),loadGeometry('cloth'),loadTexture('texture_pbr_20250901.png',true),loadTexture('texture_pbr_20250901_roughness.png')]);
  status.textContent='正在建立静态皮肤碰撞表面…';
  await new Promise(resolve=>setTimeout(resolve,0));
  materials=createLayerMaterials(color,roughness,uniforms);
  layers=createGarmentLayers(g,shell,materials.skin,materials.stocking);
  body=layers.skin;cloth=layers.stocking;physics=layers.physics;
  g.dispose();shell.dispose();
  const uv=new Float32Array(physics.base.length/3*2);
  for(let k=0;k<physics.base.length;k+=3){let x=physics.base[k],y=physics.base[k+1],z=physics.base[k+2],center=x<0?-.74:.74;uv[k/3*2]=Math.atan2(x-center,z)/(2*Math.PI)+.5;uv[k/3*2+1]=(y+3.4)/6.8}
  cloth.geometry.setAttribute('clothUv',new THREE.BufferAttribute(uv,2));
  rig.add(body,cloth);ready=true;status.hidden=true;
  $('type').onchange();syncLayerVisibility();
  $('modelInfo').textContent='皮肤固定 · 独立袜层 · 18 万面预览';
  updateStats();
 }catch(e){showError(e)}
}
function aim(e){const r=host.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera)}
function begin(point){grab=point.clone();physics.grab(grab);let best=Infinity;for(let k=0;k<physics.base.length;k+=3){let d=(physics.base[k]-grab.x)**2+(physics.base[k+1]-grab.y)**2+(physics.base[k+2]-grab.z)**2;if(d<best){best=d;anchorIndex=k}}$('hint').style.opacity='0'}
host.addEventListener('pointerdown',e=>{if(!ready||comparing)return;aim(e);host.setPointerCapture(e.pointerId);demo=0;const hit=cloth.visible?ray.intersectObject(cloth)[0]:null;if(hit){begin(rig.worldToLocal(hit.point.clone()));drag={plane:new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),hit.point),world:hit.point.clone(),normal:hit.face.normal.clone().transformDirection(rig.matrixWorld)};pull.set(0,0,0)}else orbit={x:e.clientX,y:e.clientY,rotation:rig.rotation.y,tilt:rig.rotation.x}});
host.addEventListener('pointermove',e=>{if(!ready)return;if(drag){aim(e);const p=new THREE.Vector3();if(ray.ray.intersectPlane(drag.plane,p)){let delta=p.sub(drag.world),length=delta.length(),q=rig.quaternion.clone().invert(),n=drag.normal.clone().applyQuaternion(q);delta.applyQuaternion(q);const tightness=1.22-Number($('elastic').value)/190;pull.copy(delta).multiplyScalar(.5).addScaledVector(n,length*.82).multiplyScalar(tightness);if(pull.length()>1.6)pull.setLength(1.6)}}else if(orbit){rig.rotation.y=orbit.rotation+(e.clientX-orbit.x)*.008;rig.rotation.x=THREE.MathUtils.clamp(orbit.tilt+(e.clientY-orbit.y)*.003,-.4,.4)}else{aim(e);hovering=!comparing&&cloth.visible&&!!ray.intersectObject(cloth)[0]}});
function release(){drag=null;orbit=null;pull.set(0,0,0);physics?.release()}for(const e of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(e,release);globalThis.addEventListener?.('blur',()=>{release();demo=0;hand.hide()});host.addEventListener('wheel',e=>{if(e.ctrlKey||e.shiftKey){e.preventDefault();camera.position.z=THREE.MathUtils.clamp(camera.position.z+e.deltaY*.008,7,18)}},{passive:false});
const presets={original:[-1,20,55,.75,'仅提取原织纹；肤色留在固定皮肤层'],sheer:[0,15,45,.75,'独立透肤袜层；底层肤色为近似重建'],satin:[1,30,60,.25,'缎面高光 · 独立弹性袜层'],opaque:[2,80,80,.95,'高覆盖天鹅绒 · 更紧致回弹'],fishnet:[3,20,35,.72,'透明菱形孔 · 孔洞随布料拉伸'],lace:[4,20,55,.65,'花纹袜口 · 轻薄袜身']};
$('den').oninput=()=>{$('denValue').textContent=$('den').value;uniforms.density.value=Math.min(.97,.13+Number($('den').value)*.012)};$('elastic').oninput=()=>{$('elasticValue').textContent=+$('elastic').value<40?'柔软':+$('elastic').value<75?'适中':'紧致'};
$('type').onchange=()=>{const p=presets[$('type').value];uniforms.kind.value=p[0];$('den').value=p[1];$('elastic').value=p[2];$('typeNote').textContent=p[4];$('den').oninput();$('elastic').oninput();if(cloth){cloth.material.roughness=p[3];cloth.material.sheen=p[0]===1?1:.4;cloth.material.color.set(document.querySelector('.swatch.active')?.dataset.color||'#242024')}};
document.querySelectorAll('.swatch').forEach(b=>b.onclick=()=>{document.querySelector('.swatch.active')?.classList.remove('active');b.classList.add('active');cloth?.material.color.set(b.dataset.color);$('colorName').textContent=b.getAttribute('aria-label')});
$('demo').onclick=()=>{if(!ready||!cloth.visible)return;release();const b=physics.base;let best=Infinity,at=0;for(let k=0;k<b.length;k+=3){const d=(b[k]-1.12)**2+(b[k+1]-1.1)**2+(b[k+2]-.65)**2;if(d<best){best=d;at=k}}begin(new THREE.Vector3(b[at],b[at+1],b[at+2]));demo=performance.now()};
$('compare').onchange=()=>{release();demo=0;comparing=$('compare').checked;syncLayerVisibility();hand.hide();updateStats()};
$('layerView').onchange=()=>{release();demo=0;syncLayerVisibility();updateStats()};
$('quality').onchange=async()=>{if(!ready)return;const token=++qualityRequest,quality=$('quality').value;if(globalThis.NYLON_ASSETS&&quality==='original'){$('quality').value='preview';$('modelInfo').textContent='离线单文件使用轻量预览；完整版请运行源码包';return}status.hidden=false;status.textContent=quality==='original'?'正在载入完整 150 万面模型…':'正在切换流畅预览…';try{const g=await loadGeometry(quality);if(token!==qualityRequest){g.dispose();return}layers.setSkinGeometry(g);g.dispose();$('modelInfo').textContent=quality==='original'?'皮肤固定 · 完整 150 万面原模':'皮肤固定 · 独立袜层 · 18 万面预览';status.hidden=true}catch(e){if(token===qualityRequest)showError(e)}};
$('reset').onclick=()=>{
 release();demo=0;layers?.reset();rig.rotation.set(0,0,0);camera.position.set(0,.2,12.8);
 $('type').value='original';$('type').onchange();document.querySelector('.swatch')?.click();
 $('compare').checked=false;comparing=false;$('layerView').value='both';syncLayerVisibility();
 $('hint').style.opacity='1';hand.hide();
};
function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(host);
function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.04);last=now;let contact=null;if(ready){if(demo){let t=(now-demo)/1000,a=t<1.3?Math.sin(t/1.3*Math.PI/2):t<2.5?1:Math.max(0,1-(t-2.5)/.7);pull.set(1.2*a,.05*a,.6*a);if(t>3.2){demo=0;release()}}if(physics.active||physics.max>.0001){physics.step(dt,pull,Number($('elastic').value));if(!physics.active&&physics.max<.0001)physics.reset();layers.update()}if(drag||demo){const p=physics.positions;contact=rig.localToWorld(new THREE.Vector3(p[anchorIndex],p[anchorIndex+1],p[anchorIndex+2]))}updateStats()}hand.update({holding:!!contact,worldPoint:contact,camera,hovering,demo:!!demo});renderer.render(scene,camera)}requestAnimationFrame(animate);start();


