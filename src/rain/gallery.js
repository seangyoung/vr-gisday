import * as THREE from "three";
import { createTray } from "./erosion.js";
import { SIZE, cellAt, cellPoint, createHeights } from "./terrain.js";

// Small copies of the actual starting height grids, rather than generic artwork.
export function rainThumbnail(kind) {
  const erosion = kind === "erosion";
  const heights = erosion ? createTray(SIZE) : createHeights();
  const group = new THREE.Group();
  const positions = [], colors = [], indices = [];
  const low = new THREE.Color(erosion ? 0x8e6044 : 0x46795d);
  const high = new THREE.Color(erosion ? 0xe6bd83 : 0xbac18a);
  const divisions = 32;
  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.035, 0.65),
    new THREE.MeshBasicMaterial({ color: erosion ? 0x553c34 : 0x26434b }),
  );
  tray.position.y = -0.087;
  group.add(tray);
  for (let row = 0; row <= divisions; row++)
    for (let col = 0; col <= divisions; col++) {
      const id = row * 2 * SIZE + col * 2;
      const { x, y, z } = cellPoint(id, heights);
      positions.push(x * 0.43, (y - 0.3) * 0.3, z * 0.31);
      const color = low.clone().lerp(high, THREE.MathUtils.clamp((y - 0.15) / 0.65, 0, 1));
      colors.push(color.r, color.g, color.b);
      if (row < divisions && col < divisions) {
        const a = row * (divisions + 1) + col;
        indices.push(a, a + divisions + 1, a + 1, a + 1, a + divisions + 1, a + divisions + 2);
      }
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide,
  })));

  const paths = erosion
    ? [[-0.56, -0.25], [-0.18, 0.1], [0.28, 0.5]]
    : [[-0.64, -0.65], [0.64, 0.65]];
  for (const [start, end] of paths) {
    const points = [];
    for (let i = 0; i <= 30; i++) {
      const z = -0.86 + (i / 30) * 1.72;
      const x = THREE.MathUtils.lerp(start, end, i / 30) + 0.045 * Math.sin(i * 0.8);
      const y = heights[cellAt(x, z, SIZE)];
      points.push(new THREE.Vector3(x * 0.43, (y - 0.3) * 0.3 + 0.006, z * 0.31));
    }
    group.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: erosion ? 0x5b382b : 0x5fe0ef }),
    ));
  }
  group.rotation.x = 0.95;
  return group;
}
