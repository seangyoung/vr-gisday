import * as THREE from "three";
import { ModelGrab } from "../manipulation.js";
import { createTray, ErosionWater, EROSION_SIZE } from "./erosion.js";
import { WaterSurface } from "./water-surface.js";
import { SurfaceWater } from "./water.js";
import {
  SIZE,
  createHeights,
  sculpt,
  cellPoint,
  cellAt,
  routeFrom,
  outletFor,
  CHALLENGE,
  OUTLET_A,
  OUTLET_B,
} from "./terrain.js";
const COLORS = { A: 0x60e3f0, B: 0xffce83, sink: 0xd5a2ff };
export class RainExperience {
  constructor(scene, onChange, kind = "drainage") {
    this.kind = kind;
    this.size = kind === "erosion" ? EROSION_SIZE : SIZE;
    this.spacing = 2 / (this.size - 1);
    this.cellAt = (x, z) => cellAt(x, z, this.size);
    this.pouring = false;
    this.pourIndex = 0;
    this.meshTime = 0;
    this.onChange = onChange;
    this.stage = 0;
    this.heights =
      this.kind === "erosion" ? createTray(this.size) : createHeights();
    this.water =
      this.kind === "erosion"
        ? new ErosionWater(this.heights)
        : new SurfaceWater(this.heights);
    this.mode = "rain";
    this.edited = false;
    this.stroke = null;
    this.trees = [];
    this.elapsed = 0;
    this.overlay = false;
    this.answer = null;
    this.counts = { A: 0, B: 0, sink: 0 };
    this.source = this.cellAt(-0.45, -0.3);
    this.drops = [];
    this.trails = [];
    this.emission = 0;
    this.time = 0;
    this.playback = 0;
    this.group = new THREE.Group();
    this.grab = new ModelGrab(this.group, 0.22, 0.75);
    scene.add(this.group);
    this.group.add(new THREE.HemisphereLight(0xd4f5ff, 0x39513a, 2.3));
    const sun = new THREE.DirectionalLight(0xffe5ba, 2.2);
    sun.position.set(-2, 4, 1);
    this.group.add(sun);
    this.routes = Array.from({ length: this.size * this.size }, (_, i) =>
      this.kind === "erosion" ? [i] : routeFrom(i, this.heights),
    );
    this.basins = this.routes.map((p) => (p.at(-1) === OUTLET_A ? "A" : "B"));
    const vertices = [],
      indices = [];
    for (let i = 0; i < this.size * this.size; i++) {
      const p = cellPoint(i, this.heights);
      vertices.push(p.x, p.y, p.z);
    }
    for (let r = 0; r < this.size - 1; r++)
      for (let c = 0; c < this.size - 1; c++) {
        const i = r * this.size + c;
        indices.push(
          i,
          i + this.size,
          i + 1,
          i + 1,
          i + this.size,
          i + this.size + 1,
        );
      }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(this.size * this.size * 3), 3),
    );
    this.terrain = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        side: THREE.DoubleSide,
      }),
    );
    this.group.add(this.terrain);
    if (this.kind === "erosion") {
      const lines = [];
      for (let a = 0; a < this.size; a += 4)
        for (let b = 0; b < this.size - 1; b++)
          for (const pair of [
            [a * this.size + b, a * this.size + b + 1],
            [b * this.size + a, (b + 1) * this.size + a],
          ])
            for (const id of pair) {
              const p = cellPoint(id, this.heights);
              lines.push(p.x, p.y + 0.003, p.z);
            }
      const original = new THREE.BufferGeometry();
      original.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(lines, 3),
      );
      this.originalBed = new THREE.LineSegments(
        original,
        new THREE.LineBasicMaterial({
          color: 0xf2f5e9,
          transparent: true,
          opacity: 0.55,
        }),
      );
      this.originalBed.visible = false;
      this.group.add(this.originalBed);
    }
    this.paint();
    // Contours are derived from the same triangles used by routing and ray selection.
    const contourPoints = [];
    for (const level of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7]) {
      for (let k = 0; k < indices.length; k += 3) {
        const tri = indices
          .slice(k, k + 3)
          .map(
            (id) => new THREE.Vector3(...vertices.slice(id * 3, id * 3 + 3)),
          );
        const hits = [];
        for (let e = 0; e < 3; e++) {
          const a = tri[e],
            b = tri[(e + 1) % 3];
          if ((a.y < level && b.y >= level) || (b.y < level && a.y >= level)) {
            const p = a.clone().lerp(b, (level - a.y) / (b.y - a.y));
            p.y += 0.004;
            hits.push(p);
          }
        }
        if (hits.length === 2) contourPoints.push(...hits);
      }
    }
    this.contours = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(contourPoints),
      new THREE.LineBasicMaterial({
        color: 0xe3e4ab,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    this.group.add(this.contours);
    this.contours.visible = this.kind !== "erosion";
    // Visible rock sides close the terrain slab, rather than a floating paper surface.
    const rim = [];
    for (let c = 0; c < this.size; c++) rim.push(c);
    for (let r = 1; r < this.size; r++) rim.push(r * this.size + this.size - 1);
    for (let c = this.size - 2; c >= 0; c--)
      rim.push((this.size - 1) * this.size + c);
    for (let r = this.size - 2; r > 0; r--) rim.push(r * this.size);
    const walls = [];
    for (let i = 0; i < rim.length; i++) {
      const a = cellPoint(rim[i], this.heights),
        b = cellPoint(rim[(i + 1) % rim.length], this.heights);
      walls.push(
        a.x,
        a.y,
        a.z,
        b.x,
        b.y,
        b.z,
        a.x,
        -0.06,
        a.z,
        b.x,
        b.y,
        b.z,
        b.x,
        -0.06,
        b.z,
        a.x,
        -0.06,
        a.z,
      );
    }
    const wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(walls, 3),
    );
    wallGeo.computeVertexNormals();
    this.group.add(
      new THREE.Mesh(
        wallGeo,
        new THREE.MeshStandardMaterial({
          color: 0x705b46,
          roughness: 1,
          side: THREE.DoubleSide,
        }),
      ),
    );
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.08, 2),
      new THREE.MeshStandardMaterial({ color: 0x3f4939 }),
    );
    base.position.y = -0.08;
    this.group.add(base);
    this.divide = this.line(
      Array.from({ length: this.size }, (_, r) => {
        const p = cellPoint(r * this.size + 20, this.heights);
        return new THREE.Vector3(p.x, p.y + 0.012, p.z);
      }),
      0xffffff,
      0.85,
    );
    this.divide.visible = false;
    for (const [id, name] of this.kind === "erosion"
      ? []
      : [
          [OUTLET_A, "A"],
          [OUTLET_B, "B"],
        ]) {
      const p = cellPoint(id, this.heights);
      const basin = new THREE.Mesh(
        name === "A"
          ? new THREE.CylinderGeometry(0.16, 0.16, 0.025, 32)
          : new THREE.BoxGeometry(0.3, 0.025, 0.25),
        new THREE.MeshBasicMaterial({ color: COLORS[name] }),
      );
      basin.position.set(p.x, p.y + 0.005, 1.07);
      this.group.add(basin);
      const caption = this.text(`OUTLET ${name}`, COLORS[name]);
      caption.position.set(p.x, 0.13, 1.27);
      this.group.add(caption);
    }
    // A few trees communicate scale; they do not alter the routing model.
    for (const [x, z] of this.kind === "erosion"
      ? []
      : [
          [-0.85, -0.7],
          [-0.72, -0.6],
          [-0.86, -0.47],
          [0.78, -0.66],
          [0.87, -0.38],
          [0.75, 0.13],
          [-0.82, 0.3],
        ]) {
      const p = cellPoint(this.cellAt(x, z));
      const tree = new THREE.Mesh(
        new THREE.ConeGeometry(0.045, 0.16, 7),
        new THREE.MeshStandardMaterial({ color: 0x174d3c }),
      );
      tree.position.set(p.x, p.y + 0.08, p.z);
      tree.userData.cell = this.cellAt(x, z);
      this.trees.push(tree);
      this.group.add(tree);
    }
    this.cloud = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xf4fbff,
      roughness: 1,
    });
    for (const [x, y, r] of [
      [-0.1, 0, 0.1],
      [0, 0.045, 0.125],
      [0.12, 0, 0.09],
    ]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), cloudMat);
      m.position.set(x, y, 0);
      this.cloud.add(m);
    }
    this.group.add(this.cloud);
    if (this.kind === "erosion") {
      this.cloud.visible = false;
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 1.5, 12),
        new THREE.MeshStandardMaterial({ color: 0x70b9c9 }),
      );
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 1.14, -0.8);
      this.group.add(pipe);
    }
    this.marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.014, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xffe28a }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.group.add(this.marker);
    this.particles = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.014, 7, 5),
      new THREE.MeshBasicMaterial({ color: 0xd8faff }),
      128,
    );
    this.particles.count = 0;
    this.particles.frustumCulled = false;
    this.group.add(this.particles);
    this.ponds = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(this.spacing, this.spacing),
      new THREE.MeshStandardMaterial({
        color: this.kind === "erosion" ? 0xffffff : 0x48c7fa,
        roughness: 0.2,
        metalness: 0.15,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      }),
      this.size * this.size,
    );
    this.ponds.count = 0;
    this.ponds.frustumCulled = false;
    this.group.add(this.ponds);
    if (this.kind === "erosion") {
      this.ponds.visible = false;
      this.waterSurface = new WaterSurface(this.terrain.geometry);
      this.group.add(this.waterSurface.mesh);
    }
    this.brush = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 24, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffcd85,
        wireframe: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    this.brush.scale.y = 0.22;
    this.brush.visible = false;
    this.group.add(this.brush);
    if (this.kind === "erosion") {
      const caption = this.text("EROSION TRAY", 0xf5d7a3);
      caption.position.set(0, 0.12, 1.24);
      this.group.add(caption);
      this.source = this.cellAt(0, -0.8);
    }
    this.setSource(this.source);
  }
  refreshOriginalBed(heights = this.heights, hide = true) {
    const positions = this.originalBed.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++)
      positions.setY(
        i,
        heights[this.cellAt(positions.getX(i), positions.getZ(i))] + 0.003,
      );
    positions.needsUpdate = true;
    this.originalBed.geometry.computeBoundingSphere();
    if (hide) this.originalBed.visible = false;
  }
  setMode(mode) {
    this.grab.cancel();
    this.endStroke();
    this.pouring = false;
    if (this.kind === "erosion" && this.mode === "sculpt" && mode === "rain") {
      this.water = new ErosionWater(this.heights);
      this.refreshOriginalBed();
    }
    this.mode = mode;
    if (mode === "sculpt") {
      this.clearWater();
      if (this.originalBed) this.originalBed.visible = false;
    }
    this.drops = [];
    this.particles.count = 0;
    this.emission = 0;
    this.clearTrails();
    this.overlay = false;
    this.divide.visible = false;
    this.cloud.visible = mode === "rain" && this.kind !== "erosion";
    this.brush.visible = false;
    this.paint();
    this.onChange();
  }
  clearWater() {
    if (this.kind === "erosion") this.water = new ErosionWater(this.heights);
    else this.water.clear();
    this.ponds.count = 0;
    if (this.waterSurface) this.waterSurface.mesh.visible = false;
  }
  updateWater(dt) {
    this.water.update(dt);
    if (this.kind === "erosion") {
      this.meshTime += dt;
      if (this.meshTime < 0.1) return;
      if (this.meshTime >= 0.1) {
        this.meshTime = 0;
        const geo = this.terrain.geometry;
        for (let i = 0; i < this.heights.length; i++)
          geo.attributes.position.setY(i, this.heights[i]);
        geo.attributes.position.needsUpdate = true;
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        geo.computeBoundingBox();
        this.paint();
      }
    }
    if (this.waterSurface) {
      this.waterSurface.update(this.heights, this.water);
      return;
    }
    const tile = new THREE.Object3D();
    tile.rotation.x = -Math.PI / 2;
    let count = 0;
    for (let id = 0; id < this.heights.length; id++) {
      if (this.water.depth[id] < 0.001) continue;
      const p = cellPoint(id, this.heights);
      tile.position.set(p.x, p.y + this.water.depth[id] + 0.002, p.z);
      tile.updateMatrix();
      if (this.kind === "erosion")
        this.ponds.setColorAt(
          count,
          new THREE.Color(0x64cff5).lerp(
            new THREE.Color(0xb88845),
            Math.min(
              0.9,
              (this.water.sediment[id] /
                Math.max(0.001, this.water.depth[id])) *
                2,
            ),
          ),
        );
      this.ponds.setMatrixAt(count++, tile.matrix);
    }
    this.ponds.count = count;
    this.ponds.instanceMatrix.needsUpdate = true;
    if (this.ponds.instanceColor) this.ponds.instanceColor.needsUpdate = true;
  }
  beginTrigger(handedness, id, worldHit, worldHand) {
    if (this.stage !== 1 || this.grab.hands.size) return null;
    if (handedness === "left") {
      this.aim(worldHit);
      return "rain";
    }
    if (handedness === "right" && worldHand) {
      this.beginStroke(id, worldHit, worldHand);
      return this.stroke?.id === id ? "sculpt" : null;
    }
    return null;
  }
  beginStroke(id, worldHit, worldHand) {
    if (this.stage !== 1 || this.grab.hands.size || this.stroke) return;
    const hit = this.group.worldToLocal(worldHit.clone());
    const hand = this.group.worldToLocal(worldHand.clone());
    this.stroke = { id, last: hand, offset: hit.clone().sub(hand) };
  }
  moveStroke(id, worldHand) {
    if (this.stroke?.id !== id) return;
    const p = this.group.worldToLocal(worldHand.clone());
    const center = p.clone().add(this.stroke.offset);
    const delta = THREE.MathUtils.clamp(p.y - this.stroke.last.y, -0.08, 0.08);
    this.stroke.last.copy(p);
    this.applyBrush(center.x, center.z, delta);
  }
  applyBrush(x, z, delta) {
    if (this.stage !== 1 || this.grab.hands.size) return;
    if (x < -1 || x > 1 || z < -1 || z > 1) {
      this.brush.visible = false;
      return;
    }
    const before = this.kind === "erosion" ? this.heights.slice() : null;
    sculpt(this.heights, x, z, delta);
    if (before) {
      // Manual earth movement shifts the erosion reference by exactly that edit.
      // Water and suspended sediment remain in the ongoing experiment.
      for (let i = 0; i < before.length; i++)
        this.water.initial[i] += this.heights[i] - before[i];
      this.refreshOriginalBed(this.water.initial, false);
    }
    this.edited = true;
    if (delta !== 0) this.strokeDirty = true;
    this.brush.visible = true;
    this.brush.position.set(
      x,
      cellPoint(this.cellAt(x, z), this.heights).y + 0.015,
      z,
    );
    const geometry = this.terrain.geometry;
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < this.heights.length; i++)
      positions.setY(i, this.heights[i]);
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    this.contours.visible = false;
    this.divide.visible = false;
    for (const tree of this.trees)
      tree.position.y = this.heights[tree.userData.cell] + 0.08;
    this.paint();
  }
  endStroke(id) {
    if (id !== undefined && this.stroke?.id !== id) return;
    this.stroke = null;
    if (this.strokeDirty) {
      this.strokeDirty = false;
      this.rebuildRoutes();
      this.paint();
      this.onChange();
    }
  }
  rebuildRoutes() {
    this.routes = Array.from({ length: this.size * this.size }, (_, i) =>
      this.kind === "erosion" ? [i] : routeFrom(i, this.heights),
    );
    this.basins = this.routes.map((p) =>
      p.at(-1) === OUTLET_A ? "A" : p.at(-1) === OUTLET_B ? "B" : "sink",
    );
    this.setSource(this.source);
  }
  restore(notify = true) {
    if (this.originalBed) this.originalBed.visible = false;
    if (this.waterSurface) this.waterSurface.mesh.visible = false;
    this.pouring = false;
    this.grab.cancel();
    this.stroke = null;
    this.heights =
      this.kind === "erosion" ? createTray(this.size) : createHeights();
    this.water =
      this.kind === "erosion"
        ? new ErosionWater(this.heights)
        : new SurfaceWater(this.heights);
    this.ponds.count = 0;
    // Refresh mesh and tree heights through the same edit path.
    this.mode = "sculpt";
    const oldStage = this.stage;
    this.stage = 1;
    this.applyBrush(0, 0, 0);
    this.stage = oldStage;
    this.edited = false;
    this.contours.visible = this.kind !== "erosion";
    this.rebuildRoutes();
    this.drops = [];
    this.particles.count = 0;
    this.clearTrails();
    this.mode = "rain";
    this.overlay = false;
    this.brush.visible = false;
    this.cloud.visible = this.kind !== "erosion";
    if (this.originalBed) this.refreshOriginalBed();
    this.paint();
    if (notify) this.onChange();
  }
  text(text, color) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#102732";
    ctx.fillRect(0, 0, 512, 128);
    ctx.font = "bold 60px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#" + new THREE.Color(color).getHexString();
    ctx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, depthTest: false }),
    );
    s.scale.set(0.43, 0.108, 1);
    return s;
  }
  line(points, color, opacity = 0.8) {
    const obj = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
      }),
    );
    this.group.add(obj);
    return obj;
  }
  paint() {
    const attr = this.terrain.geometry.getAttribute("color");
    const low = new THREE.Color(this.kind === "erosion" ? 0x805331 : 0x396d4b),
      high = new THREE.Color(this.kind === "erosion" ? 0xe8c78b : 0xb8bd75);
    for (let id = 0; id < this.size * this.size; id++) {
      const c = this.overlay
        ? new THREE.Color(COLORS[this.basins[id]]).multiplyScalar(0.65)
        : low
            .clone()
            .lerp(high, Math.min(1, cellPoint(id, this.heights).y / 0.8));
      if (this.kind === "erosion") {
        const change =
          this.mode === "sculpt"
            ? 0
            : this.heights[id] - this.water.initial[id];
        c.lerp(
          new THREE.Color(change < 0 ? 0x452819 : 0xffe6aa),
          Math.min(0.85, Math.abs(change) * 14),
        );
      }
      attr.setXYZ(id, c.r, c.g, c.b);
    }
    attr.needsUpdate = true;
  }
  toggleOverlay() {
    this.overlay = !this.overlay;
    this.divide.visible = this.overlay && !this.edited;
    this.paint();
    this.onChange();
  }
  setSource(id) {
    this.source = id;
    const p = cellPoint(id, this.heights);
    this.cloud.position.set(p.x, p.y + 0.4, p.z);
  }
  aim(world) {
    if (this.stage !== 1) return;
    const p = this.group.worldToLocal(world.clone());
    this.setSource(this.cellAt(p.x, p.z));
    if (this.mode === "sculpt" && !this.stroke) {
      const point = cellPoint(this.source, this.heights);
      this.brush.position.set(point.x, point.y + 0.015, point.z);
      this.brush.visible = true;
    }
  }
  place(camera) {
    this.grab.cancel();
    this.endStroke();
    const pos = new THREE.Vector3(),
      dir = new THREE.Vector3();
    camera.getWorldPosition(pos);
    camera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(0, 0, -1);
    dir.normalize();
    this.group.position.copy(pos).addScaledVector(dir, 1.4);
    this.group.position.y -= 0.28;
    this.group.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
    this.group.scale.setScalar(0.43);
  }
  explore() {
    this.stage = 1;
    this.onChange();
  }
  challenge() {
    this.restore(false);
    this.stage = 2;
    this.drops = [];
    this.clearTrails();
    this.overlay = false;
    this.divide.visible = false;
    this.paint();
    this.setSource(CHALLENGE);
    const p = cellPoint(CHALLENGE, this.heights);
    this.marker.position.set(p.x, p.y + 0.025, p.z);
    this.marker.visible = true;
    this.onChange();
  }
  choose(answer) {
    if (this.stage !== 2) return;
    this.answer = answer;
    this.stage = 3;
    this.overlay = true;
    this.divide.visible = true;
    this.paint();
    this.playback = 4;
    this.onChange();
  }
  finish() {
    this.grab.cancel();
    this.pouring = false;
    this.endStroke();
    this.mode = "rain";
    this.brush.visible = false;
    this.cloud.visible = this.kind !== "erosion";
    this.stage = 4;
    this.playback = 0;
    this.onChange();
  }
  get destination() {
    return outletFor(CHALLENGE);
  }
  clearTrails() {
    for (const t of this.trails) {
      this.group.remove(t);
      t.geometry.dispose();
      t.material.dispose();
    }
    this.trails = [];
  }
  emit(id = this.source) {
    if (this.drops.length >= 128) return;
    const ids = this.kind === "erosion" ? [id] : routeFrom(id, this.heights);
    const points = ids.map((n) => {
      const p = cellPoint(n, this.heights);
      return new THREE.Vector3(p.x, p.y + 0.025, p.z);
    });
    const top = points[0].clone();
    top.y += 0.35;
    points.unshift(top);
    const lengths = [0];
    for (let i = 1; i < points.length; i++)
      lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
    this.drops.push({
      points,
      lengths,
      progress: 0,
      outlet: this.basins[id],
      end: ids.at(-1),
    });
    if (
      this.kind !== "erosion" &&
      !this.trails.some((t) => t.userData.cell === id)
    ) {
      const trail = this.line(points.slice(1), COLORS[this.basins[id]], 0.9);
      trail.userData.cell = id;
      this.trails.push(trail);
      if (this.trails.length > 12) {
        const old = this.trails.shift();
        this.group.remove(old);
        old.geometry.dispose();
        old.material.dispose();
      }
    }
  }
  burst(id) {
    this.setSource(id);
    for (let i = 0; i < 12; i++) this.emit(id);
  }
  update(dt, raining = false) {
    this.time += dt;
    if (this.stage < 4) {
      this.elapsed += dt;
      if (this.elapsed >= 240) {
        this.finish();
        return;
      }
    }
    const active =
      (this.stage === 1 &&
        !this.grab.hands.size &&
        (raining || this.pouring)) ||
      (this.stage === 3 && this.playback > 0);
    this.playback = Math.max(0, this.playback - dt);
    if (active) {
      this.emission += dt;
      while (this.emission >= 0.1) {
        if (this.kind === "erosion" && this.pouring) {
          const x = [-0.65, -0.32, 0, 0.32, 0.65][this.pourIndex++ % 5];
          this.setSource(this.cellAt(x, -0.8));
        }
        this.emit();
        this.emission -= 0.1;
      }
    } else this.emission = 0;
    const dummy = new THREE.Object3D();
    let count = 0;
    this.drops = this.drops.filter((d) => {
      d.progress += dt * 0.75;
      if (d.progress >= d.lengths.at(-1)) {
        this.counts[d.outlet]++;
        this.water.add(d.end, this.kind === "erosion" ? 0.00035 : 0.0003);
        return false;
      }
      let i = 1;
      while (d.lengths[i] < d.progress) i++;
      const frac =
        (d.progress - d.lengths[i - 1]) / (d.lengths[i] - d.lengths[i - 1]);
      dummy.position.lerpVectors(d.points[i - 1], d.points[i], frac);
      dummy.updateMatrix();
      this.particles.setMatrixAt(count++, dummy.matrix);
      return true;
    });
    this.updateWater(dt);
    this.particles.count = count;
    this.particles.instanceMatrix.needsUpdate = true;
    this.marker.scale.setScalar(1 + 0.12 * Math.sin(this.time * 3));
  }
  dispose() {
    this.grab.cancel();
    this.group.removeFromParent();
    const materials = new Set(),
      geometries = new Set();
    this.group.traverse((n) => {
      if (n.geometry) geometries.add(n.geometry);
      if (n.material) materials.add(n.material);
      if (n.isInstancedMesh) n.dispose();
    });
    for (const g of geometries) g.dispose();
    for (const m of materials) {
      m.map?.dispose();
      m.dispose();
    }
  }
}
