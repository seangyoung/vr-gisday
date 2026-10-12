export const SPECTRA = Object.freeze({
  forest: { name: "Healthy leaves", bands: [0.06, 0.12, 0.05, 0.58] },
  stressed: { name: "Stressed leaves", bands: [0.08, 0.16, 0.19, 0.28] },
  soil: { name: "Bare soil", bands: [0.19, 0.25, 0.32, 0.39] },
  water: { name: "Water", bands: [0.10, 0.07, 0.04, 0.015] },
  roofs: { name: "Roofs and pavement", bands: [0.19, 0.22, 0.24, 0.22] },
});

export const BAND_NAMES = ["Blue", "Green", "Red", "Near infrared"];
export const SPECTRAL_MODES = ["natural", "false", "nir"];

// A synthetic teaching scene: no camera, satellite observation, or calibrated reflectance.
export function surfaceAt(u, v) {
  const river = 0.59 + 0.075 * Math.sin(v * 6.3 + 0.4);
  if (Math.abs(u - river) < 0.034) return "water";
  if ((Math.abs(v - 0.61) < 0.014 && u > 0.44) ||
      (Math.abs(u - 0.77) < 0.013 && v < 0.6)) return "roofs";
  if (u > 0.76 && v < 0.57) return "roofs";
  if (u < 0.5 && v < 0.57) {
    if (Math.hypot((u - 0.31) * 1.3, v - 0.31) < 0.14) return "stressed";
    return "forest";
  }
  if (v > 0.72 || (u > 0.54 && v > 0.4)) return "soil";
  return "forest";
}

export function displayColor(material, mode, variation = 0) {
  const [blue, green, red, nir] = SPECTRA[material].bands;
  const channels = mode === "false" ? [nir, red, green] :
    mode === "nir" ? [nir, nir, nir] : [red, green, blue];
  return channels.map((value) => Math.max(0, Math.min(255,
    Math.round(255 * Math.sqrt((value + variation) / 0.68)))));
}
