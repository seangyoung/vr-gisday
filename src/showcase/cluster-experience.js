import { TimedExhibit, canvasPanel } from "./exhibit.js";
import {
  CLUSTER_MODES, SNOW_BLOCKS, SNOW_BUILDINGS, SNOW_PUMPS, SNOW_TOTAL, SNOW_WINDOW,
  aggregationFor, blockAt, wardFor,
} from "./cluster-model.js";

const plot = { x: 45, y: 35, size: 520 };
const px = (x) => plot.x + (x - SNOW_WINDOW.minX) /
  (SNOW_WINDOW.maxX - SNOW_WINDOW.minX) * plot.size;
const py = (y) => plot.y + (SNOW_WINDOW.maxY - y) /
  (SNOW_WINDOW.maxY - SNOW_WINDOW.minY) * plot.size;

function countColor(count) {
  if (count < 25) return "#edf4fa";
  if (count < 50) return "#bfdbeb";
  if (count < 100) return "#86b7d2";
  if (count < 150) return "#4889b1";
  return "#18577e";
}

function blockPath(ctx, block) {
  ctx.beginPath();
  for (const ring of block.rings) {
    ring.forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(px(x), py(y));
      else ctx.lineTo(px(x), py(y));
    });
    ctx.closePath();
  }
}

function drawMap(canvas, mode) {
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#102b38";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // The pale gaps between source housing-block polygons are street corridors.
  ctx.fillStyle = "#a2b4aa";
  ctx.fillRect(plot.x, plot.y, plot.size, plot.size);
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.x, plot.y, plot.size, plot.size);
  ctx.clip();
  const zones = aggregationFor(mode);
  for (const block of SNOW_BLOCKS) {
    blockPath(ctx, block);
    const zone = zones[wardFor(block, mode)];
    ctx.fillStyle = zone ? countColor(zone.deaths) : "#25444f";
    ctx.fill("evenodd");
    ctx.strokeStyle = "#dae7d5";
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  if (mode === "points") {
    for (const point of SNOW_BUILDINGS) {
      ctx.beginPath();
      ctx.arc(px(point.x), py(point.y), 2.3 + Math.sqrt(point.deaths) * 1.45,
        0, Math.PI * 2);
      ctx.fillStyle = "#f0a987";
      ctx.fill();
      ctx.strokeStyle = "#422e32";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  } else {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 19px system-ui";
    for (const zone of zones) {
      const x = px(zone.x), y = py(zone.y);
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = "#102b38";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(zone.name, x, y + 1);
    }
  }
  ctx.restore();
  for (const pump of SNOW_PUMPS) {
    const broad = pump.name.includes("Broad");
    const x = px(pump.x), y = py(pump.y);
    ctx.beginPath();
    ctx.arc(x, y, broad ? 9 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = broad ? "#ffe17c" : "#72cecf";
    ctx.fill();
    ctx.strokeStyle = "#132d36";
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
  ctx.fillText(`${SNOW_TOTAL} recorded deaths`, 602, 177);
  ctx.fillStyle = "#ffe17c";
  ctx.fillText("● Broad Street pump", 602, 228);
  ctx.fillStyle = "#72cecf";
  ctx.fillText("● Other mapped pumps", 602, 262);
  if (mode === "points") {
    ctx.fillStyle = "#f0a987";
    ctx.fillText("● Size = deaths at building", 602, 307);
    ctx.fillStyle = "#c4dce0";
    ctx.fillText("Pale gaps = streets", 602, 355);
    ctx.fillText("Dark shapes = blocks", 602, 390);
  } else {
    ctx.fillStyle = "#c4dce0";
    ctx.fillText("Deaths per zone · count", 602, 305);
    const entries = [["0–24", 0], ["25–49", 25], ["50–99", 50],
      ["100–149", 100], ["150+", 150]];
    entries.forEach(([name, count], index) => {
      const y = 331 + index * 40;
      ctx.fillStyle = countColor(count);
      ctx.fillRect(602, y, 30, 27);
      ctx.fillStyle = "#e9f5f0";
      ctx.fillText(name, 644, y + 22);
    });
  }
  ctx.fillStyle = "#9fbfc7";
  ctx.font = "19px system-ui";
  ctx.fillText("Sample wards · mapped death counts", 602, 555, 305);
  ctx.strokeStyle = "#d5e5d6";
  ctx.lineWidth = 1.4;
  ctx.strokeRect(plot.x, plot.y, plot.size, plot.size);
}

function drawSelection(canvas, selection) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!selection) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.x, plot.y, plot.size, plot.size);
  ctx.clip();
  if (selection.type === "building") {
    ctx.beginPath();
    ctx.arc(px(selection.point.x), py(selection.point.y),
      7 + Math.sqrt(selection.point.deaths) * 1.45, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    for (const block of selection.zone.blocks) {
      blockPath(ctx, block);
      ctx.fillStyle = "#ffffff30";
      ctx.fill("evenodd");
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
  ctx.restore();
}

export class ClusterExperience extends TimedExhibit {
  constructor(root, onChange) {
    super(root, onChange);
    this.kind = "cluster";
    this.mode = "points";
    this.selection = null;
    this.selectedText = "Point at a building to see its recorded death count.";
    this.mapCanvas = document.createElement("canvas");
    this.mapCanvas.width = 930;
    this.mapCanvas.height = 600;
    drawMap(this.mapCanvas, this.mode);
    this.map = canvasPanel(this.mapCanvas, 2.22, 1.43, 0, 0.14);
    this.group.add(this.map);
    this.selectionCanvas = document.createElement("canvas");
    this.selectionCanvas.width = 930;
    this.selectionCanvas.height = 600;
    this.selectionMap = canvasPanel(this.selectionCanvas, 2.22, 1.43, 0, 0.14);
    this.selectionMap.position.z = 0.006;
    this.selectionMap.material.transparent = true;
    this.selectionMap.material.depthWrite = false;
    this.group.add(this.selectionMap);
  }
  finish() {
    if (!this.started || this.finished) return;
    this.group.visible = false;
    super.finish();
  }
  setMode(mode) {
    if (!this.started || this.finished || !CLUSTER_MODES[mode]) return;
    this.mode = mode;
    this.selection = null;
    this.selectedText = mode === "points"
      ? "Select a building circle to see its recorded deaths."
      : "Select a colored block to see its ward's recorded deaths.";
    drawMap(this.mapCanvas, mode);
    this.map.material.map.needsUpdate = true;
    drawSelection(this.selectionCanvas, null);
    this.selectionMap.material.map.needsUpdate = true;
    this.onChange();
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
      this.selection = near.distance <= 14
        ? { type: "building", point: near.point } : null;
      this.selectedText = this.selection
        ? `${near.point.deaths} recorded death${near.point.deaths === 1 ? "" : "s"} at this mapped building.`
        : "Select a building circle to inspect its count.";
    } else {
      const block = blockAt(x, y);
      const zone = block ? aggregationFor(this.mode)[wardFor(block, this.mode)] : null;
      this.selection = zone ? { type: "zone", zone } : null;
      this.selectedText = zone
        ? `Ward ${zone.name}: ${zone.deaths} recorded deaths across ${zone.blocks.length} blocks.`
        : "Select a colored block to inspect its ward count.";
    }
    // Selecting changes only the transparent highlight and readout; the
    // expensive base map texture stays in place without a fade or reload.
    drawSelection(this.selectionCanvas, this.selection);
    this.selectionMap.material.map.needsUpdate = true;
    this.onChange("selection");
    return true;
  }
}
