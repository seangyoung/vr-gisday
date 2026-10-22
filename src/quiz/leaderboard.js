export const GIS_DAY_2026 = "2026-11-18";
const KEY = "vr-gisday-quiz-scores-v1";

export function chicagoDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function topTen(rows) {
  return rows.filter((row) => /^[A-Z]{3}$/.test(row?.initials) &&
    Number.isInteger(row.score) && row.score >= 0 && row.score <= 2000)
    .sort((a, b) => b.score - a.score || a.at - b.at).slice(0, 10);
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
    const day = chicagoDay(this.now());
    return {
      day,
      today: saved?.day === day && Array.isArray(saved.today)
        ? topTen(saved.today) : [],
      gisDay: Array.isArray(saved?.gisDay) ? topTen(saved.gisDay) : [],
    };
  }

  submit(session) {
    const result = session.finalScore();
    if (!result) throw new Error("Only a finished round can be saved");
    const saved = this.read();
    const row = { initials: result.initials, score: result.score,
      correct: result.correct, at: this.now().getTime() };
    saved.today = topTen([...saved.today, row]);
    if (saved.day === GIS_DAY_2026)
      saved.gisDay = topTen([...saved.gisDay, row]);
    this.storage.setItem(KEY, JSON.stringify(saved));
    return saved;
  }
}
