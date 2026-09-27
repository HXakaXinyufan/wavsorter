import WavSorter from "./sorter-class.js";
import { wavNames } from "./member-data.js";

const SESSION_VERSION = 3;
const DEFAULT_RESULT_LIMIT = 30;
const MAX_PERSISTED_UNDO_STATES = 20;
const FLIP_DURATION_MS = 140;

const STORAGE = {
  theme: "wavSorter.theme",
  selection: "wavSorter.selection",
  session: "wavSorter.session.v3",
};

const PLAYLIST = [
  "Beam.mp3",
  "Chiyu.mp3",
  "Deju-Vu.mp3",
  "Firework Diary.mp3",
  "Friend Zone.mp3",
  "Generation.mp3",
  "Inner Dance.mp3",
  "Love Child.mp3",
  "Moto Princess.mp3",
  "Persona.mp3",
  "Seoul Sonyo Sound.mp3",
  "Speed Love.mp3",
  "Touch.mp3",
  "Vision.mp3",
  "White Soul Sneakers.mp3",
];

let els = {};
let sorter = null;
let selectedMembers = [];
let historyStack = [];
let showingAllResults = false;
let isAnimating = false;
let savedSession = null;

let playlist = [];
let currentSongIndex = 0;
let musicStarted = false;

const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

function cacheElements() {
  els.musicToggle = document.getElementById("music-toggle");
  els.musicToggleLabel = document.getElementById("music-toggle-label");
  els.darkModeBtn = document.getElementById("dark-mode-btn");
  els.darkModeText = document.getElementById("dark-mode-text");

  els.selectionScreen = document.getElementById("selection-screen");
  els.resumePanel = document.getElementById("resume-panel");
  els.resumeSummary = document.getElementById("resume-summary");
  els.btnResumeSort = document.getElementById("btn-resume-sort");
  els.btnDiscardSort = document.getElementById("btn-discard-sort");
  els.selectionCount = document.getElementById("selection-count");
  els.search = document.getElementById("wav-search");
  els.checkboxContainer = document.getElementById("checkbox-container");
  els.noSearchResults = document.getElementById("no-search-results");
  els.btnSelectAll = document.getElementById("btn-select-all");
  els.btnClearAll = document.getElementById("btn-clear-all");
  els.btnResetSelection = document.getElementById("btn-reset-selection");
  els.btnStartSort = document.getElementById("btn-start-sort");

  els.pageSorter = document.getElementById("page-sorter");
  els.battleNumber = document.getElementById("battleNumber");
  els.progressTrack = document.getElementById("progress-track");
  els.progressBar = document.getElementById("progress-bar");
  els.optionA = document.getElementById("optionA");
  els.optionB = document.getElementById("optionB");
  els.undoBtn = document.getElementById("undo-btn");
  els.btnExitSort = document.getElementById("btn-exit-sort");

  els.pageResult = document.getElementById("page-result");
  els.resultCount = document.getElementById("result-count");
  els.battleResult = document.getElementById("battleResult");
  els.showMore = document.getElementById("showMore");
  els.btnUndoResult = document.getElementById("btn-undo-result");
  els.downloadResult = document.getElementById("download-result");
  els.tweetButton = document.getElementById("tweet-button");
  els.btnReplay = document.getElementById("btn-replay");
  els.btnChangeSelection = document.getElementById("btn-change-selection");

  els.bgMusic = document.getElementById("bg-music");
}

function safeRead(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Could not save local data:", error);
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}

function setTheme(isDark) {
  document.body.classList.toggle("dark-mode", isDark);
  els.darkModeBtn.setAttribute("aria-pressed", String(isDark));
  els.darkModeText.textContent = isDark ? "Light mode" : "Dark mode";
  safeWrite(STORAGE.theme, isDark ? "dark" : "light");
}

function initTheme() {
  const saved = safeRead(STORAGE.theme, null);
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  setTheme(saved ? saved === "dark" : Boolean(prefersDark));
}

function populateCheckboxes() {
  const fragment = document.createDocumentFragment();

  wavNames.forEach((name, index) => {
    const label = document.createElement("label");
    label.className = "checkbox-item";
    label.dataset.search = name.toLocaleLowerCase();

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "member-checkbox";
    checkbox.value = name;
    checkbox.checked = true;
    checkbox.dataset.index = String(index);

    const text = document.createElement("span");
    text.textContent = name;

    label.append(checkbox, text);
    fragment.appendChild(label);
  });

  els.checkboxContainer.replaceChildren(fragment);

  const savedSelection = safeRead(STORAGE.selection, null);
  if (Array.isArray(savedSelection)) {
    const selected = new Set(savedSelection.filter((name) => wavNames.includes(name)));
    document.querySelectorAll(".member-checkbox").forEach((checkbox) => {
      checkbox.checked = selected.has(checkbox.value);
    });
  }

  refreshSelectionUI();
}

function getSelectedFromUI() {
  return [...document.querySelectorAll(".member-checkbox:checked")].map(
    (checkbox) => checkbox.value,
  );
}

function saveSelection() {
  safeWrite(STORAGE.selection, getSelectedFromUI());
}

function refreshSelectionUI() {
  const count = getSelectedFromUI().length;
  els.selectionCount.textContent = `${count} of ${wavNames.length} selected`;
  els.btnStartSort.disabled = count < 2;
  els.btnStartSort.textContent = count >= 2 ? `Start sorting ${count} WAVs` : "Select at least 2 WAVs";
}

function setEveryCheckbox(checked) {
  document.querySelectorAll(".member-checkbox").forEach((checkbox) => {
    checkbox.checked = checked;
  });
  saveSelection();
  refreshSelectionUI();
}

function filterCheckboxes() {
  const query = els.search.value.trim().toLocaleLowerCase();
  let visible = 0;

  els.checkboxContainer.querySelectorAll(".checkbox-item").forEach((label) => {
    const matches = !query || label.dataset.search.includes(query);
    label.hidden = !matches;
    if (matches) visible++;
  });

  els.noSearchResults.classList.toggle("is-hidden", visible !== 0);
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function setMusicTrack(index) {
  currentSongIndex = index % playlist.length;
  const filename = playlist[currentSongIndex];
  els.bgMusic.src = `${import.meta.env.BASE_URL}${encodeURIComponent(filename)}`;
}

async function startMusic() {
  if (!els.bgMusic) return;

  if (!musicStarted) {
    playlist = shuffle(PLAYLIST);
    currentSongIndex = 0;
    setMusicTrack(currentSongIndex);
    els.bgMusic.volume = 0.05;
    musicStarted = true;
  }

  try {
    await els.bgMusic.play();
    els.musicToggle.setAttribute("aria-pressed", "true");
    els.musicToggleLabel.textContent = "Music: On";
  } catch (error) {
    els.musicToggle.setAttribute("aria-pressed", "false");
    els.musicToggleLabel.textContent = "Music: Off";
    console.warn("Audio playback was blocked:", error);
  }
}

function pauseMusic() {
  els.bgMusic?.pause();
  els.musicToggle.setAttribute("aria-pressed", "false");
  els.musicToggleLabel.textContent = "Music: Paused";
}

async function toggleMusic() {
  if (!musicStarted || els.bgMusic.paused) await startMusic();
  else pauseMusic();
}

function switchScreen(screen) {
  els.selectionScreen.classList.toggle("is-hidden", screen !== "selection");
  els.pageSorter.classList.toggle("is-hidden", screen !== "battle");
  els.pageResult.classList.toggle("is-hidden", screen !== "result");
}

function persistSession() {
  if (!sorter || sorter.isComplete() || selectedMembers.length < 2) return;

  safeWrite(STORAGE.session, {
    version: SESSION_VERSION,
    selectedMembers,
    state: sorter.getState(),
    history: historyStack.slice(-MAX_PERSISTED_UNDO_STATES),
    savedAt: Date.now(),
  });
}

function clearSession() {
  savedSession = null;
  safeRemove(STORAGE.session);
  els.resumePanel.classList.add("is-hidden");
}

function readValidSession() {
  const session = safeRead(STORAGE.session, null);
  if (!session || session.version !== SESSION_VERSION) return null;
  if (!Array.isArray(session.selectedMembers) || session.selectedMembers.length < 2) return null;
  if (!session.selectedMembers.every((name) => wavNames.includes(name))) return null;

  try {
    const previewSorter = new WavSorter(session.selectedMembers);
    previewSorter.restoreState(session.state);
    if (previewSorter.isComplete()) return null;
    return {
      ...session,
      progress: previewSorter.getProgress(),
    };
  } catch {
    return null;
  }
}

function updateResumePanel() {
  savedSession = readValidSession();
  if (!savedSession) {
    safeRemove(STORAGE.session);
    els.resumePanel.classList.add("is-hidden");
    return;
  }

  const { progress, selectedMembers: members, savedAt } = savedSession;
  const date = new Date(savedAt);
  const timeText = Number.isNaN(date.getTime())
    ? ""
    : ` · saved ${date.toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`;

  els.resumeSummary.textContent =
    `${members.length} WAVs · Battle #${progress.currentQuestion} · ${progress.progressPercent}% complete${timeText}`;
  els.resumePanel.classList.remove("is-hidden");
}

function resetBattleUI() {
  showingAllResults = false;
  els.optionA.classList.remove("selected-glow");
  els.optionB.classList.remove("selected-glow");
  els.optionA.disabled = false;
  els.optionB.disabled = false;
  els.undoBtn.disabled = true;
}

async function startNewSort(members) {
  selectedMembers = [...members];
  historyStack = [];
  sorter = new WavSorter(selectedMembers);
  resetBattleUI();
  switchScreen("battle");
  persistSession();
  await startMusic();
  await showCurrentComparison({ immediate: true });
  els.optionA.focus({ preventScroll: true });
}

async function resumeSort() {
  if (!savedSession) return;

  try {
    selectedMembers = [...savedSession.selectedMembers];
    sorter = new WavSorter(selectedMembers);
    sorter.restoreState(savedSession.state);
    historyStack = Array.isArray(savedSession.history) ? savedSession.history : [];
    resetBattleUI();
    switchScreen("battle");
    await startMusic();
    await showCurrentComparison({ immediate: true });
    updateUndoButton();
    els.optionA.focus({ preventScroll: true });
  } catch (error) {
    console.error("Could not resume sort:", error);
    clearSession();
    switchScreen("selection");
  }
}

function updateProgressDisplay(progress) {
  const percent = Math.max(0, Math.min(100, progress.progressPercent));
  els.battleNumber.textContent = `Battle #${progress.currentQuestion} · ${percent}% sorted`;
  els.progressBar.style.width = `${percent}%`;
  els.progressTrack.setAttribute("aria-valuenow", String(percent));
}

function updateOptionContent(card, name, index) {
  const nameElement = card.querySelector(".member-name");
  nameElement.textContent = name;
  card.dataset.memberIndex = String(index);
  card.dataset.memberName = name;
  card.setAttribute("aria-label", `Choose ${name}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function animateCardTo(card, name, index, selected, immediate) {
  const changed = card.dataset.memberIndex !== String(index);

  if (immediate || reduceMotion?.matches) {
    updateOptionContent(card, name, index);
    return;
  }

  if (selected) card.classList.add("selected-glow");

  if (!changed) {
    await wait(FLIP_DURATION_MS * 2);
    card.classList.remove("selected-glow");
    return;
  }

  try {
    await card.animate(
      [
        { opacity: 1, transform: "translateY(0) scale(1)" },
        { opacity: 0, transform: "translateY(8px) scale(.985)" },
      ],
      { duration: FLIP_DURATION_MS, easing: "ease", fill: "forwards" },
    ).finished;
  } catch {
    // Animation cancellation is harmless.
  }

  updateOptionContent(card, name, index);
  card.classList.remove("selected-glow");

  try {
    await card.animate(
      [
        { opacity: 0, transform: "translateY(-8px) scale(.985)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      { duration: FLIP_DURATION_MS, easing: "ease", fill: "forwards" },
    ).finished;
  } catch {
    // Animation cancellation is harmless.
  }
}

async function showCurrentComparison({ selectedFlag = "", immediate = false } = {}) {
  if (!sorter || sorter.isComplete()) return;

  updateProgressDisplay(sorter.getProgress());
  updateUndoButton();

  const comparison = sorter.getCurrentComparison();
  if (!comparison) return;

  await Promise.all([
    animateCardTo(
      els.optionA,
      comparison.memberAName,
      comparison.memberA,
      selectedFlag === "A",
      immediate,
    ),
    animateCardTo(
      els.optionB,
      comparison.memberBName,
      comparison.memberB,
      selectedFlag === "B",
      immediate,
    ),
  ]);
}

function updateUndoButton() {
  els.undoBtn.disabled = historyStack.length === 0 || isAnimating;
}

function applyPreference(preference) {
  if (preference === "A") sorter.preferMemberA();
  else if (preference === "B") sorter.preferMemberB();
}

function handleSort(preference) {
  if (!sorter || sorter.isComplete() || isAnimating) return;
  if (preference !== "A" && preference !== "B") return;

  historyStack.push(sorter.getState());
  isAnimating = true;
  document.body.classList.add("is-animating");
  updateUndoButton();

  const selectedCard = preference === "A" ? els.optionA : els.optionB;
  selectedCard.classList.add("selected-glow");

  // Two animation frames let the browser paint the user's choice immediately
  // before the sorter calculates and renders the next battle.
  requestAnimationFrame(() => {
    requestAnimationFrame(async () => {
      applyPreference(preference);

      if (sorter.isComplete()) {
        updateProgressDisplay({ ...sorter.getProgress(), progressPercent: 100 });
        clearSession();
        await wait(reduceMotion?.matches ? 0 : 120);
        showResult();
      } else {
        persistSession();
        await showCurrentComparison({ selectedFlag: preference });
      }

      selectedCard.classList.remove("selected-glow");
      isAnimating = false;
      document.body.classList.remove("is-animating");
      updateUndoButton();
    });
  });
}

async function undoLastChoice({ fromResults = false } = {}) {
  if (!sorter || historyStack.length === 0 || isAnimating) return;

  isAnimating = true;
  const previousState = historyStack.pop();
  sorter.restoreState(previousState);

  if (fromResults) switchScreen("battle");
  persistSession();
  await showCurrentComparison({ immediate: true });

  isAnimating = false;
  updateUndoButton();
  els.optionA.focus({ preventScroll: true });
}

function buildRankingList(sortedMembers, limit) {
  const list = document.createElement("ol");
  list.className = "ranking-list";

  let ranking = 1;
  let sameRank = 1;
  const equal = sorter.equal;
  const shown = sortedMembers.slice(0, limit);

  shown.forEach((name, index) => {
    const item = document.createElement("li");
    const number = document.createElement("span");
    number.className = "number";
    number.textContent = String(ranking);

    const nameSpan = document.createElement("span");
    nameSpan.className = "rank-name";
    nameSpan.textContent = name;

    item.append(number, nameSpan);
    list.appendChild(item);

    if (index < shown.length - 1) {
      if (equal[index] === index + 1) sameRank++;
      else {
        ranking += sameRank;
        sameRank = 1;
      }
    }
  });

  return list;
}

function buildShareUrl(sortedMembers) {
  const top = sortedMembers.slice(0, 10);
  const lines = [`My WAV Sorter Top ${top.length}:`];
  top.forEach((name, index) => lines.push(`${index + 1}. ${name}`));
  lines.push("", "https://hxakaxinyufan.github.io/wavsorter/");

  const params = new URLSearchParams({ text: lines.join("\n") });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

function showResult() {
  if (!sorter?.isComplete()) return;

  const sortedMembers = sorter.getSortedMembers();
  const limit = showingAllResults
    ? sortedMembers.length
    : Math.min(DEFAULT_RESULT_LIMIT, sortedMembers.length);

  els.battleResult.replaceChildren(buildRankingList(sortedMembers, limit));
  els.resultCount.textContent = `${sortedMembers.length} WAVs ranked`;

  if (sortedMembers.length > DEFAULT_RESULT_LIMIT) {
    els.showMore.classList.remove("is-hidden");
    els.showMore.textContent = showingAllResults
      ? `Show Top ${DEFAULT_RESULT_LIMIT}`
      : `Show all ${sortedMembers.length}`;
  } else {
    els.showMore.classList.add("is-hidden");
  }

  els.btnUndoResult.disabled = historyStack.length === 0;
  els.tweetButton.href = buildShareUrl(sortedMembers);
  switchScreen("result");
  window.scrollTo({ top: 0, behavior: reduceMotion?.matches ? "auto" : "smooth" });
}

function restartSameSelection() {
  if (selectedMembers.length < 2) return;
  clearSession();
  startNewSort(selectedMembers);
}

function returnToSelection({ confirmLoss = false } = {}) {
  if (confirmLoss && sorter && !sorter.isComplete()) {
    const shouldLeave = window.confirm("Leave this sort? Your current progress will be discarded.");
    if (!shouldLeave) return;
  }

  sorter = null;
  selectedMembers = [];
  historyStack = [];
  showingAllResults = false;
  isAnimating = false;
  clearSession();
  switchScreen("selection");
  updateResumePanel();
  els.search.focus({ preventScroll: true });
}

function truncateCanvasText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
}

async function downloadRankingImage() {
  if (!sorter?.isComplete()) return;

  const sortedMembers = sorter.getSortedMembers().slice(0, DEFAULT_RESULT_LIMIT);
  if (document.fonts?.ready) await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const isDark = document.body.classList.contains("dark-mode");
  const bg = isDark ? "#11131a" : "#fff7ff";
  const panel = isDark ? "#1d202b" : "#ffffff";
  const text = isDark ? "#f7f3fa" : "#29222d";
  const muted = isDark ? "#b9adbd" : "#756b78";
  const accent = "#d94fe2";

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = accent;
  ctx.font = "800 64px Nunito, Arial, sans-serif";
  ctx.fillText("WAV Sorter", 70, 105);

  ctx.fillStyle = text;
  ctx.font = "800 42px Nunito, Arial, sans-serif";
  ctx.fillText(`My Top ${sortedMembers.length}`, 70, 165);

  ctx.fillStyle = muted;
  ctx.font = "600 24px Nunito, Arial, sans-serif";
  ctx.fillText("Text-only ranking · no avatars or profile images", 70, 210);

  const columns = 2;
  const rowsPerColumn = Math.ceil(sortedMembers.length / columns);
  const columnWidth = 520;
  const startX = 70;
  const startY = 275;
  const rowHeight = 61;

  sortedMembers.forEach((name, index) => {
    const column = Math.floor(index / rowsPerColumn);
    const row = index % rowsPerColumn;
    const x = startX + column * (columnWidth + 20);
    const y = startY + row * rowHeight;

    ctx.fillStyle = panel;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, columnWidth, 46, 14);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, columnWidth, 46);
    }

    ctx.fillStyle = accent;
    ctx.font = "800 24px Nunito, Arial, sans-serif";
    ctx.fillText(String(index + 1).padStart(2, "0"), x + 18, y + 31);

    ctx.fillStyle = text;
    ctx.font = "700 22px Nunito, Arial, sans-serif";
    const clipped = truncateCanvasText(ctx, name, columnWidth - 85);
    ctx.fillText(clipped, x + 65, y + 31);
  });

  ctx.fillStyle = muted;
  ctx.font = "600 21px Nunito, Arial, sans-serif";
  ctx.fillText("hxakaxinyufan.github.io/wavsorter/", 70, 1300);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `wav-sorter-top-${sortedMembers.length}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function handleKeyboard(event) {
  if (els.pageSorter.classList.contains("is-hidden") || isAnimating) return;

  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "z") {
    event.preventDefault();
    undoLastChoice();
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    handleSort("A");
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    handleSort("B");
  }
}

function bindEvents() {
  els.darkModeBtn.addEventListener("click", () => {
    setTheme(!document.body.classList.contains("dark-mode"));
  });

  els.musicToggle.addEventListener("click", toggleMusic);
  els.bgMusic.addEventListener("ended", async () => {
    if (!playlist.length) return;
    currentSongIndex++;
    if (currentSongIndex >= playlist.length) {
      playlist = shuffle(PLAYLIST);
      currentSongIndex = 0;
    }
    setMusicTrack(currentSongIndex);
    await startMusic();
  });

  els.checkboxContainer.addEventListener("change", (event) => {
    if (!event.target.classList.contains("member-checkbox")) return;
    saveSelection();
    refreshSelectionUI();
  });

  els.search.addEventListener("input", filterCheckboxes);
  els.btnSelectAll.addEventListener("click", () => setEveryCheckbox(true));
  els.btnClearAll.addEventListener("click", () => setEveryCheckbox(false));
  els.btnResetSelection.addEventListener("click", () => {
    safeRemove(STORAGE.selection);
    setEveryCheckbox(true);
  });

  els.btnStartSort.addEventListener("click", () => {
    const members = getSelectedFromUI();
    if (members.length < 2) return;
    startNewSort(members);
  });

  els.btnResumeSort.addEventListener("click", resumeSort);
  els.btnDiscardSort.addEventListener("click", () => {
    clearSession();
    updateResumePanel();
  });

  els.optionA.addEventListener("click", () => handleSort("A"));
  els.optionB.addEventListener("click", () => handleSort("B"));
  els.undoBtn.addEventListener("click", () => undoLastChoice());
  els.btnExitSort.addEventListener("click", () => returnToSelection({ confirmLoss: true }));

  els.showMore.addEventListener("click", () => {
    showingAllResults = !showingAllResults;
    showResult();
  });
  els.btnUndoResult.addEventListener("click", () => undoLastChoice({ fromResults: true }));
  els.downloadResult.addEventListener("click", downloadRankingImage);
  els.btnReplay.addEventListener("click", restartSameSelection);
  els.btnChangeSelection.addEventListener("click", () => returnToSelection());

  document.addEventListener("keydown", handleKeyboard);
}

function init() {
  cacheElements();
  initTheme();
  populateCheckboxes();
  bindEvents();
  updateResumePanel();
  switchScreen("selection");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
