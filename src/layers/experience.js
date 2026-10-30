import * as THREE from "three";
import { climbHand, climbPushOff, sampleClimbHand } from "../climb/fling.js";

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
  topography: "Digital elevation model (DEM): a grid of ground heights.",
  vegetation: "Land cover: trees mark shade, habitat, and clearings.",
  hydrology: "Hydrography: the river follows low ground to its outlet.",
  roads: "Road network: a four-lane highway bridges the river.",
  floodplain: "Floodplain: low river land; hazard maps also use water levels.",
  boundaries: "Jurisdictions: district lines organize people and services.",
};
export const LANDSCAPE_EXTENT = 160;
export const TELEPORT_MAX_DISTANCE = 120;
const extent = LANDSCAPE_EXTENT;
export const riverX = (z) =>
  7 + 3.5 * Math.sin(z * 0.018) + 1.1 * Math.sin(z * 0.065);
export const riverWaterHeight = (z) => -0.8 - 0.008 * z;
export const highwayZ = (x) =>
  -22 + 2.6 * Math.sin(x * 0.025) + 0.9 * Math.sin(x * 0.08);
const ROAD_EDGE = 6.1;
const SHOULDER_EDGE = 9;
const BRIDGE_ACCESS_STEP = 0.55;
const BRIDGE_HALF_LENGTH = 16;
const BRIDGE_SLAB_DEPTH = 0.48;
const BRIDGE_HEAD_CLEARANCE = 0.12;
const BRIDGE_SUPPORT_RADIUS = 0.42;
const VISITOR_SUPPORT_RADIUS = 0.22;
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
const TREE_CELL_SIZE = 6;
const VISITOR_TREE_RADIUS = 0.22;
const treeCells = new Map();
for (const tree of TREE_POSITIONS) {
  const key = `${Math.floor(tree.x / TREE_CELL_SIZE)},${Math.floor(tree.z / TREE_CELL_SIZE)}`;
  if (!treeCells.has(key)) treeCells.set(key, []);
  treeCells.get(key).push(tree);
}
function treesNear(x, z) {
  const cx = Math.floor(x / TREE_CELL_SIZE);
  const cz = Math.floor(z / TREE_CELL_SIZE);
  const result = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
    result.push(...(treeCells.get(`${cx + dx},${cz + dz}`) ?? []));
  return result;
}
function makeTrees(group, raised) {
  const deciduous = TREE_POSITIONS.filter((p) => !p.evergreen);
  const evergreen = TREE_POSITIONS.filter((p) => p.evergreen);
  const trunk = new THREE.InstancedMesh(
    // Bury the visible trunk end inside the foliage; climbing still reaches the canopy.
    new THREE.CylinderGeometry(0.11, 0.18, 1, 6),
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
    const trunkHeight = 3.3 * scale;
    temp.position.set(x, y + trunkHeight / 2, z);
    temp.scale.set(scale, trunkHeight, scale);
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
    landscapeHeight(x, z - ROAD_EDGE, raised),
    landscapeHeight(x, z - 3, raised),
    landscapeHeight(x, z, raised),
    landscapeHeight(x, z + 3, raised),
    landscapeHeight(x, z + ROAD_EDGE, raised),
  ) + 0.09;
  const fromBridge = Math.abs(x - riverX(z));
  const bridge = 1 - THREE.MathUtils.smoothstep(fromBridge, 10, 34);
  const bridgeTop = raised ? riverWaterHeight(z) + 3.2 : 3.2 * bridge;
  // Blend the approach into the deck without a sharp low spot at either end.
  const transition = 0.4;
  const overlap = Math.max(0, transition - Math.abs(ground - bridgeTop));
  return Math.max(ground, bridgeTop) + overlap * overlap / (4 * transition);
}
const bridgeSupportCache = new Map();
function bridgeSupports(raised) {
  if (!bridgeSupportCache.has(raised)) {
    const crossing = riverX(highwayZ(0));
    const supports = [];
    for (const offset of [-7, 0, 7]) {
      const x = crossing + offset;
      const deck = highwayDeckHeight(x, raised);
      for (const side of [-4.5, 4.5]) {
        const z = highwayZ(x) + side;
        const ground = landscapeHeight(x, z, raised);
        if (deck - ground >= 0.5) supports.push({ x, z, ground, deck });
      }
    }
    bridgeSupportCache.set(raised, supports);
  }
  return bridgeSupportCache.get(raised);
}
function shoulderWidthAt(x) {
  const fromBridge = Math.abs(x - riverX(highwayZ(x)));
  const t = THREE.MathUtils.smoothstep(fromBridge, 16, 26);
  return THREE.MathUtils.lerp(ROAD_EDGE, SHOULDER_EDGE, t);
}
function shoulderOuterHeight(x, side, raised) {
  const z = highwayZ(x) + side * shoulderWidthAt(x);
  const fromBridge = Math.abs(x - riverX(highwayZ(x)));
  const approach = THREE.MathUtils.smoothstep(fromBridge, 16, 26);
  return THREE.MathUtils.lerp(
    highwayDeckHeight(x, raised) - 0.08,
    landscapeHeight(x, z, raised) - 0.06,
    approach,
  );
}
// Null outside the highway. A visitor below the bridge only adopts this
// elevated surface after entering from a shoulder connected to the ground.
export function highwayWalkingHeight(x, z, raised = true) {
  const offset = z - highwayZ(x);
  const distance = Math.abs(offset);
  const shoulderWidth = shoulderWidthAt(x);
  if (distance > shoulderWidth) return null;
  const deck = highwayDeckHeight(x, raised);
  if (distance <= ROAD_EDGE) return deck;
  const outer = shoulderOuterHeight(x, Math.sign(offset), raised);
  const t = (distance - ROAD_EDGE) / (shoulderWidth - ROAD_EDGE);
  return Math.max(landscapeHeight(x, z, raised), THREE.MathUtils.lerp(deck, outer, t));
}
// Below the deck, the river span is open; the road approaches are solid fill.
// Keep an avatar's head clear of the concrete slab before allowing movement.
export function canWalkBelowRoad(x, z, eyeHeight, raised = true, scaleY = 1) {
  const offset = z - highwayZ(x);
  const shoulder = shoulderWidthAt(x);
  if (Math.abs(offset) > shoulder + 0.25) return true;
  const roadZ = highwayZ(x) + Math.sign(offset) * Math.min(Math.abs(offset), shoulder);
  const road = highwayWalkingHeight(x, roadZ, raised) * scaleY;
  const ground = landscapeHeight(x, z, raised) * scaleY;
  if (road - ground <= BRIDGE_ACCESS_STEP) return true;
  const crossing = riverX(highwayZ(0));
  if (Math.abs(x - crossing) >= BRIDGE_HALF_LENGTH) return false;
  const underside = (highwayDeckHeight(x, raised) - BRIDGE_SLAB_DEPTH) * scaleY;
  return ground + eyeHeight + BRIDGE_HEAD_CLEARANCE <= underside;
}
function roadShoulderRibbon(raised) {
  const vertices = [], indices = [];
  const segments = Math.ceil((2 * extent) / 0.65);
  const crossing = riverX(highwayZ(0));
  for (let i = 0; i <= segments; i++) {
    const x = -extent + (2 * extent * i) / segments;
    const centerZ = highwayZ(x);
    const deck = highwayDeckHeight(x, raised);
    const offsets = [-shoulderWidthAt(x), -ROAD_EDGE, ROAD_EDGE, shoulderWidthAt(x)];
    for (const [cross, offset] of offsets.entries())
      vertices.push(
        x,
        cross === 0 || cross === 3
          ? shoulderOuterHeight(x, Math.sign(offset), raised)
          : deck,
        centerZ + offset,
      );
    const middleX = -extent + (2 * extent * (i + 0.5)) / segments;
    if (i < segments && Math.abs(middleX - crossing) >= 16)
      for (let strip = 0; strip < offsets.length - 1; strip++) {
        const a = i * offsets.length + strip;
        const b = a + offsets.length;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x777a70, roughness: 0.9, side: THREE.DoubleSide }),
  );
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
function concreteQuad(vertices, indices, a, b, c, d) {
  const first = vertices.length / 3;
  vertices.push(...a, ...b, ...c, ...d);
  indices.push(first, first + 1, first + 2,
    first + 1, first + 3, first + 2);
}
function concreteMesh(vertices, indices, role) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: 0xa4a6a0, roughness: 0.94, side: THREE.DoubleSide,
  }));
  mesh.userData.role = role;
  return mesh;
}
function bridgeConcrete(raised, crossing) {
  const slabVertices = [], slabIndices = [];
  const start = crossing - BRIDGE_HALF_LENGTH;
  const end = crossing + BRIDGE_HALF_LENGTH;
  const segments = Math.ceil((end - start) / 0.65);
  for (let i = 0; i < segments; i++) {
    const x0 = start + (end - start) * i / segments;
    const x1 = start + (end - start) * (i + 1) / segments;
    const crossSection = (x) => {
      const z = highwayZ(x), deck = highwayDeckHeight(x, raised);
      return {
        topLeft: [x, deck - 0.012, z - ROAD_EDGE],
        topRight: [x, deck - 0.012, z + ROAD_EDGE],
        bottomLeft: [x, deck - BRIDGE_SLAB_DEPTH, z - ROAD_EDGE],
        bottomRight: [x, deck - BRIDGE_SLAB_DEPTH, z + ROAD_EDGE],
      };
    };
    const a = crossSection(x0), b = crossSection(x1);
    concreteQuad(slabVertices, slabIndices,
      a.bottomLeft, a.bottomRight, b.bottomLeft, b.bottomRight);
    concreteQuad(slabVertices, slabIndices,
      a.topLeft, a.bottomLeft, b.topLeft, b.bottomLeft);
    concreteQuad(slabVertices, slabIndices,
      a.bottomRight, a.topRight, b.bottomRight, b.topRight);
  }
  const embankmentVertices = [], embankmentIndices = [];
  for (const bank of [-1, 1])
    for (const side of [-1, 1]) {
      const sections = 32;
      const at = (i) => {
        const distance = BRIDGE_HALF_LENGTH + (36 - BRIDGE_HALF_LENGTH) * i / sections;
        const x = crossing + bank * distance;
        const fade = 1 - THREE.MathUtils.smoothstep(distance, BRIDGE_HALF_LENGTH, 36);
        const z = highwayZ(x);
        const top = highwayDeckHeight(x, raised) - 0.018;
        const outerZ = z + side * (ROAD_EDGE + 0.95 * fade);
        const ground = landscapeHeight(x, outerZ, raised) - 0.06;
        return { top: [x, top, z + side * ROAD_EDGE],
          bottom: [x, THREE.MathUtils.lerp(top, ground, fade), outerZ] };
      };
      for (let i = 0; i < sections; i++) {
        const a = at(i), b = at(i + 1);
        concreteQuad(embankmentVertices, embankmentIndices,
          a.top, a.bottom, b.top, b.bottom);
      }
    }
  const abutmentVertices = [], abutmentIndices = [];
  for (const x of [start, end]) {
    const sections = 24;
    const at = (i) => {
      const z = highwayZ(x) - ROAD_EDGE + 2 * ROAD_EDGE * i / sections;
      return { top: [x, highwayDeckHeight(x, raised) - BRIDGE_SLAB_DEPTH, z],
        bottom: [x, landscapeHeight(x, z, raised) - 0.08, z] };
    };
    for (let i = 0; i < sections; i++) {
      const a = at(i), b = at(i + 1);
      concreteQuad(abutmentVertices, abutmentIndices,
        a.top, a.bottom, b.top, b.bottom);
    }
  }
  return [concreteMesh(slabVertices, slabIndices, "bridge-slab"),
    concreteMesh(embankmentVertices, embankmentIndices, "bridge-embankment"),
    concreteMesh(abutmentVertices, abutmentIndices, "bridge-abutment")];
}
function makeRoads(group, raised) {
  group.add(roadShoulderRibbon(raised));
  group.add(roadRibbon(raised, 5.2, 0.016, 0x353b3d));
  const crossing = riverX(highwayZ(0));
  group.add(roadRibbon(raised, ROAD_EDGE, -0.012, 0xa4a6a0,
    crossing - BRIDGE_HALF_LENGTH, crossing + BRIDGE_HALF_LENGTH));
  group.add(...bridgeConcrete(raised, crossing));
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
  for (const { x, z, ground, deck } of bridgeSupports(raised)) {
    const support = new THREE.Mesh(
      new THREE.CylinderGeometry(0.33, BRIDGE_SUPPORT_RADIUS, deck - ground, 8),
      new THREE.MeshStandardMaterial({ color: 0xa7a9a1, roughness: 0.95 }),
    );
    support.userData.role = "bridge-support";
    support.position.set(x, (ground + deck) / 2, z);
    group.add(support);
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
    this.started = false;
    this.finished = false;
    this.lastLayer = null;
    this.reveal = null;
    this.view = "map";
    // The pixel and viewshed demos inherit this landscape but keep their own interactions.
    this.treeInteractions = this.constructor === LayerExperience;
    this.treeClimbHands = new Map();
    this.treeClimbTree = null;
    this.treeFlingVelocity = null;
    this.treeFlingCandidate = null;
    this.treeClimbHeight = 0;
    this.treeClimbGroundY = 0;
    this.treeClimbLimit = 0;
    this.treeFallSpeed = 0;
    this.visitor = new THREE.Vector2();
    this.onRoad = false;
    this.fallingFromRoad = false;
    this.fallVelocity = 0;
    this.eyeHeight = 1.6;
    this.visitorMarkers = [];
    this.floorY = 0;
    this.walkForward = new THREE.Vector3();
    this.group = new THREE.Group();
    scene.add(this.group);
    this.clipboard = new THREE.Group();
    this.clipboardBaseScale = 0.24;
    this.clipboard.scale.setScalar(this.clipboardBaseScale);
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
      } else {
        this.pickFlatGround = new THREE.Mesh(
          new THREE.PlaneGeometry(2 * extent, 2 * extent),
          new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
        );
        this.pickFlatGround.rotation.x = -Math.PI / 2;
        this.pickFlatGround.visible = false;
        world.add(this.pickFlatGround);
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
    this.cancelTreeClimb();
    const p = new THREE.Vector3();
    camera.getWorldPosition(p);
    this.floorY = p.y - 1.6;
    this.group.position.set(p.x, this.floorY, p.z);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.getWorldQuaternion(new THREE.Quaternion()),
    );
    this.group.rotation.y = Math.atan2(-forward.x, -forward.z) - 0.25;
    this.visitor.set(0, 0);
    this.onRoad = false;
    this.fallingFromRoad = false;
    this.fallVelocity = 0;
    this.eyeHeight = 1.6;
    this.updateVisitorMarkers();
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
  walkHeightAt(x, z, raised) {
    return landscapeHeight(x, z, raised);
  }
  treePointClear(x, z, fromX = null, fromZ = null) {
    if (!this.treeInteractions || !this.selected.has("vegetation")) return true;
    for (const tree of treesNear(x, z)) {
      const radius = VISITOR_TREE_RADIUS + 0.18 * tree.scale;
      const distance = Math.hypot(x - tree.x, z - tree.z);
      if (distance >= radius) continue;
      // If a layer is switched on around the visitor, let them walk out.
      if (fromX !== null && distance >=
          Math.hypot(fromX - tree.x, fromZ - tree.z) - 1e-6) continue;
      return false;
    }
    return true;
  }
  bridgeSupportPointClear(x, z, fromX = null, fromZ = null,
    raised = true, scaleY = 1, onRoad = this.onRoad) {
    if (onRoad || !this.selected.has("roads")) return true;
    const height = this.walkHeightAt(x, z, raised) * scaleY;
    for (const support of bridgeSupports(raised)) {
      if (height + this.eyeHeight < support.ground * scaleY ||
          height > support.deck * scaleY) continue;
      const radius = BRIDGE_SUPPORT_RADIUS + VISITOR_SUPPORT_RADIUS;
      const distance = Math.hypot(x - support.x, z - support.z);
      if (distance >= radius) continue;
      // A visitor already overlapping a support can always move away from it.
      if (fromX !== null && distance >=
          Math.hypot(fromX - support.x, fromZ - support.z) - 1e-6) continue;
      return false;
    }
    return true;
  }
  walkPointClear(x, z, fromX, fromZ, raised, scaleY, roadsReady) {
    return this.treePointClear(x, z, fromX, fromZ) &&
      (!roadsReady || this.bridgeSupportPointClear(
        x, z, fromX, fromZ, raised, scaleY));
  }
  resolveObstacleWalk(startX, startZ, desiredX, desiredZ, raised, scaleY, roadsReady) {
    if ((!this.treeInteractions || !this.selected.has("vegetation")) && !roadsReady)
      return { x: desiredX, z: desiredZ };
    const steps = Math.max(1, Math.ceil(Math.hypot(desiredX - startX,
      desiredZ - startZ) / 0.1));
    const dx = (desiredX - startX) / steps;
    const dz = (desiredZ - startZ) / steps;
    let x = startX, z = startZ;
    for (let step = 0; step < steps; step++) {
      if (this.walkPointClear(x + dx, z + dz, x, z, raised, scaleY, roadsReady)) {
        x += dx;
        z += dz;
      } else if (this.walkPointClear(x + dx, z, x, z, raised, scaleY, roadsReady)) x += dx;
      else if (this.walkPointClear(x, z + dz, x, z, raised, scaleY, roadsReady)) z += dz;
    }
    return { x, z };
  }
  get isClimbingTree() {
    return this.treeInteractions &&
      (this.treeClimbHands.size > 0 || this.treeClimbHeight > 0 ||
        this.treeFlingVelocity !== null);
  }
  gripTree(id, handWorld) {
    if (!this.treeInteractions || !this.started || this.finished ||
        !this.selected.has("vegetation") || this.treeFlingVelocity) return false;
    const local = this.group.worldToLocal(handWorld.clone());
    const raised = this.selected.has("topography");
    const scaleY = (raised ? this.variants.raised : this.variants.flat).world.scale.y;
    const candidates = this.treeClimbTree ? [this.treeClimbTree] : treesNear(local.x, local.z);
    const tree = candidates.find((candidate) => {
      const ground = landscapeHeight(candidate.x, candidate.z, raised) * scaleY;
      const canopy = (candidate.evergreen ? 4.3 : 3.8) * candidate.scale * scaleY;
      return Math.hypot(local.x - candidate.x, local.z - candidate.z) <=
        0.18 * candidate.scale + 0.25 &&
        local.y >= ground - 0.15 && local.y <= ground + canopy + 0.2;
    });
    if (!tree) return false;
    const startingClimb = !this.isClimbingTree;
    if (!this.treeClimbTree) {
      this.treeClimbTree = tree;
      this.treeClimbGroundY = this.group.position.y;
      const canopyTop = (tree.evergreen ? 4.3 : 3.8) * tree.scale * scaleY;
      this.treeClimbLimit = Math.max(0.5, canopyTop - this.eyeHeight + 0.35);
    }
    this.treeClimbHands.set(id, climbHand(handWorld));
    this.treeFlingCandidate = null;
    this.treeFallSpeed = 0;
    this.clipboard.visible = false;
    if (startingClimb) this.onChange();
    return true;
  }
  releaseTree(id, handWorld = null, allowFling = true) {
    const hand = this.treeClimbHands.get(id);
    const anchor = this.treeClimbTree &&
      new THREE.Vector2(this.treeClimbTree.x, this.treeClimbTree.z);
    const impulse = allowFling && anchor &&
      climbPushOff(hand, handWorld, this.group, anchor, this.visitor);
    this.treeClimbHands.delete(id);
    if (impulse && (!this.treeFlingCandidate ||
        impulse.strength > this.treeFlingCandidate.impulse.strength))
      this.treeFlingCandidate = { impulse, time: this.elapsed };
    if (this.treeClimbHands.size) return;
    const candidate = this.treeFlingCandidate;
    this.treeFlingCandidate = null;
    if (allowFling && candidate && this.elapsed - candidate.time < 0.16) {
      this.treeFlingVelocity = candidate.impulse.horizontal;
      this.treeFallSpeed = -candidate.impulse.up;
      this.onEvent("fling");
    } else this.treeFallSpeed = 0;
  }
  updateTreeClimb(poses, dt, camera) {
    if (!this.treeInteractions || !this.isClimbingTree) return;
    if (!this.started || this.finished || !this.selected.has("vegetation")) {
      this.cancelTreeClimb();
      return;
    }
    const pulls = [];
    for (const [id, hand] of this.treeClimbHands) {
      const matrix = poses.get(id);
      if (!matrix) { this.treeClimbHands.delete(id); continue; }
      const position = new THREE.Vector3().setFromMatrixPosition(matrix);
      pulls.push(sampleClimbHand(hand, position, dt));
    }
    if (this.treeFlingVelocity) {
      const raised = this.selected.has("topography");
      const scaleY = (raised ? this.variants.raised : this.variants.flat).world.scale.y;
      const oldGround = this.walkHeightAt(this.visitor.x, this.visitor.y, raised) * scaleY;
      const desiredX = THREE.MathUtils.clamp(this.visitor.x + this.treeFlingVelocity.x * dt,
        -extent + 4, extent - 4);
      const desiredZ = THREE.MathUtils.clamp(this.visitor.y + this.treeFlingVelocity.y * dt,
        -extent + 4, extent - 4);
      const next = this.resolveObstacleWalk(this.visitor.x, this.visitor.y,
        desiredX, desiredZ, raised, scaleY, this.selected.has("roads"));
      const nextGround = this.walkHeightAt(next.x, next.z, raised) * scaleY;
      if (nextGround > oldGround + this.treeClimbHeight) {
        next.x = this.visitor.x;
        next.z = this.visitor.y;
        this.treeFlingVelocity.set(0, 0);
      }
      const dx = next.x - this.visitor.x, dz = next.z - this.visitor.y;
      const c = Math.cos(this.group.rotation.y), s = Math.sin(this.group.rotation.y);
      this.group.position.x -= c * dx + s * dz;
      this.group.position.z -= -s * dx + c * dz;
      this.visitor.set(next.x, next.z);
      const ground = this.walkHeightAt(next.x, next.z, raised) * scaleY;
      this.treeClimbHeight = Math.max(0, this.treeClimbHeight + oldGround - ground);
      this.treeClimbGroundY = this.floorY - ground;
      this.treeFlingVelocity.multiplyScalar(Math.exp(-1.8 * dt));
      this.updateVisitorMarkers();
    }
    if (pulls.length) {
      const pull = pulls.reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a, 0);
      this.treeClimbHeight = THREE.MathUtils.clamp(
        this.treeClimbHeight + pull, 0, this.treeClimbLimit);
      this.treeFallSpeed = 0;
    } else if (this.treeClimbHeight > 0 || this.treeFlingVelocity) {
      this.treeFallSpeed = Math.min(14, this.treeFallSpeed + 13 * dt);
      this.treeClimbHeight = Math.max(0,
        this.treeClimbHeight - this.treeFallSpeed * dt);
    }
    this.group.position.y = this.treeClimbGroundY - this.treeClimbHeight;
    if (!this.treeClimbHands.size && this.treeClimbHeight === 0) {
      this.treeFlingVelocity = null;
      this.treeFlingCandidate = null;
      this.treeClimbTree = null;
      this.treeFallSpeed = 0;
      this.walk(0, 0, 0, camera);
      this.onChange();
    }
  }
  cancelTreeClimb() {
    if (this.treeClimbTree) this.group.position.y = this.treeClimbGroundY;
    this.treeClimbHands.clear();
    this.treeFlingVelocity = null;
    this.treeFlingCandidate = null;
    this.treeClimbTree = null;
    this.treeClimbHeight = 0;
    this.treeFallSpeed = 0;
  }
  teleportCandidate(raycaster, uiHit = null) {
    if (!this.started || this.finished || this.isClimbingTree) return null;
    const raised = this.selected.has("topography");
    const variant = raised ? this.variants.raised : this.variants.flat;
    const pick = raised ? this.pickGround : this.pickFlatGround;
    pick.updateWorldMatrix(true, false);
    const groundHit = raycaster.intersectObject(pick, false)[0];
    const roadMesh = this.selected.has("roads") && variant.roads.visible &&
      variant.roads.scale.y > 0.95 ? variant.roads.children[1] : null;
    roadMesh?.updateWorldMatrix(true, false);
    const roadHit = roadMesh && raycaster.intersectObject(roadMesh, false)[0];
    const roadFromAbove = roadHit && raycaster.ray.origin.y > roadHit.point.y + 0.1;
    const onRoad = !!roadFromAbove && (!groundHit || roadHit.distance < groundHit.distance);
    const hit = onRoad ? roadHit : groundHit;
    if (!hit || hit.distance > TELEPORT_MAX_DISTANCE || hit.distance < 1) return null;
    if (uiHit && uiHit.distance < hit.distance) return null;
    if (this.clipboard.visible) {
      const board = this.clipboard.children[0];
      board.updateWorldMatrix(true, false);
      const boardHit = raycaster.intersectObject(board, false)[0];
      if (boardHit && boardHit.distance < hit.distance) return null;
    }
    const local = this.group.worldToLocal(hit.point.clone());
    const limit = LANDSCAPE_EXTENT - 4;
    if (Math.abs(local.x) > limit || Math.abs(local.z) > limit) return null;
    const scaleY = variant.world.scale.y;
    const groundAt = (x, z) => this.walkHeightAt(x, z, raised) * scaleY;
    const surface = onRoad ? highwayWalkingHeight(local.x, local.z, raised) * scaleY
      : groundAt(local.x, local.z);
    const slope = onRoad ? 0 : Math.max(
      Math.abs(groundAt(local.x + 1, local.z) - surface),
      Math.abs(groundAt(local.x - 1, local.z) - surface),
      Math.abs(groundAt(local.x, local.z + 1) - surface),
      Math.abs(groundAt(local.x, local.z - 1) - surface),
    );
    const point = this.group.localToWorld(new THREE.Vector3(local.x, surface + 0.42, local.z));
    const clearBelow = onRoad || !roadMesh || canWalkBelowRoad(local.x, local.z,
      this.eyeHeight, raised, scaleY);
    return {
      x: local.x, z: local.z, point, distance: hit.distance,
      onRoad, valid: Number.isFinite(surface) && slope <= 1.2 && clearBelow &&
        this.treePointClear(local.x, local.z) &&
        this.bridgeSupportPointClear(local.x, local.z, null, null,
          raised, scaleY, onRoad),
    };
  }
  teleportTo(candidate, camera) {
    if (!this.started || this.finished || this.isClimbingTree || !candidate?.valid)
      return false;
    if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.z)) return false;
    const limit = LANDSCAPE_EXTENT - 4;
    if (Math.abs(candidate.x) > limit || Math.abs(candidate.z) > limit) return false;
    const eye = camera.getWorldPosition(new THREE.Vector3());
    const landing = this.group.localToWorld(new THREE.Vector3(candidate.x, 0, candidate.z));
    this.group.position.x += eye.x - landing.x;
    this.group.position.z += eye.z - landing.z;
    this.onRoad = candidate.onRoad;
    this.fallingFromRoad = false;
    this.fallVelocity = 0;
    this.walk(0, 0, 0, camera);
    return true;
  }
  walk(stickX, stickY, dt, camera) {
    if (this.isClimbingTree) return { distance: 0, wet: false };
    const eye = camera.getWorldPosition(new THREE.Vector3());
    const local = this.group.worldToLocal(eye.clone());
    const startX = this.visitor.x, startZ = this.visitor.y;
    const raised = this.selected.has("topography");
    const variant = raised ? this.variants.raised : this.variants.flat;
    const scaleY = variant.world.scale.y;
    const roadsReady = this.selected.has("roads") && variant.roads.scale.y > 0.95;
    const previousHeight = this.floorY - this.group.position.y;
    this.eyeHeight = THREE.MathUtils.clamp(local.y - previousHeight, 0.7, 2.2);
    let desiredX = local.x, desiredZ = local.z;
    const magnitude = Math.hypot(stickX, stickY);
    if (Number.isFinite(magnitude) && magnitude > 0.18 && dt > 0) {
      const strength = Math.min(1, (magnitude - 0.18) / 0.82);
      camera.getWorldDirection(this.walkForward);
      this.walkForward.y = 0;
      this.walkForward.normalize();
      const distance = 2.8 * strength * dt / magnitude;
      const worldX = (-this.walkForward.z * stickX - this.walkForward.x * stickY) * distance;
      const worldZ = (this.walkForward.x * stickX - this.walkForward.z * stickY) * distance;
      const c = Math.cos(this.group.rotation.y);
      const s = Math.sin(this.group.rotation.y);
      const dx = c * worldX - s * worldZ;
      const dz = s * worldX + c * worldZ;
      const limit = LANDSCAPE_EXTENT - 4;
      desiredX = THREE.MathUtils.clamp(local.x + dx, -limit, limit);
      desiredZ = THREE.MathUtils.clamp(local.z + dz, -limit, limit);
    }
    if (roadsReady && !this.onRoad &&
        !canWalkBelowRoad(desiredX, desiredZ, this.eyeHeight, raised, scaleY)) {
      const xOnly = canWalkBelowRoad(desiredX, startZ, this.eyeHeight, raised, scaleY);
      const zOnly = canWalkBelowRoad(startX, desiredZ, this.eyeHeight, raised, scaleY);
      if (xOnly && (!zOnly || Math.abs(desiredX - startX) >= Math.abs(desiredZ - startZ)))
        desiredZ = startZ;
      else if (zOnly) desiredX = startX;
      else { desiredX = startX; desiredZ = startZ; }
    }
    ({ x: desiredX, z: desiredZ } = this.resolveObstacleWalk(
      startX, startZ, desiredX, desiredZ, raised, scaleY, roadsReady));
    const c = Math.cos(this.group.rotation.y), s = Math.sin(this.group.rotation.y);
    const appliedX = desiredX - local.x, appliedZ = desiredZ - local.z;
    this.group.position.x -= c * appliedX + s * appliedZ;
    this.group.position.z -= -s * appliedX + c * appliedZ;
    local.x = desiredX;
    local.z = desiredZ;
    this.visitor.set(local.x, local.z);
    const ground = this.walkHeightAt(local.x, local.z, raised) * scaleY;
    const roadLocal = roadsReady
      ? highwayWalkingHeight(local.x, local.z, raised)
      : null;
    const road = roadLocal === null ? null : roadLocal * scaleY;
    const steppedOffRoad = Math.hypot(local.x - startX, local.z - startZ) > 0.01;
    if (this.onRoad && road === null && this.selected.has("roads") &&
        steppedOffRoad && previousHeight - ground > 0.45 && dt > 0) {
      this.fallingFromRoad = true;
      this.fallVelocity = 0;
    }
    if (road === null) this.onRoad = false;
    else if (!this.onRoad && road - ground <= BRIDGE_ACCESS_STEP) this.onRoad = true;
    const relief = this.onRoad ? road : ground;
    let height = relief;
    if (this.fallingFromRoad && !this.onRoad && dt > 0 && previousHeight > relief) {
      this.fallVelocity = Math.min(14, this.fallVelocity + 22 * dt);
      height = Math.max(relief, previousHeight - this.fallVelocity * dt);
    }
    if (height <= relief || this.onRoad) {
      this.fallingFromRoad = false;
      this.fallVelocity = 0;
    }
    this.group.position.y = this.floorY - height;
    this.updateVisitorMarkers();
    const waterLevel = (raised ? riverWaterHeight(local.z) : 0.032) * scaleY;
    const inWater = !this.onRoad && this.selected.has("hydrology") &&
      variant.hydrology.visible && variant.hydrology.scale.y > 0.95 &&
      Math.abs(local.x - riverX(local.z)) <= 2.2 && waterLevel > ground + 0.025;
    return {
      distance: Math.hypot(local.x - startX, local.z - startZ),
      wet: inWater,
    };
  }
  clearVisitorMarkers() {
    this.visitorMarkers.length = 0;
  }
  registerVisitorMarker(map, mapExtent, ring = false) {
    const marker = new THREE.Group();
    marker.position.z = 0.012;
    for (const [inner, outer, color, z] of ring ? [
      [0.025, 0.038, 0x17363d, 0],
      [0.028, 0.035, 0xffffff, 0.001],
    ] : [
      [0, 0.025, 0x17363d, 0],
      [0, 0.017, 0xffffff, 0.001],
    ]) {
      const circle = new THREE.Mesh(
        ring
          ? new THREE.RingGeometry(inner, outer, 24)
          : new THREE.CircleGeometry(outer, 20),
        new THREE.MeshBasicMaterial({ color, depthTest: false }),
      );
      circle.position.z = z;
      marker.add(circle);
    }
    map.add(marker);
    this.visitorMarkers.push({ marker, mapExtent, width: map.geometry.parameters.width });
    this.updateVisitorMarkers();
  }
  updateVisitorMarkers() {
    for (const { marker, mapExtent, width } of this.visitorMarkers) {
      marker.visible = Math.abs(this.visitor.x) <= mapExtent &&
        Math.abs(this.visitor.y) <= mapExtent;
      marker.position.x = (this.visitor.x / mapExtent) * width / 2;
      marker.position.y = -(this.visitor.y / mapExtent) * width / 2;
    }
  }
  updateClipboard(leftGrip, camera, preview = false, fallback = false) {
    if (!this.started || this.isClimbingTree) {
      this.clipboard.visible = false;
      return;
    }
    if (!leftGrip && !preview && !fallback) {
      this.clipboard.visible = false;
      return;
    }
    this.clipboard.scale.setScalar(this.clipboardBaseScale * (fallback ? 1.15 : 1));
    if (preview) {
      camera.updateWorldMatrix(true, false);
      this.clipboard.position.copy(
        camera.localToWorld(fallback
          ? new THREE.Vector3(-0.48, -0.22, -1.05)
          : new THREE.Vector3(0, -0.2, -1.3)),
      );
    } else if (leftGrip) {
      leftGrip.updateWorldMatrix(true, false);
      this.clipboard.position.copy(
        leftGrip.localToWorld(new THREE.Vector3(-0.08, 0.02, -0.18)),
      );
    } else {
      camera.updateWorldMatrix(true, false);
      this.clipboard.position.copy(
        camera.localToWorld(new THREE.Vector3(-0.48, -0.22, -1.05)),
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
  begin() {
    if (this.started) return;
    this.started = true;
    this.elapsed = 0;
    this.onChange();
  }
  toggle(key) {
    if (!this.started || !LAYER_KEYS.includes(key) || this.finished) return;
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
    if (this.isClimbingTree && (key === "vegetation" || key === "topography"))
      this.cancelTreeClimb();
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
    this.cancelTreeClimb();
    this.selected.clear();
    this.lastLayer = null;
    this.reveal = null;
    for (const variant of Object.values(this.variants)) {
      variant.world.scale.y = 1;
      for (const key of LAYER_KEYS.slice(1)) variant[key].scale.y = 1;
    }
    this.elapsed = 0;
    this.finished = false;
    this.onRoad = false;
    this.fallingFromRoad = false;
    this.fallVelocity = 0;
    this.group.position.y = this.floorY;
    this.applyVisibility();
    this.onChange();
  }
  finish() {
    if (!this.started || this.finished) return;
    this.cancelTreeClimb();
    this.finished = true;
    this.onChange();
  }
  update(dt) {
    if (!this.started) return;
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
    if (this.elapsed >= 240) this.finish();
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
