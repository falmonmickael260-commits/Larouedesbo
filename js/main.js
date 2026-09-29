import {
  TEAMS, CARD_SEGMENTS,
  getState, resetState,
  lockWheel, getRemainingMs, isLocked,
  setPendingTeam, setPendingCards, bothPending, commitResult,
  formatMs, formatTimestamp,
} from "./state.js";
import { Wheel } from "./wheel.js";
import { unlockAudio, playWhoosh, playLocked, playWin, playCombine } from "./sound.js";
import { burst } from "./particles.js";

// ============ DOM ============
const $ = (sel) => document.querySelector(sel);

const loaderEl = $("#loader");
const loaderBarFill = $("#loader-bar-fill");
const loaderTip = $("#loader-tip");
const appEl = $("#app");

const wheelTeamEl = $("#wheel-team");
const wheelCardsEl = $("#wheel-cards");
const pointerTeamEl = $(".wheel-pointer--team");
const pointerCardsEl = $(".wheel-pointer--cards");

const btnTeam = $("#btn-team");
const btnCards = $("#btn-cards");
const statusTeam = $("#status-team");
const statusCards = $("#status-cards");

const pendingRecap = $("#pending-recap");
const pendingTeamChip = $("#pending-team-chip");
const pendingTeamValue = $("#pending-team-value");
const pendingCardsChip = $("#pending-cards-chip");
const pendingCardsValue = $("#pending-cards-value");

const statsGrid = $("#stats-grid");
const historyList = $("#history-list");
const historyEmpty = $("#history-empty");

const btnReset = $("#btn-reset");
const resetModal = $("#reset-modal");
const resetCancel = $("#reset-cancel");
const resetConfirm = $("#reset-confirm");

const resultOverlay = $("#result-overlay");
const resultStage = $("#result-stage");
const resultFlyinTeam = $("#result-flyin-team");
const resultFlyinTeamValue = $("#result-flyin-team-value");
const resultFlyinCards = $("#result-flyin-cards");
const resultFlyinCardsValue = $("#result-flyin-cards-value");
const resultCard = $("#result-card");
const resultCardTeam = $("#result-card-team");
const resultCardCards = $("#result-card-cards");
const resultCardClose = $("#result-card-close");
const resultParticles = $("#result-particles");

const lockToast = $("#lock-toast");

// ============ WHEEL SETUP ============
const teamWheel = new Wheel({
  container: wheelTeamEl,
  pointerEl: pointerTeamEl,
  segments: TEAMS.map((t) => ({ label: t })),
  colorsEven: "#3b1a66",
  colorsOdd: "#5b21b6",
  textColor: "#fff",
});

const cardsWheel = new Wheel({
  container: wheelCardsEl,
  pointerEl: pointerCardsEl,
  segments: CARD_SEGMENTS.map((v) => ({ label: String(v) })),
  colorsEven: "#22d3ee",
  colorsOdd: "#10d9a0",
  textColor: "#04241f",
});

let anySpinning = false;
let lockToastTimer = null;

// ============ LOCK TOAST ============
function showLockToast(message) {
  lockToast.textContent = message;
  lockToast.hidden = false;
  clearTimeout(lockToastTimer);
  lockToastTimer = setTimeout(() => { lockToast.hidden = true; }, 2600);
}

// ============ COUNTDOWN / BUTTON STATE ============
function refreshWheelUI() {
  refreshOne("team", btnTeam, statusTeam);
  refreshOne("cards", btnCards, statusCards);
}

function refreshOne(which, btn, statusEl) {
  const spinning = which === "team" ? teamWheel.isSpinning : cardsWheel.isSpinning;
  if (spinning) {
    btn.disabled = true;
    btn.classList.add("is-spinning");
    btn.classList.remove("is-locked");
    btn.querySelector(".spin-btn-label").textContent = "LA ROUE TOURNE...";
    statusEl.textContent = "";
    statusEl.classList.remove("is-locked", "is-done");
    return;
  }
  btn.classList.remove("is-spinning");

  const remaining = getRemainingMs(which);
  if (remaining > 0) {
    btn.disabled = true;
    btn.classList.add("is-locked");
    btn.querySelector(".spin-btn-label").textContent = `🔒 PROCHAIN TIRAGE DANS ${formatMs(remaining)}`;
    statusEl.textContent = `🔒 ROUE VERROUILLÉE — Prochain tirage dans ${formatMs(remaining)}`;
    statusEl.classList.add("is-locked");
    statusEl.classList.remove("is-done");
  } else {
    btn.disabled = anySpinning;
    btn.classList.remove("is-locked");
    btn.querySelector(".spin-btn-label").textContent = "🎯 TOURNER LA ROUE";
    const state = getState();
    const pending = which === "team" ? state.pendingTeam : state.pendingCards;
    if (pending) {
      statusEl.textContent = "✓ TIRAGE EFFECTUÉ";
      statusEl.classList.add("is-done");
      statusEl.classList.remove("is-locked");
    } else {
      statusEl.textContent = "";
      statusEl.classList.remove("is-done", "is-locked");
    }
  }
}

setInterval(refreshWheelUI, 1000);

// ============ PENDING RECAP ============
function refreshPendingRecap() {
  const state = getState();
  const hasAny = !!(state.pendingTeam || state.pendingCards);
  pendingRecap.hidden = !hasAny;
  if (state.pendingTeam) {
    pendingTeamChip.hidden = false;
    pendingTeamValue.textContent = state.pendingTeam.label;
  } else {
    pendingTeamChip.hidden = true;
  }
  if (state.pendingCards) {
    pendingCardsChip.hidden = false;
    pendingCardsValue.textContent = `${state.pendingCards.value} cartes`;
  } else {
    pendingCardsChip.hidden = true;
  }
}

// ============ STATS ============
const statValueEls = {};
function buildStatsGrid() {
  statsGrid.innerHTML = "";
  TEAMS.forEach((team) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <p class="stat-card-name">${team}</p>
      <p class="stat-card-value">0</p>
      <p class="stat-card-unit">cartes</p>
    `;
    statsGrid.appendChild(card);
    statValueEls[team] = { card, valueEl: card.querySelector(".stat-card-value") };
  });
  syncStatsFromState(false);
}

function syncStatsFromState(animate = true) {
  const state = getState();
  TEAMS.forEach((team) => {
    const target = state.teamTotals[team] || 0;
    const entry = statValueEls[team];
    if (!entry) return;
    const current = parseInt(entry.valueEl.textContent, 10) || 0;
    if (!animate || current === target) {
      entry.valueEl.textContent = target;
      return;
    }
    animateCount(entry.valueEl, current, target);
    entry.card.classList.remove("is-bump");
    void entry.card.offsetWidth;
    entry.card.classList.add("is-bump");
  });
}

function animateCount(el, from, to, duration = 700) {
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round(from + (to - from) * eased);
    el.textContent = value;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ============ HISTORY ============
function renderHistory() {
  const state = getState();
  historyList.innerHTML = "";
  historyEmpty.hidden = state.history.length > 0;
  state.history.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-item-left">
        <span class="history-item-num">Tirage #${String(entry.id).padStart(2, "0")}</span>
        <div>
          <div class="history-item-team">${entry.team}</div>
          <div class="history-item-time">${formatTimestamp(entry.timestamp)}</div>
        </div>
      </div>
      <div class="history-item-cards">→ ${entry.cards} cartes</div>
    `;
    historyList.appendChild(item);
  });
}

// ============ SPIN HANDLERS ============
function attemptSpin(which) {
  unlockAudio();
  if (anySpinning) return;
  if (isLocked(which)) {
    const remaining = getRemainingMs(which);
    playLocked();
    showLockToast(`🔒 Cette roue est actuellement verrouillée. Prochain tirage dans : ${formatMs(remaining)}`);
    return;
  }

  anySpinning = true;
  refreshWheelUI();
  playWhoosh();

  if (which === "team") {
    const targetIndex = Math.floor(Math.random() * TEAMS.length);
    teamWheel.spin(targetIndex, {
      onDone: (idx) => {
        anySpinning = false;
        setPendingTeam(idx, TEAMS[idx]);
        lockWheel("team");
        playWin();
        refreshWheelUI();
        refreshPendingRecap();
        maybeShowCombinedResult();
      },
    });
  } else {
    const targetIndex = Math.floor(Math.random() * CARD_SEGMENTS.length);
    cardsWheel.spin(targetIndex, {
      onDone: (idx) => {
        anySpinning = false;
        setPendingCards(idx, CARD_SEGMENTS[idx]);
        lockWheel("cards");
        playWin();
        refreshWheelUI();
        refreshPendingRecap();
        maybeShowCombinedResult();
      },
    });
  }
}

btnTeam.addEventListener("click", () => attemptSpin("team"));
btnCards.addEventListener("click", () => attemptSpin("cards"));

// ============ COMBINED RESULT ============
function maybeShowCombinedResult() {
  if (!bothPending()) return;
  const state = getState();
  const teamLabel = state.pendingTeam.label;
  const cardsValue = state.pendingCards.value;

  resultFlyinTeamValue.textContent = teamLabel;
  resultFlyinCardsValue.textContent = cardsValue;
  resultCardTeam.textContent = teamLabel;
  resultCardCards.textContent = `${cardsValue} CARTES`;

  // reset animation classes
  resultFlyinTeam.style.animation = "none";
  resultFlyinCards.style.animation = "none";
  resultCard.classList.remove("is-visible", "is-shake");
  void resultCard.offsetWidth;

  resultOverlay.hidden = false;
  requestAnimationFrame(() => {
    resultFlyinTeam.style.animation = "";
    resultFlyinCards.style.animation = "";
  });

  playCombine();

  setTimeout(() => {
    // commit into history + stats now that the reveal has played
    commitResult();
    renderHistory();
    syncStatsFromState(true);
    refreshPendingRecap();

    resultCard.classList.add("is-visible", "is-shake");
    burst(resultParticles, { count: 46 });
    playWin();
  }, 750);
}

function closeResultOverlay() {
  resultOverlay.hidden = true;
}
resultCardClose.addEventListener("click", closeResultOverlay);
resultOverlay.addEventListener("click", (e) => {
  if (e.target === resultOverlay || e.target.classList.contains("result-overlay-bg")) closeResultOverlay();
});

// ============ RESET ============
btnReset.addEventListener("click", () => { resetModal.hidden = false; });
resetCancel.addEventListener("click", () => { resetModal.hidden = true; });
resetConfirm.addEventListener("click", () => {
  resetState();
  resetModal.hidden = true;
  teamWheel.currentRotation = 0;
  cardsWheel.currentRotation = 0;
  wheelTeamEl.style.transition = "none";
  wheelTeamEl.style.transform = "rotate(0deg)";
  wheelCardsEl.style.transition = "none";
  wheelCardsEl.style.transform = "rotate(0deg)";
  requestAnimationFrame(() => {
    wheelTeamEl.style.transition = "";
    wheelCardsEl.style.transition = "";
  });
  syncStatsFromState(false);
  renderHistory();
  refreshPendingRecap();
  refreshWheelUI();
});
resetModal.addEventListener("click", (e) => {
  if (e.target === resetModal) resetModal.hidden = true;
});

// ============ LOADER ============
function runLoader() {
  const tips = [
    "Préparation du plateau…",
    "Vérification des équipes…",
    "Mélange des cartes…",
    "Ça va tourner…",
  ];
  let tipIndex = 0;
  const tipTimer = setInterval(() => {
    tipIndex = (tipIndex + 1) % tips.length;
    loaderTip.textContent = tips[tipIndex];
  }, 450);

  let progress = 0;
  const progressTimer = setInterval(() => {
    progress = Math.min(100, progress + 8 + Math.random() * 10);
    loaderBarFill.style.width = `${progress}%`;
    if (progress >= 100) {
      clearInterval(progressTimer);
      clearInterval(tipTimer);
      setTimeout(finishLoading, 300);
    }
  }, 140);
}

function finishLoading() {
  loaderEl.classList.add("is-hidden");
  appEl.hidden = false;
  appEl.classList.add("is-entering");
  requestAnimationFrame(() => {
    appEl.classList.remove("is-entering");
  });
  setTimeout(() => { loaderEl.remove(); }, 800);
}

// ============ INIT ============
function init() {
  buildStatsGrid();
  renderHistory();
  refreshPendingRecap();
  refreshWheelUI();
  runLoader();
}

init();
