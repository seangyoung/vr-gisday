import * as THREE from "three";

const SAMPLE_BUDGET = 900;
const REFERENCE_STATIONS = Array.from({ length: 12 }, (_, index) => {
  const angle = (index / 12) * Math.PI * 2;
  return new THREE.Vector3(11 * Math.cos(angle), 1.45, 9.5 * Math.sin(angle));
}).concat([
  new THREE.Vector3(0, 1.45, 4),
  new THREE.Vector3(0, 1.45, -4),
  new THREE.Vector3(-4, 1.45, 0),
  new THREE.Vector3(4, 1.45, 0),
]);

function seededRandom(seed = 73621) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function meshTriangles(mesh) {
  mesh.updateWorldMatrix(true, false);
  const position = mesh.geometry.getAttribute("position");
  const indices = mesh.geometry.index;
  const triangles = [];
  let area = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const edge = new THREE.Vector3(), other = new THREE.Vector3();
  const length = indices?.count ?? position.count;
  for (let i = 0; i < length; i += 3) {
    const index = (offset) => indices ? indices.getX(i + offset) : i + offset;
    a.fromBufferAttribute(position, index(0)).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(position, index(1)).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(position, index(2)).applyMatrix4(mesh.matrixWorld);
    edge.subVectors(b, a);
    other.subVectors(c, a);
    const triangleArea = edge.cross(other).length() / 2;
    if (triangleArea < 1e-6) continue;
    area += triangleArea;
    triangles.push({ a: a.clone(), b: b.clone(), c: c.clone(), upto: area });
  }
  return { mesh, triangles, area };
}

function sampleMesh(info, random) {
  const aim = random() * info.area;
  let lo = 0, hi = info.triangles.length - 1;
  while (lo < hi) {
    const middle = (lo + hi) >> 1;
    if (info.triangles[middle].upto < aim) lo = middle + 1;
    else hi = middle;
  }
  const triangle = info.triangles[lo];
  const u = Math.sqrt(random()), v = random();
  const point = triangle.a.clone().multiplyScalar(1 - u)
    .addScaledVector(triangle.b, u * (1 - v))
    .addScaledVector(triangle.c, u * v);
  return { point, mesh: info.mesh };
}

export class StationCoverage {
  constructor(targets, occluders, budget = SAMPLE_BUDGET, space = null) {
    this.occluders = occluders;
    this.space = space;
    this.ray = new THREE.Raycaster();
    const random = seededRandom();
    const meshes = targets.map(meshTriangles).filter(({ area }) => area > 0);
    const weights = meshes.map(({ area }) => Math.sqrt(area));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const proposals = [];
    for (const info of meshes)
      for (let i = 0; i < 8; i++) proposals.push(sampleMesh(info, random));
    const extra = Math.max(0, budget - proposals.length);
    for (let i = 0; i < extra; i++) {
      let pick = random() * totalWeight;
      let index = 0;
      while (index < meshes.length - 1 && pick > weights[index])
        pick -= weights[index++];
      proposals.push(sampleMesh(meshes[index], random));
    }
    this.samples = proposals.filter((sample) =>
      REFERENCE_STATIONS.some((station) => this.visible(sample, station)));
    this.captured = new Uint8Array(this.samples.length);
    this.count = 0;
  }

  visible(sample, origin) {
    const worldOrigin = this.space ? origin.clone().applyMatrix4(this.space.matrixWorld) : origin;
    const worldPoint = this.space
      ? sample.point.clone().applyMatrix4(this.space.matrixWorld) : sample.point;
    const direction = worldPoint.clone().sub(worldOrigin);
    const distance = direction.length();
    if (distance < 0.15) return false;
    this.ray.set(worldOrigin, direction.multiplyScalar(1 / distance));
    this.ray.near = 0.02;
    this.ray.far = distance + 0.08;
    const first = this.ray.intersectObjects(this.occluders, false)[0];
    return first?.object === sample.mesh &&
      Math.abs(first.distance - distance) < 0.09;
  }

  capture(index, origin) {
    if (this.captured[index] || !this.visible(this.samples[index], origin)) return false;
    this.captured[index] = 1;
    this.count++;
    return true;
  }

  prepare() {
    this.space?.updateWorldMatrix(true, true);
  }

  get percent() {
    return this.samples.length ? Math.round(100 * this.count / this.samples.length) : 0;
  }
}
