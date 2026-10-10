import * as THREE from "three";

// A shared-vertex surface follows the higher-resolution bed instead of flat tiles.
export class WaterSurface {
  constructor(terrain) {
    const geometry = terrain.clone();
    this.triangles = terrain.index.array.slice();
    geometry.setIndex(
      new THREE.BufferAttribute(new Uint16Array(this.triangles.length), 1),
    );
    geometry.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.mesh.frustumCulled = false;
  }
  update(heights, water) {
    const geo = this.mesh.geometry,
      pos = geo.attributes.position,
      color = geo.attributes.color;
    const clear = new THREE.Color(0x64cff5),
      muddy = new THREE.Color(0xb88845),
      c = new THREE.Color();
    for (let id = 0; id < heights.length; id++) {
      pos.setY(id, heights[id] + water.depth[id] + 0.001);
      c.copy(clear).lerp(
        muddy,
        Math.min(
          0.85,
          (water.sediment[id] / Math.max(0.001, water.depth[id])) * 2,
        ),
      );
      color.setXYZ(id, c.r, c.g, c.b);
    }
    let count = 0;
    for (let i = 0; i < this.triangles.length; i += 3) {
      const a = this.triangles[i],
        b = this.triangles[i + 1],
        c = this.triangles[i + 2];
      // Draw only triangles touching water; shorelines are approximate at cell scale.
      if (
        Number(water.depth[a] > 0.0007) +
        Number(water.depth[b] > 0.0007) +
        Number(water.depth[c] > 0.0007) < 2
      )
        continue;
      geo.index.array[count++] = a;
      geo.index.array[count++] = b;
      geo.index.array[count++] = c;
    }
    geo.setDrawRange(0, count);
    pos.needsUpdate = color.needsUpdate = geo.index.needsUpdate = true;
    this.mesh.visible = true;
  }
}
