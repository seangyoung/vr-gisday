import source from "./data/snow.json" with { type: "json" };

export const SNOW_BUILDINGS = source.buildings.map(([x, y, deaths]) => ({ x, y, deaths }));
export const SNOW_PUMPS = source.pumps.map(([x, y, name]) => ({ x, y, name }));
export const SNOW_TOTAL = SNOW_BUILDINGS.reduce((sum, point) => sum + point.deaths, 0);
// Fixed British National Grid window; all aggregations use the same mapped buildings.
export const SNOW_WINDOW = Object.freeze({
  minX: 529115, maxX: 529700, minY: 180770, maxY: 181350,
});

export const CLUSTER_MODES = Object.freeze({
  points: { name: "Mapped buildings" },
  fine: { name: "Small zones", columns: 10, rows: 10, shift: 0 },
  shifted: { name: "Shifted zones", columns: 10, rows: 10, shift: 0.5 },
  coarse: { name: "Large zones", columns: 5, rows: 5, shift: 0 },
});

export function aggregateBuildings(buildings, window, columns, rows, shift = 0) {
  const width = (window.maxX - window.minX) / columns;
  const height = (window.maxY - window.minY) / rows;
  const cells = new Map();
  const first = shift ? -1 : 0;
  for (let row = first; row < rows; row++)
    for (let col = first; col < columns; col++)
      cells.set(`${col}:${row}`, {
        col, row,
        x0: window.minX + (col + shift) * width,
        y0: window.minY + (row + shift) * height,
        x1: window.minX + (col + 1 + shift) * width,
        y1: window.minY + (row + 1 + shift) * height,
        deaths: 0,
      });
  for (const point of buildings) {
    const col = Math.floor((point.x - window.minX) / width - shift);
    const row = Math.floor((point.y - window.minY) / height - shift);
    const key = `${col}:${row}`;
    cells.get(key).deaths += point.deaths;
  }
  return [...cells.values()];
}

export function aggregationFor(mode) {
  const config = CLUSTER_MODES[mode];
  return config.columns
    ? aggregateBuildings(SNOW_BUILDINGS, SNOW_WINDOW,
      config.columns, config.rows, config.shift)
    : [];
}
