import * as THREE from "three";

export const PLATFORMS = [
  { id: "satellite", label: "Satellite", name: "Landsat satellite",
    note: "Revisits wide regions in several light bands." },
  { id: "aircraft", label: "Aircraft", name: "Survey aircraft",
    note: "Planned flight lines map a city or region." },
  { id: "drone", label: "Drone", name: "Camera drone",
    note: "Close flights show local detail over a small site." },
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

function satellite(parent, white, blue, lens) {
  box(parent, [0.17, 0.17, 0.15], [0, 0, 0], white);
  for (const side of [-1, 1]) {
    box(parent, [0.25, 0.012, 0.17], [side * 0.23, 0.01, 0], blue);
    box(parent, [0.03, 0.018, 0.18], [side * 0.23, 0.022, 0], white);
  }
  cylinder(parent, 0.055, 0.055, 0.08, [0, -0.13, 0], lens);
  cylinder(parent, 0.014, 0.014, 0.14, [0, 0.15, 0], white);
  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.055, 16), white);
  dish.position.y = 0.24;
  parent.add(dish);
}

function aircraft(parent, white, blue, lens) {
  const body = cylinder(parent, 0.046, 0.055, 0.41, [0, 0, 0], white);
  body.rotation.x = Math.PI / 2;
  box(parent, [0.54, 0.018, 0.095], [0, 0.01, -0.01], blue);
  box(parent, [0.23, 0.018, 0.055], [0, 0.04, 0.19], white);
  box(parent, [0.018, 0.12, 0.07], [0, 0.08, 0.18], white);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.046, 0.1, 14), white);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -0.25;
  parent.add(nose);
  cylinder(parent, 0.035, 0.035, 0.045, [0, -0.085, -0.03], lens);
}

function drone(parent, white, blue, lens) {
  box(parent, [0.15, 0.06, 0.14], [0, 0, 0], white);
  const rotors = [];
  for (const x of [-0.18, 0.18]) for (const z of [-0.18, 0.18]) {
    const arm = box(parent, [0.23, 0.018, 0.022], [x / 2, 0.015, z / 2], blue);
    arm.rotation.y = Math.atan2(z, x);
    cylinder(parent, 0.028, 0.028, 0.04, [x, 0.035, z], white);
    const rotor = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.006, 6, 24), blue);
    rotor.rotation.x = Math.PI / 2;
    rotor.position.set(x, 0.066, z);
    parent.add(rotor);
    rotors.push(rotor);
  }
  cylinder(parent, 0.04, 0.04, 0.045, [0, -0.075, -0.04], lens);
  parent.userData.rotors = rotors;
}

export function makePlatformComparison() {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight(0xe8f4ff, 0x4b6654, 2.1));
  const sun = new THREE.DirectionalLight(0xffe8be, 1.7);
  sun.position.set(-1, 2, 1);
  group.add(sun);
  const white = basic(0xd6e7e9);
  const blue = basic(0x426b83, { metalness: 0.4 });
  const lens = basic(0x193c44, { emissive: 0x164b58 });
  const items = [];
  const pickTargets = [];
  for (const [index, info] of PLATFORMS.entries()) {
    const x = (index - 1) * 0.78;
    const altitude = [0.52, 0.32, 0.17][index];
    const radius = [0.33, 0.24, 0.15][index];
    const model = new THREE.Group();
    model.position.set(x, altitude, 0.09);
    group.add(model);
    if (info.id === "satellite") satellite(model, white, blue, lens);
    else if (info.id === "aircraft") aircraft(model, white, blue, lens);
    else drone(model, white, blue, lens);
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
