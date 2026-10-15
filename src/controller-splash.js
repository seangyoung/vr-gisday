import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

function disposeModel(model) {
  model.traverse((node) => {
    node.geometry?.dispose();
    if (!node.material) return;
    for (const material of Array.isArray(node.material)
      ? node.material : [node.material]) {
      material.map?.dispose();
      material.dispose();
    }
  });
}

// These are the same bundled Quest Touch Plus assets used for tracked hands.
export function addControllerIllustrations(parent, baseUrl) {
  const guide = new THREE.Group();
  parent.add(guide);
  guide.add(new THREE.HemisphereLight(0xffffff, 0x7b96a0, 2.3));
  const lamp = new THREE.DirectionalLight(0xffffff, 3.2);
  lamp.position.set(0, 1.5, 2);
  guide.add(lamp);
  for (const [hand, x, turn] of [
    ["left", -0.72, -0.22],
    ["right", 0.72, 0.22],
  ]) {
    loader.load(`${baseUrl}controller-profiles/meta-quest-touch-plus-v2/${hand}.glb`,
      (gltf) => {
        if (!guide.parent) {
          disposeModel(gltf.scene);
          return;
        }
        const model = gltf.scene;
        model.traverse((node) => {
          if (!node.isMesh || !node.material?.isMeshStandardMaterial) return;
          node.material.emissive.set(0xffffff);
          node.material.emissiveMap = node.material.map;
          node.material.emissiveIntensity = 0.9;
        });
        model.scale.setScalar(5.0);
        model.position.set(x, 0.23, 0.36);
        model.rotation.set(1.15, turn, hand === "left" ? 0.22 : -0.22);
        guide.add(model);
      }, undefined, () => {
        // The text guide remains usable if a model asset cannot load.
      });
  }
  return guide;
}
