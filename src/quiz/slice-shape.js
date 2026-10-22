function clipPolygon(polygon, point, normal, keepPositive) {
  const signed = (vertex) =>
    (vertex.x - point.x) * normal.x + (vertex.y - point.y) * normal.y;
  const inside = (distance) => keepPositive ? distance >= -1e-8 : distance <= 1e-8;
  const result = [];
  for (let index = 0; index < polygon.length; index++) {
    const from = polygon[index];
    const to = polygon[(index + 1) % polygon.length];
    const fromDistance = signed(from);
    const toDistance = signed(to);
    const fromInside = inside(fromDistance);
    const toInside = inside(toDistance);
    if (fromInside !== toInside) {
      const fraction = fromDistance / (fromDistance - toDistance);
      result.push({
        x: from.x + (to.x - from.x) * fraction,
        y: from.y + (to.y - from.y) * fraction,
      });
    }
    if (toInside) result.push({ ...to });
  }
  return result;
}

export function polygonArea(polygon) {
  let twiceArea = 0;
  for (let index = 0; index < polygon.length; index++) {
    const from = polygon[index];
    const to = polygon[(index + 1) % polygon.length];
    twiceArea += from.x * to.y - to.x * from.y;
  }
  return Math.abs(twiceArea) / 2;
}

export function polygonCentroid(polygon) {
  let x = 0;
  let y = 0;
  for (const vertex of polygon) {
    x += vertex.x;
    y += vertex.y;
  }
  return { x: x / polygon.length, y: y / polygon.length };
}

export function splitRectangle(width, height, point, direction) {
  const magnitude = Math.hypot(direction.x, direction.y) || 1;
  const tangent = { x: direction.x / magnitude, y: direction.y / magnitude };
  const normal = { x: -tangent.y, y: tangent.x };
  // A shallow edge contact still opens a visible cut without moving its angle.
  const origin = {
    x: Math.max(-width * 0.36, Math.min(width * 0.36, point.x)),
    y: Math.max(-height * 0.36, Math.min(height * 0.36, point.y)),
  };
  const rectangle = [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: height / 2 },
  ];
  return {
    normal,
    polygons: [clipPolygon(rectangle, origin, normal, false),
      clipPolygon(rectangle, origin, normal, true)],
  };
}
