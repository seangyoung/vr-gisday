import { TimedExhibit, canvasPanel, replacePanelTexture } from "./exhibit.js";
import { BAND_NAMES, displayedBandBrightness, nirGrayPixel,
  SPECTRAL_MODES } from "./spectral-model.js";
import naturalUrl from "./data/landsat-sf-natural.jpg";
import falseUrl from "./data/landsat-sf-false.jpg";

const WIDTH = 960;
const HEIGHT = 540;

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

function loadPixels(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth !== WIDTH || image.naturalHeight !== HEIGHT) {
        reject(new Error("Unexpected Landsat composite dimensions"));
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      resolve({ canvas, pixels: ctx.getImageData(0, 0, WIDTH, HEIGHT).data });
    };
    image.onerror = () => reject(new Error("Could not load the Landsat scene"));
    image.src = url;
  });
}

function nirCanvas(falsePixels) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  const pixels = ctx.createImageData(WIDTH, HEIGHT);
  for (let i = 0; i < pixels.data.length; i += 4) {
    pixels.data.set(nirGrayPixel(falsePixels.subarray(i, i + 4)), i);
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function sceneCanvas(base, sample) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(base, 0, 0);
  const x = sample.u * WIDTH;
  const y = sample.v * HEIGHT;
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
  ctx.fillText("Rendered JPEGs · not reflectance", 210, 532, 405);
  return canvas;
}

export class SpectralExperience extends TimedExhibit {
  constructor(root, onChange) {
    super(root, onChange);
    this.kind = "spectral";
    this.mode = "natural";
    this.sample = { u: 0.58, v: 0.59 };
    this.ready = false;
    this.bands = [0, 0, 0, 0];
    this.image = canvasPanel(blankCanvas(WIDTH, HEIGHT, "Loading Landsat scene…"),
      1.58, 0.89, -0.39, 0.32);
    this.graph = canvasPanel(graphCanvas(this.bands, this.mode, false),
      0.89, 1.18, 0.86, 0.23);
    this.group.add(this.image, this.graph);
    Promise.all([loadPixels(naturalUrl), loadPixels(falseUrl)]).then(([natural, falseColor]) => {
      if (this.disposed) return;
      this.sources = { natural: natural.canvas, false: falseColor.canvas,
        nir: nirCanvas(falseColor.pixels) };
      this.pixels = { natural: natural.pixels, false: falseColor.pixels };
      this.ready = true;
      this.refresh();
    }).catch(() => {
      if (!this.disposed) replacePanelTexture(this.image,
        blankCanvas(WIDTH, HEIGHT, "Landsat scene unavailable"));
    });
  }
  setMode(mode) {
    if (!this.started || this.finished || !SPECTRAL_MODES.includes(mode)) return;
    this.mode = mode;
    if (this.ready) this.refresh();
  }
  selectFromRay(raycaster) {
    if (!this.started || this.finished || !this.ready) return false;
    this.image.updateWorldMatrix(true, false);
    const hit = raycaster.intersectObject(this.image, false)[0];
    if (!hit?.uv) return false;
    this.sample = { u: hit.uv.x, v: 1 - hit.uv.y };
    this.refresh();
    return true;
  }
  refresh() {
    const x = Math.min(WIDTH - 1, Math.max(0, Math.floor(this.sample.u * WIDTH)));
    const y = Math.min(HEIGHT - 1, Math.max(0, Math.floor(this.sample.v * HEIGHT)));
    const i = (y * WIDTH + x) * 4;
    this.bands = displayedBandBrightness(
      this.pixels.natural.subarray(i, i + 4),
      this.pixels.false.subarray(i, i + 4));
    replacePanelTexture(this.image, sceneCanvas(this.sources[this.mode], this.sample));
    replacePanelTexture(this.graph, graphCanvas(this.bands, this.mode, true));
    if (this.started) this.onChange();
  }
  dispose() {
    this.disposed = true;
    super.dispose();
  }
}
