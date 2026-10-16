import * as THREE from "three";
import { TimedExhibit } from "../showcase/exhibit.js";
import { ModelGrab } from "../manipulation.js";
import { handInsideModel, modelBoundsHit } from "../model-target.js";
import {
  BUFFER_KM, HOMES, ROADS, SITES, inBuffer, riverX, scoreSites,
  terrainHeight,
} from "./model.js";

const BOUNDS = new THREE.Box3(
  new THREE.Vector3(-1.08, -0.04, -1.08),
  new THREE.Vector3(1.08, 0.65, 1.08),
);
const palette = { A: 0xffcf81, B: 0x80d7ec, C: 0xc6b7ff };

function tag(text, color = "#f5fbf4") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 100;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#102b38";
  ctx.fillRect(0, 0, 256, 100);
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, 250, 94);
  ctx.fillStyle = color;
  ctx.font = "bold 66px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 52);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture,
    depthTest: false, transparent: true }));
  sprite.scale.set(0.20, 0.078, 1);
  return sprite;
}

function ribbon(points, halfWidth, color, lift = 0.014, transparent = false) {
  const positions = [], indices = [];
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    const before = points[Math.max(0, i - 1)];
    const after = points[Math.min(points.length - 1, i + 1)];
    const dx = after[0] - before[0], dz = after[1] - before[1];
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length * halfWidth, nz = dx / length * halfWidth;
    for (const side of [-1, 1]) {
      const px = x + side * nx, pz = z + side * nz;
      positions.push(px, terrainHeight(px, pz) + lift, pz);
    }
    if (i < points.length - 1) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color,
    side: THREE.DoubleSide, transparent, opacity: transparent ? 0.38 : 1,
    depthWrite: !transparent }));
}

function terrain() {
  const size = 110;
  const positions = [], colors = [], indices = [];
  for (let row = 0; row <= size; row++) for (let col = 0; col <= size; col++) {
    const x = -1 + 2 * col / size, z = -1 + 2 * row / size;
    const h = terrainHeight(x, z);
    positions.push(x, h, z);
    const color = new THREE.Color(0x71957b);
    color.offsetHSL(0, 0, Math.min(0.14, h * 1.2));
    colors.push(color.r, color.g, color.b);
    if (row < size && col < size) {
      const a = row * (size + 1) + col;
      indices.push(a, a + size + 1, a + 1,
        a + 1, a + size + 1, a + size + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 1,
  }));
}

function distanceRing(site) {
  const points = [];
  for (let i = 0; i <= 128; i++) {
    const angle = i / 128 * Math.PI * 2;
    const x = site.x + BUFFER_KM * Math.cos(angle);
    const z = site.z + BUFFER_KM * Math.sin(angle);
    points.push(new THREE.Vector3(x, terrainHeight(x, z) + 0.038, z));
  }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false }));
  line.renderOrder = 6;
  line.raycast = () => {};
  return line;
}

export class SuitabilityExperience extends TimedExhibit {
  constructor(root, onChange, scene) {
    super(root, onChange);
    this.kind = "suitability";
    this.priority = "reach";
    this.selectedSite = null;
    this.scoresVisible = false;
    this.scoreSet = scoreSites(this.priority);
    this.model = new THREE.Group();
    this.model.visible = false;
    scene.add(this.model);
    this.grab = new ModelGrab(this.model, 0.35, 1.0);
    this.grab.turnPivot.copy(BOUNDS.getCenter(new THREE.Vector3()));

    this.model.add(new THREE.AmbientLight(0xffffff, 1.65));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(-1, 2, 1.2);
    this.model.add(sun);
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.055, 2.05),
      new THREE.MeshStandardMaterial({ color: 0x14333e, roughness: 0.85 }));
    base.position.y = -0.035;
    this.model.add(base, terrain());

    const flood = [];
    for (let i = 0; i <= 180; i++) {
      const z = -1 + 2 * i / 180;
      flood.push([riverX(z), z]);
    }
    this.floodplain = ribbon(flood, 0.26, 0x6bbdd0, 0.022, true);
    this.floodplain.visible = false;
    this.model.add(this.floodplain);
    this.model.add(ribbon(flood, 0.045, 0x318db3, 0.028));
    for (const road of ROADS) {
      const smooth = [];
      for (let i = 0; i < road.length - 1; i++) {
        const [x0, z0] = road[i], [x1, z1] = road[i + 1];
        for (let j = 0; j < 25; j++) {
          const t = j / 25;
          smooth.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]);
        }
      }
      smooth.push(road.at(-1));
      this.model.add(ribbon(smooth, 0.025, 0x344c55, 0.030));
      this.model.add(ribbon(smooth, 0.0025, 0xe9dba4, 0.032));
    }

    this.homeMarkers = HOMES.map(([x, z], index) => {
      const home = new THREE.Group();
      home.position.set(x, terrainHeight(x, z) + 0.017, z);
      const material = new THREE.MeshStandardMaterial({ color: 0xd7e4d4,
        roughness: 0.9 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.038, 0.047), material);
      body.position.y = 0.02;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.046, 0.033, 4),
        new THREE.MeshStandardMaterial({ color: 0x985f51, roughness: 1 }));
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 0.052;
      home.add(body, roof);
      this.model.add(home);
      return { material, home, index };
    });

    this.siteTargets = [];
    this.posts = [];
    this.siteMarkers = [];
    for (const site of SITES) {
      const h = terrainHeight(site.x, site.z);
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.072, 18, 12),
        new THREE.MeshStandardMaterial({ color: palette[site.id],
          emissive: palette[site.id], emissiveIntensity: 0.32,
          roughness: 0.35 }));
      marker.position.set(site.x, h + 0.12, site.z);
      marker.userData.siteId = site.id;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.10, 8),
        new THREE.MeshBasicMaterial({ color: palette[site.id] }));
      stem.position.set(site.x, h + 0.06, site.z);
      const label = tag(site.id);
      label.position.set(site.x, h + 0.245, site.z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.040, 1, 12),
        new THREE.MeshStandardMaterial({ color: palette[site.id],
          emissive: palette[site.id], emissiveIntensity: 0.18,
          transparent: true, opacity: 0.80 }));
      post.position.set(site.x + 0.115, h, site.z + 0.045);
      post.scale.y = 0.001;
      post.visible = false;
      this.model.add(marker, stem, label, post);
      this.siteTargets.push(marker);
      this.siteMarkers.push(marker);
      this.posts.push({ mesh: post, site, base: h });
    }
    this.bufferRing = null;
  }

  begin() {
    super.begin();
    this.model.visible = true;
  }

  selectSite(id) {
    if (!this.started || this.finished) return;
    const site = SITES.find((entry) => entry.id === id);
    if (!site) return;
    this.selectedSite = site;
    if (this.bufferRing) {
      this.bufferRing.geometry.dispose();
      this.bufferRing.material.dispose();
      this.bufferRing.removeFromParent();
    }
    this.bufferRing = distanceRing(site);
    this.model.add(this.bufferRing);
    this.homeMarkers.forEach(({ material, index }) =>
      material.color.set(inBuffer(site, HOMES[index]) ? 0xffe69b : 0x849b94));
    this.siteMarkers.forEach((marker) => marker.scale.setScalar(
      marker.userData.siteId === id ? 1.25 : 1));
    this.onChange("selection");
  }

  setPriority(priority) {
    if (!this.started || this.finished || !["reach", "safety"].includes(priority)) return;
    this.priority = priority;
    this.scoreSet = scoreSites(priority);
    this.onChange("reveal");
  }

  toggleScores() {
    if (!this.started || this.finished) return;
    this.scoresVisible = !this.scoresVisible;
    this.floodplain.visible = this.scoresVisible;
    this.posts.forEach(({ mesh }) => {
      mesh.visible = this.scoresVisible;
      if (!this.scoresVisible) mesh.scale.y = 0.001;
    });
    this.onChange("reveal");
  }

  selectFromRay(raycaster) {
    if (!this.started || this.finished || this.grab.hands.size) return false;
    this.model.updateWorldMatrix(true, true);
    const hit = raycaster.intersectObjects(this.siteTargets, false)[0];
    if (!hit) return false;
    this.selectSite(hit.object.userData.siteId);
    return true;
  }

  grabHit(raycaster) {
    return this.started && !this.finished && this.model.visible
      ? modelBoundsHit(this.model, BOUNDS, raycaster) : null;
  }

  handNear(position) {
    return this.started && !this.finished && this.model.visible &&
      handInsideModel(this.model, BOUNDS, position);
  }

  place(camera) {
    this.grab.cancel();
    const position = new THREE.Vector3();
    const forward = new THREE.Vector3();
    camera.getWorldPosition(position);
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.01) forward.set(0, 0, -1);
    forward.normalize();
    this.model.position.copy(position).addScaledVector(forward, 1.58);
    this.model.position.y = position.y + 0.10;
    this.model.rotation.set(0.43, Math.atan2(-forward.x, -forward.z), 0);
    this.model.scale.setScalar(0.56);
  }

  update(dt) {
    super.update(dt);
    if (!this.started || this.finished) return;
    const winner = this.scoreSet.winner.site.id;
    for (const { mesh, site, base } of this.posts) {
      if (!this.scoresVisible) continue;
      const score = this.scoreSet.scores.find((entry) => entry.site.id === site.id).score;
      const height = 0.06 + score * 0.0046;
      mesh.scale.y = THREE.MathUtils.damp(mesh.scale.y, height, 7, dt);
      mesh.position.y = base + mesh.scale.y / 2 + 0.018;
      mesh.material.emissiveIntensity = site.id === winner ? 0.65 : 0.12;
    }
  }

  finish() {
    if (!this.started || this.finished) return;
    this.model.visible = false;
    this.grab.cancel();
    super.finish();
  }

  dispose() {
    this.grab.cancel();
    this.model.traverse((node) => {
      node.geometry?.dispose();
      if (node.material) {
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          material.map?.dispose();
          material.dispose();
        }
      }
    });
    this.model.removeFromParent();
    super.dispose();
  }
}
