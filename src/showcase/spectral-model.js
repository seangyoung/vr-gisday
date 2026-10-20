export const BAND_NAMES = ["Blue", "Green", "Red", "Near infrared (NIR)"];
export const SPECTRAL_MODES = ["natural", "false", "nir"];

// NASA's published composites are rendered JPEGs, not raw sensor bands.
// These are display brightness values, never calibrated reflectance or NDVI.
export function displayedBandBrightness(naturalPixel, falsePixel) {
  return [naturalPixel[2], naturalPixel[1], naturalPixel[0], falsePixel[0]];
}

export function nirGrayPixel(falsePixel) {
  return [falsePixel[0], falsePixel[0], falsePixel[0], 255];
}

// Convert one geographic image coordinate into matching positions on the
// display plane and the viewer's circular canvas, independent of aspect ratio.
export function spectralLensAlignment(sample, scene, panelWidth, panelHeight,
  lensSize, canvasSize) {
  return {
    worldX: (sample.u - 0.5) * panelWidth,
    worldY: (0.5 - sample.v) * panelHeight,
    canvasScaleX: canvasSize * panelWidth / (lensSize * scene.width),
    canvasScaleY: canvasSize * panelHeight / (lensSize * scene.height),
    sourceX: sample.u * scene.width,
    sourceY: sample.v * scene.height,
  };
}
