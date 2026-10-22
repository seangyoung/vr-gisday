function fillRows(list, empty, rows) {
  list.replaceChildren();
  empty.hidden = rows.length > 0;
  for (const [index, row] of rows.entries()) {
    const item = document.createElement("li");
    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    const initials = document.createElement("strong");
    initials.className = "leaderboard-initials";
    initials.textContent = row.initials;
    const score = document.createElement("span");
    score.className = "leaderboard-score";
    score.textContent = `${row.score.toLocaleString()} pts`;
    item.append(rank, initials, score);
    list.append(item);
  }
}

export function renderLandingLeaderboard(root, leaderboard) {
  const date = root.querySelector("#leaderboard-date");
  const today = root.querySelector("#leaderboard-today");
  const todayEmpty = root.querySelector("#leaderboard-today-empty");
  const gisDay = root.querySelector("#leaderboard-gisday");
  const gisDayEmpty = root.querySelector("#leaderboard-gisday-empty");
  if (!date || !today || !todayEmpty || !gisDay || !gisDayEmpty) return;
  try {
    const scores = leaderboard?.read();
    date.textContent = scores?.day
      ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric",
        year: "numeric", timeZone: "UTC" }).format(
        new Date(`${scores.day}T12:00:00Z`)) : "";
    fillRows(today, todayEmpty, scores?.today ?? []);
    fillRows(gisDay, gisDayEmpty, scores?.gisDay ?? []);
    if (!scores) todayEmpty.textContent = "Scores are unavailable in this browser.";
  } catch {
    fillRows(today, todayEmpty, []);
    fillRows(gisDay, gisDayEmpty, []);
    todayEmpty.textContent = "Scores are unavailable in this browser.";
  }
}
