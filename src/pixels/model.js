import {
  TREE_POSITIONS,
  highwayZ,
  landscapeHeight,
  riverX,
} from "../layers/experience.js";

export const PIXEL_EXTENT = 500;
export const PIXEL_DETAIL_EXTENT = 72;
export const PIXEL_SIZES = [1, 10, 30, 1000];
export const pixelSizeLabel = (size) => size >= 1000
  ? `${size / 1000} km` : `${size} m`;
export const COVER_NAMES = ["Other ground", "Forest", "Water", "Road"];
const WIDTH = PIXEL_EXTENT * 2;
const COLORS = [
  [146, 180, 132],
  [52, 104, 72],
  [53, 144, 184],
  [70, 78, 82],
];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const seeded = (x, z) => {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

export function regionalForestAt(x, z) {
  const patches = 0.55 * Math.sin(x * 0.014 + z * 0.004) +
    0.48 * Math.cos(z * 0.018 - x * 0.003) +
    0.25 * Math.sin(x * 0.044 + z * 0.032);
  return patches > 0.23;
}

export const REGIONAL_TREES = (() => {
  const trees = [];
  for (let row = -45; row <= 45; row++)
    for (let col = -45; col <= 45; col++) {
      const x = col * 11 + (seeded(col, row) - 0.5) * 6;
      const z = row * 11 + (seeded(row, col + 300) - 0.5) * 6;
      if (Math.max(Math.abs(x), Math.abs(z)) <= 160 ||
          !regionalForestAt(x, z) ||
          Math.abs(x - riverX(z)) <= 7 ||
          Math.abs(z - highwayZ(x)) <= 11) continue;
      trees.push({ x, z, scale: 0.8 + seeded(col + 700, row) * 0.7,
        evergreen: seeded(col, row + 500) > 0.52 });
    }
  return trees;
})();

export class PixelModel {
  constructor() {
    this.width = WIDTH;
    this.cover = new Uint8Array(WIDTH * WIDTH);
    this.rgb = new Uint8Array(WIDTH * WIDTH * 3);
    this.rasters = new Map();
    for (const { x, z, scale, evergreen } of TREE_POSITIONS) {
      if (Math.abs(x) > PIXEL_EXTENT + 3 || Math.abs(z) > PIXEL_EXTENT + 3)
        continue;
      const radius = (evergreen ? 1 : 1.15) * scale;
      const minCol = clamp(Math.floor(x - radius + PIXEL_EXTENT), 0, WIDTH - 1);
      const maxCol = clamp(Math.floor(x + radius + PIXEL_EXTENT), 0, WIDTH - 1);
      const minRow = clamp(Math.floor(z - radius + PIXEL_EXTENT), 0, WIDTH - 1);
      const maxRow = clamp(Math.floor(z + radius + PIXEL_EXTENT), 0, WIDTH - 1);
      for (let row = minRow; row <= maxRow; row++)
        for (let col = minCol; col <= maxCol; col++) {
          const sampleX = -PIXEL_EXTENT + col + 0.5;
          const sampleZ = -PIXEL_EXTENT + row + 0.5;
          if (Math.hypot(sampleX - x, sampleZ - z) <= radius)
            this.cover[row * WIDTH + col] = 1;
        }
    }
    for (let row = 0; row < WIDTH; row++)
      for (let col = 0; col < WIDTH; col++) {
        const x = -PIXEL_EXTENT + col + 0.5;
        const z = -PIXEL_EXTENT + row + 0.5;
        const i = row * WIDTH + col;
        if (Math.max(Math.abs(x), Math.abs(z)) > 160 && regionalForestAt(x, z))
          this.cover[i] = 1;
        if (Math.abs(x - riverX(z)) <= 2.2) this.cover[i] = 2;
        if (Math.abs(z - highwayZ(x)) <= 5.2) this.cover[i] = 3;
        const [red, green, blue] = COLORS[this.cover[i]];
        const shade = this.cover[i] === 0
          ? clamp(1 + (Math.max(Math.abs(x), Math.abs(z)) <= 160
            ? landscapeHeight(x, z) * 0.008
            : 0.08 * Math.sin(x * 0.015 + z * 0.008)), 0.92, 1.2)
          : 1;
        this.rgb[i * 3] = red * shade;
        this.rgb[i * 3 + 1] = green * shade;
        this.rgb[i * 3 + 2] = blue * shade;
      }
  }
  raster(size) {
    if (!PIXEL_SIZES.includes(size)) throw new RangeError("Unsupported pixel size");
    if (this.rasters.has(size)) return this.rasters.get(size);
    if (size === 1) {
      // A million individual JS pixel objects are expensive on Quest. Keep the
      // 1 m raster in typed arrays and expose cells only when requested.
      const finePixel = (index) => {
        if (index < 0 || index >= WIDTH * WIDTH) return undefined;
        const counts = [0, 0, 0, 0];
        counts[this.cover[index]] = 1;
        return { counts, sampledArea: 1,
          rgb: Array.from(this.rgb.subarray(index * 3, index * 3 + 3)) };
      };
      const pixels = new Proxy({
        length: WIDTH * WIDTH,
        at: (index) => finePixel(index < 0 ? WIDTH * WIDTH + index : index),
      }, {
        get(target, key) {
          if (key in target) return target[key];
          if (typeof key === "string" && /^\d+$/.test(key)) return finePixel(Number(key));
          return undefined;
        },
      });
      const result = { size, cells: WIDTH, pixels };
      this.rasters.set(size, result);
      return result;
    }
    const cells = Math.ceil(WIDTH / size);
    const pixels = new Array(cells * cells);
    for (let row = 0; row < cells; row++)
      for (let col = 0; col < cells; col++) {
        const counts = [0, 0, 0, 0];
        const sums = [0, 0, 0];
        const x0 = col * size;
        const z0 = row * size;
        const sampledWidth = Math.min(size, WIDTH - x0);
        const sampledHeight = Math.min(size, WIDTH - z0);
        const sampledArea = sampledWidth * sampledHeight;
        for (let dz = 0; dz < sampledHeight; dz++)
          for (let dx = 0; dx < sampledWidth; dx++) {
            const source = (z0 + dz) * WIDTH + x0 + dx;
            counts[this.cover[source]]++;
            for (let band = 0; band < 3; band++) sums[band] += this.rgb[source * 3 + band];
          }
        pixels[row * cells + col] = {
          counts,
          sampledArea,
          rgb: sums.map((sum) => Math.round(sum / sampledArea)),
        };
      }
    const result = { size, cells, pixels };
    this.rasters.set(size, result);
    return result;
  }
  cellAt(x, z, size) {
    const raster = this.raster(size);
    const col = clamp(Math.floor((x + PIXEL_EXTENT) / size), 0, raster.cells - 1);
    const row = clamp(Math.floor((z + PIXEL_EXTENT) / size), 0, raster.cells - 1);
    return {
      ...raster.pixels[row * raster.cells + col],
      col, row, size,
      x0: -PIXEL_EXTENT + col * size,
      z0: -PIXEL_EXTENT + row * size,
    };
  }
}
