import {
  TREE_POSITIONS,
  highwayZ,
  landscapeHeight,
  riverX,
} from "../layers/experience.js";

export const PIXEL_EXTENT = 72;
export const PIXEL_SIZES = [0.5, 1, 10, 30];
export const pixelSizeLabel = (size) => size === 0.5 ? "50 cm" : `${size} m`;
export const COVER_NAMES = ["Other ground", "Forest", "Water", "Road"];
const METERS = PIXEL_EXTENT * 2;
const SAMPLE_SIZE = 0.5;
const WIDTH = METERS / SAMPLE_SIZE;
const COLORS = [
  [146, 180, 132],
  [52, 104, 72],
  [53, 144, 184],
  [70, 78, 82],
];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export class PixelModel {
  constructor() {
    this.width = METERS;
    this.sampleWidth = WIDTH;
    this.cover = new Uint8Array(WIDTH * WIDTH);
    this.rgb = new Uint8Array(WIDTH * WIDTH * 3);
    this.rasters = new Map();
    for (const { x, z, scale, evergreen } of TREE_POSITIONS) {
      if (Math.abs(x) > PIXEL_EXTENT + 3 || Math.abs(z) > PIXEL_EXTENT + 3)
        continue;
      const radius = (evergreen ? 1 : 1.15) * scale;
      const minCol = clamp(Math.floor((x - radius + PIXEL_EXTENT) / SAMPLE_SIZE), 0, WIDTH - 1);
      const maxCol = clamp(Math.floor((x + radius + PIXEL_EXTENT) / SAMPLE_SIZE), 0, WIDTH - 1);
      const minRow = clamp(Math.floor((z - radius + PIXEL_EXTENT) / SAMPLE_SIZE), 0, WIDTH - 1);
      const maxRow = clamp(Math.floor((z + radius + PIXEL_EXTENT) / SAMPLE_SIZE), 0, WIDTH - 1);
      for (let row = minRow; row <= maxRow; row++)
        for (let col = minCol; col <= maxCol; col++) {
          const sampleX = -PIXEL_EXTENT + (col + 0.5) * SAMPLE_SIZE;
          const sampleZ = -PIXEL_EXTENT + (row + 0.5) * SAMPLE_SIZE;
          if (Math.hypot(sampleX - x, sampleZ - z) <= radius)
            this.cover[row * WIDTH + col] = 1;
        }
    }
    for (let row = 0; row < WIDTH; row++)
      for (let col = 0; col < WIDTH; col++) {
        const x = -PIXEL_EXTENT + (col + 0.5) * SAMPLE_SIZE;
        const z = -PIXEL_EXTENT + (row + 0.5) * SAMPLE_SIZE;
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
    const samplesPerCell = size / SAMPLE_SIZE;
    const cells = Math.ceil(WIDTH / samplesPerCell);
    const pixels = new Array(cells * cells);
    for (let row = 0; row < cells; row++)
      for (let col = 0; col < cells; col++) {
        const counts = [0, 0, 0, 0];
        const sums = [0, 0, 0];
        const x0 = col * samplesPerCell;
        const z0 = row * samplesPerCell;
        const sampledWidth = Math.min(samplesPerCell, WIDTH - x0);
        const sampledHeight = Math.min(samplesPerCell, WIDTH - z0);
        const samples = sampledWidth * sampledHeight;
        const sampledArea = samples * SAMPLE_SIZE ** 2;
        for (let dz = 0; dz < sampledHeight; dz++)
          for (let dx = 0; dx < sampledWidth; dx++) {
            const source = (z0 + dz) * WIDTH + x0 + dx;
            counts[this.cover[source]] += SAMPLE_SIZE ** 2;
            for (let band = 0; band < 3; band++) sums[band] += this.rgb[source * 3 + band];
          }
        pixels[row * cells + col] = {
          counts,
          sampledArea,
          rgb: sums.map((sum) => Math.round(sum / samples)),
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
