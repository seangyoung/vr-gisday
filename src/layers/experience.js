import * as THREE from "three";

export const LAYER_KEYS = [
  "topography",
  "vegetation",
  "hydrology",
  "roads",
  "population",
];
export const LAYER_NAMES = {
  topography: "Topography",
  vegetation: "Vegetation",
  hydrology: "Hydrology",
  roads: "Roads",
  population: "Population density",
};
export const LAYER_HINTS = {
  topography: "Height gives this place ridges and a low valley.",
  vegetation: "Trees occupy patches of land, leaving openings near routes.",
  hydrology: "A river follows the valley; its banks respond to terrain height.",
  roads: "Routes cross the valley and connect parts of the landscape.",
  population:
    "Population is summarized by district, not measured at each point.",
};
const extent = 15;
const topographicHeight = (x, z) => {
  const radius = Math.hypot(x, z);
  const hill = 1.4 * Math.exp(-((x + 8) ** 2 + (z + 5) ** 2) / 34);
  const rise = 1.8 * Math.exp(-((x - 8) ** 2 + (z - 6) ** 2) / 42);
  const valley =
    0.55 * Math.exp(-((x - (4 + 1.2 * Math.sin(z * 0.22))) ** 2) / 8);
  const detail = 0.18 * Math.sin(x * 0.38) * Math.cos(z * 0.31);
  const blend = THREE.MathUtils.smoothstep(radius, 1.3, 3.2);
  return blend * Math.max(-0.36, hill + rise + detail - valley);
};
export const landscapeHeight = (x, z, raised = true) =>
  raised ? topographicHeight(x, z) : 0;
export const riverX = (z) => 4 + 1.2 * Math.sin(z * 0.22);
export function densityAt(x, z) {
  const center = Math.hypot(x, z * 0.8);
  if (center < 5 || (x < -2 && z > 3 && z < 10)) return "high";
  if (center < 10 && x < riverX(z) + 2) return "medium";
  return "low";
}

function surfaceGeometry(raised, size = 60) {
  const vertices = [],
    indices = [];
  for (let row = 0; row <= size; row++)
    for (let col = 0; col <= size; col++) {
      const x = -extent + (col * extent * 2) / size;
      const z = -extent + (row * extent * 2) / size;
      vertices.push(x, landscapeHeight(x, z, raised), z);
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
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function path(points, radius, color) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, points.length * 3, radius, 6, false),
    new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
  );
}
const seeded = (i) => {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
function makeTrees(group, raised) {
  const trunks = [],
    crowns = [];
  for (let i = 0; i < 95; i++) {
    const x = (seeded(i * 2) - 0.5) * 27,
      z = (seeded(i * 2 + 1) - 0.5) * 27;
    if (
      Math.hypot(x, z) < 3.5 ||
      Math.abs(x - riverX(z)) < 1.5 ||
      Math.abs(z - 2.2) < 1.2
    )
      continue;
    const y = landscapeHeight(x, z, raised),
      scale = 0.75 + seeded(i + 500) * 0.65;
    trunks.push({ x, y, z, scale });
    crowns.push({ x, y, z, scale });
  }
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.075, 0.12, 1, 5),
    new THREE.MeshStandardMaterial({ color: 0x805d40 }),
    trunks.length,
  );
  const crown = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.6, 1.8, 6),
    new THREE.MeshStandardMaterial({ color: 0x6fc99a, roughness: 1 }),
    crowns.length,
  );
  const temp = new THREE.Object3D();
  trunks.forEach(({ x, y, z, scale }, i) => {
    temp.position.set(x, y + 0.5 * scale, z);
    temp.scale.setScalar(scale);
    temp.updateMatrix();
    trunk.setMatrixAt(i, temp.matrix);
    temp.position.y = y + 1.55 * scale;
    temp.updateMatrix();
    crown.setMatrixAt(i, temp.matrix);
  });
  trunk.instanceMatrix.needsUpdate = crown.instanceMatrix.needsUpdate = true;
  group.add(trunk, crown);
}
function makeHydrology(group, raised) {
  const points = [];
  for (let z = -14.5; z <= 14.5; z += 0.5) {
    const x = riverX(z);
    points.push(new THREE.Vector3(x, landscapeHeight(x, z, raised) + 0.1, z));
  }
  group.add(path(points, 0.62, 0x51bfea));
  const feeder = [];
  for (let x = -11; x <= 4; x += 0.5) {
    const z = -6 + 0.9 * Math.sin((x + 11) * 0.23);
    feeder.push(new THREE.Vector3(x, landscapeHeight(x, z, raised) + 0.12, z));
  }
  group.add(path(feeder, 0.22, 0x72d7ee));
}
function makeRoads(group, raised) {
  const eastWest = [],
    northSouth = [];
  for (let x = -14; x <= 14; x += 0.5) {
    const z = 2.2 + 0.35 * Math.sin(x * 0.22);
    eastWest.push(
      new THREE.Vector3(x, landscapeHeight(x, z, raised) + 0.17, z),
    );
  }
  for (let z = -14; z <= 14; z += 0.5) {
    const x = -4.8 + 0.3 * Math.cos(z * 0.2);
    northSouth.push(
      new THREE.Vector3(x, landscapeHeight(x, z, raised) + 0.15, z),
    );
  }
  group.add(path(eastWest, 0.22, 0xc4af84), path(northSouth, 0.17, 0xa89575));
}
function makePopulation(group, raised) {
  const colors = { low: 0xbcd0e2, medium: 0x43c9c5, high: 0xffbd65 };
  const size = 6,
    pieces = 5;
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 5; col++) {
      const x0 = -extent + col * size,
        z0 = -extent + row * size;
      const centerX = x0 + size / 2,
        centerZ = z0 + size / 2;
      const vertices = [],
        indices = [];
      for (let r = 0; r <= pieces; r++)
        for (let c = 0; c <= pieces; c++) {
          const x = x0 + (c * size) / pieces,
            z = z0 + (r * size) / pieces;
          vertices.push(x, landscapeHeight(x, z, raised) + 0.055, z);
        }
      for (let r = 0; r < pieces; r++)
        for (let c = 0; c < pieces; c++) {
          const a = r * (pieces + 1) + c;
          indices.push(
            a,
            a + pieces + 1,
            a + 1,
            a + 1,
            a + pieces + 1,
            a + pieces + 2,
          );
        }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      group.add(
        new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            color: colors[densityAt(centerX, centerZ)],
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1,
          }),
        ),
      );
    }
}

export class LayerExperience {
  constructor(scene, onChange) {
    this.scene = scene;
    this.onChange = onChange;
    this.selected = new Set();
    this.elapsed = 0;
    this.finished = false;
    this.lastLayer = null;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.clipboard = new THREE.Group();
    this.clipboard.scale.setScalar(0.18);
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
      const ground = new THREE.Mesh(
        surfaceGeometry(raised),
        new THREE.MeshStandardMaterial({
          color: raised ? 0x597e69 : 0x546c6d,
          roughness: 1,
          side: THREE.DoubleSide,
        }),
      );
      world.add(ground);
      this.ground[name] = ground;
      for (const key of LAYER_KEYS.filter((k) => k !== "topography")) {
        const layer = new THREE.Group();
        world.add(layer);
        this.variants[name][key] = layer;
        if (key === "vegetation") makeTrees(layer, raised);
        if (key === "hydrology") makeHydrology(layer, raised);
        if (key === "roads") makeRoads(layer, raised);
        if (key === "population") makePopulation(layer, raised);
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
    this.group.rotation.y = 0;
  }
  updateClipboard(leftGrip, camera, preview = false) {
    if (!leftGrip && !preview) {
      this.clipboard.visible = false;
      return;
    }
    if (preview) {
      camera.updateWorldMatrix(true, false);
      this.clipboard.position.copy(
        camera.localToWorld(new THREE.Vector3(-0.47, -0.12, -1.05)),
      );
    } else {
      leftGrip.updateWorldMatrix(true, false);
      this.clipboard.position.copy(
        leftGrip.localToWorld(new THREE.Vector3(-0.045, 0.19, -0.12)),
      );
    }
    camera.getWorldPosition(this._viewPosition ??= new THREE.Vector3());
    this.clipboard.lookAt(this._viewPosition);
    this.clipboard.visible = true;
    this.clipboard.updateWorldMatrix(true, true);
  }
  toggle(key) {
    if (!LAYER_KEYS.includes(key) || this.finished) return;
    if (this.selected.has(key)) this.selected.delete(key);
    else this.selected.add(key);
    this.lastLayer = key;
    this.applyVisibility();
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
    this.elapsed = 0;
    this.finished = false;
    this.applyVisibility();
    this.onChange();
  }
  update(dt) {
    if (this.finished) return;
    this.elapsed += dt;
    if (this.elapsed >= 240) {
      this.finished = true;
      this.onChange();
    }
  }
  dispose() {
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
