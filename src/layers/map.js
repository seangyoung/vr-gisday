import {
  LANDSCAPE_EXTENT,
  TREE_POSITIONS,
  densityAt,
  highwayZ,
  landscapeHeight,
  riverX,
} from "./experience.js";

const extent = LANDSCAPE_EXTENT;
const colors = {
  low: "#c3d6e5",
  medium: "#4ebbb5",
  high: "#e8af62",
};
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

  if (selected.has("population")) {
    const cell = size / 8;
    ctx.lineWidth = 1.2 * ratio;
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 8; col++) {
        const x = -extent + (col + 0.5) * (2 * extent / 8);
        const z = -extent + (row + 0.5) * (2 * extent / 8);
        ctx.globalAlpha = 0.36;
        ctx.fillStyle = colors[densityAt(x, z)];
        ctx.fillRect(col * cell, row * cell, cell, cell);
        ctx.globalAlpha = 0.38;
        ctx.strokeStyle = "#314e55";
        ctx.strokeRect(col * cell, row * cell, cell, cell);
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
