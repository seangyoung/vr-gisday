import * as THREE from "three";
import {
  LayerExperience,
  LANDSCAPE_EXTENT,
  highwayDeckHeight,
  highwayZ,
  landscapeHeight,
  makeHydrology,
  makeRoads,
  outerTerrainGeometry,
  riverWaterHeight,
  riverX,
} from "../layers/experience.js";
import { PIXEL_DETAIL_EXTENT, PIXEL_EXTENT, PIXEL_SIZES,
  PixelModel, REGIONAL_TREES, pixelSizeLabel } from "./model.js";

const gold = 0xffd36f;
const clamp = (value) => THREE.MathUtils.clamp(value, -PIXEL_EXTENT + 0.001, PIXEL_EXTENT - 0.001);

function addRegionalTrees(group, raised) {
  const deciduous = REGIONAL_TREES.filter((tree) => !tree.evergreen);
  const evergreen = REGIONAL_TREES.filter((tree) => tree.evergreen);
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.11, 0.18, 1.8, 6),
    new THREE.MeshStandardMaterial({ color: 0x705b45, roughness: 1 }),
    REGIONAL_TREES.length);
  const broadleaf = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1.15, 10, 6),
    new THREE.MeshStandardMaterial({ color: 0x547652, roughness: 1 }),
    deciduous.length);
  const pine = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 3.3, 8),
    new THREE.MeshStandardMaterial({ color: 0x426456, roughness: 1 }),
    evergreen.length);
  const temp = new THREE.Object3D();
  REGIONAL_TREES.forEach(({ x, z, scale }, index) => {
    temp.position.set(x, landscapeHeight(x, z, raised) + 0.9 * scale, z);
    temp.scale.setScalar(scale);
    temp.updateMatrix();
    trunk.setMatrixAt(index, temp.matrix);
  });
  for (const [trees, crown] of [
    [deciduous, broadleaf], [evergreen, pine],
  ]) trees.forEach(({ x, z, scale }, index) => {
    temp.position.set(x, landscapeHeight(x, z, raised) + 2.65 * scale, z);
    temp.scale.setScalar(scale);
    temp.updateMatrix();
    crown.setMatrixAt(index, temp.matrix);
  });
  group.add(trunk, broadleaf, pine);
}

function enlargeVariant(variant, raised) {
  const outer = variant.world.children[1];
  outer.geometry.dispose();
  outer.geometry = outerTerrainGeometry(raised,
    [LANDSCAPE_EXTENT, 230, 330, 480, PIXEL_EXTENT]);
  for (const [key, build] of [
    ["hydrology", makeHydrology], ["roads", makeRoads],
  ]) {
    const layer = variant[key];
    layer.traverse((object) => {
      if (object !== layer) { object.geometry?.dispose(); object.material?.dispose(); }
    });
    layer.clear();
    build(layer, raised, PIXEL_EXTENT);
  }
  addRegionalTrees(variant.vegetation, raised);
  return outer;
}

function surfaceY(x, z) {
  let y = landscapeHeight(x, z);
  if (Math.abs(x - riverX(z)) <= 2.2) y = Math.max(y, riverWaterHeight(z));
  if (Math.abs(z - highwayZ(x)) <= 6.1) y = Math.max(y, highwayDeckHeight(x));
  return y;
}

function visibleBounds(cell) {
  return {
    x0: Math.max(-PIXEL_EXTENT, cell.x0),
    x1: Math.min(PIXEL_EXTENT, cell.x0 + cell.size),
    z0: Math.max(-PIXEL_EXTENT, cell.z0),
    z1: Math.min(PIXEL_EXTENT, cell.z0 + cell.size),
  };
}

function footprint(cell) {
  const group = new THREE.Group();
  const { x0, x1, z0, z1 } = visibleBounds(cell);
  const span = Math.max(x1 - x0, z1 - z0);
  const steps = Math.max(2, Math.min(160, Math.ceil(span / 1.5)));
  const path = [];
  const sides = [
    [x0, z0, x1, z0],
    [x1, z0, x1, z1],
    [x1, z1, x0, z1],
    [x0, z1, x0, z0],
  ];
  for (const [x0, z0, x1, z1] of sides)
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const x = THREE.MathUtils.lerp(x0, x1, t);
      const z = THREE.MathUtils.lerp(z0, z1, t);
      path.push(new THREE.Vector3(x, surfaceY(x, z) + 0.3, z));
    }
  path.push(path[0].clone());
  group.add(new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), path.length * 2, 0.065, 5),
    new THREE.MeshBasicMaterial({ color: gold }),
  ));
  const fillSteps = Math.max(1, Math.min(112, Math.ceil(span / 2)));
  const positions = [], indices = [];
  for (let row = 0; row <= fillSteps; row++)
    for (let col = 0; col <= fillSteps; col++) {
      const x = x0 + (col / fillSteps) * (x1 - x0);
      const z = z0 + (row / fillSteps) * (z1 - z0);
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
  const postHeight = cell.size === 1000 ? 14 : 0.85;
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(cell.size === 1000 ? 0.22 : 0.055,
        cell.size === 1000 ? 0.22 : 0.055, postHeight, 8),
      new THREE.MeshBasicMaterial({ color: gold }),
    );
    post.position.set(x, surfaceY(x, z) + postHeight / 2 + 0.18, z);
    group.add(post);
  }
  return group;
}

export class PixelExperience extends LayerExperience {
  constructor(scene, onChange, onEvent = () => {}) {
    super(scene, onChange);
    this.walkExtent = PIXEL_EXTENT;
    this.teleportMaxDistance = 260;
    this.additionalPickGround = [enlargeVariant(this.variants.raised, true)];
    enlargeVariant(this.variants.flat, false);
    this.pickFlatGround.geometry.dispose();
    this.pickFlatGround.geometry = new THREE.PlaneGeometry(2 * PIXEL_EXTENT, 2 * PIXEL_EXTENT);
    if (scene.fog) { scene.fog.near = 400; scene.fog.far = 1250; }
    this.onEvent = onEvent;
    this.clipboardBaseScale = 0.26;
    this.clipboard.scale.setScalar(this.clipboardBaseScale);
    this.selected = new Set(["topography", "vegetation", "hydrology", "roads"]);
    this.applyVisibility();
    this.model = new PixelModel();
    this.size = 30;
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
    const bounds = visibleBounds(this.cell);
    const centerX = (bounds.x0 + bounds.x1) / 2;
    const centerZ = (bounds.z0 + bounds.z1) / 2;
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
    if (!this.started || this.finished || !PIXEL_SIZES.includes(size) || this.size === size) return;
    const previous = this.size;
    this.size = size;
    this.refreshFootprint(previous);
    this.onEvent(size > previous ? "merge" : "reveal");
    this.onChange();
  }
  update(dt) {
    if (!this.started) return;
    super.update(dt);
    if (!this.footprint || this.footprintAge >= 1) return;
    this.footprintAge = Math.min(1, this.footprintAge + dt / 0.7);
    const current = this.footprint.scale.x;
    const next = THREE.MathUtils.damp(current, 1, 9, dt);
    this.footprint.scale.set(next, 1, next);
    if (this.footprintAge >= 1) this.footprint.scale.set(1, 1, 1);
  }
  get pureWaterAt30() {
    return this.model.raster(30).pixels.some(({ counts, sampledArea }) =>
      sampledArea === 30 ** 2 && counts[2] === sampledArea);
  }
  predictPureWater(answer) {
    if (!this.started || this.finished || this.answer !== null) return;
    this.answer = answer;
    this.onEvent(answer === this.pureWaterAt30 ? "correct" : "blocked");
    this.onChange();
  }
  setProbe(x, z) {
    if (!this.started || this.finished || !Number.isFinite(x) || !Number.isFinite(z)) return;
    this.probe.x = clamp(x);
    this.probe.z = clamp(z);
    this.refreshFootprint();
    this.onChange();
  }
  placeFromMap(hit, mapExtent = PIXEL_DETAIL_EXTENT) {
    if (!hit?.uv) return false;
    this.setProbe(
      (hit.uv.x * 2 - 1) * mapExtent,
      (1 - hit.uv.y * 2) * mapExtent,
    );
    return true;
  }
  hitTerrain(raycaster) {
    this.pickGround.updateWorldMatrix(true, false);
    for (const extra of this.additionalPickGround)
      extra.updateWorldMatrix(true, false);
    this.clipboard.children[0].updateWorldMatrix(true, false);
    if (this.clipboard.visible && raycaster.intersectObject(this.clipboard.children[0], false).length)
      return null;
    return raycaster.intersectObjects([this.pickGround, ...this.additionalPickGround], false)[0] ?? null;
  }
  placeFromRay(raycaster) {
    if (!this.started || this.finished) return false;
    const hit = this.hitTerrain(raycaster);
    if (!hit) return false;
    const local = this.group.worldToLocal(hit.point.clone());
    this.setProbe(local.x, local.z);
    return true;
  }
  reset() {
    this.elapsed = 0;
    this.finished = false;
    this.size = 30;
    this.probe = { x: 0, z: -3 };
    this.answer = null;
    this.refreshFootprint();
    this.onChange();
  }
  renderMap(ctx, size = this.size, viewExtent = size === 1000
    ? PIXEL_EXTENT : PIXEL_DETAIL_EXTENT) {
    const width = ctx.canvas.width;
    const canvasPerMeter = width / (viewExtent * 2);
    ctx.fillStyle = "#163b3b";
    ctx.fillRect(0, 0, width, width);
    if (size === 1) {
      // Draw the neighborhood directly from typed RGB samples. Building a
      // million canvas rectangles or JS pixel objects would stall the headset.
      const image = ctx.createImageData(width, width);
      for (let row = 0; row < width; row++)
        for (let col = 0; col < width; col++) {
          const x = Math.floor(PIXEL_EXTENT - viewExtent + (col + 0.5) / canvasPerMeter);
          const z = Math.floor(PIXEL_EXTENT - viewExtent + (row + 0.5) / canvasPerMeter);
          const source = (z * this.model.width + x) * 3;
          const target = (row * width + col) * 4;
          image.data[target] = this.model.rgb[source];
          image.data[target + 1] = this.model.rgb[source + 1];
          image.data[target + 2] = this.model.rgb[source + 2];
          image.data[target + 3] = 255;
        }
      ctx.putImageData(image, 0, 0);
    } else {
      const raster = this.model.raster(size);
      for (let row = 0; row < raster.cells; row++)
        for (let col = 0; col < raster.cells; col++) {
          const x0 = Math.max(-viewExtent, -PIXEL_EXTENT + col * size);
          const x1 = Math.min(viewExtent, -PIXEL_EXTENT + (col + 1) * size);
          const z0 = Math.max(-viewExtent, -PIXEL_EXTENT + row * size);
          const z1 = Math.min(viewExtent, -PIXEL_EXTENT + (row + 1) * size);
          if (x1 <= x0 || z1 <= z0) continue;
          const { rgb } = raster.pixels[row * raster.cells + col];
          ctx.fillStyle = `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
          ctx.fillRect((x0 + viewExtent) * canvasPerMeter,
            (z0 + viewExtent) * canvasPerMeter,
            (x1 - x0) * canvasPerMeter + 0.5,
            (z1 - z0) * canvasPerMeter + 0.5);
        }
    }
    if (size * canvasPerMeter >= 8 && size < viewExtent * 2) {
      ctx.strokeStyle = "#13292666";
      ctx.lineWidth = 1;
      const start = Math.ceil((PIXEL_EXTENT - viewExtent) / size);
      const end = Math.floor((PIXEL_EXTENT + viewExtent) / size);
      for (let i = start; i <= end; i++) {
        const at = (-PIXEL_EXTENT + i * size + viewExtent) * canvasPerMeter;
        ctx.beginPath();
        ctx.moveTo(at, 0); ctx.lineTo(at, width);
        ctx.moveTo(0, at); ctx.lineTo(width, at);
        ctx.stroke();
      }
    }
    const cell = this.model.cellAt(this.probe.x, this.probe.z, size);
    const cellX0 = Math.max(-viewExtent, cell.x0);
    const cellX1 = Math.min(viewExtent, cell.x0 + size);
    const cellZ0 = Math.max(-viewExtent, cell.z0);
    const cellZ1 = Math.min(viewExtent, cell.z0 + size);
    if (cellX1 > cellX0 && cellZ1 > cellZ0) {
      const cellX = (cellX0 + viewExtent) * canvasPerMeter;
      const cellY = (cellZ0 + viewExtent) * canvasPerMeter;
      const sampledWidth = (cellX1 - cellX0) * canvasPerMeter;
      const sampledHeight = (cellZ1 - cellZ0) * canvasPerMeter;
      ctx.strokeStyle = "#163039";
      ctx.lineWidth = 7;
      ctx.strokeRect(cellX, cellY, sampledWidth, sampledHeight);
      ctx.strokeStyle = "#ffdf75";
      ctx.lineWidth = 4;
      ctx.strokeRect(cellX, cellY, sampledWidth, sampledHeight);
    }
    if (viewExtent === PIXEL_EXTENT) {
      const at = (PIXEL_EXTENT - PIXEL_DETAIL_EXTENT) * canvasPerMeter;
      const span = PIXEL_DETAIL_EXTENT * 2 * canvasPerMeter;
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(at, at, span, span);
      ctx.setLineDash([]);
      ctx.fillStyle = "#163039dd";
      ctx.fillRect(at - 2, at + span + 5, 132, 25);
      ctx.fillStyle = "#ffffff";
      ctx.font = "18px system-ui, sans-serif";
      ctx.fillText("144 m detail area", at + 4, at + span + 23);
    }
    ctx.fillStyle = "#17313add";
    ctx.fillRect(0, 0, width, 42);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 23px system-ui, sans-serif";
    ctx.fillText(`MODEL COLORS · ${pixelSizeLabel(size)} · ${viewExtent === PIXEL_EXTENT
      ? "1 km region" : "144 m detail"}`, 12, 29);
  }
}
