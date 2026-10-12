import { TimedExhibit, canvasPanel, replacePanelTexture } from "./exhibit.js";
import { BAND_NAMES, SPECTRA, displayColor, surfaceAt } from "./spectral-model.js";

function sceneCanvas(mode, sample) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  const pixels = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      const kind = surfaceAt(x / canvas.width, y / canvas.height);
      const grain = ((x * 37 + y * 73 + (x * y) % 31) % 29 - 14) / 900;
      const color = displayColor(kind, mode, grain);
      const i = (y * canvas.width + x) * 4;
      pixels.data.set([...color, 255], i);
    }
  ctx.putImageData(pixels, 0, 0);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(sample.u * canvas.width, sample.v * canvas.height, 10, 0, Math.PI * 2);
  ctx.moveTo(sample.u * canvas.width - 18, sample.v * canvas.height);
  ctx.lineTo(sample.u * canvas.width - 11, sample.v * canvas.height);
  ctx.moveTo(sample.u * canvas.width + 11, sample.v * canvas.height);
  ctx.lineTo(sample.u * canvas.width + 18, sample.v * canvas.height);
  ctx.stroke();
  return canvas;
}

function graphCanvas(kind, mode) {
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 560;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#102c37";
  ctx.fillRect(0, 0, 420, 560);
  ctx.fillStyle = "#e6f4f5";
  ctx.textAlign = "center";
  ctx.font = "bold 32px system-ui";
  ctx.fillText(SPECTRA[kind].name, 210, 55, 390);
  ctx.font = "24px system-ui";
  ctx.fillStyle = "#b6d1d9";
  ctx.fillText("Relative reflected light", 210, 90);
  const colors = ["#4889d2", "#60c879", "#e5706c", "#ef9ca8"];
  SPECTRA[kind].bands.forEach((value, i) => {
    const y = 148 + i * 94;
    const width = Math.round(value / 0.65 * 215);
    ctx.fillStyle = "#24414a";
    ctx.fillRect(165, y, 215, 29);
    ctx.fillStyle = colors[i];
    ctx.fillRect(165, y, width, 29);
    ctx.fillStyle = "#e6f4f5";
    ctx.textAlign = "right";
    ctx.font = "21px system-ui";
    ctx.fillText(BAND_NAMES[i], 154, y + 23, 145);
  });
  ctx.fillStyle = "#a6f5d9";
  ctx.textAlign = "center";
  ctx.font = "22px system-ui";
  ctx.fillText(mode === "false" ? "Display R ← NIR, G ← red, B ← green"
    : mode === "nir" ? "Invisible NIR shown as gray" : "Display RGB ← visible red, green, blue",
  210, 527, 400);
  return canvas;
}

export class SpectralExperience extends TimedExhibit {
  constructor(root, onChange) {
    super(root, onChange);
    this.kind = "spectral";
    this.mode = "natural";
    this.sample = { u: 0.16, v: 0.27 };
    this.material = surfaceAt(this.sample.u, this.sample.v);
    this.image = canvasPanel(sceneCanvas(this.mode, this.sample), 1.58, 1.18, -0.39, 0.23);
    this.graph = canvasPanel(graphCanvas(this.material, this.mode), 0.89, 1.18, 0.86, 0.23);
    this.group.add(this.image, this.graph);
  }
  setMode(mode) {
    if (!this.started || this.finished || !["natural", "false", "nir"].includes(mode)) return;
    this.mode = mode;
    this.refresh();
  }
  selectFromRay(raycaster) {
    if (!this.started || this.finished) return false;
    this.image.updateWorldMatrix(true, false);
    const hit = raycaster.intersectObject(this.image, false)[0];
    if (!hit?.uv) return false;
    this.sample = { u: hit.uv.x, v: 1 - hit.uv.y };
    this.material = surfaceAt(this.sample.u, this.sample.v);
    this.refresh();
    return true;
  }
  refresh() {
    replacePanelTexture(this.image, sceneCanvas(this.mode, this.sample));
    replacePanelTexture(this.graph, graphCanvas(this.material, this.mode));
    this.onChange();
  }
}
