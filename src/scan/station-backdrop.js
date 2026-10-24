import * as THREE from "three";

// The field scenery sits beyond the walkable survey square. It gives each
// station exercise a setting without adding unscored surfaces to the target.
const PROFILES = {
  ruins: { ground: 0x657157, hill: 0x6e8065, ridge: 0x526b5b,
    barrier: 0xc69a57, detail: "forest" },
  bridge: { ground: 0x707763, hill: 0x8b8270, ridge: 0x666d65,
    barrier: 0xd39651, detail: "ravine" },
  village: { ground: 0x879477, hill: 0x9faa86, ridge: 0x7e9181,
    barrier: 0xb99965, detail: "settlement" },
  terraces: { ground: 0x818b68, hill: 0xa1a17b, ridge: 0x818b73,
    barrier: 0xc5a16c, detail: "farmland" },
  canopy: { ground: 0x596c57, hill: 0x667d64, ridge: 0x456858,
    barrier: 0xd4ad69, detail: "forest" },
  courtyard: { ground: 0x858b73, hill: 0x9d9b80, ridge: 0x808875,
    barrier: 0xc5aa74, detail: "garden" },
  tower: { ground: 0x7d8c70, hill: 0x91a381, ridge: 0x6d8579,
    barrier: 0xd39754, detail: "uplands" },
};

const matte = (color) => new THREE.MeshStandardMaterial({ color, roughness: 1 });

function addBox(group, dimensions, position, material, kind) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
  mesh.position.set(...position);
  mesh.userData.backdropKind = kind;
  group.add(mesh);
  return mesh;
}

function addHills(group, profile, id) {
  const near = 28, middle = 40, far = 64, steps = 64;
  const positions = [], colors = [];
  const innerColor = new THREE.Color(profile.ground);
  const middleColor = new THREE.Color(profile.hill);
  const outerColor = new THREE.Color(profile.ridge);
  for (let i = 0; i < steps; i++) {
    const a = i * Math.PI * 2 / steps, b = (i + 1) * Math.PI * 2 / steps;
    const elevation = (angle, ring) => {
      const broad = Math.sin(angle * 3 + id.length) * 1.35 +
        Math.cos(angle * 5 - id.length) * 0.65;
      const sceneBoost = id === "bridge" ? 3.3 : id === "terraces" ? 2.0 : 0;
      return ring === 0 ? -0.08 : (ring === 1 ? 2.4 : 5.0) +
        broad * (ring === 1 ? 0.55 : 1.1) + sceneBoost;
    };
    const rings = [[near, innerColor], [middle, middleColor], [far, outerColor]];
    for (let ring = 0; ring < 2; ring++) {
      const [r0, c0] = rings[ring], [r1, c1] = rings[ring + 1];
      const vertices = [
        [r0 * Math.sin(a), elevation(a, ring), r0 * Math.cos(a), c0],
        [r1 * Math.sin(a), elevation(a, ring + 1), r1 * Math.cos(a), c1],
        [r0 * Math.sin(b), elevation(b, ring), r0 * Math.cos(b), c0],
        [r0 * Math.sin(b), elevation(b, ring), r0 * Math.cos(b), c0],
        [r1 * Math.sin(a), elevation(a, ring + 1), r1 * Math.cos(a), c1],
        [r1 * Math.sin(b), elevation(b, ring + 1), r1 * Math.cos(b), c1],
      ];
      for (const [x, y, z, color] of vertices) {
        positions.push(x, y, z);
        colors.push(color.r, color.g, color.b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const hills = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, side: THREE.DoubleSide,
  }));
  hills.userData.backdropKind = "terrain";
  group.add(hills);
}

function addCordon(group, color) {
  const posts = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.065, 0.085, 1.55, 6), matte(0x48504c), 40);
  const transform = new THREE.Object3D();
  let index = 0;
  for (let i = 0; i <= 9; i++) {
    const p = -20.5 + 41 * i / 9;
    for (const [x, z] of [[p, -20.5], [p, 20.5], [-20.5, p], [20.5, p]]) {
      transform.position.set(x, 0.77, z);
      transform.updateMatrix();
      posts.setMatrixAt(index++, transform.matrix);
    }
  }
  posts.userData.backdropKind = "barrier-posts";
  group.add(posts);
  const rail = matte(color);
  const cap = matte(0xf4e4b7);
  for (const edge of [-20.5, 20.5]) {
    for (const height of [0.86, 1.3]) {
      addBox(group, [41, 0.09, 0.07], [0, height, edge], rail, "barrier-rail");
      addBox(group, [0.07, 0.09, 41], [edge, height, 0], rail, "barrier-rail");
    }
  }
  // High-contrast short caps make the boundary read as survey barricades.
  const capMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.08, 0.22), cap, 40);
  index = 0;
  for (let i = 0; i <= 9; i++) {
    const p = -20.5 + 41 * i / 9;
    for (const [x, z] of [[p, -20.5], [p, 20.5], [-20.5, p], [20.5, p]]) {
      transform.position.set(x, 1.55, z);
      transform.updateMatrix();
      capMesh.setMatrixAt(index++, transform.matrix);
    }
  }
  capMesh.userData.backdropKind = "barrier-caps";
  group.add(capMesh);
}

function addTrees(group, id, count) {
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.2, 2.4, 6), matte(0x705d46), count);
  const crown = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.15, 3.3, 7), matte(id === "canopy" ? 0x3f6851 : 0x557458), count);
  const transform = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = i * 2.399963 + id.length * 0.37;
    const radius = 27 + (i * 7 % 15);
    const x = Math.sin(a) * radius, z = Math.cos(a) * radius;
    const size = 0.75 + (i * 3 % 7) / 14;
    transform.position.set(x, 1.2 * size, z);
    transform.scale.setScalar(size);
    transform.updateMatrix();
    trunk.setMatrixAt(i, transform.matrix);
    transform.position.y = 3.4 * size;
    transform.updateMatrix();
    crown.setMatrixAt(i, transform.matrix);
  }
  trunk.userData.backdropKind = crown.userData.backdropKind = "distant-trees";
  group.add(trunk, crown);
}

function addSceneDetails(group, id) {
  if (id === "ruins" || id === "canopy") {
    addTrees(group, id, id === "canopy" ? 42 : 26);
  } else if (id === "bridge") {
    const rock = matte(0x777669);
    for (const side of [-1, 1]) {
      for (const z of [-13, -29]) {
        const bluff = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rock);
        bluff.scale.set(5.2, 2.3, 6.4);
        bluff.position.set(side * 32, 2, z);
        bluff.userData.backdropKind = "distant-ravine-bank";
        group.add(bluff);
      }
    }
    addTrees(group, id, 12);
  } else if (id === "village") {
    const wall = matte(0xc8bea2), roof = matte(0x8d6659);
    for (let i = 0; i < 7; i++) {
      const x = -17 + i * 5.5, z = -30 - i % 3 * 2;
      addBox(group, [2.8, 2.2 + i % 3 * 0.5, 2.4], [x, 1.1 + i % 3 * 0.25, z],
        wall, "distant-building");
      const top = new THREE.Mesh(new THREE.ConeGeometry(2.25, 1.2, 4), roof);
      top.position.set(x, 2.8 + i % 3 * 0.5, z);
      top.rotation.y = Math.PI / 4;
      top.userData.backdropKind = "distant-building";
      group.add(top);
    }
    addTrees(group, id, 12);
  } else if (id === "terraces") {
    const stone = matte(0x9e987a), crop = matte(0x77885d);
    for (let i = 0; i < 4; i++) {
      const z = -26 - i * 4.5;
      addBox(group, [33 - i * 3, 0.5 + i * 0.35, 2.6], [0, 0.2 + i * 0.17, z],
        stone, "distant-terrace");
      addBox(group, [32 - i * 3, 0.08, 2.4], [0, 0.48 + i * 0.35, z],
        crop, "distant-terrace");
    }
    addTrees(group, id, 10);
  } else if (id === "courtyard") {
    const masonry = matte(0xb7ae96);
    for (const x of [-29, 29])
      addBox(group, [0.7, 3.1, 29], [x, 1.55, -3], masonry, "distant-garden-wall");
    addBox(group, [58, 3.1, 0.7], [0, 1.55, -28], masonry, "distant-garden-wall");
    addTrees(group, id, 18);
  } else if (id === "tower") {
    addTrees(group, id, 17);
    const metal = matte(0x697c77);
    for (const x of [-26, 28]) {
      addBox(group, [0.15, 5.5, 0.15], [x, 2.75, -29], metal, "distant-mast");
      addBox(group, [1.8, 0.12, 0.12], [x, 5.3, -29], metal, "distant-mast");
    }
  }
}

export function buildStationBackdrop(id) {
  const profile = PROFILES[id];
  if (!profile) throw new Error(`Unknown scan backdrop: ${id}`);
  const group = new THREE.Group();
  group.name = `${id}-station-backdrop`;
  group.userData.sceneId = id;
  group.userData.detail = profile.detail;
  addHills(group, profile, id);
  addSceneDetails(group, id);
  addCordon(group, profile.barrier);
  return { group, groundColor: profile.ground };
}
