// A reproducible teaching model. Shared movement and random draws isolate the
// effect of one rule; these are fictional agents, not epidemiological forecasts.
export const OUTBREAK_POPULATION = 84;
export const OUTBREAK_TICK_SECONDS = 0.2;

function hash(seed, agent, tick, salt = 0) {
  let x = (seed ^ Math.imul(agent + 1, 0x9e3779b1) ^
    Math.imul(tick + 1, 0x85ebca6b) ^ salt) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 0x100000000;
}

export function makeOutbreak(seed = 24018, rule = {}) {
  const agents = Array.from({ length: OUTBREAK_POPULATION }, (_, id) => ({
    id,
    x: 0.08 + hash(seed, id, 0, 1) * 0.84,
    z: 0.08 + hash(seed, id, 0, 2) * 0.84,
    state: id < 2 ? "infectious" : "susceptible",
    infectedAt: id < 2 ? 0 : null,
    contacts: [],
  }));
  return { seed, tick: 0, agents, rule: {
    contactDistance: rule.contactDistance ?? 0.085,
    transmission: rule.transmission ?? 0.38,
  }, history: [{ susceptible: OUTBREAK_POPULATION - 2, infectious: 2, recovered: 0 }] };
}

export function outbreakCounts(sim) {
  const counts = { susceptible: 0, infectious: 0, recovered: 0 };
  for (const agent of sim.agents) counts[agent.state]++;
  return counts;
}

export function advanceOutbreak(sim) {
  const { agents, seed } = sim;
  const tick = ++sim.tick;
  // Every paired run uses the same motion, indexed by agent and tick.
  for (const agent of agents) {
    const angle = hash(seed, agent.id, tick, 11) * Math.PI * 2;
    const stride = 0.007 + hash(seed, agent.id, tick, 12) * 0.012;
    agent.x = Math.min(0.94, Math.max(0.06, agent.x + Math.cos(angle) * stride));
    agent.z = Math.min(0.94, Math.max(0.06, agent.z + Math.sin(angle) * stride));
    if (agent.state === "infectious" && tick - agent.infectedAt > 30)
      agent.state = "recovered";
  }
  const newlyInfected = new Set();
  for (let i = 0; i < agents.length; i++) for (let j = i + 1; j < agents.length; j++) {
    const a = agents[i], b = agents[j];
    if ((a.x - b.x) ** 2 + (a.z - b.z) ** 2 > sim.rule.contactDistance ** 2) continue;
    // Retain a short history for inspection, independently of transmission.
    a.contacts.push({ id: b.id, tick });
    b.contacts.push({ id: a.id, tick });
    if (a.contacts.length > 12) a.contacts.shift();
    if (b.contacts.length > 12) b.contacts.shift();
    const infectious = a.state === "infectious" ? a : b.state === "infectious" ? b : null;
    const susceptible = a.state === "susceptible" ? a : b.state === "susceptible" ? b : null;
    if (infectious && susceptible &&
      hash(seed, i * OUTBREAK_POPULATION + j, tick, 31) < sim.rule.transmission)
      newlyInfected.add(susceptible.id);
  }
  for (const id of newlyInfected) {
    const a = agents[id];
    if (a.state === "susceptible") {
      a.state = "infectious";
      a.infectedAt = tick;
    }
  }
  sim.history.push(outbreakCounts(sim));
  return sim;
}

export function outbreakHotspots(sim, cells = 4) {
  const grid = Array.from({ length: cells * cells }, () => 0);
  for (const agent of sim.agents) if (agent.state !== "susceptible") {
    const x = Math.min(cells - 1, Math.floor(agent.x * cells));
    const z = Math.min(cells - 1, Math.floor(agent.z * cells));
    grid[z * cells + x]++;
  }
  return grid;
}
