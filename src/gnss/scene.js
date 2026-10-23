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
function route(parent, points, color) {
  const curve = new THREE.CurvePath();
  for (let i = 1; i < points.length; i++)
    curve.add(new THREE.LineCurve3(points[i - 1], points[i]));
  mesh(parent, new THREE.TubeGeometry(curve, 56, 0.025, 6, false),
    color, point(0, 0), { opacity: 0.13 }).material.depthWrite = false;
  mesh(parent, new THREE.TubeGeometry(curve, 56, 0.008, 6, false),
    color, point(0, 0));
}
function satellite(parent, position, size = 1) {
  const craft = new THREE.Group();
  craft.position.copy(position);
  craft.scale.setScalar(size);
  parent.add(craft);
  const bus = mesh(craft, new THREE.BoxGeometry(0.29, 0.33, 0.27), 0x435360,
    point(0, 0.02));
  bus.userData.gnssPart = "Clock & radio · The atomic clock dates each message.";
  // A stylized GPS III configuration: insulated bus, antenna deck, and two
  // deployable solar wings. It follows the official silhouette, not flight CAD.
  const foil = mesh(craft, new THREE.BoxGeometry(0.245, 0.27, 0.012),
    0xb99962, point(0, 0.02, 0.143));
  foil.userData.gnssPart = bus.userData.gnssPart;
  for (const x of [-0.126, 0.126])
    mesh(craft, new THREE.BoxGeometry(0.012, 0.29, 0.02), 0xe0bf7d,
      point(x, 0.02, 0.153)).userData.gnssPart = bus.userData.gnssPart;
  mesh(craft, new THREE.BoxGeometry(0.31, 0.025, 0.29), 0xd6bd87,
    point(0, 0.2));
  const radiator = mesh(craft, new THREE.BoxGeometry(0.18, 0.19, 0.012),
    0xc7d1d4, point(0, 0.01, -0.144));
  radiator.userData.gnssPart = "Spacecraft bus · Electronics process and broadcast navigation data.";
  for (const sign of [-1, 1]) {
    const x = sign * 0.55;
    const boom = mesh(craft, new THREE.CylinderGeometry(0.013, 0.013, 0.19, 8),
      0xbac9ca, point(sign * 0.22, 0.015, 0));
    boom.rotation.z = Math.PI / 2;
    const frame = mesh(craft, new THREE.BoxGeometry(0.53, 0.37, 0.016),
      0x9aabb1, point(x, 0.02, 0.035));
    frame.userData.gnssPart = "Solar arrays · Sunlight powers the satellite.";
    for (let column = 0; column < 4; column++)
      for (let row = 0; row < 3; row++) {
        const cell = mesh(craft, new THREE.BoxGeometry(0.117, 0.108, 0.006),
          (column + row) % 2 ? 0x274d78 : blue,
          point(x + (column - 1.5) * 0.127,
            0.02 + (row - 1) * 0.117, 0.047));
        cell.userData.gnssPart = frame.userData.gnssPart;
      }
  }
  const deck = mesh(craft, new THREE.BoxGeometry(0.32, 0.035, 0.3),
    0xe0e7e3, point(0, -0.17));
  deck.userData.gnssPart = "Antenna deck · Navigation signals are directed toward Earth.";
  for (const x of [-0.085, 0.085])
    for (const z of [-0.073, 0.073]) {
      const patch = mesh(craft,
        new THREE.CylinderGeometry(0.053, 0.042, 0.025, 16), 0xf3f4eb,
        point(x, -0.2, z));
      patch.userData.gnssPart = deck.userData.gnssPart;
    }
  const antenna = mesh(craft,
    new THREE.CylinderGeometry(0.06, 0.027, 0.075, 18), 0xc7d9dc,
    point(0, -0.235));
  antenna.userData.gnssPart = "Antenna · Radio navigation signals beam toward Earth.";
  const antennaTip = mesh(craft, new THREE.SphereGeometry(0.035, 12, 8),
    0xeffcf2, point(0, -0.28));
  antennaTip.userData.gnssPart = antenna.userData.gnssPart;
  mesh(craft, new THREE.CylinderGeometry(0.035, 0.05, 0.065, 12),
    0x9ca9ac, point(0, 0.25));
  return craft;
}

function receiver(parent, position) {
  mesh(parent, new THREE.CylinderGeometry(0.07, 0.09, 0.12, 16), 0xc9ded7,
    position);
  mesh(parent, new THREE.SphereGeometry(0.028, 12, 8), teal,
    position.clone().add(point(0, 0.08)));
}

export class GnssScene {
  constructor(stage, { clockCorrected = false, environment = null } = {}) {
    this.group = new THREE.Group();
    this.group.userData.radius = 1.3;
    this.pulseAge = -1;
    this.fourthAge = -1;
    this.stage = stage;
    this.satellitePoint = stage === GNSS_MULTIPATH
      ? point(-0.56, 0.45) : point(-0.13, 0.3);
    this.craft = satellite(this.group, this.satellitePoint,
      stage === GNSS_SATELLITE ? 1.25 :
        stage === GNSS_CLOCK ? 0.32 : stage === GNSS_MULTIPATH ? 0.65 : 0.9);
    this.craftBounds = new THREE.Box3().setFromObject(this.craft);
    if (stage === GNSS_SATELLITE) {
      const halo = mesh(this.group, new THREE.SphereGeometry(0.67, 24, 16),
        teal, this.satellitePoint.clone(), { opacity: 0.055 });
      halo.material.depthWrite = false;
      halo.userData.rayIgnore = true;
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
      this.pulseShell.userData.rayIgnore = true;
      this.group.add(this.pulseShell);
    }
    if (stage === GNSS_CLOCK) {
      const destination = point(0.15, -0.43);
      receiver(this.group, destination);
      for (const position of [point(-0.68, 0.67, -0.25),
        point(0.48, 0.65, -0.25)]) {
        satellite(this.group, position, 0.32);
        path(this.group, [position, destination], teal, 0.36, true);
      }
      this.satelliteCount = clockCorrected ? 4 : 3;
      path(this.group, [this.satellitePoint, destination], teal, 0.9);
      if (!clockCorrected) {
        const falseRange = destination.clone().add(point(0.34, -0.15));
        mesh(this.group, new THREE.SphereGeometry(0.045, 12, 8), gold,
          falseRange);
        path(this.group, [this.satellitePoint, falseRange], gold, 0.88, true);
        path(this.group, [destination, falseRange], gold, 0.75);
      } else {
        const fourthPosition = point(0.65, 0.1, -0.32);
        this.fourth = satellite(this.group, fourthPosition, 0.32);
        path(this.group, [fourthPosition, destination], 0xa6f5d9, 0.95);
        mesh(this.group, new THREE.SphereGeometry(0.1, 20, 12), teal,
          destination, { opacity: 0.22 });
      }
    }
    if (stage === GNSS_MULTIPATH) {
      const destination = point(0.4, -0.42);
      receiver(this.group, destination);
      const direct = [this.satellitePoint, destination];
      if (environment === "canyon") {
        for (const [x, y, width, height] of [
          [-0.05, -0.13, 0.30, 0.56], [0.79, -0.10, 0.25, 0.58],
        ]) {
          const building = mesh(this.group,
            new THREE.BoxGeometry(width, height, 0.36), 0x617986,
            point(x, y, 0), { opacity: 0.76 });
          building.material.depthWrite = false;
          for (let row = 0; row < 3; row++)
            for (const offset of [-0.07, 0.07])
              mesh(this.group, new THREE.BoxGeometry(0.045, 0.055, 0.004),
                0x9db5be, point(x + offset, y + (row - 1) * 0.13, 0.185),
                { opacity: 0.54 });
        }
        path(this.group, direct, 0xff938e, 0.9, true);
        route(this.group, [point(-0.11, -0.07, 0.19),
          point(0.01, 0.05, 0.19)], 0xff938e);
        route(this.group, [point(-0.11, 0.05, 0.19),
          point(0.01, -0.07, 0.19)], 0xff938e);
        const bounce = point(0.66, 0.17, 0.185);
        this.pathRatio = pathLength([
          this.satellitePoint.toArray(), bounce.toArray(), destination.toArray(),
        ]) / pathLength([this.satellitePoint.toArray(), destination.toArray()]);
        this.signalRoute = [this.satellitePoint, bounce, destination];
        route(this.group, this.signalRoute, gold);
        mesh(this.group, new THREE.SphereGeometry(0.035, 10, 8), gold, bounce);
      } else if (environment === "open") {
        this.signalRoute = direct;
        route(this.group, direct, teal);
      } else path(this.group, direct, teal, 0.45, true);
      if (this.signalRoute) {
        this.signalAge = 0;
        this.signalDuration = 1.4 * pathLength(this.signalRoute.map((p) => p.toArray())) /
          pathLength(direct.map((p) => p.toArray()));
        this.signalMarker = mesh(this.group,
          new THREE.SphereGeometry(0.032, 12, 8),
          environment === "canyon" ? gold : teal, this.satellitePoint.clone());
        this.signalMarker.material.depthTest = false;
        this.signalMarker.renderOrder = 5;
        this.receiverGlow = mesh(this.group,
          new THREE.SphereGeometry(0.095, 16, 12), teal,
          destination.clone(), { opacity: 0 });
        this.receiverGlow.material.depthWrite = false;
      }
    }
  }
  fire() {
    if (!this.pulseShell) return;
    this.pulseAge = 0;
    this.pulseShell.visible = true;
  }
  revealFourth() {
    if (!this.fourth) return;
    this.fourthAge = 0;
    this.fourth.scale.setScalar(0.001);
  }
  pickPart(raycaster) {
    if (this.stage !== GNSS_SATELLITE) return null;
    this.group.updateWorldMatrix(true, true);
    const hit = raycaster.intersectObject(this.craft, true)
      .find((candidate) => candidate.object.userData.gnssPart);
    return hit ? { text: hit.object.userData.gnssPart, point: hit.point.clone() } : null;
  }
  hitSurface(raycaster) {
    this.group.updateWorldMatrix(true, true);
    return raycaster.intersectObject(this.group, true).find((hit) =>
      hit.object.isMesh && !hit.object.userData.rayIgnore &&
      hit.object.material.opacity >= 0.5) ?? null;
  }
  update(dt) {
    if (this.signalRoute) {
      this.signalAge += dt;
      const cycle = this.signalDuration + 0.5;
      const elapsed = this.signalAge % cycle;
      const progress = Math.min(1, elapsed / this.signalDuration);
      const lengths = [];
      for (let i = 1; i < this.signalRoute.length; i++)
        lengths.push(this.signalRoute[i].distanceTo(this.signalRoute[i - 1]));
      let remaining = progress * lengths.reduce((a, b) => a + b, 0);
      this.signalMarker.visible = elapsed <= this.signalDuration;
      for (let i = 0; i < lengths.length; i++) {
        if (remaining <= lengths[i] || i === lengths.length - 1) {
          this.signalMarker.position.copy(this.signalRoute[i]).lerp(
            this.signalRoute[i + 1], Math.min(1, remaining / lengths[i]));
          break;
        }
        remaining -= lengths[i];
      }
      this.receiverGlow.material.opacity = elapsed > this.signalDuration
        ? 0.32 * (1 - (elapsed - this.signalDuration) / 0.5) : 0;
    }
    if (this.fourthAge >= 0 && this.fourth) {
      this.fourthAge += dt;
      const progress = Math.min(1, this.fourthAge / 0.8);
      this.fourth.scale.setScalar(0.32 * (1 - (1 - progress) ** 3));
      if (progress === 1) this.fourthAge = -1;
    }
    if (this.pulseAge >= 0 && this.pulseShell) {
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
}
