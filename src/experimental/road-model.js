// Fictional town. Coordinates are metres, edge lengths and speed limits yield
// minutes; a closed bridge is excluded from Dijkstra's shortest-time search.
export const TOWN_NODES = {
  hospital: [-48, -28], west: [-24, -28], westNorth: [-24, -18],
  bridgeNorthW: [-12, -18], bridgeNorthE: [12, -18], eastNorth: [28, -18],
  east: [28, -26], patient: [48, -26], southW: [-24, -48],
  bridgeSouthW: [-12, -48], bridgeSouthE: [12, -48], southE: [28, -48],
  market: [43, 9],
};
const e = (a, b, speed = 30, bridge = null) => ({ a, b, speed, bridge });
export const TOWN_EDGES = [
  e('hospital','west',30), e('west','westNorth',28),
  e('westNorth','bridgeNorthW',36), e('bridgeNorthW','bridgeNorthE',36,'north'),
  e('bridgeNorthE','eastNorth',36), e('eastNorth','east',28),
  e('east','patient',30), e('west','southW',16),
  e('southW','bridgeSouthW',18), e('bridgeSouthW','bridgeSouthE',18,'south'),
  e('bridgeSouthE','southE',18), e('southE','east',16),
  e('eastNorth','market',25), e('market','patient',22),
];
export function edgeLength(edge) {
  const [ax, ay] = TOWN_NODES[edge.a], [bx, by] = TOWN_NODES[edge.b];
  return Math.hypot(ax - bx, ay - by);
}
export function edgeMinutes(edge) { return edgeLength(edge) / (edge.speed * 1000 / 60); }
export function fastestRoute(start = 'hospital', finish = 'patient', closed = [], extra = []) {
  const nodes = Object.keys(TOWN_NODES);
  if (!nodes.includes(start) || !nodes.includes(finish)) throw new RangeError('Unknown road node');
  const edges = [...TOWN_EDGES, ...extra].filter(edge => !closed.includes(edge.bridge));
  const distance = Object.fromEntries(nodes.map(id => [id, Infinity]));
  const previous = {};
  distance[start] = 0;
  const remaining = new Set(nodes);
  while (remaining.size) {
    const current = [...remaining].reduce((a,b) => distance[a] < distance[b] ? a : b);
    if (!Number.isFinite(distance[current]) || current === finish) break;
    remaining.delete(current);
    for (const edge of edges) {
      const next = edge.a === current ? edge.b : edge.b === current ? edge.a : null;
      if (!next || !remaining.has(next)) continue;
      const cost = distance[current] + edgeMinutes(edge);
      if (cost < distance[next]) { distance[next] = cost; previous[next] = current; }
    }
  }
  if (!Number.isFinite(distance[finish])) return null;
  const path = [finish];
  while (path[0] !== start) path.unshift(previous[path[0]]);
  return { path, minutes: distance[finish], meters: path.slice(1).reduce((sum,node,index) => {
    const prev = path[index];
    return sum + Math.hypot(TOWN_NODES[node][0]-TOWN_NODES[prev][0],TOWN_NODES[node][1]-TOWN_NODES[prev][1]);
  },0) };
}
export function nearestRoadNode(x, y) {
  return Object.keys(TOWN_NODES).reduce((best, id) => {
    const [nx, ny] = TOWN_NODES[id];
    const d = (x-nx)**2 + (y-ny)**2;
    return d < best.distance ? { id, distance:d } : best;
  }, { id: null, distance: Infinity }).id;
}
export function driveStep(vehicle,{throttle=false,brake=false,steer=0}={},dt=0){
  const seconds=Math.max(0,Math.min(0.1,dt));
  const speed=Math.max(0,Math.min(8,vehicle.speed+
    (throttle?3.2:0)*seconds-(brake?6:1.25)*seconds));
  const heading=vehicle.heading+Math.max(-1,Math.min(1,steer))*speed*seconds*0.025;
  return {x:vehicle.x+Math.sin(heading)*speed*seconds,
    z:vehicle.z-Math.cos(heading)*speed*seconds,heading,speed};
}
