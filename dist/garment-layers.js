import * as THREE from './vendor/three.module.js';
import { StaticSkinCollider } from './skin-collider.js';
import { ClothPhysics } from './cloth-physics.js';

export function createGarmentLayers(bodySource, garmentSource, skinMaterial, stockingMaterial) {
  if (skinMaterial === stockingMaterial) throw Error('Skin and stockings require separate materials');
  // Deep attribute copies protect the source model and prohibit shared position buffers.
  const skinGeometry = bodySource.clone(), stockingGeometry = garmentSource.clone();
  const collider = new StaticSkinCollider(skinGeometry.attributes.position.array, skinGeometry.index.array);
  const physics = new ClothPhysics(stockingGeometry.attributes.position.array, stockingGeometry.attributes.normal.array, { collider });
  stockingGeometry.setAttribute('position', new THREE.BufferAttribute(physics.positions, 3).setUsage(THREE.DynamicDrawUsage));
  stockingGeometry.setAttribute('stretch', new THREE.BufferAttribute(physics.stretch, 1).setUsage(THREE.DynamicDrawUsage));
  stockingGeometry.computeBoundingSphere(); stockingGeometry.boundingSphere.radius += 2;
  const skin = new THREE.Mesh(skinGeometry, skinMaterial), stocking = new THREE.Mesh(stockingGeometry, stockingMaterial);
  skin.name = 'Static skin — never simulated'; stocking.name = 'Independent stocking — draggable';
  skin.userData.layer = 'skin'; skin.userData.draggable = false;
  stocking.userData.layer = 'stocking'; stocking.userData.draggable = true; stocking.renderOrder = 2;
  const result = {
    skin, stocking, physics, collider, skinMaterial, stockingMaterial,
    setSkinGeometry(source) { const old = skin.geometry; skin.geometry = source.clone(); old.dispose(); },
    update() {
      stockingGeometry.attributes.position.needsUpdate = true;
      stockingGeometry.attributes.stretch.needsUpdate = true;
      stockingGeometry.computeVertexNormals();
    },
    reset() { physics.reset(); this.update(); },
  };
  return result;
}
