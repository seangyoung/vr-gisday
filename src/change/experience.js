import * as THREE from "three";
import { TimedExhibit, canvasPanel, replacePanelTexture } from "../showcase/exhibit.js";
import { CHANGE_SCENES } from "./scenes.js";

const FULL_HEAD_TILT = 12 * Math.PI / 180;

export function headTiltBlendFromRoll(roll) {
  const position = Math.max(0, Math.min(1,
    0.5 - roll / (2 * FULL_HEAD_TILT)));
  return position * position * (3 - 2 * position);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load Landsat imagery"));
    image.src = url;
  });
}

function blank(canvas, text) {
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#102c37";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#e6f4f5";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "30px system-ui";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
}

function dateBadge(ctx, text, x, y, align, { size = 27, height = 48, alpha = 1 } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = (ctx.globalAlpha ?? 1) * alpha;
  ctx.font = `bold ${size}px system-ui`;
  const padding = size <= 20 ? 10 : 15;
  const width = ctx.measureText(text).width + padding * 2;
  const left = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
  ctx.fillStyle = "#071820de";
  ctx.fillRect(left, y, width, height);
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x + (align === "right" ? -padding : align === "center" ? 0 : padding), y + height / 2);
  ctx.restore();
}

export class ChangeExperience extends TimedExhibit {
  constructor(root, onChange) {
    super(root, onChange);
    this.kind = "change";
    this.sceneIndex = 0;
    this.comparisonMode = "slider";
    this.split = 0.5;
    this.lens = { u: 0.5, v: 0.5 };
    this.tiltBlend = 0.5;
    this.lastTiltDrawn = 0.5;
    this.tiltRefreshTime = 0;
    this.headQuaternion = new THREE.Quaternion();
    this.headEuler = new THREE.Euler();
    this.selectedOption = null;
    this.revealed = false;
    this.ready = false;
    this.draggingBy = null;
    this.cache = new Map();
    this.pending = new Map();
    this.canvas = document.createElement("canvas");
    this.canvas.width = CHANGE_SCENES[0].width;
    this.canvas.height = CHANGE_SCENES[0].height;
    blank(this.canvas, "Loading Landsat images…");
    this.image = canvasPanel(this.canvas, 1.65, 1.42, -0.47, -0.03);
    // The image and answer controls share a plane in front of the visitor.
    this.image.position.z = 0.115;
    this.group.add(this.image);
    this.loadScene();
  }

  get sceneInfo() { return CHANGE_SCENES[this.sceneIndex]; }

  getPair(scene) {
    if (this.cache.has(scene.id)) return Promise.resolve(this.cache.get(scene.id));
    if (this.pending.has(scene.id)) return this.pending.get(scene.id);
    const promise = Promise.all([loadImage(scene.before), loadImage(scene.after)])
      .then((pair) => {
        this.cache.set(scene.id, pair);
        this.pending.delete(scene.id);
        return pair;
      }).catch((error) => {
        this.pending.delete(scene.id);
        throw error;
      });
    this.pending.set(scene.id, promise);
    return promise;
  }

  loadScene() {
    const scene = this.sceneInfo;
    const ticket = this.loadTicket = (this.loadTicket || 0) + 1;
    this.draggingBy = null;
    this.split = 0.5;
    this.lens = { u: 0.5, v: 0.5 };
    this.tiltBlend = 0.5;
    this.lastTiltDrawn = 0.5;
    this.tiltRefreshTime = 0;
    this.selectedOption = null;
    this.revealed = false;
    this.ready = false;
    this.error = false;
    this.canvas.width = scene.width;
    this.canvas.height = scene.height;
    const aspect = scene.width / scene.height;
    const height = Math.min(1.42, 1.65 / aspect);
    const width = height * aspect;
    this.image.scale.set(width / 1.65, height / 1.42, 1);
    blank(this.canvas, "Loading Landsat images…");
    // Resizing a canvas requires a fresh GPU texture on some WebGL runtimes.
    replacePanelTexture(this.image, this.canvas);
    this.getPair(scene).then((pair) => {
      if (this.disposed || ticket !== this.loadTicket) return;
      this.pair = pair;
      this.ready = true;
      this.refresh();
      this.onChange();
      const next = CHANGE_SCENES[this.sceneIndex + 1];
      if (next) this.getPair(next).catch(() => {});
    }).catch(() => {
      if (this.disposed || ticket !== this.loadTicket) return;
      this.error = true;
      blank(this.canvas, "Imagery unavailable · select Retry");
      this.image.material.map.needsUpdate = true;
      this.onChange();
    });
  }

  refresh() {
    if (!this.ready) return;
    const { width, height } = this.canvas;
    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    const crop = this.sceneInfo.crop;
    if (crop) ctx.drawImage(this.pair[0], ...crop.before, 0, 0, width, height);
    else ctx.drawImage(this.pair[0], 0, 0, width, height);
    const spotlight = this.comparisonMode === "spotlight";
    const headTilt = this.comparisonMode === "head-tilt";
    const lensX = (this.lens?.u ?? 0.5) * width;
    const lensY = (this.lens?.v ?? 0.5) * height;
    const lensRadius = Math.min(width, height) * 0.24;
    ctx.save();
    if (headTilt) ctx.globalAlpha = this.tiltBlend;
    else {
      ctx.beginPath();
      if (spotlight) ctx.arc(lensX, lensY, lensRadius, 0, Math.PI * 2);
      else ctx.rect(this.split * width, 0, width * (1 - this.split), height);
      ctx.clip();
    }
    if (crop) ctx.drawImage(this.pair[1], ...crop.after, 0, 0, width, height);
    else ctx.drawImage(this.pair[1], 0, 0, width, height);
    ctx.restore();
    if (spotlight) {
      ctx.strokeStyle = "#102c37";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(lensX, lensY, lensRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#d7fff4";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(lensX, lensY, lensRadius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (!headTilt) {
      const splitX = this.split * width;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, height);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(splitX, height * 0.52, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#102c37";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(splitX - 10, height * 0.52);
      ctx.lineTo(splitX + 10, height * 0.52);
      ctx.stroke();
    }
    if (spotlight) {
      dateBadge(ctx, this.sceneInfo.beforeDate, 12, 12, "left");
      // Keep the later date with the moving window, tucked inside its rim.
      const badgeHeight = 32;
      const badgeWidth = (() => {
        ctx.font = "bold 19px system-ui";
        return ctx.measureText(this.sceneInfo.afterDate).width + 20;
      })();
      const badgeX = Math.max(badgeWidth / 2 + 8,
        Math.min(width - badgeWidth / 2 - 8, lensX));
      const farthestEdge = Math.abs(badgeX - lensX) + badgeWidth / 2;
      const inset = lensRadius - Math.sqrt(Math.max(0,
        lensRadius * lensRadius - Math.min(farthestEdge, lensRadius) ** 2)) + 8;
      const innerTop = lensY - lensRadius + inset;
      const innerBottom = lensY + lensRadius - inset - badgeHeight;
      const badgeY = innerTop >= 8 ? innerTop : Math.min(height - badgeHeight - 8, innerBottom);
      ctx.save();
      ctx.beginPath();
      ctx.arc(lensX, lensY, lensRadius - 5, 0, Math.PI * 2);
      ctx.clip();
      dateBadge(ctx, this.sceneInfo.afterDate, badgeX, badgeY, "center",
        { size: 19, height: badgeHeight });
      ctx.restore();
    } else if (headTilt) {
      dateBadge(ctx, this.sceneInfo.beforeDate, 12, 12, "left",
        { alpha: 1 - this.tiltBlend });
      dateBadge(ctx, this.sceneInfo.afterDate, width - 12, 12, "right",
        { alpha: this.tiltBlend });
    } else {
      dateBadge(ctx, this.sceneInfo.beforeDate, 12, 12, "left");
      dateBadge(ctx, this.sceneInfo.afterDate, width - 12, 12, "right");
    }
    if (this.revealed && this.sceneInfo.focus) {
      const { u, v, rx, ry } = this.sceneInfo.focus;
      ctx.strokeStyle = "#fff9bb";
      ctx.lineWidth = 6;
      ctx.setLineDash([16, 10]);
      ctx.beginPath();
      ctx.ellipse(u * width, v * height, rx * width, ry * height,
        0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    this.image.material.map.needsUpdate = true;
    if (headTilt) this.lastTiltDrawn = this.tiltBlend;
  }

  imageHit(raycaster) {
    if (!this.started || this.finished || !this.ready) return null;
    this.image.updateWorldMatrix(true, false);
    return raycaster.intersectObject(this.image, false)[0];
  }

  setComparisonMode(mode) {
    if (!this.started || this.finished ||
        !["slider", "spotlight", "head-tilt"].includes(mode)) return;
    this.comparisonMode = mode;
    this.draggingBy = null;
    if (mode === "head-tilt") {
      this.tiltBlend = 0.5;
      this.tiltRefreshTime = 0;
    }
    this.refresh();
    this.onChange();
  }

  setLensFromUV(uv) {
    const u = Math.max(0, Math.min(1, uv.x));
    const v = Math.max(0, Math.min(1, 1 - uv.y));
    if (Math.abs(u - this.lens.u) < 0.006 && Math.abs(v - this.lens.v) < 0.006)
      return false;
    this.lens = { u, v };
    this.refresh();
    return true;
  }

  aimSpotlight(raycaster) {
    if (this.comparisonMode !== "spotlight") return false;
    const hit = this.imageHit(raycaster);
    if (!hit?.uv) return false;
    this.setLensFromUV(hit.uv);
    return true;
  }

  beginInteraction(raycaster, id) {
    if (this.comparisonMode === "head-tilt") return false;
    const hit = this.imageHit(raycaster);
    if (!hit?.uv) return false;
    this.draggingBy = id;
    if (this.comparisonMode === "spotlight") this.setLensFromUV(hit.uv);
    this.startU = hit.uv.x;
    this.moved = false;
    return true;
  }

  dragInteraction(raycaster, id) {
    if (this.draggingBy !== id) return false;
    const hit = this.imageHit(raycaster);
    if (!hit?.uv) return false;
    if (this.comparisonMode === "spotlight") {
      this.setLensFromUV(hit.uv);
      return true;
    }
    const u = Math.max(0.02, Math.min(0.98, hit.uv.x));
    if (Math.abs(u - this.startU) > 0.025) this.moved = true;
    if (this.moved && Math.abs(u - this.split) > 0.001) {
      this.split = u;
      this.refresh();
    }
    return true;
  }

  endInteraction(id) {
    if (this.draggingBy !== id) return false;
    this.draggingBy = null;
    return true;
  }

  chooseAnswer(index) {
    if (!this.started || this.finished || !this.ready || this.revealed ||
        index < 0 || index >= this.sceneInfo.options.length) return;
    this.draggingBy = null;
    this.selectedOption = index;
    this.revealed = true;
    this.refresh();
    this.onChange(index === this.sceneInfo.answer ? "correct" : "blocked");
  }

  nextScene() {
    if (!this.started || this.finished || !this.revealed) return;
    if (this.sceneIndex === CHANGE_SCENES.length - 1) {
      this.finish();
      return;
    }
    this.sceneIndex++;
    this.loadScene();
    this.onChange("reveal");
  }

  finish() {
    if (!this.started || this.finished) return;
    this.draggingBy = null;
    this.group.visible = false;
    super.finish();
  }

  update(dt, camera) {
    super.update(dt);
    if (this.finished) this.group.visible = false;
    if (!this.started || this.finished || !this.ready ||
        this.comparisonMode !== "head-tilt" || !camera) return;
    camera.getWorldQuaternion(this.headQuaternion);
    this.headEuler.setFromQuaternion(this.headQuaternion, "YXZ");
    const target = headTiltBlendFromRoll(this.headEuler.z);
    this.tiltBlend += (target - this.tiltBlend) * (1 - Math.exp(-dt * 14));
    if (Math.abs(target - this.tiltBlend) < 0.001) this.tiltBlend = target;
    this.tiltRefreshTime += dt;
    if (this.tiltRefreshTime >= 1 / 30 &&
        Math.abs(this.tiltBlend - this.lastTiltDrawn) >= 1 / 96) {
      this.tiltRefreshTime = 0;
      this.refresh();
    }
  }

  dispose() {
    this.disposed = true;
    super.dispose();
  }
}
