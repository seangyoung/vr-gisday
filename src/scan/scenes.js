import * as THREE from "three";

// Original procedural models; dimensions share the same handheld scan volume.
export const SCAN_SCENES = [
  { id: "ruins", name: "Woodland ruins" },
  { id: "bridge", name: "Ravine bridge" },
  { id: "village", name: "Hillside village" },
  { id: "terraces", name: "Terraced lookout" },
];

export function createSceneRotation(random = Math.random) {
  let bag = [],
    previous;
  return () => {
    if (!bag.length) {
      bag = [...SCAN_SCENES];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      // Draw from the end; prevent repeats across cycle boundaries too.
      if (bag.at(-1) === previous)
        [bag[0], bag[bag.length - 1]] = [bag.at(-1), bag[0]];
    }
    previous = bag.pop();
    return previous;
  };
}

export function buildScanScene(id, mesh) {
  const box = (size, p, kind = "structure") =>
    mesh(new THREE.BoxGeometry(...size), p, kind);
  const tree = (x, z, y = 0, scale = 1) => {
    mesh(
      new THREE.CylinderGeometry(0.035 * scale, 0.05 * scale, 0.65 * scale, 8),
      [x, y + 0.325 * scale, z],
      "vegetation",
    );
    mesh(
      new THREE.SphereGeometry(0.29 * scale, 24, 16),
      [x, y + 0.69 * scale, z],
      "vegetation",
    );
    for (const side of [-1, 1])
      mesh(
        new THREE.IcosahedronGeometry(0.13 * scale, 1),
        [x + side * 0.17 * scale, y + 0.59 * scale, z + side * 0.08 * scale],
        "vegetation",
      );
  };
  box([2, 0.04, 1.6], [0, -0.02, 0], "ground");
  if (id === "ruins") {
    for (const x of [-0.48, 0.48]) box([0.14, 0.55, 0.7], [x, 0.275, 0]);
    box([1.1, 0.15, 0.18], [0, 0.61, 0.3]);
    box([1.1, 0.32, 0.12], [0, 0.16, -0.34]);
    for (const [x, z, w] of [[-0.2, 0.55, 0.22], [0.28, -0.55, 0.17], [0.55, 0.44, 0.14]])
      box([w, 0.07, w * 0.8], [x, 0.035, z]);
    tree(-0.65, 0.45);
    tree(0.65, -0.4);
  } else if (id === "bridge") {
    for (const x of [-0.76, 0.76]) {
      box([0.48, 0.25, 1.6], [x, 0.125, 0], "ground");
      box([0.13, 0.44, 0.52], [x * 0.65, 0.22, 0]);
    }
    box([1.8, 0.09, 0.5], [0, 0.465, 0]);
    for (const x of [-0.6, -0.3, 0, 0.3, 0.6])
      box([0.06, 0.035, 0.55], [x, 0.53, 0]);
    for (const z of [-0.24, 0.24]) {
      box([1.8, 0.04, 0.04], [0, 0.66, z]);
      for (const x of [-0.8, -0.4, 0, 0.4, 0.8])
        box([0.035, 0.2, 0.035], [x, 0.56, z]);
    }
    tree(-0.78, -0.5, 0.25, 0.64);
    tree(0.78, 0.5, 0.25, 0.64);
  } else if (id === "village") {
    box([1.05, 0.14, 0.7], [0.4, 0.07, -0.4], "ground");
    for (const [x, z, y, h] of [
      [-0.55, 0.26, 0, 0.36],
      [0.35, 0.3, 0, 0.48],
      [0.42, -0.42, 0.14, 0.38],
    ]) {
      box([0.48, h, 0.42], [x, y + h / 2, z]);
      // Extruded triangular roof creates recognizably sloped returns.
      const roof = new THREE.Shape();
      roof.moveTo(-0.28, 0);
      roof.lineTo(0.28, 0);
      roof.lineTo(0, 0.23);
      roof.closePath();
      mesh(
        new THREE.ExtrudeGeometry(roof, { depth: 0.5, bevelEnabled: false }),
        [x, y + h, z - 0.25],
        "structure",
      );
      for (const side of [-1, 1])
        box([0.09, 0.1, 0.012], [x + side * 0.13, y + h * 0.58, z + 0.217]);
    }
    tree(-0.7, -0.45, 0, 0.85);
    tree(0.79, 0.53, 0, 0.55);
  } else if (id === "terraces") {
    for (const [w, d, h, y] of [
      [1.5, 1.2, 0.16, 0.08],
      [1.05, 0.85, 0.16, 0.24],
      [0.65, 0.5, 0.16, 0.4],
    ])
      box([w, h, d], [0, y, -0.1], "ground");
    for (const x of [-0.22, 0.22])
      for (const z of [-0.24, 0.04]) box([0.045, 0.35, 0.045], [x, 0.655, z]);
    for (const [w, y] of [[1.5, 0.16], [1.05, 0.32], [0.65, 0.48]])
      box([w, 0.035, 0.035], [0, y, 0.49 - y * 0.35]);
    mesh(
      new THREE.ConeGeometry(0.4, 0.22, 4),
      [0, 0.94, -0.1],
      "structure",
    ).rotation.y = Math.PI / 4;
    tree(-0.78, 0.5, 0, 0.65);
    tree(0.78, -0.45, 0, 0.65);
  } else throw new Error(`Unknown scan scene: ${id}`);
}
