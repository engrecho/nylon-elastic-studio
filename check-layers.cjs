const fs = require('node:fs'), assert = require('node:assert/strict');
(async () => {
  const THREE = await import('./dist/vendor/three.module.js');
  const { StaticSkinCollider } = await import('./dist/skin-collider.js');
  const { createGarmentLayers } = await import('./dist/garment-layers.js');
  const { createLayerMaterials } = await import('./dist/layer-materials.js');
  const { loadGeometry } = await import('./dist/model-loader.js');
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async url => String(url).startsWith('model/') ? new Response(fs.readFileSync('dist/' + url)) : fetchOriginal(url);

  // A closed fixture proves nearest-triangle contact and sweeping, including
  // a crossing whose endpoint is already outside the opposite side of the body.
  const box = new THREE.BoxGeometry(2, 2, 2), proxy = new StaticSkinCollider(box.attributes.position.array, box.index.array, { maxY: Infinity });
  assert(Math.abs(proxy.nearest(0, 0, 2).distance - 1) < 1e-6);
  const tunnel = proxy.constrain([0, 0, 2], [0, 0, -2]);
  assert(tunnel.corrected && tunnel.point[2] > 1.013, 'Swept contact must stop at the first skin surface');
  const inside = proxy.constrain([0, 0, 1.03], [0, 0, .99]);
  assert(inside.point[2] >= 1.013, 'Endpoint contact must retain a gap');
  const touch = proxy.constrain([.1, 0, 1.014], [.2, 0, 1.014]);
  assert(Math.abs(touch.point[0] - .2) < 1e-6, 'Tangential contact must not freeze the garment');

  const body = await loadGeometry('preview'), garment = await loadGeometry('cloth');
  const sourceBody = body.attributes.position.array.slice(), sourceGarment = garment.attributes.position.array.slice();
  const materials = createLayerMaterials(new THREE.Texture(), new THREE.Texture(), { kind: { value: -1 }, density: { value: .4 } });
  console.time('Independent layer and BVH construction');
  const layers = createGarmentLayers(body, garment, materials.skin, materials.stocking);
  console.timeEnd('Independent layer and BVH construction');
  const { skin, stocking, physics, collider } = layers;
  assert.notEqual(skin.geometry, stocking.geometry);
  assert.notEqual(skin.geometry.attributes.position.array.buffer, stocking.geometry.attributes.position.array.buffer);
  assert.notEqual(skin.geometry.index.array.buffer, stocking.geometry.index.array.buffer);
  assert.notEqual(collider.positions.buffer, skin.geometry.attributes.position.array.buffer);
  assert.notEqual(materials.skin, materials.stocking);
  assert.equal(skin.userData.draggable, false); assert.equal(stocking.userData.draggable, true);
  const skinBefore = skin.geometry.attributes.position.array.slice(), normalsBefore = skin.geometry.attributes.normal.array.slice(), indicesBefore = skin.geometry.index.array.slice();
  const proxyBefore = collider.positions.slice();
  const base = physics.base; let at = 0, best = Infinity;
  for (let k = 0; k < base.length; k += 3) { const distance = (base[k] - 1.12) ** 2 + (base[k + 1] - 1.1) ** 2 + (base[k + 2] - .65) ** 2; if (distance < best) { best = distance; at = k; } }
  physics.grab({ x: base[at], y: base[at + 1], z: base[at + 2] });
  console.time('Layer deformation and return');
  for (let frame = 0; frame < 48; frame++) physics.step(1 / 60, { x: .8, y: .05, z: .6 }, 55);
  layers.update(); assert(physics.max > .35, 'Only the separate stocking should visibly lift');
  let opposite = 0, nearPenetrations = 0;
  for (let k = 0; k < base.length; k += 3) {
    if (base[k] < 0) opposite = Math.max(opposite, Math.hypot(...physics.offset.subarray(k, k + 3)));
    if (physics.weights[k / 3] < .01) continue;
    const p = Array.from(physics.positions.subarray(k, k + 3)), hit = collider.nearest(...p, .03);
    if (hit) { const signed = hit.normal.reduce((s, n, c) => s + n * (p[c] - hit.point[c]), 0); if (signed < -.001) nearPenetrations++; }
  }
  assert(opposite < 1e-6, 'The other leg must stay fixed');
  assert.equal(nearPenetrations, 0, 'The moving stocking must not penetrate nearby skin triangles');
  physics.release(); for (let frame = 0; frame < 240; frame++) physics.step(1 / 60, { x: 0, y: 0, z: 0 }, 55);
  assert(physics.max < .0001, 'Clothing must settle onto its independent rest surface');
  layers.reset(); assert.deepEqual(physics.positions, physics.rest);
  assert.deepEqual(skin.geometry.attributes.position.array, skinBefore);
  assert.deepEqual(skin.geometry.attributes.normal.array, normalsBefore);
  assert.deepEqual(skin.geometry.index.array, indicesBefore);
  assert.deepEqual(collider.positions, proxyBefore);
  assert.deepEqual(body.attributes.position.array, sourceBody);
  assert.deepEqual(garment.attributes.position.array, sourceGarment);
  console.timeEnd('Layer deformation and return');

  const shader = () => ({ uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <map_fragment>' });
  const skinShader = shader(), stockingShader = shader(); materials.skin.onBeforeCompile(skinShader); materials.stocking.onBeforeCompile(stockingShader);
  assert.equal(Object.keys(skinShader.uniforms).length, 0, 'Skin shader must not depend on grabbing or garment controls');
  assert(!/grab|lift|fabricKind|fabricDensity/.test(skinShader.fragmentShader));
  assert(!stockingShader.fragmentShader.includes('#include <map_fragment>'), 'Skin RGB must not be mapped onto movable cloth');
  assert(stockingShader.fragmentShader.includes('diffuseColor.rgb=diffuse*'));
  const full = await loadGeometry('original'); layers.setSkinGeometry(full);
  assert.notEqual(skin.geometry.attributes.position.array.buffer, full.attributes.position.array.buffer);
  assert.equal(skin.geometry.index.count, full.index.count); layers.reset();
  assert.deepEqual(skin.geometry.attributes.position.array, full.attributes.position.array);
  console.log('PASS: distinct geometry, buffers and materials; immutable skin/source/proxy; UV-safe rest surface; swept collision; fixed skin shader; no skin RGB on cloth; full-quality replacement.');
})().catch(error => { console.error(error); process.exitCode = 1; });


