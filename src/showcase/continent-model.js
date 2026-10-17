import continents from "./data/continents.json" with { type: "json" };

export const CONTINENTS = continents;

function unwrapRing(ring) {
  const result = [];
  for (const [longitude, latitude] of ring) {
    let lon = longitude;
    if (result.length)
      while (lon - result[result.length - 1][0] > 180) lon -= 360;
    if (result.length)
      while (lon - result[result.length - 1][0] < -180) lon += 360;
    result.push([lon, latitude]);
  }
  return result;
}

function insideRing(longitude, latitude, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > latitude) !== (yj > latitude) &&
        longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

const searchable = continents.map((continent) => ({
  continent,
  rings: continent.rings.map(unwrapRing),
}));

export function continentAt(longitude, latitude) {
  // Natural Earth's Antarctica polygon is split at the map seam and pole.
  if (latitude <= -80) return continents.find((c) => c.name === "Antarctica");
  for (const { continent, rings } of searchable)
    for (const ring of rings)
      if ([longitude - 360, longitude, longitude + 360].some((lon) =>
        insideRing(lon, latitude, ring)))
        return continent;
  return null;
}
