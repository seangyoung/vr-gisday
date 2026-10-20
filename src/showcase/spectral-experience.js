import * as THREE from "three";
import { TimedExhibit, canvasPanel, replacePanelTexture } from "./exhibit.js";
import { BAND_NAMES, displayedBandBrightness, nirGrayPixel,
  spectralLensAlignment,
  SPECTRAL_MODES } from "./spectral-model.js";
import { SPECTRAL_SCENES, createSpectralSceneRotation } from "./spectral-scenes.js";
import bayNaturalUrl from "./data/landsat-sf-natural.jpg";
import bayFalseUrl from "./data/landsat-sf-false.jpg";
import evergladesNaturalUrl from "./data/landsat-florida-natural.jpg";
import evergladesFalseUrl from "./data/landsat-florida-false.jpg";
import lilongweNaturalUrl from "./data/landsat-lilongwe-natural.jpg";
import lilongweFalseUrl from "./data/landsat-lilongwe-false.jpg";

const SCENE_URLS = {
  bay: [bayNaturalUrl, bayFalseUrl],
  everglades: [evergladesNaturalUrl, evergladesFalseUrl],
  lilongwe: [lilongweNaturalUrl, lilongweFalseUrl],
};

function blankCanvas(width, height, message) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#102c37";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#e6f4f5";
  ctx.textAlign = "center";
  ctx.font = "28px system-ui";
  ctx.fillText(message, width / 2, height / 2);
  return canvas;
}

function loadPixels(url, width, height) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (Math.abs(image.naturalWidth / image.naturalHeight - width / height) > 0.002) {
        reject(new Error("Unexpected scene aspect ratio"));
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, width, height);
      resolve({ canvas, pixels: ctx.getImageData(0, 0, width, height).data });
    };
    image.onerror = () => reject(new Error("Could not load the Landsat scene"));
    image.src = url;
  });
}

function nirCanvas(falsePixels, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const pixels = ctx.createImageData(width, height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    pixels.data.set(nirGrayPixel(falsePixels.subarray(i, i + 4)), i);
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function sceneCanvas(base, sample, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(base, 0, 0);
  const x = sample.u * width;
  const y = sample.v * height;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.moveTo(x - 18, y);
  ctx.lineTo(x - 11, y);
  ctx.moveTo(x + 11, y);
  ctx.lineTo(x + 18, y);
  ctx.stroke();
  return canvas;
}

function graphCanvas(bands, mode, ready) {
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 560;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#102c37";
  ctx.fillRect(0, 0, 420, 560);
  ctx.fillStyle = "#e6f4f5";
  ctx.textAlign = "center";
  ctx.font = "bold 31px system-ui";
  ctx.fillText(ready ? "Selected place" : "Scene loading", 210, 55, 390);
  ctx.font = "21px system-ui";
  ctx.fillStyle = "#b6d1d9";
  ctx.fillText("Approx. image brightness", 210, 90);
  const colors = ["#4889d2", "#60c879", "#e5706c", "#ef9ca8"];
  bands.forEach((value, i) => {
    const y = 144 + i * 92;
    ctx.fillStyle = "#24414a";
    ctx.fillRect(165, y, 215, 29);
    ctx.fillStyle = colors[i];
    ctx.fillRect(165, y, Math.round(value / 255 * 215), 29);
    ctx.fillStyle = "#e6f4f5";
    ctx.textAlign = "right";
    ctx.font = "20px system-ui";
    ctx.fillText(BAND_NAMES[i], 154, y + 23, 145);
  });
  ctx.fillStyle = "#a6f5d9";
  ctx.textAlign = "center";
  ctx.font = "19px system-ui";
  ctx.fillText(mode === "false" ? "Display: NIR → R, red → G, green → B"
    : mode === "nir" ? "NIR shown as grayscale" : "Display: visible red, green, blue",
  210, 495, 405);
  ctx.fillStyle = "#b6d1d9";
  ctx.font = "17px system-ui";
  ctx.fillText("Reflectance needs calibration", 210, 532, 405);
  return canvas;
}

const LENS_SIZE = 0.28;

function viewerProp() {
  const prop = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.007, 8, 40),
    new THREE.MeshStandardMaterial({ color: 0xe9c778, metalness: 0.5,
      roughness: 0.3 }));
  rim.position.set(0, 0.035, -0.19);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.049, 40),
    new THREE.MeshBasicMaterial({ color: 0x78dfe9, transparent: true,
      opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.copy(rim.position);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.017, 0.13, 10),
    new THREE.MeshStandardMaterial({ color: 0x244c58, metalness: 0.4,
      roughness: 0.45 }));
  handle.position.set(0, -0.06, -0.19);
  prop.add(rim, glass, handle);
  prop.visible = false;
  return prop;
}

function paintLens(canvas, source, sample, scene, panelWidth, panelHeight) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const { canvasScaleX, canvasScaleY, sourceX, sourceY } =
    spectralLensAlignment(sample, scene, panelWidth, panelHeight,
      LENS_SIZE, size);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
  ctx.clip();
  // Draw the same geographic pixels at the same physical scale as the
  // natural-color image beneath the viewer.
  ctx.drawImage(source, size / 2 - sourceX * canvasScaleX,
    size / 2 - sourceY * canvasScaleY, scene.width * canvasScaleX,
    scene.height * canvasScaleY);
  ctx.restore();
  ctx.strokeStyle = "#ffe1a1";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 4, 0, Math.PI * 2);
  ctx.fill();
}

export class SpectralExperience extends TimedExhibit {
  constructor(root, onChange) {
    super(root, onChange);
    this.kind = "spectral";
    this.mode = "natural";
    this.nextSceneInRotation = createSpectralSceneRotation();
    this.sceneInfo = this.nextSceneInRotation();
    this.sample = { ...this.sceneInfo.sample };
    this.takeawayOpen = false;
    this.ready = false;
    this.bands = [0, 0, 0, 0];
    this.viewerHeldBy = null;
    this.viewerBand = "false";
    this.viewerSample = null;
    this.viewerPixel = null;
    this.sceneCache = new Map();
    this.scenePromises = new Map();
    this.image = canvasPanel(blankCanvas(960, 540, "Loading Landsat scene…"),
      1.58, 0.89, -0.39, 0.32);
    this.graph = canvasPanel(graphCanvas(this.bands, this.mode, false),
      0.89, 1.18, 0.86, 0.23);
    this.lensCanvas = document.createElement("canvas");
    this.lensCanvas.width = this.lensCanvas.height = 256;
    const lensTexture = new THREE.CanvasTexture(this.lensCanvas);
    lensTexture.colorSpace = THREE.SRGBColorSpace;
    this.lens = new THREE.Mesh(new THREE.PlaneGeometry(LENS_SIZE, LENS_SIZE),
      new THREE.MeshBasicMaterial({ map: lensTexture, transparent: true,
        depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    this.lens.visible = false;
    this.lens.renderOrder = 5;
    this.viewer = viewerProp();
    this.group.add(this.image, this.graph, this.lens, this.viewer);
    this.loadScene();
    for (const scene of SPECTRAL_SCENES.slice(1))
      this.getSceneData(scene).catch(() => {});
  }
  getSceneData(scene) {
    if (this.sceneCache.has(scene.id))
      return Promise.resolve(this.sceneCache.get(scene.id));
    if (this.scenePromises.has(scene.id))
      return this.scenePromises.get(scene.id);
    const { width, height } = scene;
    const [naturalUrl, falseUrl] = SCENE_URLS[scene.id];
    const promise = Promise.all([
      loadPixels(naturalUrl, width, height), loadPixels(falseUrl, width, height),
    ]).then(([natural, falseColor]) => {
      const data = {
        sources: { natural: natural.canvas, false: falseColor.canvas,
          nir: nirCanvas(falseColor.pixels, width, height) },
        pixels: { natural: natural.pixels, false: falseColor.pixels },
      };
      this.sceneCache.set(scene.id, data);
      this.scenePromises.delete(scene.id);
      return data;
    }).catch((error) => {
      this.scenePromises.delete(scene.id);
      throw error;
    });
    this.scenePromises.set(scene.id, promise);
    return promise;
  }
  loadScene() {
    const scene = this.sceneInfo;
    const ticket = this.loadTicket = (this.loadTicket || 0) + 1;
    const { width, height } = scene;
    const aspect = width / height;
    const panelHeight = Math.min(1.16, 1.58 / aspect);
    this.image.scale.set(panelHeight * aspect / 1.58, panelHeight / 0.89, 1);
    this.image.position.y = 0.24;
    const applyData = (data) => {
      this.sources = data.sources;
      this.pixels = data.pixels;
      this.ready = true;
      this.refresh();
    };
    const cached = this.sceneCache.get(scene.id);
    if (cached) {
      applyData(cached);
      return;
    }
    this.ready = false;
    this.bands = [0, 0, 0, 0];
    replacePanelTexture(this.image, blankCanvas(width, height, "Loading scene…"));
    replacePanelTexture(this.graph, graphCanvas(this.bands, this.mode, false));
    this.getSceneData(scene)
      .then((data) => {
        if (this.disposed || ticket !== this.loadTicket) return;
        applyData(data);
      }).catch(() => {
        if (this.disposed || ticket !== this.loadTicket) return;
        replacePanelTexture(this.image,
          blankCanvas(width, height, "Scene unavailable"));
        this.onChange();
      });
  }
  nextScene() {
    if (!this.started || this.finished) return;
    this.endViewer();
    this.sceneInfo = this.nextSceneInRotation();
    this.sample = { ...this.sceneInfo.sample };
    this.takeawayOpen = false;
    this.group.visible = true;
    this.mode = "natural";
    this.loadScene();
    if (!this.ready) this.onChange();
  }
  showTakeaways() {
    if (!this.started || this.finished) return;
    this.endViewer();
    this.takeawayOpen = true;
    this.group.visible = false;
    this.onChange();
  }
  keepExploring() {
    if (!this.takeawayOpen || this.finished) return;
    this.takeawayOpen = false;
    this.group.visible = true;
    this.onChange();
  }
  update(dt) {
    super.update(dt);
    if (this.finished) {
      this.endViewer();
      this.group.visible = false;
    }
  }
  beginViewer(source, grip) {
    if (!this.started || this.finished || this.takeawayOpen ||
        this.viewerHeldBy !== null) return false;
    this.viewerHeldBy = source;
    this.viewerSample = null;
    this.viewerPixel = null;
    if (grip) {
      grip.add(this.viewer);
      this.viewer.position.set(0, 0, 0);
      this.viewer.rotation.set(0, 0, 0);
      this.viewer.visible = true;
    }
    if (this.ready) this.refresh();
    else this.onChange();
    return true;
  }
  endViewer(source = this.viewerHeldBy) {
    if (source === null || this.viewerHeldBy !== source) return;
    this.viewerHeldBy = null;
    this.viewerSample = null;
    this.viewerPixel = null;
    this.viewer.visible = false;
    this.group.add(this.viewer);
    this.lens.visible = false;
    if (!this.disposed) {
      if (this.ready) this.refresh();
      else this.onChange();
    }
  }
  setViewerBand(mode) {
    if (this.viewerHeldBy === null || !["false", "nir"].includes(mode)) return;
    this.viewerBand = mode;
    this.viewerPixel = null;
    if (this.viewerSample) this.paintViewerLens();
    replacePanelTexture(this.graph, graphCanvas(this.bands, mode, true));
    this.onChange();
  }
  updateViewerAim(raycaster, source, blocked = false) {
    if (this.viewerHeldBy !== source || !this.ready) return;
    this.image.updateWorldMatrix(true, false);
    this.graph.updateWorldMatrix(true, false);
    const obscured = blocked || !!raycaster.intersectObject(this.graph, false)[0];
    const hit = obscured ? null : raycaster.intersectObject(this.image, false)[0];
    if (!hit?.uv) {
      this.viewerSample = null;
      this.lens.visible = false;
      return;
    }
    const sample = { u: hit.uv.x, v: 1 - hit.uv.y };
    const pixel = [Math.round(sample.u * this.sceneInfo.width / 3),
      Math.round(sample.v * this.sceneInfo.height / 3)];
    this.viewerSample = sample;
    if (this.viewerPixel?.[0] === pixel[0] &&
        this.viewerPixel?.[1] === pixel[1]) return;
    this.viewerPixel = pixel;
    this.paintViewerLens();
  }
  paintViewerLens() {
    if (!this.viewerSample || !this.ready) return;
    const panelWidth = this.image.geometry.parameters.width * this.image.scale.x;
    const panelHeight = this.image.geometry.parameters.height * this.image.scale.y;
    const { u, v } = this.viewerSample;
    const alignment = spectralLensAlignment({ u, v }, this.sceneInfo,
      panelWidth, panelHeight, LENS_SIZE, this.lensCanvas.width);
    this.lens.position.set(this.image.position.x + alignment.worldX,
      this.image.position.y + alignment.worldY, 0.035);
    paintLens(this.lensCanvas, this.sources[this.viewerBand], { u, v },
      this.sceneInfo, panelWidth, panelHeight);
    this.lens.material.map.needsUpdate = true;
    this.lens.visible = true;
  }
  setMode(mode) {
    if (!this.started || this.finished || this.takeawayOpen ||
        this.viewerHeldBy !== null || !SPECTRAL_MODES.includes(mode)) return;
    this.mode = mode;
    if (this.ready) this.refresh();
  }
  selectFromRay(raycaster) {
    if (!this.started || this.finished || this.takeawayOpen || !this.ready) return false;
    this.image.updateWorldMatrix(true, false);
    this.graph.updateWorldMatrix(true, false);
    if (raycaster.intersectObject(this.graph, false).length) return false;
    const hit = raycaster.intersectObject(this.image, false)[0];
    if (!hit?.uv) return false;
    this.sample = { u: hit.uv.x, v: 1 - hit.uv.y };
    this.refresh();
    return true;
  }
  refresh() {
    const { width, height } = this.sceneInfo;
    const x = Math.min(width - 1, Math.max(0, Math.floor(this.sample.u * width)));
    const y = Math.min(height - 1, Math.max(0, Math.floor(this.sample.v * height)));
    const i = (y * width + x) * 4;
    this.bands = displayedBandBrightness(
      this.pixels.natural.subarray(i, i + 4),
      this.pixels.false.subarray(i, i + 4));
    replacePanelTexture(this.image,
      sceneCanvas(this.sources[this.viewerHeldBy !== null ? "natural" : this.mode],
        this.sample, width, height));
    replacePanelTexture(this.graph, graphCanvas(this.bands,
      this.viewerHeldBy !== null ? this.viewerBand : this.mode, true));
    if (this.started) this.onChange();
  }
  dispose() {
    this.disposed = true;
    this.endViewer();
    super.dispose();
  }
}
