export const GIS_DAY_2026 = "2026-11-18";
const KEY = "vr-gisday-lesson-scores-v2";
const LEGACY_KEY = "vr-gisday-quiz-scores-v1";
const MAX_NAME = 30;

export function chicagoDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function cleanPlayerName(value) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, MAX_NAME).trim();
}

function validEntry(entry) {
  return entry && typeof entry.demo === "string" && /^[a-z-]+$/.test(entry.demo) &&
    Number.isInteger(entry.score) && entry.score >= 0 && entry.score <= 200 &&
    Number.isFinite(entry.at) && (entry.demo !== "change" || entry.version === 2);
}

function normalizePlayers(players) {
  if (!Array.isArray(players)) return [];
  const seen = new Set();
  return players.map(cleanPlayerName).filter((name) => {
    const key = name.toLocaleLowerCase();
    if (!name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeScores(scores, players) {
  const known = new Map(players.map((name) => [name.toLocaleLowerCase(), name]));
  if (!scores || typeof scores !== "object") return {};
  const result = {};
  for (const [key, entries] of Object.entries(scores)) {
    const name = known.get(key.toLocaleLowerCase());
    if (!name || !Array.isArray(entries)) continue;
    result[name] = entries.filter(validEntry).slice(0, 40);
  }
  return result;
}

function ranks(scores) {
  return Object.entries(scores).map(([name, entries]) => ({
    name,
    score: entries.reduce((sum, entry) => sum + entry.score, 0),
    completed: entries.length,
    at: Math.min(...entries.map((entry) => entry.at)),
  })).filter((row) => row.completed)
    .sort((a, b) => b.score - a.score || b.completed - a.completed || a.at - b.at)
    .slice(0, 10);
}

export class QuizLeaderboard {
  constructor(storage = localStorage, now = () => new Date()) {
    this.storage = storage;
    this.now = now;
  }

  read() {
    let saved;
    try { saved = JSON.parse(this.storage.getItem(KEY) || "null"); }
    catch { saved = null; }
    let legacy;
    try { legacy = JSON.parse(this.storage.getItem(LEGACY_KEY) || "null"); }
    catch { legacy = null; }
    const day = chicagoDay(this.now());
    const legacyNames = [...(Array.isArray(legacy?.today) ? legacy.today : []),
      ...(Array.isArray(legacy?.gisDay) ? legacy.gisDay : [])]
      .map((row) => row?.initials);
    const players = normalizePlayers([
      ...(Array.isArray(saved?.players) ? saved.players : []), ...legacyNames,
    ]);
    const todayScores = saved?.day === day
      ? normalizeScores(saved?.todayScores, players) : {};
    const gisDayScores = normalizeScores(saved?.gisDayScores, players);
    const selected = players.find((name) =>
      name.toLocaleLowerCase() === cleanPlayerName(saved?.selected).toLocaleLowerCase()) ?? "";
    return { day, players, selected, todayScores, gisDayScores,
      today: ranks(todayScores), gisDay: ranks(gisDayScores) };
  }

  selectPlayer(value) {
    const name = cleanPlayerName(value);
    if (!name) throw new Error("Enter a player name before starting VR.");
    const saved = this.read();
    const existing = saved.players.find((player) =>
      player.toLocaleLowerCase() === name.toLocaleLowerCase());
    saved.selected = existing ?? name;
    if (!existing) saved.players.push(name);
    this.storage.setItem(KEY, JSON.stringify(saved));
    return saved.selected;
  }

  submitDemo(demo, result) {
    if (!/^[a-z-]+$/.test(demo) || !result ||
        !Number.isInteger(result.score) || result.score < 0 || result.score > 200)
      throw new Error("A finished lesson question is required.");
    const saved = this.read();
    const name = saved.selected;
    if (!name) throw new Error("Select a player before recording a score.");
    const entry = { demo, score: result.score, at: this.now().getTime(),
      ...(demo === "change" ? { version: 2 } : {}) };
    const update = (scores) => {
      const entries = scores[name] ?? [];
      const previous = entries.find((item) => item.demo === demo);
      if (!previous || entry.score > previous.score)
        scores[name] = [...entries.filter((item) => item.demo !== demo), entry];
    };
    update(saved.todayScores);
    if (saved.day === GIS_DAY_2026) update(saved.gisDayScores);
    saved.today = ranks(saved.todayScores);
    saved.gisDay = ranks(saved.gisDayScores);
    this.storage.setItem(KEY, JSON.stringify(saved));
    return saved;
  }
}
