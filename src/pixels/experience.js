import * as THREE from "three";
import {
  LayerExperience,
  highwayDeckHeight,
  highwayZ,
  landscapeHeight,
  riverWaterHeight,
  riverX,
} from "../layers/experience.js";
import { PIXEL_EXTENT, PIXEL_SIZES, PixelModel, pixelSizeLabel } from "./model.js";
import { RemotePlatformScene } from "../showcase/remote-platforms.js";
import { PixelFlyover } from "./flyover.js";
import { PIXEL_WORLD_EXTENT, makePixelLandscape,
  pixelLandscapeTexture } from "./landscape.js";

const gold = 0xffd36f;
const clamp = (value) => THREE.MathUtils.clamp(value, -PIXEL_EXTENT + 0.001, PIXEL_EXTENT - 0.001);

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
  const steps = Math.max(2, Math.ceil(span / 1.5));
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
  const fillSteps = Math.max(1, Math.ceil(span / 2));
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
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
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
  constructor(scene, onChange, onEvent = () => {}, platformParent = scene) {
    super(scene, onChange);
    this.phase = "platforms";
    this.landscapeBackground = scene.background;
    this.landscapeFog = scene.fog;
    scene.background = this.previousBackground;
    scene.fog = null;
    this.group.visible = false;
    this.platformScene = new RemotePlatformScene(platformParent, onChange);
    this.onEvent = onEvent;
    this.clipboardBaseScale = 0.26;
    this.clipboard.scale.setScalar(this.clipboardBaseScale);
    this.selected = new Set(["topography", "vegetation", "hydrology", "roads"]);
    this.applyVisibility();
    this.model = new PixelModel();
    this.flyover = new PixelFlyover(this.group);
    this.viewMode = "footprint";
    this.pixelWorld = null;
    this.pixelWorldModel = null;
    this.pixelTextures = new Map();
    this.size = 30;
    this.probe = { x: 0, z: -3 };
    this.answer = null;
    this.footprintAge = 1;
    this.footprint = null;
    this.refreshFootprint();
  }
  begin() {
    if (this.started) return;
    this.platformScene.group.visible = true;
    super.begin();
  }
  showPixels() {
    if (!this.started || this.finished || this.phase !== "platforms") return;
    this.phase = "pixels";
    this.platformScene.hide();
    this.group.visible = true;
    this.scene.background = this.landscapeBackground;
    this.scene.fog = this.landscapeFog;
    this.flyover.begin(this.size);
    this.onChange();
  }
  get cell() {
    return this.model.cellAt(this.probe.x, this.probe.z, this.size);
  }
  get hidesWorldUI() {
    return this.started && this.phase === "pixels" && !this.clipboard.visible;
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
    this.footprint.visible = this.viewMode === "footprint";
    this.footprintAge = previousSize ? 0 : 1;
    if (previousSize) {
      const start = THREE.MathUtils.clamp(previousSize / this.size, 0.35, 2);
      this.footprint.scale.set(start, 1, start);
    }
    this.variants.raised.world.add(this.footprint);
  }
  setSize(size) {
    if (!this.started || this.finished || this.phase !== "pixels" ||
        !PIXEL_SIZES.includes(size) || this.size === size) return;
    const previous = this.size;
    this.size = size;
    this.refreshFootprint(this.viewMode === "footprint" ? previous : null);
    if (this.viewMode === "footprint") this.flyover.begin(size);
    else this.showPixelTexture();
    this.onEvent(size > previous ? "merge" : "reveal");
    this.onChange();
  }
  showPixelTexture() {
    if (!this.pixelWorldModel)
      this.pixelWorldModel = new PixelModel(PIXEL_WORLD_EXTENT);
    if (!this.pixelTextures.has(this.size))
      this.pixelTextures.set(this.size,
        pixelLandscapeTexture(this.pixelWorldModel, this.size));
    const texture = this.pixelTextures.get(this.size);
    if (!this.pixelWorld) {
      this.pixelWorld = makePixelLandscape(this.pixelWorldModel,
        this.ground.raised.geometry, texture);
      this.variants.raised.world.add(this.pixelWorld);
    } else {
      this.pixelWorld.material.map = texture;
      this.pixelWorld.material.needsUpdate = true;
    }
  }
  setViewMode(mode, camera = null) {
    if (!this.started || this.finished || this.phase !== "pixels" ||
        !["footprint", "pixelated"].includes(mode) || this.viewMode === mode) return;
    if (mode === "pixelated") this.showPixelTexture();
    this.viewMode = mode;
    this.selected = new Set(mode === "footprint"
      ? ["topography", "vegetation", "hydrology", "roads"]
      : ["topography"]);
    this.applyVisibility();
    this.ground.raised.visible = mode === "footprint";
    if (this.pixelWorld) this.pixelWorld.visible = mode === "pixelated";
    this.footprint.visible = mode === "footprint";
    if (mode === "footprint") this.flyover.begin(this.size);
    else this.flyover.clear();
    this.onRoad = false;
    this.fallingFromRoad = false;
    if (camera) this.walk(0, 0, 0, camera);
    this.onChange();
  }
  update(dt) {
    if (!this.started) return;
    super.update(dt);
    if (this.phase === "pixels" && !this.finished &&
        this.viewMode === "footprint") this.flyover.update(dt);
    if (this.phase === "platforms" && !this.finished)
      this.platformScene.update(dt, this.elapsed);
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
    if (!this.started || this.finished || this.phase !== "pixels" ||
        this.answer !== null) return;
    this.answer = answer;
    this.onEvent(answer === this.pureWaterAt30 ? "correct" : "blocked");
    this.onChange();
  }
  setProbe(x, z) {
    if (!this.started || this.finished || this.phase !== "pixels" ||
        !Number.isFinite(x) || !Number.isFinite(z)) return;
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
    if (this.phase !== "pixels") return null;
    this.pickGround.updateWorldMatrix(true, false);
    this.clipboard.children[0].updateWorldMatrix(true, false);
    if (this.clipboard.visible && raycaster.intersectObject(this.clipboard.children[0], false).length)
      return null;
    return raycaster.intersectObject(this.pickGround, false)[0] ?? null;
  }
  placeFromRay(raycaster) {
    if (!this.started || this.finished || this.phase !== "pixels") return false;
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
    this.viewMode = "footprint";
    this.selected = new Set(["topography", "vegetation", "hydrology", "roads"]);
    this.applyVisibility();
    this.ground.raised.visible = true;
    if (this.pixelWorld) this.pixelWorld.visible = false;
    this.flyover.clear();
    this.refreshFootprint();
    this.onChange();
  }
  finish() {
    this.flyover.clear();
    if (this.phase === "platforms") {
      this.phase = "pixels";
      this.platformScene.hide();
      this.group.visible = true;
      this.scene.background = this.landscapeBackground;
      this.scene.fog = this.landscapeFog;
    }
    super.finish();
  }
  dispose() {
    this.flyover.dispose();
    this.platformScene.dispose();
    if (this.pixelWorld) this.pixelWorld.material.map = null;
    for (const texture of this.pixelTextures.values()) texture.dispose();
    super.dispose();
  }
  renderMap(ctx, size = this.size) {
    const raster = this.model.raster(size);
    const width = ctx.canvas.width;
    const canvasPerMeter = width / (PIXEL_EXTENT * 2);
    ctx.fillStyle = "#163b3b";
    ctx.fillRect(0, 0, width, width);
    if (size === 0.5) {
      // One ImageData upload avoids thousands of canvas draw calls on Quest.
      const image = ctx.createImageData(width, width);
      const sourceWidth = this.model.sampleWidth;
      for (let y = 0; y < width; y++)
        for (let x = 0; x < width; x++) {
          const source = (Math.floor(y * sourceWidth / width) * sourceWidth +
            Math.floor(x * sourceWidth / width)) * 3;
          const target = (y * width + x) * 4;
          image.data[target] = this.model.rgb[source];
          image.data[target + 1] = this.model.rgb[source + 1];
          image.data[target + 2] = this.model.rgb[source + 2];
          image.data[target + 3] = 255;
        }
      ctx.putImageData(image, 0, 0);
    } else raster.pixels.forEach(({ rgb }, index) => {
      const col = index % raster.cells;
      const row = Math.floor(index / raster.cells);
      ctx.fillStyle = `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
      ctx.fillRect(col * size * canvasPerMeter, row * size * canvasPerMeter,
        Math.min(size, this.model.width - col * size) * canvasPerMeter + 0.5,
        Math.min(size, this.model.width - row * size) * canvasPerMeter + 0.5);
    });
    if (size * canvasPerMeter >= 8) {
      ctx.strokeStyle = "#13292666";
      ctx.lineWidth = 1;
      for (let i = 0; i <= raster.cells; i++) {
        const at = Math.min(width, i * size * canvasPerMeter);
        ctx.beginPath();
        ctx.moveTo(at, 0); ctx.lineTo(at, width);
        ctx.moveTo(0, at); ctx.lineTo(width, at);
        ctx.stroke();
      }
    }
    const cell = this.model.cellAt(this.probe.x, this.probe.z, size);
    ctx.strokeStyle = "#163039";
    ctx.lineWidth = 7;
    const cellX = Math.max(0, cell.x0 + PIXEL_EXTENT) * canvasPerMeter;
    const cellY = Math.max(0, cell.z0 + PIXEL_EXTENT) * canvasPerMeter;
    const sampledWidth = Math.min(size, this.model.width - cell.col * size) * canvasPerMeter;
    const sampledHeight = Math.min(size, this.model.width - cell.row * size) * canvasPerMeter;
    ctx.strokeRect(cellX, cellY, sampledWidth, sampledHeight);
    ctx.strokeStyle = "#ffdf75";
    ctx.lineWidth = 4;
    ctx.strokeRect(cellX, cellY, sampledWidth, sampledHeight);
    ctx.fillStyle = "#17313add";
    ctx.fillRect(0, 0, width, 42);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 23px system-ui, sans-serif";
    ctx.fillText(`MODEL COLORS · ${pixelSizeLabel(size)}`, 12, 29);
  }
}
