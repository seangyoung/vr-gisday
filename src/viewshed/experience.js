import * as THREE from "three";
import {
  LANDSCAPE_EXTENT,
  LayerExperience,
  landscapeHeight,
} from "../layers/experience.js";
import { renderLayerMap } from "../layers/map.js";
import { TerrainSampler, calculateViewshed, traceSightline } from "./analysis.js";

const TARGET = { x: 50, z: -100 };

const visibleColor = new THREE.Color(0x55e5a9);
const hiddenColor = new THREE.Color(0x9176bd);

function coverageMesh(analysis) {
  const positions = [], colors = [], indices = [];
  const { values, cells, extent, cellSize } = analysis;
  for (let row = 0; row < cells; row++)
    for (let col = 0; col < cells; col++) {
      const state = values[row * cells + col];
      if (!state) continue;
      const x0 = -extent + col * cellSize, x1 = x0 + cellSize;
      const z0 = -extent + row * cellSize, z1 = z0 + cellSize;
      const first = positions.length / 3;
      for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
        positions.push(x, landscapeHeight(x, z) + 0.12, z);
        const color = state === 1 ? visibleColor : hiddenColor;
        colors.push(color.r, color.g, color.b);
      }
      indices.push(first, first + 2, first + 1, first + 1, first + 2, first + 3);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.43,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
}

function observationMarker() {
  const marker = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffce68, emissive: 0x6b420c, roughness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x394c55, roughness: 0.8 });
  const mastMaterial = new THREE.MeshStandardMaterial({ color: 0x6d858b, metalness: 0.25, roughness: 0.6 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.2, 16), dark);
  base.position.y = 0.1;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.065, 1, 12), mastMaterial);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), gold);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.74, 0.045, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0xffd879 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  marker.add(base, mast, eye, ring);
  marker.userData.mast = mast;
  marker.userData.eye = eye;
  return marker;
}

export class ViewshedExperience extends LayerExperience {
  constructor(scene, onChange, onEvent = () => {}) {
    super(scene, onChange);
    this.onEvent = onEvent;
    this.selected = new Set(["topography", "vegetation", "hydrology", "roads"]);
    this.applyVisibility();
    this.view = "scene";
    this.sampler = new TerrainSampler(LANDSCAPE_EXTENT, 320);
    this.observer = { x: 0, z: 0, height: 2 };
    this.visualHeight = 2;
    this.revealAge = 1;
    this.marker = observationMarker();
    this.variants.raised.world.add(this.marker);
    this.targetRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.3, 0.18, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x55d8f3, depthTest: false }),
    );
    this.targetRing.rotation.x = Math.PI / 2;
    this.targetRing.position.set(TARGET.x, landscapeHeight(TARGET.x, TARGET.z) + 0.2, TARGET.z);
    this.variants.raised.world.add(this.targetRing);
    this.sightline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: visibleColor, transparent: true, opacity: 0.85, depthTest: false }),
    );
    this.sightline.frustumCulled = false;
    this.variants.raised.world.add(this.sightline);
    this.analysis = null;
    this.overlay = null;
    this.refresh();
  }
  refresh() {
    this.analysis = calculateViewshed(
      (x, z) => this.sampler.sample(x, z),
      this.observer,
      { cells: 161, radius: 125, sampleStep: 1.7 },
    );
    if (this.overlay) {
      this.overlay.removeFromParent();
      this.overlay.geometry.dispose();
      this.overlay.material.dispose();
    }
    this.overlay = coverageMesh(this.analysis);
    this.overlay.material.opacity = 0;
    this.revealAge = 0;
    this.variants.raised.world.add(this.overlay);
    const ground = landscapeHeight(this.observer.x, this.observer.z);
    this.marker.position.set(this.observer.x, ground, this.observer.z);
    this.setVisualHeight(this.visualHeight);
    this.trace = traceSightline((x, z) => this.sampler.sample(x, z),
      this.observer, TARGET, 1.7);
    const positions = this.sightline.geometry.attributes.position;
    positions.setXYZ(0, this.observer.x, ground + this.observer.height, this.observer.z);
    positions.setXYZ(1, this.observer.x, ground + this.observer.height, this.observer.z);
    positions.needsUpdate = true;
    this.sightline.geometry.computeBoundingSphere();
    this.sightline.material.color.set(this.trace.visible ? visibleColor : hiddenColor);
  }
  setVisualHeight(height) {
    this.marker.userData.mast.scale.y = height;
    this.marker.userData.mast.position.y = height / 2;
    this.marker.userData.eye.position.y = height;
  }
  update(dt) {
    super.update(dt);
    this.revealAge = Math.min(1, this.revealAge + dt / 0.9);
    if (this.overlay) this.overlay.material.opacity = 0.43 * this.revealAge;
    if (this.sightline) {
      const ease = 1 - (1 - this.revealAge) ** 2;
      const startY = landscapeHeight(this.observer.x, this.observer.z) + this.observer.height;
      const positions = this.sightline.geometry.attributes.position;
      positions.setXYZ(1,
        THREE.MathUtils.lerp(this.observer.x, this.trace.end.x, ease),
        THREE.MathUtils.lerp(startY, this.trace.end.y, ease),
        THREE.MathUtils.lerp(this.observer.z, this.trace.end.z, ease),
      );
      positions.needsUpdate = true;
    }
    this.visualHeight = THREE.MathUtils.damp(this.visualHeight, this.observer.height, 6, dt);
    this.setVisualHeight(this.visualHeight);
  }
  setObserver(x, z) {
    if (this.finished || !Number.isFinite(x) || !Number.isFinite(z)) return;
    this.observer.x = THREE.MathUtils.clamp(x, -LANDSCAPE_EXTENT + 2, LANDSCAPE_EXTENT - 2);
    this.observer.z = THREE.MathUtils.clamp(z, -LANDSCAPE_EXTENT + 2, LANDSCAPE_EXTENT - 2);
    this.refresh();
    this.onEvent(this.trace.visible ? "correct" : "blocked");
    this.onChange();
  }
  setHeight(height) {
    if (this.finished || (height !== 2 && height !== 12)) return;
    this.observer.height = height;
    this.refresh();
    this.onEvent(this.trace.visible ? "correct" : "blocked");
    this.onChange();
  }
  setView(view) {
    if (view !== "scene" && view !== "map") return;
    this.view = view;
    this.onChange();
  }
  placeFromMap(hit) {
    if (!hit?.uv) return;
    this.setObserver(
      (hit.uv.x * 2 - 1) * LANDSCAPE_EXTENT,
      (1 - hit.uv.y * 2) * LANDSCAPE_EXTENT,
    );
  }
  placeFromRay(raycaster) {
    const hit = this.hitTerrain(raycaster);
    if (!hit) return false;
    const local = this.group.worldToLocal(hit.point.clone());
    this.setObserver(local.x, local.z);
    return true;
  }
  hitTerrain(raycaster) {
    this.group.updateWorldMatrix(true, true);
    this.clipboard.updateWorldMatrix(true, true);
    if (this.clipboard.visible && raycaster.intersectObject(this.clipboard.children[0], false).length)
      return null;
    return raycaster.intersectObject(this.ground.raised, false)[0] ?? null;
  }
  reset() {
    this.elapsed = 0;
    this.finished = false;
    this.observer = { x: 0, z: 0, height: 2 };
    this.visualHeight = 2;
    this.refresh();
    this.onChange();
  }
  get visiblePercent() {
    return Math.round((100 * this.analysis.visible) / this.analysis.sampled);
  }
  renderMap(ctx) {
    renderLayerMap(ctx, this.selected, { annotations: false });
    const size = ctx.canvas.width;
    const ratio = size / 384;
    const { values, cells } = this.analysis;
    const pixel = size / cells;
    for (let row = 0; row < cells; row++)
      for (let col = 0; col < cells; col++) {
        const value = values[row * cells + col];
        if (!value) continue;
        ctx.fillStyle = value === 1 ? "#34d99b88" : "#8f6cbb99";
        ctx.fillRect(col * pixel, row * pixel, pixel + 0.5, pixel + 0.5);
      }
    const x = ((this.observer.x + LANDSCAPE_EXTENT) / (2 * LANDSCAPE_EXTENT)) * size;
    const y = ((this.observer.z + LANDSCAPE_EXTENT) / (2 * LANDSCAPE_EXTENT)) * size;
    ctx.beginPath();
    ctx.arc(x, y, 7 * ratio, 0, Math.PI * 2);
    ctx.fillStyle = "#ffcf62";
    ctx.fill();
    ctx.lineWidth = 2 * ratio;
    ctx.strokeStyle = "#1b3037";
    ctx.stroke();
    ctx.fillStyle = "#17363dcc";
    ctx.fillRect(0, size - 32 * ratio, size, 32 * ratio);
    ctx.fillStyle = "#ffffff";
    ctx.font = `${18 * ratio}px system-ui, sans-serif`;
    ctx.fillText("Green visible · Purple hidden", 10 * ratio, size - 10 * ratio);
    const targetX = ((TARGET.x + LANDSCAPE_EXTENT) / (2 * LANDSCAPE_EXTENT)) * size;
    const targetZ = ((TARGET.z + LANDSCAPE_EXTENT) / (2 * LANDSCAPE_EXTENT)) * size;
    ctx.beginPath();
    ctx.arc(targetX, targetZ, 7 * ratio, 0, Math.PI * 2);
    ctx.fillStyle = "#55d8f3";
    ctx.fill();
    ctx.font = `bold ${17 * ratio}px system-ui, sans-serif`;
    ctx.fillStyle = "#17363d";
    ctx.fillText("MODEL N ↑", 10 * ratio, 23 * ratio);
  }
}
