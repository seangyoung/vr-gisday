import { TimedExhibit, canvasPanel, replacePanelTexture } from "../showcase/exhibit.js";
import { CHANGE_SCENES } from "./scenes.js";

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

function dateBadge(ctx, text, x, y, align) {
  ctx.font = "bold 27px system-ui";
  const width = ctx.measureText(text).width + 30;
  const left = align === "right" ? x - width : x;
  ctx.fillStyle = "#071820de";
  ctx.fillRect(left, y, width, 48);
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x + (align === "right" ? -15 : 15), y + 24);
}

export class ChangeExperience extends TimedExhibit {
  constructor(root, onChange) {
    super(root, onChange);
    this.kind = "change";
    this.sceneIndex = 0;
    this.split = 0.5;
    this.marker = null;
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
    this.image = canvasPanel(this.canvas, 1.65, 1.42, -0.42, 0.05);
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
    this.marker = null;
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
    ctx.drawImage(this.pair[0], 0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.split * width, 0, width * (1 - this.split), height);
    ctx.clip();
    ctx.drawImage(this.pair[1], 0, 0, width, height);
    ctx.restore();
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
    dateBadge(ctx, this.sceneInfo.beforeDate, 12, 12, "left");
    dateBadge(ctx, this.sceneInfo.afterDate, width - 12, 12, "right");
    if (this.marker) {
      const x = this.marker.u * width, y = this.marker.v * height;
      ctx.strokeStyle = "#ffdf85";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, 17, 0, Math.PI * 2);
      ctx.moveTo(x - 30, y); ctx.lineTo(x - 20, y);
      ctx.moveTo(x + 20, y); ctx.lineTo(x + 30, y);
      ctx.moveTo(x, y - 30); ctx.lineTo(x, y - 20);
      ctx.moveTo(x, y + 20); ctx.lineTo(x, y + 30);
      ctx.stroke();
    }
    if (this.revealed) {
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
  }

  imageHit(raycaster) {
    if (!this.started || this.finished || !this.ready || this.revealed) return null;
    this.image.updateWorldMatrix(true, false);
    return raycaster.intersectObject(this.image, false)[0];
  }

  beginInteraction(raycaster, id) {
    const hit = this.imageHit(raycaster);
    if (!hit?.uv) return false;
    this.draggingBy = id;
    this.startU = hit.uv.x;
    this.lastUV = { u: hit.uv.x, v: 1 - hit.uv.y };
    this.moved = false;
    return true;
  }

  dragInteraction(raycaster, id) {
    if (this.draggingBy !== id) return false;
    const hit = this.imageHit(raycaster);
    if (!hit?.uv) return false;
    const u = Math.max(0.02, Math.min(0.98, hit.uv.x));
    this.lastUV = { u, v: 1 - hit.uv.y };
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
    if (!this.moved && !this.revealed) {
      this.marker = this.lastUV;
      this.refresh();
      this.onChange();
    }
    return true;
  }

  selectFromRay(raycaster) {
    if (!this.beginInteraction(raycaster, "tap")) return false;
    this.endInteraction("tap");
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

  update(dt) {
    super.update(dt);
    if (this.finished) this.group.visible = false;
  }

  dispose() {
    this.disposed = true;
    super.dispose();
  }
}
