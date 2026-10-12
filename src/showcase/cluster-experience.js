import { TimedExhibit, canvasPanel, replacePanelTexture } from "./exhibit.js";
import {
  CLUSTER_MODES, SNOW_BUILDINGS, SNOW_PUMPS, SNOW_TOTAL, SNOW_WINDOW,
  aggregationFor,
} from "./cluster-model.js";

const plot = { x: 45, y: 35, size: 520 };
const px = (x) => plot.x + (x - SNOW_WINDOW.minX) /
  (SNOW_WINDOW.maxX - SNOW_WINDOW.minX) * plot.size;
const py = (y) => plot.y + (SNOW_WINDOW.maxY - y) /
  (SNOW_WINDOW.maxY - SNOW_WINDOW.minY) * plot.size;

function deathColor(density) {
  if (!density) return "#1a3a46";
  if (density < 5) return "#417779";
  if (density < 15) return "#8fb375";
  if (density < 30) return "#e7ab66";
  return "#e36e64";
}

function mapCanvas(mode, selected) {
  const canvas = document.createElement("canvas");
  canvas.width = 930;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#102b38";
  ctx.fillRect(0, 0, 930, 600);
  ctx.fillStyle = "#153743";
  ctx.fillRect(plot.x, plot.y, plot.size, plot.size);
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.x, plot.y, plot.size, plot.size);
  ctx.clip();
  if (mode === "points") {
    for (const point of SNOW_BUILDINGS) {
      ctx.beginPath();
      ctx.arc(px(point.x), py(point.y), 3 + Math.sqrt(point.deaths) * 1.6,
        0, Math.PI * 2);
      ctx.fillStyle = "#efaa91";
      ctx.fill();
      ctx.strokeStyle = "#412c30";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  } else {
    for (const cell of aggregationFor(mode)) {
      const area = (cell.x1 - cell.x0) * (cell.y1 - cell.y0);
      const density = cell.deaths / area * 10000;
      const x = px(cell.x0), y = py(cell.y1);
      const width = px(cell.x1) - x, height = py(cell.y0) - y;
      ctx.fillStyle = deathColor(density);
      ctx.fillRect(x, y, width, height);
      ctx.strokeStyle = "#cce7dc88";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x, y, width, height);
      if (selected && cell.col === selected.col && cell.row === selected.row) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
      }
    }
  }
  ctx.restore();
  for (const pump of SNOW_PUMPS) {
    const broad = pump.name.includes("Broad");
    const x = px(pump.x), y = py(pump.y);
    ctx.beginPath();
    ctx.arc(x, y, broad ? 11 : 6, 0, Math.PI * 2);
    ctx.fillStyle = broad ? "#ffdf7b" : "#85c8c6";
    ctx.fill();
    ctx.strokeStyle = "#092332";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = "#e9f5f0";
  ctx.textAlign = "left";
  ctx.font = "bold 27px system-ui";
  ctx.fillText(CLUSTER_MODES[mode].name, 602, 63);
  ctx.font = "22px system-ui";
  ctx.fillStyle = "#c4dce0";
  ctx.fillText("1854 Soho, London", 602, 102);
  ctx.fillText(`${SNOW_BUILDINGS.length} mapped buildings`, 602, 144);
  ctx.fillText(`${SNOW_TOTAL} deaths in this dataset`, 602, 177);
  ctx.fillStyle = "#ffdf7b";
  ctx.fillText("● Broad Street pump", 602, 228);
  if (mode === "points") {
    ctx.fillStyle = "#efaa91";
    ctx.fillText("● Circle size = deaths", 602, 276);
    ctx.fillStyle = "#c4dce0";
    ctx.fillText("Each mark is a building", 602, 333);
    ctx.fillText("with recorded deaths.", 602, 365);
  } else {
    ctx.fillStyle = "#c4dce0";
    ctx.fillText("Deaths per 10,000 m²", 602, 270);
    const entries = [["0", 0], ["< 5", 2], ["5–15", 9],
      ["15–30", 22], ["30+", 40]];
    entries.forEach(([name, density], i) => {
      const y = 298 + i * 41;
      ctx.fillStyle = deathColor(density);
      ctx.fillRect(602, y, 30, 27);
      ctx.fillStyle = "#e9f5f0";
      ctx.fillText(name, 644, y + 22);
    });
  }
  ctx.fillStyle = "#9fbfc7";
  ctx.font = "19px system-ui";
  ctx.fillText("Area density ≠ mortality risk", 602, 555);
  ctx.strokeStyle = "#8eb1b9";
  ctx.lineWidth = 2;
  ctx.strokeRect(plot.x, plot.y, plot.size, plot.size);
  return canvas;
}

export class ClusterExperience extends TimedExhibit {
  constructor(root, onChange) {
    super(root, onChange);
    this.kind = "cluster";
    this.mode = "points";
    this.selected = null;
    this.selectedText = "Point at the map to inspect a building or zone.";
    this.fade = 1;
    this.map = canvasPanel(mapCanvas(this.mode, this.selected), 2.22, 1.43, 0, 0.14);
    this.group.add(this.map);
  }
  setMode(mode) {
    if (!this.started || this.finished || !CLUSTER_MODES[mode]) return;
    this.mode = mode;
    this.selected = null;
    this.selectedText = mode === "points"
      ? "The individual building pattern stays the same."
      : mode === "shifted"
        ? "Same grid size, different starting position. Where is the peak now?"
        : "Same buildings, new grouping. Does the hotspot look different?";
    this.refresh();
  }
  refresh() {
    replacePanelTexture(this.map, mapCanvas(this.mode, this.selected));
    this.fade = 0;
    this.map.material.transparent = true;
    this.map.material.opacity = 0;
    this.onChange();
  }
  update(dt) {
    super.update(dt);
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / 0.45);
      this.map.material.opacity = this.fade;
    }
  }
  selectFromRay(raycaster) {
    if (!this.started || this.finished) return false;
    this.map.updateWorldMatrix(true, false);
    const hit = raycaster.intersectObject(this.map, false)[0];
    if (!hit?.uv) return false;
    const mapX = hit.uv.x * 930;
    const mapY = (1 - hit.uv.y) * 600;
    if (mapX < plot.x || mapX > plot.x + plot.size ||
        mapY < plot.y || mapY > plot.y + plot.size) return false;
    const x = SNOW_WINDOW.minX + (mapX - plot.x) / plot.size *
      (SNOW_WINDOW.maxX - SNOW_WINDOW.minX);
    const y = SNOW_WINDOW.maxY - (mapY - plot.y) / plot.size *
      (SNOW_WINDOW.maxY - SNOW_WINDOW.minY);
    if (this.mode === "points") {
      const near = SNOW_BUILDINGS.map((point) => ({ point,
        distance: Math.hypot(px(point.x) - mapX, py(point.y) - mapY) }))
        .sort((a, b) => a.distance - b.distance)[0];
      this.selectedText = near.distance <= 14
        ? `${near.point.deaths} recorded death${near.point.deaths === 1 ? "" : "s"} at this mapped building.`
        : "Select a circle to inspect its recorded deaths.";
    } else {
      this.selected = aggregationFor(this.mode).find((cell) =>
        x >= cell.x0 && x < cell.x1 && y >= cell.y0 && y < cell.y1) ?? null;
      this.selectedText = this.selected
        ? `${this.selected.deaths} deaths in this teaching zone. Counts are not disease rates.`
        : "No mapped deaths in this zone.";
    }
    this.refresh();
    return true;
  }
}
