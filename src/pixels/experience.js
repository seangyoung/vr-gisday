import * as THREE from "three";
import {
  LayerExperience,
  highwayDeckHeight,
  highwayZ,
  landscapeHeight,
  riverWaterHeight,
  riverX,
} from "../layers/experience.js";
import { PIXEL_EXTENT, PIXEL_SIZES, PixelModel } from "./model.js";

const gold = 0xffd36f;
const clamp = (value) => THREE.MathUtils.clamp(value, -PIXEL_EXTENT + 0.001, PIXEL_EXTENT - 0.001);

function surfaceY(x, z) {
  let y = landscapeHeight(x, z);
  if (Math.abs(x - riverX(z)) <= 2.2) y = Math.max(y, riverWaterHeight(z));
  if (Math.abs(z - highwayZ(x)) <= 6.1) y = Math.max(y, highwayDeckHeight(x));
  return y;
}

function footprint(cell) {
  const group = new THREE.Group();
  const steps = Math.max(2, Math.ceil(cell.size / 1.5));
  const path = [];
  const sides = [
    [cell.x0, cell.z0, cell.x0 + cell.size, cell.z0],
    [cell.x0 + cell.size, cell.z0, cell.x0 + cell.size, cell.z0 + cell.size],
    [cell.x0 + cell.size, cell.z0 + cell.size, cell.x0, cell.z0 + cell.size],
    [cell.x0, cell.z0 + cell.size, cell.x0, cell.z0],
  ];
  for (const [x0, z0, x1, z1] of sides)
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const x = THREE.MathUtils.lerp(x0, x1, t);
      const z = THREE.MathUtils.lerp(z0, z1, t);
      path.push(new THREE.Vector3(x, surfaceY(x, z) + 0.3, z));
    }
  path.push(path[0].clone());
  const border = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), path.length * 2, 0.065, 5),
    new THREE.MeshBasicMaterial({ color: gold }),
  );
  group.add(border);
  const fillSteps = Math.max(1, Math.ceil(cell.size / 2));
  const positions = [], indices = [];
  for (let row = 0; row <= fillSteps; row++)
    for (let col = 0; col <= fillSteps; col++) {
      const x = cell.x0 + (col / fillSteps) * cell.size;
      const z = cell.z0 + (row / fillSteps) * cell.size;
      positions.push(x, surfaceY(x, z) + 0.16, z);
      if (row < fillSteps && col < fillSteps) {
        const a = row * (fillSteps + 1) + col;
        indices.push(a, a + fillSteps + 1, a + 1, a + 1, a + fillSteps + 1, a + fillSteps + 2);
      }
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  group.add(new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
  ));
  for (const [x, z] of [
    [cell.x0, cell.z0], [cell.x0 + cell.size, cell.z0],
    [cell.x0, cell.z0 + cell.size], [cell.x0 + cell.size, cell.z0 + cell.size],
  ]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.85, 8),
      new THREE.MeshBasicMaterial({ color: gold }),
    );
    post.position.set(x, surfaceY(x, z) + 0.6, z);
    group.add(post);
  }
  return group;
}

export class PixelExperience extends LayerExperience {
  constructor(scene, onChange, onEvent = () => {}) {
    super(scene, onChange);
    this.onEvent = onEvent;
    this.clipboard.scale.setScalar(0.26);
    this.selected = new Set(["topography", "vegetation", "hydrology", "roads"]);
    this.applyVisibility();
    this.model = new PixelModel();
    this.size = 24;
    this.probe = { x: 0, z: -3 };
    this.answer = null;
    this.footprintAge = 1;
    this.footprint = null;
    this.refreshFootprint();
  }
  get cell() {
    return this.model.cellAt(this.probe.x, this.probe.z, this.size);
  }
  refreshFootprint(previousSize = null) {
    if (this.footprint) {
      this.footprint.removeFromParent();
      this.footprint.traverse((object) => {
        object.geometry?.dispose();
        object.material?.dispose();
      });
    }
    this.footprint = footprint(this.cell);
    const centerX = this.cell.x0 + this.size / 2;
    const centerZ = this.cell.z0 + this.size / 2;
    const pivot = new THREE.Group();
    pivot.position.set(centerX, 0, centerZ);
    this.footprint.position.set(-centerX, 0, -centerZ);
    pivot.add(this.footprint);
    this.footprint = pivot;
    this.footprintAge = previousSize ? 0 : 1;
    if (previousSize) {
      const start = THREE.MathUtils.clamp(previousSize / this.size, 0.35, 2);
      this.footprint.scale.set(start, 1, start);
    }
    this.variants.raised.world.add(this.footprint);
  }
  setSize(size) {
    if (this.finished || !PIXEL_SIZES.includes(size) || this.size === size) return;
    const previous = this.size;
    this.size = size;
    this.refreshFootprint(previous);
    this.onEvent(size > previous ? "merge" : "reveal");
    this.onChange();
  }
  update(dt) {
    super.update(dt);
    if (!this.footprint || this.footprintAge >= 1) return;
    this.footprintAge = Math.min(1, this.footprintAge + dt / 0.7);
    const current = this.footprint.scale.x;
    const next = THREE.MathUtils.damp(current, 1, 9, dt);
    this.footprint.scale.set(next, 1, next);
    if (this.footprintAge >= 1) this.footprint.scale.set(1, 1, 1);
  }
  get pureWaterAt48() {
    return this.model.raster(48).pixels.some(({ counts }) => counts[2] === 48 ** 2);
  }
  predictPureWater(answer) {
    if (this.finished || this.answer !== null) return;
    this.answer = answer;
    this.onEvent(answer === this.pureWaterAt48 ? "correct" : "blocked");
    this.onChange();
  }
  setProbe(x, z) {
    if (this.finished || !Number.isFinite(x) || !Number.isFinite(z)) return;
    this.probe.x = clamp(x);
    this.probe.z = clamp(z);
    this.refreshFootprint();
    this.onChange();
  }
  placeFromMap(hit) {
    if (!hit?.uv) return false;
    this.setProbe(
      (hit.uv.x * 2 - 1) * PIXEL_EXTENT,
      (1 - hit.uv.y * 2) * PIXEL_EXTENT,
    );
    return true;
  }
  hitTerrain(raycaster) {
    this.group.updateWorldMatrix(true, true);
    this.clipboard.updateWorldMatrix(true, true);
    if (this.clipboard.visible && raycaster.intersectObject(this.clipboard.children[0], false).length)
      return null;
    return raycaster.intersectObject(this.ground.raised, false)[0] ?? null;
  }
  placeFromRay(raycaster) {
    const hit = this.hitTerrain(raycaster);
    if (!hit) return false;
    const local = this.group.worldToLocal(hit.point.clone());
    this.setProbe(local.x, local.z);
    return true;
  }
  reset() {
    this.elapsed = 0;
    this.finished = false;
    this.size = 24;
    this.probe = { x: 0, z: -3 };
    this.answer = null;
    this.refreshFootprint();
    this.onChange();
  }
  renderMap(ctx, size = this.size) {
    const raster = this.model.raster(size);
    const width = ctx.canvas.width;
    const cellPixels = width / raster.cells;
    ctx.fillStyle = "#163b3b";
    ctx.fillRect(0, 0, width, width);
    raster.pixels.forEach(({ rgb }, index) => {
      const col = index % raster.cells;
      const row = Math.floor(index / raster.cells);
      ctx.fillStyle = `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
      ctx.fillRect(col * cellPixels, row * cellPixels, cellPixels + 0.5, cellPixels + 0.5);
    });
    if (cellPixels >= 8) {
      ctx.strokeStyle = "#13292666";
      ctx.lineWidth = 1;
      for (let i = 0; i <= raster.cells; i++) {
        const at = i * cellPixels;
        ctx.beginPath();
        ctx.moveTo(at, 0); ctx.lineTo(at, width);
        ctx.moveTo(0, at); ctx.lineTo(width, at);
        ctx.stroke();
      }
    }
    const cell = this.model.cellAt(this.probe.x, this.probe.z, size);
    ctx.strokeStyle = "#163039";
    ctx.lineWidth = 7;
    ctx.strokeRect(cell.col * cellPixels, cell.row * cellPixels, cellPixels, cellPixels);
    ctx.strokeStyle = "#ffdf75";
    ctx.lineWidth = 4;
    ctx.strokeRect(cell.col * cellPixels, cell.row * cellPixels, cellPixels, cellPixels);
    ctx.fillStyle = "#17313add";
    ctx.fillRect(0, 0, width, 42);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 23px system-ui, sans-serif";
    ctx.fillText(`MODEL COLORS · ${size} m`, 12, 29);
  }
}
