import * as THREE from "three";

// Small deterministic textures give the reference scene recognizable materials
// without loading remote assets or changing the first-hit scanning geometry.
const FINISHES = ["earth", "stone", "timber", "plaster", "roof", "metal", "bark", "leaves"];
const BASE = {
  earth: [97, 119, 78], stone: [143, 139, 122],
  timber: [139, 94, 58], plaster: [197, 181, 151],
  roof: [151, 79, 58], metal: [112, 131, 137],
  bark: [100, 69, 47], leaves: [69, 130, 65],
};

function noise(x, y, seed) {
  let n = Math.imul(x + 17, 374761393) ^
    Math.imul(y + 31, 668265263) ^ Math.imul(seed + 5, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function scanTexture(finish) {
  if (!BASE[finish]) throw new RangeError(`Unknown scan finish: ${finish}`);
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  const seed = FINISHES.indexOf(finish);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const grain = noise(x >> 2, y >> 2, seed) - 0.5;
      let shade = grain * 28;
      if (finish === "earth")
        shade += 13 * Math.sin(x * 0.16 + y * 0.1);
      if (finish === "stone" && (y % 32 < 2 ||
        (x + (Math.floor(y / 32) % 2) * 16) % 32 < 2)) shade -= 48;
      if (finish === "timber" || finish === "bark")
        shade += 17 * Math.sin((finish === "bark" ? x : y) * 0.48);
      if (finish === "plaster") shade += 9 * Math.sin(x * 0.08 + y * 0.14);
      if (finish === "roof" && (y % 18 < 2 ||
        (x + (Math.floor(y / 18) % 2) * 12) % 24 < 2)) shade -= 35;
      if (finish === "metal") shade += y % 32 < 2 ? -24 : 0;
      if (finish === "leaves") shade += (noise(x, y, seed + 19) - 0.5) * 65;
      const i = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel++)
        pixels[i + channel] = THREE.MathUtils.clamp(BASE[finish][channel] + shade, 0, 255);
      pixels[i + 3] = 255;
    }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function scanMaterials() {
  const materials = Object.fromEntries(FINISHES.map((finish) => [finish,
    new THREE.MeshStandardMaterial({
      map: scanTexture(finish), roughness: finish === "metal" ? 0.58 : 0.95,
      metalness: finish === "metal" ? 0.35 : 0,
      side: THREE.DoubleSide,
    }),
  ]));
  return materials;
}
