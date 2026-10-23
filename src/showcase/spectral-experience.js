import * as THREE from "three";
import { TimedExhibit, canvasPanel, replacePanelTexture } from "./exhibit.js";
import { BAND_NAMES, displayedBandBrightness, displayIndexPixel, displayIndexValue,
  SPECTRAL_MODES } from "./spectral-model.js";
import { SPECTRAL_SCENES, createSpectralSceneRotation } from "./spectral-scenes.js";
import { SPECTRAL_LESSON_STEPS, nextSpectralLessonStep,
  drawSpectralLesson } from "./spectral-lesson.js";
import { makePlatformComparison, highlightPlatform,
  alignSensingFootprints } from "./remote-platforms.js";
import { GlobeSpin } from "./projection-model.js";
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

function indexCanvas(falsePixels, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const pixels = ctx.createImageData(width, height);
  const histogram = new Uint32Array(512);
  let positives = 0;
  for (let i = 0; i < falsePixels.length; i += 4) {
    const value = displayIndexValue(falsePixels.subarray(i, i + 4));
    if (value >= 0) {
      histogram[Math.min(511, Math.floor(value * 512))]++;
      positives++;
    }
  }
  const quantile = (fraction) => {
    let seen = 0;
    for (let index = 0; index < histogram.length; index++) {
      seen += histogram[index];
      if (seen >= positives * fraction) return index / 512;
    }
    return 1;
  };
  const low = positives ? quantile(0.12) : 0;
  const high = positives ? quantile(0.88) : 0.4;
  for (let i = 0; i < pixels.data.length; i += 4) {
    pixels.data.set(displayIndexPixel(falsePixels.subarray(i, i + 4), low, high), i);
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
    : mode === "index" ? "NDVI compares NIR and red" : "Display: visible red, green, blue",
  210, 495, 405);
  ctx.fillStyle = "#b6d1d9";
  ctx.font = "17px system-ui";
  ctx.fillText("Compare the bands at your chosen place", 210, 532, 405);
  return canvas;
}

export class SpectralExperience extends TimedExhibit {
  constructor(root, onChange) {
    super(root, onChange);
    this.kind = "spectral";
    this.phase = "platforms";
    this.platform = "satellite";
    this.mode = "natural";
    this.nextSceneInRotation = createSpectralSceneRotation();
    this.sceneInfo = this.nextSceneInRotation();
    this.sample = { ...this.sceneInfo.sample };
    this.takeawayOpen = false;
    this.ready = false;
    this.bands = [0, 0, 0, 0];
    this.sceneCache = new Map();
    this.scenePromises = new Map();
    this.image = canvasPanel(blankCanvas(960, 540, "Loading Landsat scene…"),
      1.58, 0.89, -0.39, 0.32);
    this.graph = canvasPanel(graphCanvas(this.bands, this.mode, false),
      0.89, 1.18, 0.86, 0.23);
    this.lessonStep = 0;
    this.lessonTime = 0;
    this.lessonFrameTime = 0;
    this.lessonCanvas = document.createElement("canvas");
    this.lessonCanvas.width = 1100;
    this.lessonCanvas.height = 530;
    drawSpectralLesson(this.lessonCanvas.getContext("2d"), 0, 0);
    this.spectrum = canvasPanel(this.lessonCanvas, 2.35, 1.13, 0, 0.2);
    this.image.visible = false;
    this.graph.visible = false;
    this.spectrum.visible = false;
    const comparison = makePlatformComparison();
    this.platformGroup = comparison.group;
    this.platformItems = comparison.items;
    this.platformHits = comparison.pickTargets;
    this.platformSpinBy = null;
    this.platformSpinItem = null;
    for (const item of this.platformItems) item.spin = new GlobeSpin();
    highlightPlatform(this.platformItems, this.platform);
    this.group.add(this.image, this.graph, this.platformGroup, this.spectrum);
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
          index: indexCanvas(falseColor.pixels, width, height) },
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
    if (!this.started || this.finished || this.phase !== "bands") return;
    this.sceneInfo = this.nextSceneInRotation();
    this.sample = { ...this.sceneInfo.sample };
    this.takeawayOpen = false;
    this.group.visible = true;
    this.mode = "natural";
    this.loadScene();
    if (!this.ready) this.onChange();
  }
  showTakeaways() {
    if (!this.started || this.finished || this.phase !== "bands") return;
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
    if (this.started && !this.finished && this.phase === "spectrum") {
      this.lessonTime += dt;
      this.lessonFrameTime += dt;
      if (this.lessonFrameTime >= 1 / 24) {
        drawSpectralLesson(this.lessonCanvas.getContext("2d"),
          this.lessonStep, this.lessonTime);
        this.spectrum.material.map.needsUpdate = true;
        this.lessonFrameTime = 0;
      }
    }
    if (this.started && !this.finished && this.phase === "platforms")
      for (const item of this.platformItems) {
        item.spin.step(dt);
        item.model.rotation.set(item.spin.pitch, item.spin.yaw, 0, "XYZ");
        item.cone.material.opacity = item.id === this.platform
          ? 0.17 + 0.045 * Math.sin(this.elapsed * 3) : 0.055;
        for (const rotor of item.model.userData.rotors || [])
          rotor.rotation.y += dt * 10;
      }
    if (this.started && !this.finished && this.phase === "platforms")
      alignSensingFootprints(this.platformGroup, this.platformItems);
    if (this.finished && this.platformSpinBy !== null)
      this.endPlatformSpin(this.platformSpinBy);
    if (this.finished) this.group.visible = false;
  }
  selectPlatform(platform) {
    if (!this.started || this.finished || this.phase !== "platforms" ||
        !this.platformItems.some((item) => item.id === platform)) return;
    this.platform = platform;
    highlightPlatform(this.platformItems, platform);
    alignSensingFootprints(this.platformGroup, this.platformItems);
    this.onChange();
  }
  platformRayAngles(raycaster) {
    this.group.updateWorldMatrix(true, false);
    const inverse = this.group.matrixWorld.clone().invert();
    const direction = raycaster.ray.direction.clone().transformDirection(inverse);
    return [Math.atan2(direction.x, -direction.z),
      Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1))];
  }
  beginPlatformSpin(raycaster, source) {
    if (!this.started || this.finished || this.phase !== "platforms" ||
        this.platformSpinBy !== null) return false;
    this.platformGroup.updateWorldMatrix(true, true);
    const hit = raycaster.intersectObjects(this.platformHits, false)[0];
    if (!hit) return false;
    const item = this.platformItems.find(({ id }) => id === hit.object.userData.platform);
    this.platformSpinBy = source;
    this.platformSpinItem = item;
    item.spin.begin(...this.platformRayAngles(raycaster));
    this.selectPlatform(item.id);
    return true;
  }
  dragPlatformSpin(raycaster, source, dt) {
    if (this.platformSpinBy !== source || !this.platformSpinItem) return false;
    this.platformSpinItem.spin.drag(...this.platformRayAngles(raycaster), dt);
    this.platformSpinItem.model.rotation.set(
      this.platformSpinItem.spin.pitch, this.platformSpinItem.spin.yaw, 0, "XYZ");
    alignSensingFootprints(this.platformGroup, this.platformItems);
    return true;
  }
  endPlatformSpin(source) {
    if (this.platformSpinBy !== source) return false;
    this.platformSpinItem.spin.end();
    this.platformSpinBy = null;
    this.platformSpinItem = null;
    return true;
  }
  showSpectrum() {
    if (!this.started || this.finished || this.phase !== "platforms") return;
    if (this.platformSpinBy !== null) this.endPlatformSpin(this.platformSpinBy);
    this.phase = "spectrum";
    this.lessonStep = 0;
    this.lessonTime = 0;
    this.lessonFrameTime = 0;
    this.platformGroup.visible = false;
    this.spectrum.visible = true;
    this.onChange();
  }
  advanceLesson() {
    if (!this.started || this.finished || this.phase !== "spectrum") return;
    const next = nextSpectralLessonStep(this.lessonStep);
    if (next === null) {
      this.showBands();
      return;
    }
    this.lessonStep = next;
    this.lessonTime = 0;
    this.lessonFrameTime = 0;
    drawSpectralLesson(this.lessonCanvas.getContext("2d"), next, 0);
    this.spectrum.material.map.needsUpdate = true;
    this.onChange();
  }
  showBands() {
    if (!this.started || this.finished || this.phase !== "spectrum" ||
        this.lessonStep !== SPECTRAL_LESSON_STEPS.length - 1) return;
    this.phase = "bands";
    this.spectrum.visible = false;
    this.image.visible = true;
    this.graph.visible = true;
    this.onChange();
  }
  setMode(mode) {
    if (!this.started || this.finished || this.phase !== "bands" ||
        this.takeawayOpen || !SPECTRAL_MODES.includes(mode)) return;
    this.mode = mode;
    if (this.ready) this.refresh();
  }
  selectFromRay(raycaster) {
    if (!this.started || this.finished || this.takeawayOpen) return false;
    if (this.phase === "platforms") {
      this.platformGroup.updateWorldMatrix(true, true);
      const hit = raycaster.intersectObjects(this.platformHits, false)[0];
      if (!hit) return false;
      this.selectPlatform(hit.object.userData.platform);
      return true;
    }
    if (this.phase !== "bands" || !this.ready) return false;
    this.image.updateWorldMatrix(true, false);
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
      sceneCanvas(this.sources[this.mode], this.sample, width, height));
    replacePanelTexture(this.graph, graphCanvas(this.bands, this.mode, true));
    if (this.started) this.onChange();
  }
  dispose() {
    this.disposed = true;
    super.dispose();
  }
}
