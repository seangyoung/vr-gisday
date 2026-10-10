import {
  TREE_POSITIONS,
  highwayZ,
  landscapeHeight,
  riverX,
} from "../layers/experience.js";

export const PIXEL_EXTENT = 72;
export const PIXEL_SIZES = [2, 8, 24, 48];
export const COVER_NAMES = ["Other ground", "Forest", "Water", "Road"];
const WIDTH = PIXEL_EXTENT * 2;
const COLORS = [
  [146, 180, 132],
  [52, 104, 72],
  [53, 144, 184],
  [70, 78, 82],
];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

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
        if (Math.abs(x - riverX(z)) <= 2.2) this.cover[i] = 2;
        if (Math.abs(z - highwayZ(x)) <= 5.2) this.cover[i] = 3;
        const [red, green, blue] = COLORS[this.cover[i]];
        const shade = this.cover[i] === 0
          ? clamp(1 + landscapeHeight(x, z) * 0.008, 0.95, 1.2)
          : 1;
        this.rgb[i * 3] = red * shade;
        this.rgb[i * 3 + 1] = green * shade;
        this.rgb[i * 3 + 2] = blue * shade;
      }
  }
  raster(size) {
    if (!PIXEL_SIZES.includes(size)) throw new RangeError("Unsupported pixel size");
    if (this.rasters.has(size)) return this.rasters.get(size);
    const cells = WIDTH / size;
    const pixels = new Array(cells * cells);
    for (let row = 0; row < cells; row++)
      for (let col = 0; col < cells; col++) {
        const counts = [0, 0, 0, 0];
        const sums = [0, 0, 0];
        for (let dz = 0; dz < size; dz++)
          for (let dx = 0; dx < size; dx++) {
            const source = (row * size + dz) * WIDTH + col * size + dx;
            counts[this.cover[source]]++;
            for (let band = 0; band < 3; band++) sums[band] += this.rgb[source * 3 + band];
          }
        pixels[row * cells + col] = {
          counts,
          rgb: sums.map((sum) => Math.round(sum / (size * size))),
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
