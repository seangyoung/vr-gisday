export const BAND_NAMES = ["Blue", "Green", "Red", "Near infrared (NIR)"];
export const SPECTRAL_MODES = ["natural", "false", "index"];

// NASA's published composites are rendered JPEGs, not raw sensor bands.
// These are display brightness values, never calibrated reflectance.
export function displayedBandBrightness(naturalPixel, falsePixel) {
  return [naturalPixel[2], naturalPixel[1], naturalPixel[0], falsePixel[0]];
}

// The published false-color JPEG places NIR in display red and visible red in
// display green. Their independent display stretches prevent quantitative NDVI.
// This ratio is an illustrative, per-pixel index for the teaching color view.
export function displayIndexValue(falsePixel) {
  const nirDisplay = falsePixel[0];
  const redDisplay = falsePixel[1];
  return (nirDisplay - redDisplay) / (nirDisplay + redDisplay + 1);
}

export function displayIndexPixel(falsePixel, low = 0, high = 0.4) {
  const value = displayIndexValue(falsePixel);
  const lerp = (a, b, t) => Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));
  let from, to, fraction;
  if (value < 0) {
    from = [37, 78, 116]; to = [174, 153, 111]; fraction = (value + 0.5) / 0.5;
  } else {
    // Stretch positive display ratios within each scene for legibility. These
    // colors are illustrative and must never be read as quantitative NDVI.
    const stretched = Math.max(0, Math.min(1, (value - low) /
      Math.max(0.03, high - low)));
    if (stretched < 0.5) {
      from = [174, 153, 111]; to = [120, 169, 93]; fraction = stretched * 2;
    } else {
      from = [120, 169, 93]; to = [29, 101, 64]; fraction = (stretched - 0.5) * 2;
    }
  }
  return [lerp(from[0], to[0], fraction), lerp(from[1], to[1], fraction),
    lerp(from[2], to[2], fraction), 255];
}
