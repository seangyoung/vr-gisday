import * as THREE from "three";

// The 324 m image covers the 320 m walkable terrain. Its grid origin is 90 m
// from the clipboard map's origin, aligning cells at every supported size.
export const PIXEL_WORLD_EXTENT = 162;

export function pixelLandscapeTexture(model, size) {
  const width = model.sampleWidth;
  const samplesPerCell = size / 0.5;
  const raster = size === 0.5 ? null : model.raster(size);
  const rgba = new Uint8Array(width * width * 4);
  for (let row = 0; row < width; row++)
    for (let col = 0; col < width; col++) {
      const sample = row * width + col;
      const rgb = raster
        ? raster.pixels[Math.floor(row / samplesPerCell) * raster.cells +
          Math.floor(col / samplesPerCell)].rgb
        : model.rgb.subarray(sample * 3, sample * 3 + 3);
      const edge = size >= 10 &&
        (row % samplesPerCell === 0 || col % samplesPerCell === 0);
      for (let band = 0; band < 3; band++)
        rgba[sample * 4 + band] = edge ? Math.round(rgb[band] * 0.78) : rgb[band];
      rgba[sample * 4 + 3] = 255;
    }
  const texture = new THREE.DataTexture(rgba, width, width, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function makePixelLandscape(model, fineGroundGeometry, texture) {
  const geometry = fineGroundGeometry.clone();
  const position = geometry.getAttribute("position");
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = (position.getX(i) + model.extent) / model.width;
    uv[i * 2 + 1] = (position.getZ(i) + model.extent) / model.width;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    map: texture, roughness: 1, side: THREE.DoubleSide,
  }));
}
