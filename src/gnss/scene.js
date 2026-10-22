import * as THREE from "three";
import { GNSS_SATELLITE, GNSS_SIGNAL, GNSS_CLOCK, GNSS_MULTIPATH,
  pathLength } from "../model.js";

const teal = 0x82e4d4;
const gold = 0xffd88b;
const blue = 0x5579a2;
const point = (x, y, z = 0) => new THREE.Vector3(x, y, z);

function mesh(parent, geometry, color, position, options = {}) {
  const object = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color,
    transparent: options.opacity != null, opacity: options.opacity ?? 1,
    side: THREE.DoubleSide,
  }));
  object.position.copy(position);
  parent.add(object);
  return object;
}
function path(parent, points, color, opacity = 1, dashed = false) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.07, gapSize: 0.045,
      transparent: true, opacity, depthTest: false })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity,
      depthTest: false });
  const line = new THREE.Line(geometry, material);
  if (dashed) line.computeLineDistances();
  line.renderOrder = 3;
  parent.add(line);
  return line;
}
function satellite(parent, position, size = 1) {
  const craft = new THREE.Group();
  craft.position.copy(position);
  craft.scale.setScalar(size);
  parent.add(craft);
  const bus = mesh(craft, new THREE.BoxGeometry(0.25, 0.24, 0.22), gold,
    point(0, 0), { metalness: 0.75, roughness: 0.35 });
  bus.userData.gnssPart = "Clock & radio · The atomic clock dates each message.";
  for (const x of [-0.38, 0.38]) {
    const panel = mesh(craft, new THREE.BoxGeometry(0.43, 0.012, 0.24), blue,
      point(x, 0), { metalness: 0.4, roughness: 0.32 });
    panel.userData.gnssPart = "Solar arrays · Sunlight powers the satellite.";
    mesh(craft, new THREE.CylinderGeometry(0.012, 0.012, 0.13, 8), 0xc8dbd5,
      point(Math.sign(x) * 0.14, 0), { metalness: 0.7 });
    for (let i = -1; i <= 1; i++)
      path(craft, [point(x - 0.21, 0.009, i * 0.07),
        point(x + 0.21, 0.009, i * 0.07)], 0x92b5c5, 0.8);
    for (let i = -1; i <= 1; i++)
      path(craft, [point(x + i * 0.1, 0.009, -0.12),
        point(x + i * 0.1, 0.009, 0.12)], 0x92b5c5, 0.8);
  }
  const antenna = mesh(craft,
    new THREE.CylinderGeometry(0.105, 0.035, 0.09, 20), 0xd7e7df,
    point(0, -0.16), { metalness: 0.6 });
  antenna.userData.gnssPart = "Antenna · Radio navigation signals beam toward Earth.";
  const antennaTip = mesh(craft, new THREE.SphereGeometry(0.037, 12, 8),
    0xeffcf2, point(0, -0.22));
  antennaTip.userData.gnssPart = antenna.userData.gnssPart;
  for (const z of [-0.11, 0.11])
    mesh(craft, new THREE.BoxGeometry(0.06, 0.06, 0.035), 0x768994,
      point(0, 0.1, z));
  return craft;
}

function receiver(parent, position) {
  mesh(parent, new THREE.CylinderGeometry(0.07, 0.09, 0.12, 16), 0xc9ded7,
    position, { metalness: 0.3 });
  mesh(parent, new THREE.SphereGeometry(0.028, 12, 8), teal,
    position.clone().add(point(0, 0.08)));
}

export class GnssScene {
  constructor(stage, { clockCorrected = false, environment = null } = {}) {
    this.group = new THREE.Group();
    this.group.userData.radius = 1.1;
    this.pulseAge = -1;
    this.stage = stage;
    this.satellitePoint = point(-0.13, 0.3);
    this.craft = satellite(this.group, this.satellitePoint,
      stage === GNSS_SATELLITE ? 1.25 : 0.9);
    if (stage === GNSS_SATELLITE) {
      const halo = mesh(this.group, new THREE.SphereGeometry(0.67, 24, 16),
        teal, this.satellitePoint.clone(), { opacity: 0.055 });
      halo.material.depthWrite = false;
    }
    if (stage === GNSS_SIGNAL) {
      const destination = point(0.35, -0.43);
      receiver(this.group, destination);
      path(this.group, [this.satellitePoint, destination], teal, 0.7, true);
      this.pulseShell = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20),
        new THREE.MeshBasicMaterial({ color: teal, transparent: true,
          opacity: 0.2, wireframe: true, depthWrite: false }));
      this.pulseShell.position.copy(this.satellitePoint);
      this.pulseShell.visible = false;
      this.group.add(this.pulseShell);
    }
    if (stage === GNSS_CLOCK) {
      const destination = point(0.15, -0.43);
      receiver(this.group, destination);
      for (const position of [point(-0.68, 0.67, -0.25),
        point(0.48, 0.65, -0.25), point(0.65, 0.1, -0.32)]) {
        satellite(this.group, position, 0.28);
        path(this.group, [position, destination], teal, 0.36, true);
      }
      path(this.group, [this.satellitePoint, destination], teal, 0.9);
      if (!clockCorrected) {
        const falseRange = destination.clone().add(point(0.34, -0.15));
        mesh(this.group, new THREE.SphereGeometry(0.045, 12, 8), gold,
          falseRange);
        path(this.group, [this.satellitePoint, falseRange], gold, 0.88, true);
        path(this.group, [destination, falseRange], gold, 0.75);
      } else
        mesh(this.group, new THREE.SphereGeometry(0.1, 20, 12), teal,
          destination, { opacity: 0.22 });
    }
    if (stage === GNSS_MULTIPATH) {
      const destination = point(0.4, -0.42);
      receiver(this.group, destination);
      const direct = [this.satellitePoint, destination];
      if (environment === "canyon") {
        for (const x of [-0.75, 0.78]) {
          const building = mesh(this.group,
            new THREE.BoxGeometry(0.25, 0.44, 0.36), 0x6d8290,
            point(x, -0.26, 0), { opacity: 0.62 });
          building.material.depthWrite = false;
        }
        path(this.group, direct, 0xff8f89, 0.65, true);
        const bounce = point(0.73, -0.04, -0.08);
        this.pathRatio = pathLength([
          this.satellitePoint.toArray(), bounce.toArray(), destination.toArray(),
        ]) / pathLength([this.satellitePoint.toArray(), destination.toArray()]);
        path(this.group, [this.satellitePoint, bounce, destination], gold, 0.95);
        mesh(this.group, new THREE.SphereGeometry(0.035, 10, 8), gold, bounce);
      } else if (environment === "open")
        path(this.group, direct, teal, 0.95);
      else path(this.group, direct, teal, 0.45, true);
    }
  }
  fire() {
    if (!this.pulseShell) return;
    this.pulseAge = 0;
    this.pulseShell.visible = true;
  }
  pickPart(raycaster) {
    if (this.stage !== GNSS_SATELLITE) return null;
    this.group.updateWorldMatrix(true, true);
    return raycaster.intersectObject(this.craft, true)
      .find((hit) => hit.object.userData.gnssPart)?.object.userData.gnssPart ?? null;
  }
  update(dt) {
    if (this.pulseAge < 0 || !this.pulseShell) return;
    this.pulseAge += dt;
    const progress = Math.min(1, this.pulseAge / 1.8);
    this.pulseShell.scale.setScalar(Math.max(0.015, progress * 1.2));
    this.pulseShell.material.opacity = 0.24 * (1 - progress);
    if (progress === 1) {
      this.pulseShell.visible = false;
      this.pulseAge = -1;
    }
  }
}
