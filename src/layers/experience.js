import * as THREE from "three";

export const LAYER_KEYS = [
  "topography",
  "vegetation",
  "hydrology",
  "roads",
  "floodplain",
  "boundaries",
];
export const LAYER_NAMES = {
  topography: "Topography",
  vegetation: "Vegetation",
  hydrology: "Hydrology",
  roads: "Roads",
  floodplain: "Floodplain",
  boundaries: "Political boundaries",
};
export const LAYER_HINTS = {
  topography: "DEM (elevation grid): reveals ridges and valleys; used to model slope.",
  vegetation: "Land cover: mapped trees show habitat, shade, and cleared corridors.",
  hydrology: "Hydrography: a downhill river follows its carved channel and watershed.",
  roads: "Transport network: a four-lane highway bridges the river.",
  floodplain: "Floodplain: low ground beside the river; an illustrative terrain zone, not a flood forecast.",
  boundaries: "Jurisdictions: fictional district lines are drawn by people, not barriers on the ground.",
};
export const LANDSCAPE_EXTENT = 160;
const extent = LANDSCAPE_EXTENT;
export const riverX = (z) =>
  7 + 3.5 * Math.sin(z * 0.018) + 1.1 * Math.sin(z * 0.065);
export const riverWaterHeight = (z) => -0.8 - 0.008 * z;
export const highwayZ = (x) =>
  -22 + 2.6 * Math.sin(x * 0.025) + 0.9 * Math.sin(x * 0.08);
const topographicHeight = (x, z) => {
  const fromRiver = Math.abs(x - riverX(z));
  const floor = riverWaterHeight(z) - 0.26;
  const flank = 0.066 * fromRiver + 0.00055 * fromRiver ** 2;
  const rolling =
    (0.42 * Math.sin(x * 0.055 + Math.cos(z * 0.025)) +
      0.36 * Math.sin(z * 0.052) +
      0.14 * Math.sin(x * 0.21) * Math.cos(z * 0.18)) *
    THREE.MathUtils.smoothstep(fromRiver, 4, 23);
  const hills =
    8.0 * Math.exp(-((x + 59) ** 2 + (z + 35) ** 2) / 1450) +
    6.0 * Math.exp(-((x + 53) ** 2 + (z - 70) ** 2) / 1050) +
    8.2 * Math.exp(-((x - 66) ** 2 + (z + 62) ** 2) / 1750) +
    6.5 * Math.exp(-((x - 74) ** 2 + (z - 52) ** 2) / 1280) +
    11.0 * Math.exp(-((x + 126) ** 2 + (z + 112) ** 2) / 2400) +
    9.0 * Math.exp(-((x - 122) ** 2 + (z - 99) ** 2) / 2200);
  const channel =
    0.2 * (1 - THREE.MathUtils.smoothstep(fromRiver, 0.6, 3));
  const outerDistance = Math.max(Math.abs(x), Math.abs(z));
  const outerRidges = THREE.MathUtils.smoothstep(outerDistance, 150, 260) *
    (5 * Math.sin(x * 0.019 + z * 0.007) +
      3.5 * Math.cos(z * 0.024 - x * 0.011));
  const raw =
    floor + flank + rolling +
    hills * THREE.MathUtils.smoothstep(fromRiver, 2, 18) - channel + outerRidges;
  const clearing = 1 - THREE.MathUtils.smoothstep(Math.hypot(x, z), 2.5, 4.5);
  return THREE.MathUtils.lerp(raw, 0, clearing);
};
export const landscapeHeight = (x, z, raised = true) =>
  raised ? topographicHeight(x, z) : 0;
export const boundaryX = (z) => -12 + 9 * Math.sin(z * 0.013);
export const boundaryZ = (x) => -38 + 7 * Math.sin(x * 0.016);
export const floodplainAt = (x, z) =>
  Math.abs(x - riverX(z)) < 18 &&
  landscapeHeight(x, z) - riverWaterHeight(z) < 1.15;

function surfaceGeometry(raised, size = 400) {
  const vertices = [],
    colors = [],
    indices = [];
  const spread = (index) => {
    const unit = (index * 2) / size - 1;
    return Math.sign(unit) * Math.abs(unit) ** 1.28 * extent;
  };
  for (let row = 0; row <= size; row++)
    for (let col = 0; col <= size; col++) {
      const x = spread(col);
      const z = spread(row);
      const y = landscapeHeight(x, z, raised);
      vertices.push(x, y, z);
      const grain =
        0.027 * Math.sin(x * 0.24) * Math.sin(z * 0.22) +
        0.012 * Math.sin(x * 0.65 + z * 0.48);
      const color = new THREE.Color(raised ? 0x729477 : 0x779078);
      color.offsetHSL(0, 0, THREE.MathUtils.clamp(y * 0.012 + grain, -0.09, 0.11));
      colors.push(color.r, color.g, color.b);
    }
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      const a = row * (size + 1) + col;
      indices.push(a, a + size + 1, a + 1, a + 1, a + size + 1, a + size + 2);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function outerTerrainGeometry(raised) {
  const rings = [extent, 230, 330, 480], segments = 96;
  const vertices = [], colors = [], indices = [];
  const add = (x, z) => {
    const y = landscapeHeight(x, z, raised);
    vertices.push(x, y, z);
    const color = new THREE.Color(raised ? 0x729477 : 0x779078);
    color.offsetHSL(0, 0, THREE.MathUtils.clamp(y * 0.012, -0.09, 0.11));
    colors.push(color.r, color.g, color.b);
  };
  for (let side = 0; side < 4; side++) {
    const first = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      const t = -1 + (2 * i) / segments;
      for (const distance of rings) {
        if (side === 0) add(t * distance, -distance);
        if (side === 1) add(t * distance, distance);
        if (side === 2) add(-distance, t * distance);
        if (side === 3) add(distance, t * distance);
      }
      if (i < segments)
        for (let ring = 0; ring < rings.length - 1; ring++) {
          const a = first + i * rings.length + ring;
          indices.push(a, a + 1, a + rings.length,
            a + 1, a + rings.length + 1, a + rings.length);
        }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
const seeded = (i) => {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
export const TREE_POSITIONS = Array.from({ length: 3600 }, (_, i) => ({
  x: (seeded(i * 2 + 1) - 0.5) * (extent * 1.92),
  z: (seeded(i * 2 + 2) - 0.5) * (extent * 1.92),
  scale: 0.76 + seeded(i + 6000) * 0.85,
  evergreen: seeded(i + 8000) > 0.43,
}))
  .filter(({ x, z }, i) =>
    seeded(i + 10000) > 0.23 &&
    Math.hypot(x, z) > 14 &&
    Math.abs(x - riverX(z)) > 5.5 &&
    Math.abs(z - highwayZ(x)) > 9.5,
  );
function makeTrees(group, raised) {
  const deciduous = TREE_POSITIONS.filter((p) => !p.evergreen);
  const evergreen = TREE_POSITIONS.filter((p) => p.evergreen);
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.11, 0.18, 1.8, 6),
    new THREE.MeshStandardMaterial({ color: 0x705b45, roughness: 1 }),
    TREE_POSITIONS.length,
  );
  const broadleaf = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1.15, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
    deciduous.length,
  );
  const pine = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.0, 3.3, 14),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
    evergreen.length,
  );
  const temp = new THREE.Object3D();
  TREE_POSITIONS.forEach(({ x, z, scale }, i) => {
    const y = landscapeHeight(x, z, raised);
    temp.position.set(x, y + 0.9 * scale, z);
    temp.scale.set(scale, scale, scale);
    temp.updateMatrix();
    trunk.setMatrixAt(i, temp.matrix);
  });
  deciduous.forEach(({ x, z, scale }, i) => {
    temp.position.set(x, landscapeHeight(x, z, raised) + 2.65 * scale, z);
    temp.scale.setScalar(scale);
    temp.updateMatrix();
    broadleaf.setMatrixAt(i, temp.matrix);
    broadleaf.setColorAt(
      i,
      new THREE.Color().setHSL(0.29 + seeded(i + 3100) * 0.09, 0.22, 0.28 + seeded(i + 3200) * 0.13),
    );
  });
  evergreen.forEach(({ x, z, scale }, i) => {
    temp.position.set(x, landscapeHeight(x, z, raised) + 2.65 * scale, z);
    temp.scale.setScalar(scale);
    temp.updateMatrix();
    pine.setMatrixAt(i, temp.matrix);
    pine.setColorAt(
      i,
      new THREE.Color().setHSL(0.38 + seeded(i + 3400) * 0.04, 0.25, 0.23 + seeded(i + 3500) * 0.1),
    );
  });
  group.add(trunk, broadleaf, pine);
  const nearLeaf = deciduous.filter(({ x, z }) => Math.hypot(x, z) < 58);
  const lobes = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.62, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
    nearLeaf.length * 3,
  );
  nearLeaf.forEach(({ x, z, scale }, i) => {
    for (let lobe = 0; lobe < 3; lobe++) {
      const angle = (lobe * Math.PI * 2) / 3 + seeded(i + 4500);
      temp.position.set(
        x + Math.cos(angle) * 0.65 * scale,
        landscapeHeight(x, z, raised) + (2.3 + 0.2 * seeded(i + lobe + 4600)) * scale,
        z + Math.sin(angle) * 0.65 * scale,
      );
      temp.scale.setScalar(scale);
      temp.updateMatrix();
      lobes.setMatrixAt(i * 3 + lobe, temp.matrix);
      lobes.setColorAt(i * 3 + lobe, new THREE.Color().setHSL(
        0.29 + seeded(i + 3100) * 0.09, 0.22, 0.28 + seeded(i + 3200) * 0.13,
      ));
    }
  });
  group.add(lobes);
  const shrubs = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.35, 0),
    new THREE.MeshStandardMaterial({ color: 0x597b55, roughness: 1 }),
    480,
  );
  for (let i = 0; i < shrubs.count; i++) {
    const x = (seeded(i + 28000) - 0.5) * 145;
    const z = (seeded(i + 29000) - 0.5) * 145;
    const scale = Math.hypot(x, z) < 8 || Math.abs(x - riverX(z)) < 5 ||
      Math.abs(z - highwayZ(x)) < 9 ? 0 : 0.6 + seeded(i + 30000) * 1.3;
    temp.position.set(x, landscapeHeight(x, z, raised) + 0.22 * scale, z);
    temp.scale.setScalar(scale);
    temp.updateMatrix();
    shrubs.setMatrixAt(i, temp.matrix);
  }
  group.add(shrubs);
}
function ribbonAlongZ(raised, halfWidth, yAt, color, crossSegments = 1) {
  const vertices = [], indices = [];
  const segments = 440;
  for (let i = 0; i <= segments; i++) {
    const z = -extent + (2 * extent * i) / segments;
    const center = riverX(z);
    for (let cross = 0; cross <= crossSegments; cross++) {
      const x = center - halfWidth + (2 * halfWidth * cross) / crossSegments;
      vertices.push(x, yAt(x, z, raised), z);
    }
    if (i < segments)
      for (let cross = 0; cross < crossSegments; cross++) {
        const a = i * (crossSegments + 1) + cross;
        indices.push(
          a, a + crossSegments + 1, a + 1,
          a + 1, a + crossSegments + 1, a + crossSegments + 2,
        );
      }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.52, metalness: 0.08, side: THREE.DoubleSide }),
  );
}
function makeHydrology(group, raised) {
  group.add(
    ribbonAlongZ(raised, 3.4, (x, z, relief) => landscapeHeight(x, z, relief) + 0.025, 0xb4a58a, 8),
  );
  const water = ribbonAlongZ(
    raised,
    2.2,
    (_x, z, relief) => relief ? riverWaterHeight(z) : 0.032,
    0x388fb2,
  );
  water.material.roughness = 0.24;
  water.material.metalness = 0.18;
  group.add(water);
}
export function highwayDeckHeight(x, raised = true) {
  const z = highwayZ(x);
  const ground = Math.max(
    landscapeHeight(x, z - 4.9, raised),
    landscapeHeight(x, z + 4.9, raised),
    landscapeHeight(x, z, raised),
  ) + 0.09;
  const fromBridge = Math.abs(x - riverX(z));
  const bridge = 1 - THREE.MathUtils.smoothstep(fromBridge, 7, 17);
  return Math.max(ground, (raised ? riverWaterHeight(z) : 0) + 1.9 * bridge);
}
function roadRibbon(raised, halfWidth, lift, color, start = -extent, end = extent, step = 0.65) {
  const vertices = [], indices = [];
  const segments = Math.ceil((end - start) / step);
  for (let i = 0; i <= segments; i++) {
    const x = start + ((end - start) * i) / segments;
    const z = highwayZ(x), y = highwayDeckHeight(x, raised) + lift;
    vertices.push(x, y, z - halfWidth, x, y, z + halfWidth);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide }),
  );
}
function makeRoads(group, raised) {
  group.add(roadRibbon(raised, 6.1, 0, 0x777a70));
  group.add(roadRibbon(raised, 5.2, 0.016, 0x353b3d));
  const markings = { white: { vertices: [], indices: [] }, yellow: { vertices: [], indices: [] } };
  const addMark = (x0, x1, offset, width, kind) => {
    const { vertices, indices } = markings[kind];
    const first = vertices.length / 3;
    for (const x of [x0, x1]) {
      const z = highwayZ(x) + offset;
      const y = highwayDeckHeight(x, raised) + 0.025;
      vertices.push(x, y, z - width / 2, x, y, z + width / 2);
    }
    indices.push(first, first + 1, first + 2, first + 1, first + 3, first + 2);
  };
  for (let x = -extent; x < extent; x += 5.5) {
    for (const side of [-2.55, 2.55])
      addMark(x, Math.min(extent, x + 3.2), side, 0.12, "white");
  }
  for (let x = -extent; x < extent; x += 1.5) {
    for (const side of [-4.75, 4.75])
      addMark(x, Math.min(extent, x + 1.5), side, 0.11, "white");
    for (const side of [-0.14, 0.14])
      addMark(x, Math.min(extent, x + 1.5), side, 0.1, "yellow");
  }
  for (const [kind, { vertices, indices }] of Object.entries(markings)) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    group.add(new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: kind === "white" ? 0xe9e7d7 : 0xe5bd58,
        side: THREE.DoubleSide,
      }),
    ));
  }
  const crossing = riverX(highwayZ(0));
  for (const side of [-5.75, 5.75]) {
    const vertices = [], indices = [], railPoints = [];
    const segments = 45, start = crossing - 16, end = crossing + 16;
    for (let i = 0; i <= segments; i++) {
      const x = start + ((end - start) * i) / segments;
      const y = highwayDeckHeight(x, raised);
      const z = highwayZ(x) + side;
      vertices.push(x, y + 0.02, z, x, y - 0.33, z);
      railPoints.push(new THREE.Vector3(x, y + 0.78, z));
      if (i < segments) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const sideGeometry = new THREE.BufferGeometry();
    sideGeometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    sideGeometry.setIndex(indices);
    sideGeometry.computeVertexNormals();
    group.add(new THREE.Mesh(
      sideGeometry,
      new THREE.MeshStandardMaterial({ color: 0xadafa9, roughness: 0.95, side: THREE.DoubleSide }),
    ));
    group.add(new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPoints), segments, 0.065, 6),
      new THREE.MeshStandardMaterial({ color: 0xd1d7d5, metalness: 0.4, roughness: 0.48 }),
    ));
  }
  for (const offset of [-7, 0, 7]) {
    const x = crossing + offset;
    const z = highwayZ(x);
    const ground = landscapeHeight(x, z, raised);
    const deck = highwayDeckHeight(x, raised);
    if (deck - ground < 0.5) continue;
    for (const side of [-4.5, 4.5]) {
      const support = new THREE.Mesh(
        new THREE.CylinderGeometry(0.33, 0.42, deck - ground, 8),
        new THREE.MeshStandardMaterial({ color: 0xa7a9a1, roughness: 0.95 }),
      );
      support.position.set(x, (ground + deck) / 2, z + side);
      group.add(support);
    }
  }
}
function makeFloodplain(group, raised) {
  const vertices = [], indices = [];
  const step = 2, width = 18;
  for (let z = -extent; z < extent; z += step)
    for (let offset = -width; offset < width; offset += step) {
      const centerX = riverX(z + step / 2) + offset + step / 2;
      if (!floodplainAt(centerX, z + step / 2)) continue;
      const first = vertices.length / 3;
      for (const [x, zz] of [
        [riverX(z) + offset, z], [riverX(z) + offset + step, z],
        [riverX(z + step) + offset, z + step],
        [riverX(z + step) + offset + step, z + step],
      ]) vertices.push(x, landscapeHeight(x, zz, raised) + 0.11, zz);
      indices.push(first, first + 2, first + 1, first + 1, first + 2, first + 3);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: 0x62d5ea, transparent: true, opacity: 0.34,
    side: THREE.DoubleSide, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2,
  })));
}
function makeBoundaries(group, raised) {
  for (const [path, vertical] of [
    [(t) => [boundaryX(t), t], true],
    [(t) => [t, boundaryZ(t)], false],
  ]) {
    const vertices = [], indices = [];
    for (let t = -extent; t < extent - 3; t += 7) {
      const first = vertices.length / 3;
      for (const value of [t, t + 4]) {
        const [x, z] = path(value);
        for (const sign of [-1, 1]) {
          const px = x + (vertical ? 0.32 * sign : 0);
          const pz = z + (vertical ? 0 : 0.32 * sign);
          vertices.push(px, landscapeHeight(px, pz, raised) + 0.23, pz);
        }
      }
      indices.push(first, first + 2, first + 1, first + 1, first + 2, first + 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: 0xf2c5ff, side: THREE.DoubleSide, depthWrite: false,
    })));
  }
}

export class LayerExperience {
  constructor(scene, onChange, onEvent = () => {}) {
    this.scene = scene;
    this.onChange = onChange;
    this.onEvent = onEvent;
    this.previousBackground = scene.background;
    this.previousFog = scene.fog;
    if (scene.background !== null) {
      scene.background = new THREE.Color(0xa8c8ca);
      scene.fog = new THREE.Fog(0xa8c8ca, 150, 470);
    }
    this.selected = new Set();
    this.elapsed = 0;
    this.finished = false;
    this.lastLayer = null;
    this.reveal = null;
    this.view = "map";
    this.group = new THREE.Group();
    scene.add(this.group);
    this.clipboard = new THREE.Group();
    this.clipboard.scale.setScalar(0.24);
    this.clipboard.visible = false;
    scene.add(this.clipboard);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 2.25, 0.07),
      new THREE.MeshBasicMaterial({ color: 0x143441 }),
    );
    board.position.z = -0.07;
    this.clipboard.add(board);
    const clip = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.12, 0.055),
      new THREE.MeshBasicMaterial({ color: 0xb8c9c9 }),
    );
    clip.position.set(0, 1.12, 0.01);
    this.clipboard.add(clip);
    this.ui = new THREE.Group();
    this.clipboard.add(this.ui);
    this.ground = {};
    this.variants = {};
    for (const [name, raised] of [
      ["flat", false],
      ["raised", true],
    ]) {
      const world = new THREE.Group();
      this.group.add(world);
      this.variants[name] = { world };
      const groundMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        side: THREE.DoubleSide,
      });
      const ground = new THREE.Mesh(surfaceGeometry(raised), groundMaterial);
      world.add(ground, new THREE.Mesh(outerTerrainGeometry(raised), groundMaterial));
      this.ground[name] = ground;
      if (raised) {
        // Controller targeting does not need the 400-cell visual terrain.
        this.pickGround = new THREE.Mesh(
          surfaceGeometry(true, 96),
          new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
        );
        this.pickGround.visible = false;
        world.add(this.pickGround);
      }
      for (const key of LAYER_KEYS.filter((k) => k !== "topography")) {
        const layer = new THREE.Group();
        world.add(layer);
        this.variants[name][key] = layer;
        if (key === "vegetation") makeTrees(layer, raised);
        if (key === "hydrology") makeHydrology(layer, raised);
        if (key === "roads") makeRoads(layer, raised);
        if (key === "floodplain") makeFloodplain(layer, raised);
        if (key === "boundaries") makeBoundaries(layer, raised);
      }
    }
    this.group.add(new THREE.HemisphereLight(0xe6f7ff, 0x344849, 2));
    const sun = new THREE.DirectionalLight(0xffe7bb, 2.5);
    sun.position.set(-7, 12, 5);
    this.group.add(sun);
    this.applyVisibility();
  }
  place(camera) {
    const p = new THREE.Vector3();
    camera.getWorldPosition(p);
    this.group.position.set(p.x, p.y - 1.6, p.z);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.getWorldQuaternion(new THREE.Quaternion()),
    );
    this.group.rotation.y = Math.atan2(-forward.x, -forward.z) - 0.25;
  }
  turn(angle, camera) {
    if (!angle) return;
    const pivot = camera.getWorldPosition(new THREE.Vector3());
    const offset = this.group.position.clone().sub(pivot);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    this.group.position.x = pivot.x + offset.x;
    this.group.position.z = pivot.z + offset.z;
    this.group.rotation.y += angle;
  }
  updateClipboard(leftGrip, camera, preview = false) {
    if (!leftGrip && !preview) {
      this.clipboard.visible = false;
      return;
    }
    if (preview) {
      camera.updateWorldMatrix(true, false);
      this.clipboard.position.copy(
        camera.localToWorld(new THREE.Vector3(0, -0.2, -1.3)),
      );
    } else {
      leftGrip.updateWorldMatrix(true, false);
      this.clipboard.position.copy(
        leftGrip.localToWorld(new THREE.Vector3(-0.08, 0.02, -0.18)),
      );
    }
    camera.getWorldPosition(this._viewPosition ??= new THREE.Vector3());
    const away = this.clipboard.position.clone().sub(this._viewPosition);
    if (away.lengthSq() < 0.85 ** 2)
      this.clipboard.position.copy(this._viewPosition).addScaledVector(
        away.lengthSq() > 0.0001 ? away.normalize() : new THREE.Vector3(0, -0.3, -1).normalize(),
        0.85,
      );
    this.clipboard.lookAt(this._viewPosition);
    this.clipboard.visible = true;
    this.clipboard.updateWorldMatrix(true, true);
  }
  toggle(key) {
    if (!LAYER_KEYS.includes(key) || this.finished) return;
    if (this.reveal) {
      for (const variant of Object.values(this.variants))
        if (this.reveal.key !== "topography") variant[this.reveal.key].scale.y = 1;
      if (this.reveal.key === "topography") this.variants.raised.world.scale.y = 1;
      this.reveal = null;
    }
    if (this.selected.has(key)) this.selected.delete(key);
    else {
      this.selected.add(key);
      this.reveal = { key, elapsed: 0 };
    }
    this.lastLayer = key;
    this.applyVisibility();
    this.onEvent("layer");
    this.onChange();
  }
  applyVisibility() {
    const active = this.selected.has("topography") ? "raised" : "flat";
    for (const [name, variant] of Object.entries(this.variants)) {
      variant.world.visible = name === active;
      for (const key of LAYER_KEYS.filter((k) => k !== "topography"))
        variant[key].visible = this.selected.has(key);
    }
  }
  reset() {
    this.selected.clear();
    this.lastLayer = null;
    this.reveal = null;
    for (const variant of Object.values(this.variants)) {
      variant.world.scale.y = 1;
      for (const key of LAYER_KEYS.slice(1)) variant[key].scale.y = 1;
    }
    this.elapsed = 0;
    this.finished = false;
    this.applyVisibility();
    this.onChange();
  }
  update(dt) {
    if (this.reveal) {
      this.reveal.elapsed += dt;
      const { key, elapsed } = this.reveal;
      const amount = 0.02 + 0.98 * (1 - (1 - Math.min(1, elapsed / 0.8)) ** 3);
      for (const variant of Object.values(this.variants))
        if (key !== "topography") variant[key].scale.y = amount;
      if (key === "topography") this.variants.raised.world.scale.y = amount;
      if (elapsed >= 0.8) this.reveal = null;
    }
    if (this.finished) return;
    this.elapsed += dt;
    if (this.elapsed >= 240) {
      this.finished = true;
      this.onChange();
    }
  }
  dispose() {
    this.scene.background = this.previousBackground;
    this.scene.fog = this.previousFog;
    for (const group of [this.group, this.clipboard]) {
      group.removeFromParent();
      group.traverse((obj) => {
        obj.geometry?.dispose();
        if (obj.material)
          for (const material of Array.isArray(obj.material)
            ? obj.material
            : [obj.material]) {
            material.map?.dispose();
            material.dispose();
          }
      });
    }
  }
}
