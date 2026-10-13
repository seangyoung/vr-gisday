import * as THREE from "three";
import land from "./data/ne_110m_land.json" with { type: "json" };
import { TimedExhibit } from "./exhibit.js";
import {
  GlobeSpin, PROJECTIONS, TISSOT_LONGITUDES, projectMetric,
  projectionFitScale, relativeAreaScale,
} from "./projection-model.js";

function drawTissot(ctx, canvas) {
  const radians = Math.PI / 180;
  const radius = 8 * radians;
  const x = (lon) => (lon + 180) / 360 * canvas.width;
  const y = (lat) => (90 - lat) / 180 * canvas.height;
  for (const latitude of [-60, -30, 0, 30, 60])
    for (const longitude of TISSOT_LONGITUDES) {
      const lat = latitude * radians;
      const lon = longitude * radians;
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const bearing = i / 48 * Math.PI * 2;
        const sampleLat = Math.asin(Math.sin(lat) * Math.cos(radius) +
          Math.cos(lat) * Math.sin(radius) * Math.cos(bearing));
        const sampleLon = lon + Math.atan2(
          Math.sin(bearing) * Math.sin(radius) * Math.cos(lat),
          Math.cos(radius) - Math.sin(lat) * Math.sin(sampleLat));
        const px = x(sampleLon / radians), py = y(sampleLat / radians);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = "#ffe08355";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#fff3b9";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x(longitude), y(latitude), 3, 0, Math.PI * 2);
      ctx.fillStyle = "#fff9de";
      ctx.fill();
    }
}

function earthCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#214d67";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const x = (lon) => (lon + 180) / 360 * canvas.width;
  const y = (lat) => (90 - lat) / 180 * canvas.height;
  ctx.fillStyle = "#89b979";
  ctx.strokeStyle = "#d3e7b2";
  ctx.lineWidth = 1.1;
  for (const feature of land.features) {
    const polygons = feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const polygon of polygons) {
      ctx.beginPath();
      for (const ring of polygon) {
        ring.forEach(([lon, lat], i) => {
          if (i === 0) ctx.moveTo(x(lon), y(lat));
          else ctx.lineTo(x(lon), y(lat));
        });
        ctx.closePath();
      }
      ctx.fill("evenodd");
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "#e0ecdd77";
  ctx.lineWidth = 1.2;
  for (let lon = -150; lon <= 180; lon += 30) {
    ctx.beginPath();
    ctx.moveTo(x(lon), 0);
    ctx.lineTo(x(lon), canvas.height);
    ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y(lat));
    ctx.lineTo(canvas.width, y(lat));
    ctx.stroke();
  }
  return canvas;
}

function meshGeometry() {
  const lonSteps = 96, latSteps = 48;
  const vertices = [], uvs = [], indices = [];
  for (let row = 0; row <= latSteps; row++)
    for (let col = 0; col <= lonSteps; col++) {
      const u = col / lonSteps, v = row / latSteps;
      const lon = (u * 2 - 1) * Math.PI;
      const lat = (v * 2 - 1) * Math.PI / 2;
      const radius = 0.49;
      vertices.push(radius * Math.cos(lat) * Math.sin(lon),
        radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon));
      uvs.push(u, v);
      if (row < latSteps && col < lonSteps) {
        const a = row * (lonSteps + 1) + col;
        indices.push(a, a + 1, a + lonSteps + 1,
          a + 1, a + lonSteps + 2, a + lonSteps + 1);
      }
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function textureFor(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

export function orientGlobe(globe, spin) {
  // Apply pitch in viewer space after yaw. With local-axis pitch (YXZ),
  // vertical drag reverses when the globe's far side rotates toward us.
  globe.rotation.set(spin.pitch, spin.yaw, 0, "XYZ");
}

export class ProjectionExperience extends TimedExhibit {
  constructor(root, onChange) {
    super(root, onChange);
    this.kind = "projection";
    this.projection = "equirectangular";
    this.standardParallel = 0;
    this.centralMeridian = 0;
    this.flat = false;
    this.tissot = false;
    this.spinningBy = null;
    this.spin = new GlobeSpin();
    this.visualAge = 0;
    this.transitionAge = 1;
    this.baseCanvas = earthCanvas();
    this.displayCanvas = document.createElement("canvas");
    this.displayCanvas.width = this.baseCanvas.width;
    this.displayCanvas.height = this.baseCanvas.height;
    this.paintTexture();
    this.globe = new THREE.Mesh(meshGeometry(), new THREE.MeshBasicMaterial({
      map: textureFor(this.displayCanvas), side: THREE.DoubleSide,
    }));
    this.globe.position.set(-0.66, 0.25, 0);
    this.group.add(this.globe);
    this.map = new THREE.Mesh(meshGeometry(), new THREE.MeshBasicMaterial({
      map: textureFor(this.displayCanvas), side: THREE.DoubleSide,
    }));
    this.map.position.set(0.66, 0.25, 0);
    this.group.add(this.map);
    this.from = this.map.geometry.attributes.position.array.slice();
    this.to = this.from.slice();
  }
  begin() {
    super.begin();
    this.transitionTo(true);
  }
  finish() {
    if (!this.started || this.finished) return;
    this.spinningBy = null;
    this.spin.end();
    this.group.visible = false;
    super.finish();
  }
  paintTexture() {
    const ctx = this.displayCanvas.getContext("2d");
    ctx.clearRect(0, 0, this.displayCanvas.width, this.displayCanvas.height);
    ctx.drawImage(this.baseCanvas, 0, 0);
    if (this.tissot) drawTissot(ctx, this.displayCanvas);
    if (this.globe) this.globe.material.map.needsUpdate = true;
    if (this.map) this.map.material.map.needsUpdate = true;
  }
  setTissot(enabled) {
    if (!this.started || this.finished) return;
    this.tissot = enabled;
    this.paintTexture();
    this.onChange();
  }
  rayAngles(raycaster) {
    this.group.updateWorldMatrix(true, false);
    const inverse = this.group.matrixWorld.clone().invert();
    const direction = raycaster.ray.direction.clone().transformDirection(inverse);
    return [Math.atan2(direction.x, -direction.z),
      Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1))];
  }
  beginSpin(raycaster, source) {
    if (!this.started || this.finished || this.spinningBy !== null) return false;
    this.globe.updateWorldMatrix(true, false);
    if (!raycaster.intersectObject(this.globe, false).length) return false;
    this.spinningBy = source;
    this.spin.begin(...this.rayAngles(raycaster));
    return true;
  }
  dragSpin(raycaster, source, dt) {
    if (this.spinningBy !== source) return;
    const [azimuth, elevation] = this.rayAngles(raycaster);
    this.spin.drag(azimuth, elevation, dt);
    orientGlobe(this.globe, this.spin);
  }
  endSpin(source) {
    if (this.spinningBy !== source) return;
    this.spinningBy = null;
    this.spin.end();
  }
  targetVertices(flat, projection = this.projection) {
    const uvs = this.map.geometry.attributes.uv.array;
    const result = new Float32Array(this.map.geometry.attributes.position.array.length);
    const scale = projectionFitScale(projection, this.standardParallel);
    for (let i = 0; i < uvs.length / 2; i++) {
      const lon = (uvs[i * 2] * 2 - 1) * 180;
      const lat = (uvs[i * 2 + 1] * 2 - 1) * 90;
      if (flat) {
        const projected = projectMetric(lon, lat, projection, this.standardParallel);
        result[i * 3] = projected.x * scale;
        result[i * 3 + 1] = projected.y * scale;
        result[i * 3 + 2] = 0;
      } else {
        const longitude = lon * Math.PI / 180;
        const latitude = lat * Math.PI / 180;
        result[i * 3] = 0.49 * Math.cos(latitude) * Math.sin(longitude);
        result[i * 3 + 1] = 0.49 * Math.sin(latitude);
        result[i * 3 + 2] = 0.49 * Math.cos(latitude) * Math.cos(longitude);
      }
    }
    return result;
  }
  transitionTo(flat) {
    if (!this.started || this.finished) return;
    this.flat = flat;
    this.from = this.map.geometry.attributes.position.array.slice();
    this.to = this.targetVertices(flat);
    this.transitionAge = 0;
    this.onChange();
  }
  setProjection(projection) {
    if (!this.started || this.finished || !PROJECTIONS[projection]) return;
    this.projection = projection;
    this.transitionTo(true);
  }
  setStandardParallel(parallel) {
    if (!this.started || this.finished || this.projection !== "equalArea" ||
        ![0, 30, 45].includes(parallel)) return;
    this.standardParallel = parallel;
    this.transitionTo(true);
  }
  turnCenter(delta) {
    if (!this.started || this.finished) return;
    this.centralMeridian = ((this.centralMeridian + delta + 540) % 360) - 180;
    this.map.material.map.offset.x = this.centralMeridian / 360;
    this.onChange();
  }
  update(dt) {
    super.update(dt);
    if (!this.started || this.finished) return;
    this.spin.step(dt);
    orientGlobe(this.globe, this.spin);
    if (this.transitionAge >= 1) return;
    this.transitionAge = Math.min(1, this.transitionAge + dt / 0.9);
    const ease = 1 - (1 - this.transitionAge) ** 3;
    const position = this.map.geometry.attributes.position;
    for (let i = 0; i < position.array.length; i++)
      position.array[i] = this.from[i] + (this.to[i] - this.from[i]) * ease;
    position.needsUpdate = true;
    this.map.geometry.computeBoundingSphere();
  }
  get areaAt60() {
    return relativeAreaScale(this.projection, 60).toFixed(1);
  }
}
