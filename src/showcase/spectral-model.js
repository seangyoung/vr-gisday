export const BAND_NAMES = ["Blue", "Green", "Red", "Near infrared"];
export const SPECTRAL_MODES = ["natural", "false", "nir"];

// NASA's published composites are rendered JPEGs, not raw sensor bands.
// These are display brightness values, never calibrated reflectance or NDVI.
export function displayedBandBrightness(naturalPixel, falsePixel) {
  return [naturalPixel[2], naturalPixel[1], naturalPixel[0], falsePixel[0]];
}

export function nirGrayPixel(falsePixel) {
  return [falsePixel[0], falsePixel[0], falsePixel[0], 255];
}
