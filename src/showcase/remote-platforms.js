import * as THREE from "three";

export const PLATFORMS = [
  { id: "satellite", label: "Satellite", name: "Landsat satellite",
    note: "Wide, repeatable coverage builds a long record of change.\nClouds and the orbit set when a clear view is available." },
  { id: "aircraft", label: "Aircraft", name: "Survey aircraft",
    note: "Planned flights carry specialized sensors over a city or region.\nFlights can be timed and tailored, but require a campaign." },
  { id: "drone", label: "Drone", name: "Camera drone",
    note: "Close, flexible flights reveal fine detail at a local site.\nBattery life and flight rules limit the area covered." },
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
}

function aircraft(parent, white, blue, lens, gold, dark) {
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.047, 0.34, 5, 10), white);
  fuselage.rotation.x = Math.PI / 2;
  parent.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.095, 14), white);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -0.253;
  parent.add(nose);
  const wing = box(parent, [0.59, 0.018, 0.12], [0, 0.045, -0.02], blue);
  wing.rotation.z = -0.018;
  for (const side of [-1, 1]) {
    box(parent, [0.11, 0.003, 0.014], [side * 0.215, 0.056, -0.065], gold);
    rod(parent, [side * 0.18, 0.038, -0.02],
      [side * 0.044, -0.055, 0.02], 0.005, white);
    box(parent, [0.12, 0.011, 0.068], [side * 0.12, 0.018, 0.196], blue);
  }
  box(parent, [0.018, 0.095, 0.075], [0, 0.067, 0.195], blue);
  box(parent, [0.072, 0.02, 0.065], [0, 0.022, -0.128], dark);
  cylinder(parent, 0.027, 0.032, 0.03, [0, -0.064, -0.012], lens);
  rod(parent, [0, 0, -0.302], [0, 0.123, -0.302], 0.004, dark);
  rod(parent, [-0.073, 0.061, -0.302], [0.073, 0.061, -0.302], 0.004, dark);
}

function drone(parent, white, blue, lens, gold, dark) {
  box(parent, [0.17, 0.055, 0.12], [0, 0, 0], white);
  box(parent, [0.09, 0.009, 0.07], [0, 0.034, 0], gold);
  const rotors = [];
  for (const x of [-0.18, 0.18]) for (const z of [-0.18, 0.18]) {
    rod(parent, [Math.sign(x) * 0.045, 0, Math.sign(z) * 0.035],
      [x, 0.038, z], 0.012, blue);
    cylinder(parent, 0.027, 0.027, 0.035, [x, 0.055, z], dark);
    const rotor = new THREE.Group();
    rotor.position.set(x, 0.078, z);
    box(rotor, [0.15, 0.003, 0.014], [0, 0, 0], white);
    box(rotor, [0.014, 0.003, 0.15], [0, 0, 0], white);
    cylinder(rotor, 0.017, 0.017, 0.007, [0, 0.004, 0], gold);
    parent.add(rotor);
    rotors.push(rotor);
  }
  for (const side of [-1, 1]) {
    rod(parent, [side * 0.07, -0.02, -0.065], [side * 0.09, -0.11, -0.07], 0.006, dark);
    rod(parent, [side * 0.07, -0.02, 0.065], [side * 0.09, -0.11, 0.07], 0.006, dark);
    rod(parent, [side * 0.09, -0.11, -0.095], [side * 0.09, -0.11, 0.095], 0.006, dark);
  }
  cylinder(parent, 0.027, 0.027, 0.025, [0, -0.075, -0.035], dark);
  cylinder(parent, 0.037, 0.037, 0.043, [0, -0.105, -0.035], lens);
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
      new THREE.ConeGeometry(radius, altitude + 0.34, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x75d8ca, transparent: true,
        opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }),
    );
    cone.position.set(x, (altitude - 0.34) / 2, 0.09);
    group.add(cone);
    const pick = new THREE.Mesh(
      new THREE.PlaneGeometry(0.67, 1.0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true,
        opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    pick.position.set(x, 0.09, -0.05);
    pick.userData.platform = info.id;
    group.add(pick);
    pickTargets.push(pick);
    items.push({ ...info, model, ring, cone, footprint });
  }
  return { group, items, pickTargets };
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
