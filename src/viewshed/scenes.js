import * as THREE from "three";
import { LANDSCAPE_EXTENT, landscapeHeight, riverWaterHeight, riverX } from "../layers/experience.js";

const smooth = THREE.MathUtils.smoothstep;
const gaussian = (x, z, cx, cz, radius) =>
  Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (radius * radius));

function canyon(options) {
  const { id, label, target, center, width, color, sky, mesas } = options;
  const river = (z) => center(z);
  const water = (z) => -10 - z * 0.012;
  const heightAt = (x, z) => {
    const bend = river(z);
    const slope = (river(z + 0.5) - river(z - 0.5));
    const distance = Math.abs(x - bend) / Math.sqrt(1 + slope * slope);
    const wall = 5 * smooth(distance, width + 1, width + 5)
      + 9 * smooth(distance, width + 5, width + 13)
      + 9 * smooth(distance, width + 13, width + 23);
    const terraces = 1.3 * Math.sin(z * 0.072 + x * 0.033)
      + 0.8 * Math.sin(x * 0.17) * Math.cos(z * 0.11);
    const buttes = mesas.reduce((sum, [mx, mz, r, h]) =>
      sum + h * gaussian(x, z, mx, mz, r), 0);
    return water(z) - 0.36 + wall +
      smooth(distance, width + 8, width + 28) * (terraces + buttes);
  };
  return {
    id, label, target, start: { x: 0, z: -3.4 },
    heightAt, river, water, riverWidth: width - 0.8,
    color, sky,
  };
}

export const VIEWSHED_SCENES = [
  {
    id: "valley", label: "River Valley",
    target: { x: 50, z: -100 }, start: { x: 0, z: -3.4 },
    heightAt: (x, z) => landscapeHeight(x, z),
    river: riverX, water: riverWaterHeight, riverWidth: 2.2,
    sky: 0xa8c8ca,
  },
  canyon({
    id: "redrock", label: "Redrock Bend", target: { x: -40, z: -100 },
    center: (z) => 35 + 43 * Math.sin((z + 16) * 0.019) + 7 * Math.sin(z * 0.052),
    width: 4.2, color: 0xa95d3a, sky: 0xe3bb96,
    mesas: [[-72, -70, 30, 11], [92, 48, 37, 9], [-110, 98, 46, 8]],
  }),
  canyon({
    id: "mesa", label: "Mesa Gate", target: { x: -108, z: -90 },
    center: (z) => -70 + 35 * Math.sin(z * 0.016 + 1.45) + 11 * Math.sin(z * 0.043),
    width: 5, color: 0xb98655, sky: 0xe6cba9,
    mesas: [[-70, -35, 35, 19], [58, -96, 38, 16], [94, 76, 42, 13]],
  }),
];

function gridGeometry(spec, size, extent) {
  const positions = [], colors = [], indices = [];
  const base = new THREE.Color(spec.color);
  for (let row = 0; row <= size; row++) {
    const z = (row / size * 2 - 1) * extent;
    for (let col = 0; col <= size; col++) {
      const x = (col / size * 2 - 1) * extent;
      const y = spec.heightAt(x, z);
      positions.push(x, y, z);
      const band = 0.035 * Math.sin(y * 0.85) + 0.025 * Math.sin(y * 2.1);
      const grain = 0.018 * Math.sin(x * 0.22 + z * 0.29);
      const c = base.clone().offsetHSL(0, 0, THREE.MathUtils.clamp((y - 7) * 0.005 + band + grain, -0.13, 0.13));
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      const a = row * (size + 1) + col;
      indices.push(a, a + size + 1, a + 1, a + 1, a + size + 1, a + size + 2);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function outerGeometry(spec) {
  const rings = [LANDSCAPE_EXTENT, 240, 350, 480], segments = 64;
  const positions = [], colors = [], indices = [];
  const base = new THREE.Color(spec.color);
  for (let side = 0; side < 4; side++) {
    const first = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments * 2 - 1;
      for (const distance of rings) {
        const x = side < 2 ? t * distance : (side === 2 ? -distance : distance);
        const z = side < 2 ? (side === 0 ? -distance : distance) : t * distance;
        const y = spec.heightAt(x, z);
        positions.push(x, y, z);
        const c = base.clone().offsetHSL(0, 0, THREE.MathUtils.clamp((y - 7) * 0.005, -0.1, 0.1));
        colors.push(c.r, c.g, c.b);
      }
      if (i < segments)
        for (let ring = 0; ring < rings.length - 1; ring++) {
          const a = first + i * rings.length + ring;
          indices.push(a, a + 1, a + rings.length, a + 1, a + rings.length + 1, a + rings.length);
        }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function riverMesh(spec) {
  const positions = [], indices = [], segments = 450;
  for (let i = 0; i <= segments; i++) {
    const z = -LANDSCAPE_EXTENT + i * 2 * LANDSCAPE_EXTENT / segments;
    const x = spec.river(z), y = spec.water(z) + 0.04;
    positions.push(x - spec.riverWidth, y, z, x + spec.riverWidth, y, z);
    if (i < segments) {
      const a = 2 * i;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: 0x31849b, metalness: 0.18, roughness: 0.36, side: THREE.DoubleSide,
  }));
}

export function buildCanyonWorld(spec) {
  const world = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, side: THREE.DoubleSide,
    emissive: new THREE.Color(spec.color), emissiveIntensity: 0.13,
  });
  world.add(new THREE.Mesh(gridGeometry(spec, 288, LANDSCAPE_EXTENT), material));
  world.add(new THREE.Mesh(outerGeometry(spec), material));
  world.add(riverMesh(spec));
  const pick = new THREE.Mesh(
    gridGeometry(spec, 96, LANDSCAPE_EXTENT),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  pick.visible = false;
  world.add(pick);
  return { world, pick };
}
