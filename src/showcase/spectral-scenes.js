// Each pair covers the same footprint. Natural color is visible RGB;
// false color assigns NIR, red, and green to display RGB.
export const SPECTRAL_SCENES = [
  {
    id: "bay", name: "San Francisco Bay", sensor: "Landsat 5 · 1997",
    width: 960, height: 540, sample: { u: 0.58, v: 0.59 },
    prompt: "Sample Bay water, then the vegetated hills.",
    observation: "Bay water stays dark in NIR; vegetation brightens in false color.",
  },
  {
    id: "everglades", name: "Everglades and Miami", sensor: "Landsat 5 · 2011",
    width: 720, height: 720, sample: { u: 0.24, v: 0.13 },
    prompt: "Sample farm fields, wetlands, and the city.",
    observation: "Leafy fields turn red; open water and flooded areas look dark.",
  },
  {
    id: "lilongwe", name: "Lilongwe, Malawi", sensor: "Landsat 8 · 2018",
    width: 720, height: 900, sample: { u: 0.71, v: 0.44 },
    prompt: "Sample trees beside streams, then built-up areas.",
    observation: "NIR reveals trees along streams and within the city.",
  },
];

export function createSpectralSceneRotation(random = Math.random) {
  let bag = [], previous;
  return () => {
    if (!bag.length) {
      bag = [...SPECTRAL_SCENES];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.at(-1) === previous)
        [bag[0], bag[bag.length - 1]] = [bag.at(-1), bag[0]];
    }
    previous = bag.pop();
    return previous;
  };
}
