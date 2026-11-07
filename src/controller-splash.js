import * as THREE from "three";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";

const neutralPad = {
  mapping: "xr-standard",
  buttons: Array.from({ length: 8 }, () => ({ pressed: false, touched: false, value: 0 })),
  axes: [0, 0, 0, 0],
};

function styleGuideModel(model) {
  model.traverse((node) => {
    if (!node.isMesh || !node.material?.isMeshStandardMaterial) return;
    node.material = node.material.clone();
    if (node.name === "controller_mesh") {
      // The faceplate occupies the upper-left tile of this asset's texture atlas.
      node.material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#ifdef USE_MAP
            vec4 sampledDiffuseColor = texture2D(map, vMapUv);
            float faceplate = (1.0 - step(0.43, vMapUv.x)) * (1.0 - step(0.43, vMapUv.y));
            vec3 paleShell = vec3(0.91, 0.94, 0.93) + sampledDiffuseColor.rgb * 0.22;
            diffuseColor.rgb *= mix(paleShell, sampledDiffuseColor.rgb, faceplate);
            diffuseColor.a *= sampledDiffuseColor.a;
          #endif`,
        );
      };
      node.material.customProgramCacheKey = () => "quest-guide-pale-shell-v2";
      node.material.emissive.set(0x4b5b58);
      node.material.emissiveMap = null;
      node.material.emissiveIntensity = 0.3;
    } else {
      node.material.emissive.set(0xffffff);
      node.material.emissiveMap = node.material.map;
      node.material.emissiveIntensity = 0.9;
    }
    node.material.needsUpdate = true;
  });
}

function disposeDetachedModel(model) {
  model.traverse((node) => {
    node.geometry?.dispose();
    if (!node.material) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      material.map?.dispose();
      material.dispose();
    }
  });
}

export function updateIllustrationSources(sources, inputSources) {
  const available = Array.from(inputSources ?? []);
  for (const source of sources) {
    const actual = available.find((item) => item?.handedness === source.handedness);
    source.gamepad = actual?.gamepad?.mapping === "xr-standard"
      ? actual.gamepad : neutralPad;
  }
}

// The guide's models stay in place while the model factory animates their controls
// from each real hand's live Gamepad state.
export function addControllerIllustrations(parent, baseUrl) {
  const guide = new THREE.Group();
  parent.add(guide);
  guide.add(new THREE.HemisphereLight(0xffffff, 0x7b96a0, 2.3));
  const lamp = new THREE.DirectionalLight(0xffffff, 3.2);
  lamp.position.set(0, 1.5, 2);
  guide.add(lamp);
  const factory = new XRControllerModelFactory(undefined, (model) => {
    if (guide.parent) styleGuideModel(model);
    else disposeDetachedModel(model);
  });
  factory.setPath(`${baseUrl}controller-profiles`);
  const sources = [];
  for (const [hand, x, turn] of [
    ["left", -0.72, -0.22],
    ["right", 0.72, 0.22],
  ]) {
    const mount = new THREE.Group();
    mount.scale.setScalar(5.0);
    mount.position.set(x, 0.23, 0.36);
    mount.rotation.set(1.15, turn, hand === "left" ? 0.22 : -0.22);
    guide.add(mount);
    mount.add(factory.createControllerModel(mount));
    const source = {
      handedness: hand,
      targetRayMode: "tracked-pointer",
      profiles: ["meta-quest-touch-plus-v2", "meta-quest-touch-plus"],
      gamepad: neutralPad,
    };
    mount.dispatchEvent({ type: "connected", data: source });
    sources.push(source);
  }
  guide.userData.updateControls = (inputSources) =>
    updateIllustrationSources(sources, inputSources);
  return guide;
}
