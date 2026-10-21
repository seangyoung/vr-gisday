import * as THREE from "three";
import {
  LANDSCAPE_EXTENT,
  LayerExperience,
  landscapeHeight,
} from "../layers/experience.js";
import { renderLayerMap } from "../layers/map.js";
import { TerrainSampler, calculateViewshed, traceSightline } from "./analysis.js";
import { VIEWSHED_SCENES, buildCanyonWorld } from "./scenes.js";

const TOWER_HEIGHT = 12;
const CLIMB_HEIGHT = TOWER_HEIGHT - 1.6;
const RUNG_SPACING = 0.43;
const LOOKOUT_Z = -0.54;
const MAX_LOOKOUT_SHIFT = 0.65;

const visibleColor = new THREE.Color(0x55e5a9);
const hiddenColor = new THREE.Color(0x9176bd);
const canyonVisibleColor = new THREE.Color(0xb4efbe);
const canyonHiddenColor = new THREE.Color(0xc2abd7);

function coverageMesh(analysis, heightAt, subdivisions = 1) {
  const positions = [], colors = [], indices = [];
  const { values, cells, extent, cellSize } = analysis;
  for (let row = 0; row < cells; row++)
    for (let col = 0; col < cells; col++) {
      const state = values[row * cells + col];
      if (!state) continue;
      const x0 = -extent + col * cellSize, x1 = x0 + cellSize;
      const z0 = -extent + row * cellSize, z1 = z0 + cellSize;
      const color = state === 1
        ? (subdivisions > 1 ? canyonVisibleColor : visibleColor)
        : (subdivisions > 1 ? canyonHiddenColor : hiddenColor);
      for (let subRow = 0; subRow < subdivisions; subRow++)
        for (let subCol = 0; subCol < subdivisions; subCol++) {
          const sx0 = THREE.MathUtils.lerp(x0, x1, subCol / subdivisions);
          const sx1 = THREE.MathUtils.lerp(x0, x1, (subCol + 1) / subdivisions);
          const sz0 = THREE.MathUtils.lerp(z0, z1, subRow / subdivisions);
          const sz1 = THREE.MathUtils.lerp(z0, z1, (subRow + 1) / subdivisions);
          const first = positions.length / 3;
          for (const [x, z] of [[sx0, sz0], [sx1, sz0], [sx0, sz1], [sx1, sz1]]) {
            positions.push(x, heightAt(x, z) + (subdivisions > 1 ? 0.28 : 0.12), z);
            colors.push(color.r, color.g, color.b);
          }
          indices.push(first, first + 2, first + 1, first + 1, first + 2, first + 3);
        }
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
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1, 12), mastMaterial);
  mast.scale.y = 2;
  mast.position.y = 1;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), gold);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.74, 0.045, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0xffd879 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  const steps = new THREE.Group();
  steps.visible = false;
  const rungMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9c8c4, metalness: 0.48, roughness: 0.46,
  });
  const rungs = [];
  const pegGeometry = new THREE.CylinderGeometry(0.023, 0.023, 0.42, 8);
  const lipGeometry = new THREE.CylinderGeometry(0.019, 0.019, 0.085, 8);
  for (let y = 0.55, index = 0; y < TOWER_HEIGHT - 0.65; y += RUNG_SPACING, index++) {
    const side = index % 2 ? 1 : -1;
    const step = new THREE.Group();
    step.position.set(side * 0.28, y, -0.11);
    const peg = new THREE.Mesh(pegGeometry, rungMaterial);
    peg.rotation.z = Math.PI / 2;
    const lip = new THREE.Mesh(lipGeometry, rungMaterial);
    lip.position.set(side * 0.2, 0.035, 0);
    step.add(peg, lip);
    steps.add(step);
    rungs.push(step);
  }
  const lookout = new THREE.Group();
  lookout.visible = false;
  lookout.position.y = CLIMB_HEIGHT;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.07, 0.96), dark);
  deck.position.set(0, -0.04, LOOKOUT_Z);
  lookout.add(deck);
  const slatMaterial = new THREE.MeshStandardMaterial({
    color: 0x849d9b, metalness: 0.3, roughness: 0.64,
  });
  for (const z of [-0.82, -0.54, -0.26]) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.012, 0.19), slatMaterial);
    slat.position.set(0, 0.006, z);
    lookout.add(slat);
  }
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9bd78, emissive: 0x3d3215, roughness: 0.5,
  });
  for (const z of [-1.01, -0.07]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.025, 0.025), edgeMaterial);
    edge.position.set(0, 0.015, z);
    lookout.add(edge);
  }
  for (const x of [-0.59, 0.59]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.96), edgeMaterial);
    edge.position.set(x, 0.015, LOOKOUT_Z);
    lookout.add(edge);
  }
  for (const side of [-1, 1]) {
    const lower = new THREE.Vector3(side * 0.08, -1.05, 0);
    const upper = new THREE.Vector3(side * 0.42, -0.08, -0.78);
    const direction = upper.clone().sub(lower);
    const brace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.019, direction.length(), 8), rungMaterial,
    );
    brace.position.copy(lower).add(upper).multiplyScalar(0.5);
    brace.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), direction.normalize(),
    );
    lookout.add(brace);
  }
  marker.add(base, mast, eye, ring, steps, lookout);
  marker.userData.mast = mast;
  marker.userData.eye = eye;
  marker.userData.rungs = rungs;
  marker.userData.steps = steps;
  marker.userData.lookout = lookout;
  marker.userData.lookoutEdge = edgeMaterial;
  return marker;
}

export class ViewshedExperience extends LayerExperience {
  constructor(scene, onChange, onEvent = () => {}) {
    super(scene, onChange);
    this.onEvent = onEvent;
    // Show the bare-earth surface used by the sightline calculation. The
    // vegetation and highway remain available in the shared landscape demos.
    this.selected = new Set(["topography", "hydrology"]);
    this.applyVisibility();
    this.view = "map";
    this.sceneChoice = VIEWSHED_SCENES[0];
    this.canyonWorlds = new Map();
    this.valleyPickGround = this.pickGround;
    this.sampler = new TerrainSampler(LANDSCAPE_EXTENT, 320, this.sceneChoice.heightAt);
    this.observer = { ...this.sceneChoice.start, height: 2 };
    this.visualHeight = 2;
    this.climbHands = new Map();
    this.climbHeight = 0;
    this.climbGroundY = 0;
    this.fallSpeed = 0;
    this.topLocked = false;
    this.topLockReady = true;
    this.lookoutSlide = new THREE.Vector2();
    this.lookoutGoal = new THREE.Vector2();
    this.revealAge = 1;
    this.marker = observationMarker();
    this.marker.visible = false;
    this.group.add(this.marker);
    this.targetRing = new THREE.Group();
    const targetColor = 0x168cff;
    const groundRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 0.22, 8, 48),
      new THREE.MeshBasicMaterial({ color: targetColor }),
    );
    groundRing.rotation.x = Math.PI / 2;
    this.targetRing.add(groundRing);
    // An elevated locator remains identifiable when the ground target is
    // hidden by a ridge. It is a waypoint cue, not part of the sightline test.
    const locatorMaterial = new THREE.MeshBasicMaterial({
      color: targetColor, depthTest: false, depthWrite: false, fog: false,
    });
    const locatorOutline = new THREE.MeshBasicMaterial({
      color: 0x103b52, depthTest: false, depthWrite: false, fog: false,
    });
    const stemOutline = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 18, 8), locatorOutline,
    );
    stemOutline.position.y = 9;
    stemOutline.renderOrder = 4;
    this.targetRing.add(stemOutline);
    const locatorStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 18, 8), locatorMaterial,
    );
    locatorStem.position.y = 9;
    locatorStem.renderOrder = 5;
    this.targetRing.add(locatorStem);
    for (const rotationY of [0, Math.PI / 2]) {
      const outline = new THREE.Mesh(
        new THREE.TorusGeometry(4.8, 0.58, 8, 48), locatorOutline,
      );
      outline.position.y = 18;
      outline.rotation.y = rotationY;
      outline.renderOrder = 4;
      this.targetRing.add(outline);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(4.8, 0.32, 8, 48), locatorMaterial,
      );
      halo.position.y = 18;
      halo.rotation.y = rotationY;
      halo.renderOrder = 5;
      this.targetRing.add(halo);
    }
    const coreOutline = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 12, 8), locatorOutline,
    );
    coreOutline.position.y = 18;
    coreOutline.renderOrder = 4;
    this.targetRing.add(coreOutline);
    const locatorCore = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 12, 8), locatorMaterial,
    );
    locatorCore.position.y = 18;
    locatorCore.renderOrder = 5;
    this.targetRing.add(locatorCore);
    this.group.add(this.targetRing);
    this.sightline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: visibleColor, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.sightline.frustumCulled = false;
    this.group.add(this.sightline);
    this.analysis = null;
    this.overlay = null;
    this.refresh();
  }
  walkHeightAt(x, z, raised) {
    return raised ? this.sceneChoice.heightAt(x, z) : 0;
  }
  setScene(id, camera) {
    const choice = VIEWSHED_SCENES.find((scene) => scene.id === id);
    if (!choice || choice === this.sceneChoice || !this.started || this.finished) return;
    this.cancelClimb();
    this.sceneChoice = choice;
    this.variants.raised.world.visible = id === "valley";
    for (const [key, item] of this.canyonWorlds) item.world.visible = key === id;
    if (id === "valley") this.pickGround = this.valleyPickGround;
    else {
      if (!this.canyonWorlds.has(id)) {
        const item = buildCanyonWorld(choice);
        this.canyonWorlds.set(id, item);
        this.group.add(item.world);
      }
      this.canyonWorlds.get(id).world.visible = true;
      this.pickGround = this.canyonWorlds.get(id).pick;
    }
    if (this.scene.background !== null) {
      this.scene.background = new THREE.Color(choice.sky);
      this.scene.fog = new THREE.Fog(choice.sky, 150, 470);
    }
    this.sampler = new TerrainSampler(LANDSCAPE_EXTENT, 320, choice.heightAt);
    this.observer = { ...choice.start, height: 2 };
    this.visualHeight = 2;
    this.place(camera);
    this.walk(0, 0, 0, camera);
    this.refresh();
    this.onEvent("select");
    this.onChange();
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
    this.overlay = coverageMesh(this.analysis, this.sceneChoice.heightAt,
      this.sceneChoice.id === "valley" ? 1 : 2);
    this.overlay.material.opacity = 0;
    this.revealAge = 0;
    this.group.add(this.overlay);
    const ground = this.sceneChoice.heightAt(this.observer.x, this.observer.z);
    this.marker.position.set(this.observer.x, ground, this.observer.z);
    const target = this.sceneChoice.target;
    this.targetRing.position.set(target.x, this.sceneChoice.heightAt(target.x, target.z) + 0.2, target.z);
    this.setVisualHeight(this.visualHeight);
    this.trace = traceSightline((x, z) => this.sampler.sample(x, z),
      this.observer, target, 1.7);
    const positions = this.sightline.geometry.attributes.position;
    positions.setXYZ(0, this.observer.x, ground + this.observer.height, this.observer.z);
    positions.setXYZ(1, this.observer.x, ground + this.observer.height, this.observer.z);
    positions.needsUpdate = true;
    this.sightline.geometry.computeBoundingSphere();
    this.sightline.material.color.set(this.trace.visible ? visibleColor : hiddenColor);
  }
  setVisualHeight(height) {
    this.marker.userData.eye.position.y = height;
    const nearPole = Math.hypot(
      this.visitor.x - this.observer.x, this.visitor.y - this.observer.z,
    ) < 1.15;
    this.marker.userData.eye.visible = !nearPole && this.climbHeight < CLIMB_HEIGHT - 2;
    this.marker.userData.mast.scale.y = height;
    this.marker.userData.mast.position.y = height / 2;
    this.marker.userData.steps.visible = this.observer.height === TOWER_HEIGHT;
    this.marker.userData.steps.scale.y = height / TOWER_HEIGHT;
    this.marker.userData.lookout.visible = this.observer.height === TOWER_HEIGHT;
    this.marker.userData.lookout.position.y = CLIMB_HEIGHT * height / TOWER_HEIGHT;
  }
  get isAtTop() {
    return this.topLocked;
  }
  get isClimbing() {
    return this.climbHands.size > 0 || (this.climbHeight > 0 && !this.topLocked);
  }
  begin() {
    this.marker.visible = true;
    super.begin();
  }
  place(camera) {
    this.cancelClimb();
    super.place(camera);
    this.climbGroundY = this.group.position.y;
  }
  walk(stickX, stickY, dt, camera) {
    if (this.isClimbing || this.isAtTop) return { distance: 0, wet: false };
    const movement = super.walk(stickX, stickY, dt, camera);
    this.climbGroundY = this.group.position.y;
    return movement;
  }
  updateClipboard(leftGrip, camera, preview = false, fallback = false) {
    if (this.isClimbing) {
      this.clipboard.visible = false;
      return;
    }
    super.updateClipboard(leftGrip, camera, preview, fallback);
  }
  nearestRung(handWorld) {
    if (!handWorld?.isVector3 || !this.marker.userData.steps.visible ||
        this.visualHeight < TOWER_HEIGHT - 0.5) return null;
    this.marker.updateWorldMatrix(true, true);
    let nearest = null;
    for (const rung of this.marker.userData.rungs) {
      const gap = handWorld.distanceTo(rung.getWorldPosition(new THREE.Vector3()));
      if (gap < 0.32 && (!nearest || gap < nearest.gap)) nearest = { rung, gap };
    }
    return nearest?.rung ?? null;
  }
  gripRung(id, handWorld) {
    if (!this.started || this.finished || this.observer.height !== TOWER_HEIGHT ||
        !this.nearestRung(handWorld)) return false;
    const firstHand = !this.climbHands.size;
    if (this.topLocked) {
      this.topLockReady = false;
      this.marker.userData.lookoutEdge.color.setHex(0xd9bd78);
      this.marker.userData.lookoutEdge.emissive.setHex(0x3d3215);
    }
    this.topLocked = false;
    this.climbHands.set(id, handWorld.y);
    this.fallSpeed = 0;
    this.clipboard.visible = false;
    if (firstHand) this.onChange();
    return true;
  }
  releaseRung(id) {
    this.climbHands.delete(id);
    if (!this.climbHands.size && this.climbHeight > 0) this.fallSpeed = 0;
  }
  lockLookout() {
    this.climbHeight = CLIMB_HEIGHT;
    this.topLocked = true;
    this.climbHands.clear();
    const step = new THREE.Vector2(
      this.visitor.x - this.observer.x,
      this.visitor.y - (this.observer.z + LOOKOUT_Z),
    ).clampLength(0, MAX_LOOKOUT_SHIFT);
    this.lookoutGoal.copy(this.lookoutSlide).add(step);
    this.marker.userData.lookoutEdge.color.setHex(0x78e4c5);
    this.marker.userData.lookoutEdge.emissive.setHex(0x1c6654);
  }
  updateLookout(dt) {
    const goalX = this.topLocked ? this.lookoutGoal.x : 0;
    const goalZ = this.topLocked ? this.lookoutGoal.y : 0;
    const dx = THREE.MathUtils.damp(this.lookoutSlide.x, goalX, 8, dt) - this.lookoutSlide.x;
    const dz = THREE.MathUtils.damp(this.lookoutSlide.y, goalZ, 8, dt) - this.lookoutSlide.y;
    if (Math.abs(dx) + Math.abs(dz) < 1e-6) return;
    const angle = this.group.rotation.y;
    this.group.position.x += Math.cos(angle) * dx + Math.sin(angle) * dz;
    this.group.position.z += -Math.sin(angle) * dx + Math.cos(angle) * dz;
    this.lookoutSlide.x += dx;
    this.lookoutSlide.y += dz;
    this.visitor.x -= dx;
    this.visitor.y -= dz;
    this.updateVisitorMarkers();
  }
  updateClimb(poses, dt) {
    if (!this.started || this.finished) {
      this.cancelClimb();
      return;
    }
    const deltas = [];
    for (const [id, lastY] of this.climbHands) {
      const matrix = poses.get(id);
      if (!matrix) {
        this.climbHands.delete(id);
        continue;
      }
      const y = new THREE.Vector3().setFromMatrixPosition(matrix).y;
      deltas.push(THREE.MathUtils.clamp(lastY - y, -0.22, 0.22));
      this.climbHands.set(id, y);
    }
    if (deltas.length) {
      // The hand with the strongest pull drives the climb; the other may hold steady.
      const pull = deltas.reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a, 0);
      this.climbHeight = THREE.MathUtils.clamp(this.climbHeight + pull, 0, CLIMB_HEIGHT);
      this.fallSpeed = 0;
      if (this.climbHeight <= CLIMB_HEIGHT - 0.15) this.topLockReady = true;
      if (this.topLockReady && this.climbHeight >= CLIMB_HEIGHT - 0.01) {
        this.lockLookout();
        this.onEvent("reveal");
        this.onChange();
      }
    } else if (this.climbHeight > 0 && !this.topLocked) {
      this.fallSpeed = Math.min(14, this.fallSpeed + 13 * dt);
      this.climbHeight = Math.max(0, this.climbHeight - this.fallSpeed * dt);
      if (this.climbHeight === 0) {
        this.fallSpeed = 0;
        this.onChange();
      }
    }
    this.group.position.y = this.climbGroundY - this.climbHeight;
    this.updateLookout(dt);
  }
  cancelClimb() {
    const angle = this.group.rotation.y;
    this.group.position.x -= Math.cos(angle) * this.lookoutSlide.x +
      Math.sin(angle) * this.lookoutSlide.y;
    this.group.position.z -= -Math.sin(angle) * this.lookoutSlide.x +
      Math.cos(angle) * this.lookoutSlide.y;
    this.visitor.add(this.lookoutSlide);
    this.lookoutSlide.set(0, 0);
    this.lookoutGoal.set(0, 0);
    this.climbHands.clear();
    this.climbHeight = 0;
    this.fallSpeed = 0;
    this.topLocked = false;
    this.topLockReady = true;
    this.group.position.y = this.climbGroundY;
    this.updateVisitorMarkers();
    this.marker.userData.lookoutEdge.color.setHex(0xd9bd78);
    this.marker.userData.lookoutEdge.emissive.setHex(0x3d3215);
  }
  update(dt) {
    if (!this.started) return;
    super.update(dt);
    this.revealAge = Math.min(1, this.revealAge + dt / 0.9);
    if (this.overlay) this.overlay.material.opacity =
      (this.sceneChoice.id === "valley" ? 0.43 : 0.3) * this.revealAge;
    if (this.sightline) {
      const ease = 1 - (1 - this.revealAge) ** 2;
      const startY = this.sceneChoice.heightAt(this.observer.x, this.observer.z) + this.observer.height;
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
    if (!this.started || this.finished || !Number.isFinite(x) || !Number.isFinite(z)) return;
    if (this.isClimbing || this.isAtTop) this.cancelClimb();
    this.observer.x = THREE.MathUtils.clamp(x, -LANDSCAPE_EXTENT + 2, LANDSCAPE_EXTENT - 2);
    this.observer.z = THREE.MathUtils.clamp(z, -LANDSCAPE_EXTENT + 2, LANDSCAPE_EXTENT - 2);
    this.refresh();
    this.onEvent(this.trace.visible ? "correct" : "blocked");
    this.onChange();
  }
  setHeight(height) {
    if (!this.started || this.finished || (height !== 2 && height !== 12)) return;
    if (height === 2 && (this.isClimbing || this.isAtTop)) this.cancelClimb();
    this.observer.height = height;
    this.refresh();
    this.onEvent(this.trace.visible ? "correct" : "blocked");
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
    if (!this.started || this.finished || this.isAtTop) return false;
    const hit = this.hitTerrain(raycaster);
    if (!hit) return false;
    const local = this.group.worldToLocal(hit.point.clone());
    this.setObserver(local.x, local.z);
    return true;
  }
  hitTerrain(raycaster) {
    this.pickGround.updateWorldMatrix(true, false);
    this.clipboard.children[0].updateWorldMatrix(true, false);
    if (this.clipboard.visible && raycaster.intersectObject(this.clipboard.children[0], false).length)
      return null;
    return raycaster.intersectObject(this.pickGround, false)[0] ?? null;
  }
  reset() {
    this.cancelClimb();
    this.elapsed = 0;
    this.finished = false;
    this.observer = { ...this.sceneChoice.start, height: 2 };
    this.visualHeight = 2;
    this.refresh();
    this.onChange();
  }
  finish() {
    this.cancelClimb();
    super.finish();
  }
  get visiblePercent() {
    return Math.round((100 * this.analysis.visible) / this.analysis.sampled);
  }
  renderMap(ctx) {
    if (this.sceneChoice.id === "valley") renderLayerMap(ctx, this.selected, { annotations: false });
    else this.renderCanyonMap(ctx);
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
    const targetX = ((this.sceneChoice.target.x + LANDSCAPE_EXTENT) / (2 * LANDSCAPE_EXTENT)) * size;
    const targetZ = ((this.sceneChoice.target.z + LANDSCAPE_EXTENT) / (2 * LANDSCAPE_EXTENT)) * size;
    ctx.beginPath();
    ctx.arc(targetX, targetZ, 9 * ratio, 0, Math.PI * 2);
    ctx.fillStyle = "#168cff";
    ctx.fill();
    ctx.lineWidth = 3 * ratio;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(targetX, targetZ, 2.5 * ratio, 0, Math.PI * 2);
    ctx.fillStyle = "#17363d";
    ctx.fill();
    ctx.font = `bold ${17 * ratio}px system-ui, sans-serif`;
    ctx.fillStyle = "#17363d";
    ctx.fillText("MODEL N ↑", 10 * ratio, 23 * ratio);
  }
  renderCanyonMap(ctx) {
    const size = ctx.canvas.width;
    const spec = this.sceneChoice;
    const step = size / 256;
    for (let row = 0; row < 256; row++) {
      const z = (row / 255 * 2 - 1) * LANDSCAPE_EXTENT;
      for (let col = 0; col < 256; col++) {
        const x = (col / 255 * 2 - 1) * LANDSCAPE_EXTENT;
        const y = spec.heightAt(x, z);
        const light = Math.round(45 + THREE.MathUtils.clamp(y * 0.65, -8, 18));
        ctx.fillStyle = Math.abs(x - spec.river(z)) < spec.riverWidth
          ? "#428ca3" : `hsl(19 47% ${light}%)`;
        ctx.fillRect(col * step, row * step, step + 1, step + 1);
      }
    }
  }
}
