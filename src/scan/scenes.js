import * as THREE from "three";

// Original procedural models; dimensions share the same handheld scan volume.
export const SCAN_SCENES = [
  {
    id: "ruins", name: "Woodland ruins",
    prompt: "Scan one wall, then turn the ruins around.\nWhich faces appear only from the other side?",
    takeaway: {
      title: "A wall can hide what lies behind it.",
      body: "The wall blocks rays from surfaces behind it: occlusion.\nScan from another side to fill some of the gap.\nSurveyors align multiple lidar views for a fuller 3D map.",
    },
  },
  {
    id: "bridge", name: "Ravine bridge",
    prompt: "Scan across the deck, then look beneath it.\nCan you capture the supports from above?",
    takeaway: {
      title: "Look below the bridge deck.",
      body: "The deck hides its supports from a high viewpoint.\nA low, angled scan reveals the underside and clearance.\nCombined lidar views show more of the bridge.",
    },
  },
  {
    id: "village", name: "Hillside village",
    prompt: "Sweep the rooftops, then move to the other side.\nWhich walls do the roofs and houses hide?",
    takeaway: {
      title: "Roofs can hide the streets below.",
      body: "First returns show roofs while walls stay hidden.\nA side scan adds facades to the building point cloud.\nSurveyors combine views to map more of a settlement.",
    },
  },
  {
    id: "terraces", name: "Terraced lookout",
    prompt: "Scan the stepped ground and nearby trees.\nWhich faces need a higher or lower viewpoint?",
    takeaway: {
      title: "Height changes need well-placed samples.",
      body: "The steps and trees return points at different heights.\nGround points reveal terrace tops and vertical faces.\nA digital elevation model (DEM) stores ground heights in a grid.",
    },
  },
  {
    id: "canopy", name: "Forest survey",
    prompt: "Scan the trail through the trees.\nThen hide plants: does new ground appear below them?",
    takeaway: {
      title: "A ground map needs ground returns.",
      body: "Canopies intercept the first ray hits in this model.\nHiding tree points leaves the unsampled ground as a gap.\nGround returns help build bare-earth elevation models.",
    },
  },
  {
    id: "courtyard", name: "Covered courtyard",
    prompt: "Scan the roof and outside walls first.\nTurn the model to find the open side and columns.",
    takeaway: {
      title: "An enclosed space needs access.",
      body: "The roof and walls block rays into the courtyard.\nScan through the opening to reach its columns.\nA new viewpoint can reveal surfaces hidden from outside.",
    },
  },
  {
    id: "tower", name: "Survey tower",
    prompt: "Sweep the platform and its narrow supports.\nDo all the slender pieces get the same number of points?",
    takeaway: {
      title: "Thin features need denser sampling.",
      body: "Narrow supports catch fewer rays than broad surfaces.\nPoint density limits the detail a scan can resolve.\nDenser lidar sampling helps document thin features.",
    },
  },
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
  const defaultFinish = {
    ruins: "stone", bridge: "timber", village: "plaster",
    terraces: "stone", canopy: "timber", courtyard: "stone",
    tower: "metal",
  }[id];
  const box = (size, p, kind = "structure", finish =
    kind === "ground" ? "earth" : defaultFinish) =>
    mesh(new THREE.BoxGeometry(...size), p, kind, finish);
  const tree = (x, z, y = 0, scale = 1) => {
    mesh(
      new THREE.CylinderGeometry(0.035 * scale, 0.05 * scale, 0.65 * scale, 8),
      [x, y + 0.325 * scale, z],
      "vegetation",
      "bark",
    );
    mesh(
      new THREE.SphereGeometry(0.29 * scale, 24, 16),
      [x, y + 0.69 * scale, z],
      "vegetation",
      "leaves",
    );
    for (const side of [-1, 1])
      mesh(
        new THREE.IcosahedronGeometry(0.13 * scale, 1),
        [x + side * 0.17 * scale, y + 0.59 * scale, z + side * 0.08 * scale],
        "vegetation",
        "leaves",
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
      box([0.13, 0.44, 0.52], [x * 0.65, 0.22, 0], "structure", "stone");
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
        "roof",
      );
      for (const side of [-1, 1])
        box([0.09, 0.1, 0.012], [x + side * 0.13, y + h * 0.58, z + 0.217],
          "structure", "timber");
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
  } else if (id === "canopy") {
    // A visible boardwalk runs beneath overlapping crowns; removing canopy
    // points should leave honest gaps in the first-surface ground sample.
    for (const z of [-0.54, -0.18, 0.18, 0.54])
      box([0.27, 0.05, 0.26], [0.02 + z * 0.18, 0.045, z]);
    for (const x of [-0.48, 0.48])
      for (const z of [-0.44, 0.4]) tree(x, z, 0, 0.72);
    box([0.12, 0.34, 0.1], [-0.13, 0.17, 0.62]);
  } else if (id === "courtyard") {
    // Three walls and a partial roof leave one side open to oblique rays.
    box([1.18, 0.62, 0.1], [0, 0.31, -0.46]);
    for (const x of [-0.55, 0.55])
      box([0.1, 0.62, 0.86], [x, 0.31, -0.08]);
    box([1.18, 0.055, 0.52], [0, 0.68, -0.27]);
    for (const x of [-0.34, 0.34])
      box([0.075, 0.55, 0.075], [x, 0.275, 0.3]);
    box([0.54, 0.08, 0.28], [0, 0.04, 0.14], "ground");
    tree(0.76, 0.49, 0, 0.62);
    tree(-0.78, -0.5, 0, 0.57);
  } else if (id === "tower") {
    for (const x of [-0.28, 0.28])
      for (const z of [-0.24, 0.24])
        box([0.055, 0.7, 0.055], [x, 0.35, z]);
    box([0.72, 0.07, 0.66], [0, 0.735, 0]);
    for (const z of [-0.29, 0.29])
      box([0.73, 0.035, 0.035], [0, 0.91, z]);
    for (const x of [-0.34, 0.34])
      box([0.035, 0.035, 0.59], [x, 0.91, 0]);
    box([0.045, 0.21, 0.045], [0, 0.89, 0]);
    tree(-0.72, 0.4, 0, 0.65);
    tree(0.73, -0.47, 0, 0.61);
  } else throw new Error(`Unknown scan scene: ${id}`);
}
