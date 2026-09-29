// ============ CONSTANTS ============
export const TEAMS = [
  "ÉQUIPE 1", "ÉQUIPE 2", "ÉQUIPE 3", "ÉQUIPE 4",
  "ÉQUIPE 5", "ÉQUIPE 6", "ÉQUIPE 7", "ÉQUIPE 8",
];

// 20 segments, each value (5/10/15/20/25) repeated exactly 4 times,
// arranged so no two identical values sit next to each other.
export const CARD_SEGMENTS = [
  5, 10, 15, 20, 25, 15, 5, 20, 10, 25,
  20, 15, 5, 25, 10, 15, 20, 5, 25, 10,
];

export const LOCK_DURATION_MS = 60 * 60 * 1000; // 1 heure

const STORAGE_KEY = "roue-des-bo:v1";

function defaultState() {
  const totals = {};
  TEAMS.forEach((t) => { totals[t] = 0; });
  return {
    teamLockUntil: null,
    cardsLockUntil: null,
    pendingTeam: null,   // { index, label }
    pendingCards: null,  // { index, value }
    history: [],         // { id, team, cards, timestamp }
    teamTotals: totals,
    historyCounter: 0,
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    // merge defensively in case of future shape changes
    return {
      ...base,
      ...parsed,
      teamTotals: { ...base.teamTotals, ...(parsed.teamTotals || {}) },
    };
  } catch (e) {
    console.warn("Impossible de lire l'état sauvegardé, réinitialisation.", e);
    return defaultState();
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Impossible de sauvegarder l'état.", e);
  }
}

export function getState() {
  return state;
}

export function resetState() {
  state = defaultState();
  persist();
  return state;
}

export function lockWheel(which) {
  const until = Date.now() + LOCK_DURATION_MS;
  if (which === "team") state.teamLockUntil = until;
  else state.cardsLockUntil = until;
  persist();
}

export function getRemainingMs(which) {
  const until = which === "team" ? state.teamLockUntil : state.cardsLockUntil;
  if (!until) return 0;
  const remaining = until - Date.now();
  return remaining > 0 ? remaining : 0;
}

export function isLocked(which) {
  return getRemainingMs(which) > 0;
}

export function setPendingTeam(index, label) {
  state.pendingTeam = { index, label };
  persist();
}

export function setPendingCards(index, value) {
  state.pendingCards = { index, value };
  persist();
}

export function bothPending() {
  return !!(state.pendingTeam && state.pendingCards);
}

export function commitResult() {
  if (!bothPending()) return null;
  const team = state.pendingTeam.label;
  const cards = state.pendingCards.value;
  state.historyCounter += 1;
  const entry = {
    id: state.historyCounter,
    team,
    cards,
    timestamp: Date.now(),
  };
  state.history.unshift(entry);
  state.teamTotals[team] = (state.teamTotals[team] || 0) + cards;
  state.pendingTeam = null;
  state.pendingCards = null;
  persist();
  return entry;
}

export function formatMs(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatTimestamp(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} à ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
