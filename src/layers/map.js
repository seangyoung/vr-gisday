import {
  LANDSCAPE_EXTENT,
  TREE_POSITIONS,
  boundaryX,
  boundaryZ,
  floodplainAt,
  highwayZ,
  landscapeHeight,
  riverX,
} from "./experience.js";

const extent = LANDSCAPE_EXTENT;
const reliefCache = new Map();

export function renderLayerMap(ctx, selected, { annotations = true } = {}) {
  const size = ctx.canvas.width;
  const ratio = size / 384;
  const coord = (value) => ((value + extent) / (2 * extent)) * size;
  const point = (x, z) => [coord(x), coord(z)];
  ctx.fillStyle = "#d8e1cf";
  ctx.fillRect(0, 0, size, size);

  if (selected.has("topography")) {
    let relief = reliefCache.get(size);
    if (!relief) {
      relief = new Uint8ClampedArray(size * size * 4);
      for (let py = 0; py < size; py++) {
        const z = (py / (size - 1)) * 2 * extent - extent;
        for (let px = 0; px < size; px++) {
          const x = (px / (size - 1)) * 2 * extent - extent;
          const height = landscapeHeight(x, z);
          const west = landscapeHeight(x - 1.3, z);
          const north = landscapeHeight(x, z - 1.3);
          const shade = Math.max(0.62, Math.min(1.15, 0.91 + (height - west) * 0.35 + (height - north) * 0.22));
          const browning = Math.max(0, Math.min(35, height * 2.2));
          const index = (py * size + px) * 4;
          relief[index] = (136 + browning) * shade;
          relief[index + 1] = (164 - browning * 0.35) * shade;
          relief[index + 2] = (131 - browning * 0.7) * shade;
          relief[index + 3] = 255;
        }
      }
      reliefCache.set(size, relief);
    }
    const image = ctx.createImageData(size, size);
    image.data.set(relief);
    ctx.putImageData(image, 0, 0);
  }

  if (selected.has("floodplain")) {
    const step = 1.6, pixel = step * size / (2 * extent);
    ctx.fillStyle = "#65d0e6";
    ctx.globalAlpha = 0.65;
    for (let z = -extent; z < extent; z += step)
      for (let offset = -18; offset < 18; offset += step) {
        const x = riverX(z) + offset;
        if (floodplainAt(x, z)) ctx.fillRect(coord(x), coord(z), pixel + 1, pixel + 1);
      }
    ctx.globalAlpha = 1;
  }

  if (selected.has("vegetation")) {
    ctx.fillStyle = "#214b35";
    for (const { x, z } of TREE_POSITIONS) {
      const [px, py] = point(x, z);
      ctx.fillRect(px, py, 1.8 * ratio, 1.8 * ratio);
    }
  }

  if (selected.has("hydrology")) {
    ctx.beginPath();
    for (let z = -extent; z <= extent; z += 0.7) {
      const [px, py] = point(riverX(z), z);
      if (z === -extent) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "#307d9f";
    ctx.lineWidth = 8 * ratio;
    ctx.stroke();
    ctx.strokeStyle = "#78c0cf";
    ctx.lineWidth = 3 * ratio;
    ctx.stroke();
  }

  if (selected.has("roads")) {
    ctx.beginPath();
    for (let x = -extent; x <= extent; x += 0.7) {
      const [px, py] = point(x, highwayZ(x));
      if (x === -extent) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "#e9ece6";
    ctx.lineWidth = 14 * ratio;
    ctx.stroke();
    ctx.strokeStyle = "#374247";
    ctx.lineWidth = 10 * ratio;
    ctx.stroke();
    ctx.strokeStyle = "#e5bd58";
    ctx.lineWidth = 1.5 * ratio;
    ctx.stroke();
  }

  if (selected.has("boundaries")) {
    ctx.setLineDash([6 * ratio, 4 * ratio]);
    ctx.lineWidth = 2.8 * ratio;
    ctx.strokeStyle = "#512062";
    for (const path of [
      (t) => point(boundaryX(t), t),
      (t) => point(t, boundaryZ(t)),
    ]) {
      ctx.beginPath();
      for (let t = -extent; t <= extent; t += 2) {
        const [px, py] = path(t);
        if (t === -extent) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  if (annotations) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 7 * ratio, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 2.5 * ratio;
    ctx.strokeStyle = "#17363d";
    ctx.stroke();
    ctx.font = `bold ${20 * ratio}px system-ui, sans-serif`;
    ctx.fillStyle = "#17363d";
    ctx.fillText("YOU", size / 2 + 11 * ratio, size / 2 - 11 * ratio);
    ctx.font = `bold ${18 * ratio}px system-ui, sans-serif`;
    ctx.fillText("MODEL N ↑", 13 * ratio, 26 * ratio);
    ctx.fillStyle = "#17363dcc";
    ctx.fillRect(0, size - 28 * ratio, size, 28 * ratio);
    ctx.fillStyle = "#ffffff";
    ctx.font = `${16 * ratio}px system-ui, sans-serif`;
    ctx.fillText("Same synthetic layers · overhead view", 12 * ratio, size - 8 * ratio);
  }
}
