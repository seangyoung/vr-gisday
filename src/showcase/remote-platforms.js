import * as THREE from "three";

export const PLATFORMS = [
  { id: "satellite", label: "Satellite", name: "Landsat satellite",
    note: "Spatial resolution: 30 m pixels across wide areas.\nTemporal resolution: scheduled revisits; clouds can hide the ground.\nCost: Landsat images are free to use." },
  { id: "aircraft", label: "Aircraft", name: "Survey aircraft",
    note: "Spatial resolution: finer detail over a chosen region.\nTemporal resolution: fly when conditions and schedules allow.\nCost: aircraft, crew, and sensors make each survey costly." },
  { id: "drone", label: "Drone", name: "Camera drone",
    note: "Spatial resolution: very fine detail over a small site.\nTemporal resolution: repeat flights as weather and rules allow.\nCost: a lower-cost launch, with many flights for broad coverage." },
];

const basic = (color, extras = {}) => new THREE.MeshStandardMaterial({
  color, metalness: 0.23, roughness: 0.56, ...extras,
});

function box(parent, size, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, top, bottom, height, position, material, sides = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, sides), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function rod(parent, start, end, radius, material) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const mesh = cylinder(parent, radius, radius, a.distanceTo(b),
    a.clone().add(b).multiplyScalar(0.5).toArray(), material, 8);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
    b.sub(a).normalize());
  return mesh;
}

function plate(parent, outline, y, thickness, material) {
  const shape = new THREE.Shape();
  outline.forEach(([x, z], index) => {
    if (index) shape.lineTo(x, -z);
    else shape.moveTo(x, -z);
  });
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: false, steps: 1,
  }), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y - thickness / 2;
  parent.add(mesh);
  return mesh;
}

function verticalFin(parent, outline, thickness, material) {
  const shape = new THREE.Shape();
  outline.forEach(([z, y], index) => {
    if (index) shape.lineTo(-z, y);
    else shape.moveTo(-z, y);
  });
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: false, steps: 1,
  }), material);
  mesh.rotation.y = Math.PI / 2;
  mesh.position.x = -thickness / 2;
  parent.add(mesh);
  return mesh;
}

function fuselage(parent, sections, material) {
  const vertices = [], triangles = [], sides = 14;
  for (const [z, centerY, radiusX, radiusY] of sections)
    for (let side = 0; side < sides; side++) {
      const angle = side * Math.PI * 2 / sides;
      vertices.push(Math.cos(angle) * radiusX,
        centerY + Math.sin(angle) * radiusY, z);
    }
  for (let ring = 0; ring < sections.length - 1; ring++)
    for (let side = 0; side < sides; side++) {
      const a = ring * sides + side;
      const next = ring * sides + (side + 1) % sides;
      const b = (ring + 1) * sides + side;
      const bNext = (ring + 1) * sides + (side + 1) % sides;
      triangles.push(a, next, b, next, bNext, b);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();
  parent.add(new THREE.Mesh(geometry, material));
}

function satellite(parent, white, blue, lens, gold, dark) {
  // Landsat-like bus, segmented solar wings, nadir-facing imager, and antenna.
  box(parent, [0.17, 0.18, 0.17], [0, 0, 0], gold);
  box(parent, [0.14, 0.12, 0.17], [0, 0.015, -0.004], white);
  for (const side of [-1, 1]) {
    rod(parent, [side * 0.085, 0, 0], [side * 0.16, 0, 0], 0.009, dark);
    for (let panel = 0; panel < 2; panel++) {
      const x = side * (0.225 + panel * 0.145);
      box(parent, [0.13, 0.19, 0.008], [x, 0, 0], dark);
      for (let row = -1; row <= 1; row++)
        box(parent, [0.119, 0.048, 0.002], [x, row * 0.059, 0.005], blue);
      box(parent, [0.007, 0.205, 0.011], [x + side * 0.068, 0, 0], white);
    }
  }
  cylinder(parent, 0.063, 0.075, 0.095, [0, -0.135, 0], white, 16);
  cylinder(parent, 0.052, 0.052, 0.008, [0, -0.187, 0], lens, 16);
  rod(parent, [0, 0.09, 0], [0, 0.205, 0], 0.008, white);
  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.074, 0.04, 18), white);
  dish.rotation.z = Math.PI;
  dish.position.y = 0.215;
  parent.add(dish);
  parent.userData.cameraAperture = new THREE.Vector3(0, -0.191, 0);
}

function aircraft(parent, white, blue, lens, gold, dark) {
  // Single-engine survey plane: tapered cabin, swept wings, tail, propeller,
  // landing gear, and a belly-mounted mapping camera.
  fuselage(parent, [
    [-0.365, 0, 0.003, 0.003], [-0.30, 0, 0.045, 0.04],
    [-0.20, 0.003, 0.067, 0.055], [-0.08, 0, 0.078, 0.062],
    [0.08, 0, 0.07, 0.057], [0.23, 0.01, 0.042, 0.039],
    [0.355, 0.032, 0.006, 0.009],
  ], white);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), lens);
  canopy.scale.set(0.058, 0.029, 0.105);
  canopy.position.set(0, 0.055, -0.13);
  parent.add(canopy);
  for (const side of [-1, 1]) {
    const wing = [[0.04, -0.085], [0.41, -0.015],
      [0.395, 0.08], [0.05, 0.09]].map(([x, z]) => [side * x, z]);
    plate(parent, wing, 0.067, 0.018, white);
    plate(parent, [[0.16, -0.048], [0.38, -0.009],
      [0.375, 0.011], [0.16, -0.017]].map(([x, z]) => [side * x, z]),
    0.079, 0.003, blue);
    rod(parent, [side * 0.28, 0.054, 0.01],
      [side * 0.065, -0.054, 0.055], 0.006, dark);
    plate(parent, [[0.026, 0.245], [0.195, 0.245],
      [0.18, 0.325], [0.025, 0.34]].map(([x, z]) => [side * x, z]),
    0.072, 0.012, blue);
    box(parent, [0.005, 0.02, 0.21], [side * 0.075, -0.011, 0.015], blue);
    box(parent, [0.009, 0.029, 0.062], [side * 0.074, 0.021, -0.035], lens);
    rod(parent, [side * 0.14, -0.015, 0.045],
      [side * 0.18, -0.128, 0.057], 0.006, dark);
    const wheel = cylinder(parent, 0.028, 0.028, 0.016,
      [side * 0.188, -0.141, 0.057], dark, 12);
    wheel.rotation.z = Math.PI / 2;
    cylinder(parent, 0.009, 0.009, 0.018,
      [side * 0.198, -0.141, 0.057], gold, 12).rotation.z = Math.PI / 2;
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), gold);
    light.position.set(side * 0.41, 0.072, 0.029);
    parent.add(light);
  }
  verticalFin(parent, [[0.21, 0.034], [0.29, 0.151],
    [0.353, 0.158], [0.345, 0.047]], 0.014, blue);
  const spinner = cylinder(parent, 0.027, 0.027, 0.026,
    [0, 0, -0.382], gold, 16);
  spinner.rotation.x = Math.PI / 2;
  box(parent, [0.013, 0.16, 0.007], [0, 0, -0.405], dark).rotation.z = 0.28;
  cylinder(parent, 0.016, 0.016, 0.008,
    [0, 0, -0.411], white, 16).rotation.x = Math.PI / 2;
  rod(parent, [0, -0.032, -0.255], [0, -0.105, -0.255], 0.005, dark);
  const noseWheel = cylinder(parent, 0.019, 0.019, 0.012,
    [0, -0.116, -0.255], dark, 12);
  noseWheel.rotation.z = Math.PI / 2;
  box(parent, [0.09, 0.035, 0.095], [0, -0.072, 0.025], dark);
  cylinder(parent, 0.035, 0.035, 0.028,
    [0, -0.104, 0.025], white, 16);
  cylinder(parent, 0.029, 0.029, 0.006,
    [0, -0.122, 0.025], lens, 16);
  parent.userData.cameraAperture = new THREE.Vector3(0, -0.126, 0.025);
}

function drone(parent, white, blue, lens, gold, dark) {
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), white);
  shell.scale.set(0.105, 0.045, 0.08);
  parent.add(shell);
  box(parent, [0.085, 0.01, 0.06], [0, 0.046, 0], gold);
  const rotors = [];
  for (const x of [-0.22, 0.22]) for (const z of [-0.20, 0.20]) {
    rod(parent, [Math.sign(x) * 0.05, 0.012, Math.sign(z) * 0.04],
      [x, 0.058, z], 0.014, blue);
    cylinder(parent, 0.034, 0.039, 0.038, [x, 0.07, z], dark);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.073, 0.005, 6, 24), blue);
    guard.rotation.x = Math.PI / 2;
    guard.position.set(x, 0.104, z);
    parent.add(guard);
    const rotor = new THREE.Group();
    rotor.position.set(x, 0.105, z);
    box(rotor, [0.126, 0.003, 0.016], [0, 0, 0], white);
    box(rotor, [0.016, 0.003, 0.126], [0, 0, 0], white);
    cylinder(rotor, 0.017, 0.017, 0.007, [0, 0.004, 0], gold);
    parent.add(rotor);
    rotors.push(rotor);
  }
  for (const side of [-1, 1]) {
    rod(parent, [side * 0.075, -0.018, -0.048], [side * 0.11, -0.132, -0.09], 0.007, dark);
    rod(parent, [side * 0.075, -0.018, 0.048], [side * 0.11, -0.132, 0.09], 0.007, dark);
    rod(parent, [side * 0.11, -0.132, -0.115], [side * 0.11, -0.132, 0.115], 0.009, dark);
  }
  rod(parent, [0, -0.035, -0.025], [0, -0.087, -0.045], 0.008, dark);
  box(parent, [0.091, 0.056, 0.08], [0, -0.112, -0.045], white);
  box(parent, [0.108, 0.016, 0.083], [0, -0.084, -0.045], dark);
  cylinder(parent, 0.032, 0.032, 0.024, [0, -0.151, -0.045], dark, 16);
  cylinder(parent, 0.026, 0.026, 0.006, [0, -0.168, -0.045], lens, 16);
  parent.userData.cameraAperture = new THREE.Vector3(0, -0.172, -0.045);
  parent.userData.rotors = rotors;
}

export function makePlatformComparison() {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight(0xe8f4ff, 0x4b6654, 2.1));
  const sun = new THREE.DirectionalLight(0xffe8be, 1.7);
  sun.position.set(-1, 2, 1);
  group.add(sun);
  const white = basic(0xd6e7e9);
  const blue = basic(0x558eaa, { metalness: 0.32, emissive: 0x133849,
    emissiveIntensity: 0.5 });
  const lens = basic(0x193c44, { emissive: 0x164b58 });
  const gold = basic(0xc4a66b, { metalness: 0.54 });
  const dark = basic(0x253a44, { metalness: 0.35 });
  const items = [];
  const pickTargets = [];
  for (const [index, info] of PLATFORMS.entries()) {
    const x = (index - 1) * 0.78;
    const altitude = [0.52, 0.32, 0.17][index];
    const radius = [0.33, 0.24, 0.15][index];
    const model = new THREE.Group();
    model.position.set(x, altitude, 0.09);
    group.add(model);
    if (info.id === "satellite") satellite(model, white, blue, lens, gold, dark);
    else if (info.id === "aircraft") aircraft(model, white, blue, lens, gold, dark);
    else drone(model, white, blue, lens, gold, dark);
    const footprint = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 36),
      new THREE.MeshBasicMaterial({ color: 0x346d69, side: THREE.DoubleSide }),
    );
    footprint.rotation.x = -Math.PI / 2;
    footprint.position.set(x, -0.34, 0.1);
    group.add(footprint);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.012, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0x8aa8ac }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(footprint.position);
    ring.position.y += 0.004;
    group.add(ring);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(radius, 1, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x75d8ca, transparent: true,
        opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }),
    );
    group.add(cone);
    const pick = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 1.0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true,
        opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    pick.position.set(x, 0.09, -0.05);
    pick.userData.platform = info.id;
    group.add(pick);
    pickTargets.push(pick);
    items.push({ ...info, model, ring, cone, footprint });
  }
  alignSensingFootprints(group, items);
  return { group, items, pickTargets };
}

export function alignSensingFootprints(group, items) {
  for (const item of items) {
    const aperture = group.worldToLocal(item.model.localToWorld(
      item.model.userData.cameraAperture.clone()));
    const height = Math.max(0.05, aperture.y + 0.34);
    item.cone.position.set(aperture.x, (aperture.y - 0.34) / 2, aperture.z);
    item.cone.scale.y = height;
    item.footprint.position.x = aperture.x;
    item.footprint.position.z = aperture.z;
    item.ring.position.x = aperture.x;
    item.ring.position.z = aperture.z;
  }
}

export function highlightPlatform(items, selected) {
  for (const item of items) {
    const active = item.id === selected;
    item.ring.material.color.set(active ? 0xa6f5d9 : 0x75969b);
    item.footprint.material.color.set(active ? 0x3e9a79 : 0x346d69);
    item.cone.material.opacity = active ? 0.22 : 0.055;
    item.model.scale.setScalar(active ? 1.11 : 1);
  }
}
