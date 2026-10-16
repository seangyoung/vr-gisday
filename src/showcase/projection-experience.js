import * as THREE from "three";
import land from "./data/ne_110m_land.json" with { type: "json" };
import { TimedExhibit } from "./exhibit.js";
import {
  GlobeSpin, PROJECTIONS, TISSOT_LONGITUDES, TISSOT_LATITUDES,
  nearestTissotCircle, projectMetric,
  projectionFitScale, relativeAreaScale, tissotDistortion,
} from "./projection-model.js";

function drawTissot(ctx, canvas, selectedCircle) {
  const radians = Math.PI / 180;
  const radius = 8 * radians;
  const x = (lon) => (lon + 180) / 360 * canvas.width;
  const y = (lat) => (90 - lat) / 180 * canvas.height;
  for (const latitude of TISSOT_LATITUDES)
    for (const longitude of TISSOT_LONGITUDES) {
      const selected = selectedCircle?.latitude === latitude &&
        selectedCircle.longitude === (longitude === 180 ? -180 : longitude);
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
      ctx.fillStyle = selected ? "#49f5e399" : "#ffe08355";
      ctx.fill();
      ctx.lineWidth = selected ? 6 : 3;
      ctx.strokeStyle = selected ? "#64ffed" : "#fff3b9";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x(longitude), y(latitude), selected ? 6 : 3, 0, Math.PI * 2);
      ctx.fillStyle = selected ? "#ffffff" : "#fff9de";
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
  ctx.strokeStyle = "#d7faf0cc";
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(x(0), 0);
  ctx.lineTo(x(0), canvas.height);
  ctx.moveTo(0, y(0));
  ctx.lineTo(canvas.width, y(0));
  ctx.stroke();
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
    this.selectedCircle = null;
    this.draggingBy = null;
    this.interaction = null;
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
    this.tooltipCanvas = document.createElement("canvas");
    this.tooltipCanvas.width = 1024;
    this.tooltipCanvas.height = 500;
    const tooltipTexture = textureFor(this.tooltipCanvas);
    this.tooltip = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.46),
      new THREE.MeshBasicMaterial({ map: tooltipTexture, side: THREE.DoubleSide,
        depthTest: false, depthWrite: false }));
    this.tooltip.visible = false;
    this.tooltip.renderOrder = 5;
    this.group.add(this.tooltip);
    this.tooltipLeader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(),
    ]), new THREE.LineBasicMaterial({ color: 0x64ffed, depthTest: false,
      depthWrite: false }));
    this.tooltipLeader.visible = false;
    this.tooltipLeader.renderOrder = 4;
    this.tooltipLeader.frustumCulled = false;
    this.group.add(this.tooltipLeader);
    this.from = this.map.geometry.attributes.position.array.slice();
    this.to = this.from.slice();
  }
  begin() {
    super.begin();
    this.transitionTo(true);
  }
  finish() {
    if (!this.started || this.finished) return;
    this.draggingBy = null;
    this.interaction = null;
    this.spin.end();
    this.group.visible = false;
    super.finish();
  }
  paintTexture() {
    const ctx = this.displayCanvas.getContext("2d");
    ctx.clearRect(0, 0, this.displayCanvas.width, this.displayCanvas.height);
    ctx.drawImage(this.baseCanvas, 0, 0);
    if (this.tissot) drawTissot(ctx, this.displayCanvas, this.selectedCircle);
    if (this.globe) this.globe.material.map.needsUpdate = true;
    if (this.map) this.map.material.map.needsUpdate = true;
  }
  setTissot(enabled) {
    if (!this.started || this.finished) return;
    this.tissot = enabled;
    if (!enabled) this.selectedCircle = null;
    this.paintTexture();
    this.updateTooltip();
    this.onChange();
  }
  rayAngles(raycaster) {
    this.group.updateWorldMatrix(true, false);
    const inverse = this.group.matrixWorld.clone().invert();
    const direction = raycaster.ray.direction.clone().transformDirection(inverse);
    return [Math.atan2(direction.x, -direction.z),
      Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1))];
  }
  mapRayX(raycaster) {
    this.group.updateWorldMatrix(true, false);
    const inverse = this.group.matrixWorld.clone().invert();
    const origin = raycaster.ray.origin.clone().applyMatrix4(inverse);
    const direction = raycaster.ray.direction.clone().transformDirection(inverse);
    if (Math.abs(direction.z) < 0.001) return null;
    return origin.x - origin.z * direction.x / direction.z;
  }
  beginInteraction(raycaster, source) {
    if (!this.started || this.finished || this.draggingBy !== null) return false;
    this.group.updateWorldMatrix(true, true);
    const hit = raycaster.intersectObjects([this.globe, this.map], false)[0];
    if (!hit) {
      this.selectCircle(null);
      return false;
    }
    const kind = hit.object === this.globe ? "globe" : "map";
    this.draggingBy = source;
    this.interaction = { kind, uv: hit.uv.clone(), moved: false,
      startX: this.mapRayX(raycaster), lastX: this.mapRayX(raycaster),
      startAngles: this.rayAngles(raycaster) };
    if (kind === "globe") this.spin.begin(...this.interaction.startAngles);
    return true;
  }
  dragInteraction(raycaster, source, dt) {
    if (this.draggingBy !== source || !this.interaction) return;
    const gesture = this.interaction;
    if (gesture.kind === "globe") {
      const angles = this.rayAngles(raycaster);
      if (Math.hypot(angles[0] - gesture.startAngles[0],
        angles[1] - gesture.startAngles[1]) > 0.015) gesture.moved = true;
      this.spin.drag(...angles, dt);
      orientGlobe(this.globe, this.spin);
    } else {
      const x = this.mapRayX(raycaster);
      if (x === null || gesture.lastX === null) return;
      if (Math.abs(x - gesture.startX) > 0.015) gesture.moved = true;
      const width = 2 * Math.PI * projectionFitScale(this.projection,
        this.standardParallel) * (this.projection === "equalArea"
          ? Math.cos(this.standardParallel * Math.PI / 180) : 1);
      this.turnCenter(-(x - gesture.lastX) / width * 360, false);
      gesture.lastX = x;
    }
  }
  endInteraction(source) {
    if (this.draggingBy !== source || !this.interaction) return;
    const gesture = this.interaction;
    this.draggingBy = null;
    this.interaction = null;
    if (gesture.kind === "globe") this.spin.end();
    if (!gesture.moved && this.tissot) {
      const offset = gesture.kind === "map" ? this.map.material.map.offset.x : 0;
      const longitude = (((gesture.uv.x + offset) % 1 + 1) % 1) * 360 - 180;
      const latitude = gesture.uv.y * 180 - 90;
      this.selectCircle(nearestTissotCircle(longitude, latitude));
    } else if (gesture.kind === "map") this.onChange();
  }
  selectCircle(circle) {
    if (!this.started || this.finished || !this.tissot) return;
    this.selectedCircle = circle;
    this.paintTexture();
    this.updateTooltip();
    this.onChange();
  }
  updateTooltip() {
    const circle = this.selectedCircle;
    if (!this.tissot || !circle) {
      this.tooltip.visible = false;
      this.tooltipLeader.visible = false;
      return;
    }
    const { shapeRatio, longerAxis, relativeArea } = tissotDistortion(
      this.projection, circle.latitude, this.standardParallel);
    const ctx = this.tooltipCanvas.getContext("2d");
    ctx.fillStyle = "#0b2430";
    ctx.fillRect(0, 0, 1024, 500);
    ctx.strokeStyle = "#64ffed";
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 1016, 492);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#64ffed";
    ctx.font = "600 61px system-ui, sans-serif";
    const latitude = circle.latitude === 0 ? "EQUATOR" :
      `${Math.abs(circle.latitude)}° ${circle.latitude < 0 ? "S" : "N"}`;
    ctx.fillText(`TISSOT · ${latitude}`,
      46, 82, 930);
    ctx.fillStyle = "#e6f4f5";
    ctx.font = "500 57px system-ui, sans-serif";
    const shape = shapeRatio < 1.05 ? "round · local shape kept" :
      `≈${shapeRatio.toFixed(1)}× ${longerAxis === "east-west" ? "wider" : "taller"}`;
    ctx.fillText(`Shape: ${shape}`, 46, 190, 930);
    ctx.fillText(relativeArea === 1 ? "Area: preserved (1.0× equator)" :
      `Area: ≈${relativeArea.toFixed(1)}× map area at equator`,
      46, 290, 930);
    ctx.fillStyle = "#b6d1d9";
    ctx.font = "500 42px system-ui, sans-serif";
    ctx.fillText("Equal-size ground circles reveal map distortion.",
      46, 410, 930);
    this.tooltip.material.map.needsUpdate = true;
    this.positionTooltip();
  }
  positionTooltip() {
    const circle = this.selectedCircle;
    const visible = !!(this.tissot && circle && this.transitionAge >= 1);
    this.tooltip.visible = visible;
    this.tooltipLeader.visible = visible;
    if (!visible) return;
    const offset = this.centralMeridian / 360;
    const geographicU = (circle.longitude + 180) / 360;
    const u = ((geographicU - offset) % 1 + 1) % 1;
    const longitude = u * 360 - 180;
    let anchorX, anchorY, anchorZ = 0;
    if (this.flat) {
      const scale = projectionFitScale(this.projection, this.standardParallel);
      const projected = projectMetric(longitude, circle.latitude,
        this.projection, this.standardParallel);
      anchorX = this.map.position.x + projected.x * scale;
      anchorY = this.map.position.y + projected.y * scale;
    } else {
      const latitude = circle.latitude * Math.PI / 180;
      const relativeLongitude = longitude * Math.PI / 180;
      const mapPoint = new THREE.Vector3(
        0.49 * Math.cos(latitude) * Math.sin(relativeLongitude),
        0.49 * Math.sin(latitude),
        0.49 * Math.cos(latitude) * Math.cos(relativeLongitude));
      if (mapPoint.z > 0.06) {
        anchorX = this.map.position.x + mapPoint.x;
        anchorY = this.map.position.y + mapPoint.y;
        anchorZ = mapPoint.z;
      } else {
        const globeLongitude = circle.longitude * Math.PI / 180;
        const globePoint = new THREE.Vector3(
          0.49 * Math.cos(latitude) * Math.sin(globeLongitude),
          0.49 * Math.sin(latitude),
          0.49 * Math.cos(latitude) * Math.cos(globeLongitude))
          .applyEuler(this.globe.rotation);
        if (globePoint.z > 0.06) {
          anchorX = this.globe.position.x + globePoint.x;
          anchorY = this.globe.position.y + globePoint.y;
          anchorZ = globePoint.z;
        } else {
          // The selected circle is on the far side of both wrapped surfaces.
          // Keep the explanation by the map without pointing to a hidden spot.
          anchorX = this.map.position.x;
          anchorY = this.map.position.y;
          anchorZ = 0.49;
          this.tooltipLeader.visible = false;
        }
      }
    }
    const side = anchorX > (this.flat ? 1.1 : 0.95) ? -1 : 1;
    const cardScale = this.flat ? 1 : 0.78;
    const halfWidth = 0.47 * cardScale;
    const halfHeight = 0.23 * cardScale;
    const cardX = anchorX + side * (halfWidth + 0.06);
    const cardY = anchorY + (anchorY > 0.32 ? -1 : 1) * (halfHeight + 0.03);
    const leaderZ = Math.max(0.14, anchorZ + 0.04);
    this.tooltip.scale.setScalar(cardScale);
    this.tooltip.position.set(cardX, cardY, leaderZ + 0.01);
    const points = this.tooltipLeader.geometry.attributes.position;
    points.setXYZ(0, anchorX, anchorY, leaderZ);
    points.setXYZ(1, cardX - side * halfWidth,
      THREE.MathUtils.clamp(anchorY, cardY - halfHeight, cardY + halfHeight),
      leaderZ);
    points.needsUpdate = true;
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
    this.updateTooltip();
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
  turnCenter(delta, redraw = true) {
    if (!this.started || this.finished) return;
    this.centralMeridian = ((this.centralMeridian + delta + 540) % 360) - 180;
    this.map.material.map.offset.x = this.centralMeridian / 360;
    this.positionTooltip();
    if (redraw) this.onChange();
  }
  update(dt) {
    super.update(dt);
    if (!this.started || this.finished) return;
    this.spin.step(dt);
    orientGlobe(this.globe, this.spin);
    if (this.transitionAge >= 1) {
      if (this.selectedCircle && !this.flat) this.positionTooltip();
      return;
    }
    this.transitionAge = Math.min(1, this.transitionAge + dt / 0.9);
    const ease = 1 - (1 - this.transitionAge) ** 3;
    const position = this.map.geometry.attributes.position;
    for (let i = 0; i < position.array.length; i++)
      position.array[i] = this.from[i] + (this.to[i] - this.from[i]) * ease;
    position.needsUpdate = true;
    this.map.geometry.computeBoundingSphere();
    if (this.transitionAge >= 1) this.positionTooltip();
  }
  get areaAt60() {
    return relativeAreaScale(this.projection, 60).toFixed(1);
  }
}
