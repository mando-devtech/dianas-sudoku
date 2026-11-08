/* ═══════════════════════════════════════════════
   Diana's Sudoku - Modern Zen Game Logic (game.js)
   PWA Ready | Dark & Light Mode | High-Performance UX
   ═══════════════════════════════════════════════ */

'use strict';

// ─── PWA: Service Worker Registration ────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => reg.update())
      .catch(() => {});
  });
}

// ─── THEME MANAGER ────────────────────────────────────────────────────────────
const THEME = {
  key: 'sudoku_theme',
  current: 'dark',

  init() {
    const saved = localStorage.getItem(this.key) || 'dark';
    this.apply(saved);
  },

  apply(theme) {
    this.current = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.key, theme);

    // Update theme icon
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '💡' : '🌙';

    // Update meta theme-color for browser chrome
    const metaColor = document.getElementById('meta-theme-color');
    if (metaColor) {
      metaColor.content = theme === 'dark' ? '#12151e' : '#f8fafc';
    }
  },

  toggle() {
    this.apply(this.current === 'dark' ? 'light' : 'dark');
  }
};

// ─── AUDIO ENGINE (Warm Zen Soundscapes) ──────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(opts = {}) {
  try {
    const ctx = getAudioCtx();
    const { type = 'sine', freq = 440, freq2 = null, duration = 0.15,
            gain = 0.16, gainEnd = 0, delay = 0, detune = 0 } = opts;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    if (freq2 !== null) {
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      osc.frequency.linearRampToValueAtTime(freq2, ctx.currentTime + delay + duration);
    }

    gainNode.gain.setValueAtTime(0.001, ctx.currentTime + delay);
    gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(gainEnd, 0.001), ctx.currentTime + delay + duration
    );

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.03);
  } catch (e) { /* ignore audio errors */ }
}

const SFX = {
  select: () => {
    playTone({ type: 'sine', freq: 480, duration: 0.08, gain: 0.14 });
    playTone({ type: 'triangle', freq: 640, duration: 0.1, gain: 0.12, delay: 0.06 });
  },
  back: () => {
    playTone({ type: 'triangle', freq: 360, duration: 0.08, gain: 0.12 });
    playTone({ type: 'sine', freq: 260, duration: 0.1, gain: 0.1, delay: 0.06 });
  },
  click: () => {
    playTone({ type: 'sine', freq: 520, duration: 0.05, gain: 0.1 });
  },
  correct: () => {
    // Gentle melodic triad
    playTone({ type: 'sine', freq: 523.25, duration: 0.12, gain: 0.16 });        // C5
    playTone({ type: 'sine', freq: 659.25, duration: 0.14, gain: 0.14, delay: 0.08 }); // E5
    playTone({ type: 'triangle', freq: 783.99, duration: 0.18, gain: 0.12, delay: 0.16 }); // G5
  },
  error: () => {
    // Soft low chime (non-punitive)
    playTone({ type: 'triangle', freq: 240, freq2: 180, duration: 0.22, gain: 0.18 });
  },
  hint: () => {
    playTone({ type: 'sine', freq: 659.25, duration: 0.1, gain: 0.14 });
    playTone({ type: 'sine', freq: 880, duration: 0.12, gain: 0.12, delay: 0.08 });
    playTone({ type: 'triangle', freq: 1046.5, duration: 0.16, gain: 0.1, delay: 0.16 });
  },
  lineComplete: () => {
    // Zen breeze completion chord
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      playTone({ type: 'sine', freq: f, duration: 0.18, gain: 0.12, delay: i * 0.06 });
    });
  },
  victory: () => {
    const melody = [523.25, 659.25, 783.99, 880, 1046.5, 1318.5];
    melody.forEach((f, i) => {
      playTone({ type: 'sine', freq: f, duration: 0.2, gain: 0.15, delay: i * 0.11 });
    });
  },
  gameOver: () => {
    [392, 349.23, 311.13, 261.63].forEach((f, i) => {
      playTone({ type: 'triangle', freq: f, duration: 0.25, gain: 0.16, delay: i * 0.16 });
    });
  },
  undo: () => {
    playTone({ type: 'sine', freq: 587.33, freq2: 440, duration: 0.12, gain: 0.12 });
  },
  pause: () => {
    playTone({ type: 'sine', freq: 440, duration: 0.06, gain: 0.12 });
    playTone({ type: 'sine', freq: 440, duration: 0.06, gain: 0.12, delay: 0.08 });
  },
  erase: () => {
    playTone({ type: 'triangle', freq: 260, duration: 0.08, gain: 0.1 });
  },
  boxComplete: () => {
    [659.25, 783.99, 987.77, 1318.51].forEach((f, i) => {
      playTone({ type: 'sine', freq: f, duration: 0.16, gain: 0.13, delay: i * 0.08 });
    });
  },
};

// ─── STATE ────────────────────────────────────────────────────────────────────
const STATE = {
  difficulty: 'medium',
  puzzle: null,        // 9x9 array (0 = empty)
  solution: null,      // 9x9 solution
  board: null,         // player's current board
  given: null,         // bool matrix of pre-filled cells
  selected: null,      // { row, col }
  selectedValue: 0,    // value of selected cell (for Spotlight highlight)
  errors: 0,
  hintsLeft: 2,
  hintsUsed: 0,
  history: [],         // stack of moves
  timerSeconds: 0,
  timerInterval: null,
  paused: false,
  gameActive: false,
};

// ─── SAVED GAME ───────────────────────────────────────────────────────────────
const SAVE_KEY = 'sudoku_saved_game';

function saveGame() {
  if (!STATE.gameActive) return;
  const save = {
    difficulty: STATE.difficulty,
    puzzle: STATE.puzzle,
    solution: STATE.solution,
    board: STATE.board,
    given: STATE.given,
    errors: STATE.errors,
    hintsLeft: STATE.hintsLeft,
    hintsUsed: STATE.hintsUsed,
    history: STATE.history,
    timerSeconds: STATE.timerSeconds,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

function hasSavedGame() {
  return !!localStorage.getItem(SAVE_KEY);
}

function clearSavedGame() {
  localStorage.removeItem(SAVE_KEY);
}

function loadSavedGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const save = JSON.parse(raw);
    STATE.difficulty = save.difficulty;
    STATE.puzzle = save.puzzle;
    STATE.solution = save.solution;
    STATE.board = save.board;
    STATE.given = save.given;
    STATE.errors = save.errors;
    STATE.hintsLeft = save.hintsLeft;
    STATE.hintsUsed = save.hintsUsed;
    STATE.history = save.history || [];
    STATE.timerSeconds = save.timerSeconds;
    STATE.selected = null;
    STATE.selectedValue = 0;
    STATE.paused = false;
    STATE.gameActive = true;

    // Reset UI
    ['heart1','heart2','heart3'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.toggle('lost', i < STATE.errors);
        el.style.animation = '';
      }
    });
    ['hint1','hint2'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('used', i < STATE.hintsUsed);
    });
    document.getElementById('hints-left').textContent = STATE.hintsLeft;
    document.getElementById('btn-hint').disabled = STATE.hintsLeft <= 0;
    document.getElementById('game-diff-badge').textContent = diffLabel(STATE.difficulty);

    hideOverlays();
    buildGrid();
    renderBoard();
    showScreen('screen-game');
    startTimer();
    updateTimerDisplay();
    return true;
  } catch(e) {
    clearSavedGame();
    return false;
  }
}

function updateContinueButton() {
  const btn = document.getElementById('btn-continue');
  if (btn) {
    if (hasSavedGame()) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  }
}

// ─── SUDOKU GENERATOR ─────────────────────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isValid(board, row, col, num) {
  for (let c = 0; c < 9; c++) if (board[row][c] === num) return false;
  for (let r = 0; r < 9; r++) if (board[r][col] === num) return false;
  const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++)
      if (board[r][c] === num) return false;
  return true;
}

function solveSudoku(board) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        const nums = shuffle([1,2,3,4,5,6,7,8,9]);
        for (const num of nums) {
          if (isValid(board, row, col, num)) {
            board[row][col] = num;
            if (solveSudoku(board)) return true;
            board[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function countSolutions(board, limit = 2) {
  let bestRow = -1, bestCol = -1, bestCandidates = null;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        const cands = [];
        for (let n = 1; n <= 9; n++) {
          if (isValid(board, r, c, n)) cands.push(n);
        }
        if (cands.length === 0) return 0;
        if (!bestCandidates || cands.length < bestCandidates.length) {
          bestCandidates = cands;
          bestRow = r;
          bestCol = c;
          if (cands.length === 1) break;
        }
      }
    }
    if (bestCandidates && bestCandidates.length === 1) break;
  }

  if (bestRow === -1) return 1;

  let count = 0;
  for (const num of bestCandidates) {
    board[bestRow][bestCol] = num;
    count += countSolutions(board, limit - count);
    board[bestRow][bestCol] = 0;
    if (count >= limit) return count;
  }
  return count;
}

function generatePuzzle(difficulty = 'medium') {
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  solveSudoku(board);
  const solution = board.map(r => [...r]);

  const removeCounts = { easy: 36, medium: 46, hard: 56 };
  const toRemove = removeCounts[difficulty] || 46;

  const cells = shuffle([...Array(81).keys()]);
  const puzzle = board.map(r => [...r]);
  let removed = 0;
  for (const idx of cells) {
    if (removed >= toRemove) break;
    const r = Math.floor(idx / 9), c = idx % 9;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    const copy = puzzle.map(row => [...row]);
    if (countSolutions(copy, 2) !== 1) {
      puzzle[r][c] = backup;
    } else {
      removed++;
    }
  }
  return { puzzle, solution };
}

// ─── SCREEN MANAGER ──────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function showOverlay(id) {
  document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function hideOverlays() {
  document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
}

// ─── TIMER ────────────────────────────────────────────────────────────────────
function startTimer() {
  stopTimer();
  STATE.timerInterval = setInterval(() => {
    if (!STATE.paused) {
      STATE.timerSeconds++;
      updateTimerDisplay();
      if (STATE.timerSeconds % 5 === 0) saveGame();
    }
  }, 1000);
}

function stopTimer() {
  if (STATE.timerInterval) {
    clearInterval(STATE.timerInterval);
    STATE.timerInterval = null;
  }
}

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  if (display) display.textContent = formatTime(STATE.timerSeconds);
}

// ─── GRID BUILDER ─────────────────────────────────────────────────────────────
function buildGrid() {
  const grid = document.getElementById('sudoku-grid');
  grid.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.className = 'sudoku-cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('role', 'gridcell');
      cell.addEventListener('click', () => selectCell(r, c));
      cell.addEventListener('keydown', onCellKeydown);
      grid.appendChild(cell);
    }
  }
}

function getCell(r, c) {
  return document.querySelector(`.sudoku-cell[data-row="${r}"][data-col="${c}"]`);
}

function renderCellContent(r, c) {
  const cell = getCell(r, c);
  if (!cell) return;
  const val = STATE.board[r][c];
  const isGiven = STATE.given[r][c];

  cell.classList.toggle('given', isGiven);

  if (val !== 0) {
    cell.textContent = val;
    cell.classList.toggle('wrong-val', !isGiven && val !== STATE.solution[r][c]);
  } else {
    cell.textContent = '';
    cell.classList.remove('wrong-val');
  }
}

function renderBoard() {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      renderCellContent(r, c);
    }
  }
  updateHighlights();
  updateNumberExhaustion();
}

// ─── SELECTION & SPOTLIGHT HIGHLIGHTS ─────────────────────────────────────────
function selectCell(r, c) {
  if (!STATE.gameActive || STATE.paused) return;
  STATE.selected = { row: r, col: c };
  STATE.selectedValue = STATE.board[r][c];
  updateHighlights();
}

function updateHighlights() {
  const sel = STATE.selected;
  const selVal = STATE.selectedValue;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = getCell(r, c);
      if (!cell) continue;

      cell.classList.remove('selected', 'highlight-row', 'highlight-col', 'highlight-box', 'highlight-same');

      if (!sel) continue;

      const isSelected = r === sel.row && c === sel.col;
      const inSameRow   = r === sel.row && !isSelected;
      const inSameCol   = c === sel.col && !isSelected;
      const inSameBox   = !isSelected &&
        Math.floor(r / 3) === Math.floor(sel.row / 3) &&
        Math.floor(c / 3) === Math.floor(sel.col / 3);
      const isSameValue = !isSelected && selVal > 0 && STATE.board[r][c] === selVal;

      if (isSelected) {
        cell.classList.add('selected');
      } else if (isSameValue) {
        // Spotlight mode: highlight identical numbers
        cell.classList.add('highlight-same');
      } else if (inSameRow) {
        cell.classList.add('highlight-row');
      } else if (inSameCol) {
        cell.classList.add('highlight-col');
      } else if (inSameBox) {
        cell.classList.add('highlight-box');
      }
    }
  }
}

// ─── NUMBER EXHAUSTION & REMAINING COUNTERS ───────────────────────────────────
function updateNumberExhaustion() {
  const counts = Array(10).fill(0);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = STATE.board[r][c];
      if (val > 0 && val === STATE.solution[r][c]) {
        counts[val]++;
      }
    }
  }

  for (let n = 1; n <= 9; n++) {
    const placed = counts[n];
    const remaining = Math.max(0, 9 - placed);
    const countEl = document.getElementById(`count-${n}`);
    const btn = document.querySelector(`.num-btn[data-num="${n}"]`);

    if (countEl) {
      countEl.textContent = remaining === 0 ? '✓' : remaining;
    }
    if (btn) {
      btn.classList.toggle('exhausted', remaining === 0);
    }
  }
}

// ─── NUMBER INPUT ─────────────────────────────────────────────────────────────
function inputNumber(num) {
  applyNumber(num);
  saveGame();
}

function applyNumber(num) {
  if (!STATE.gameActive || STATE.paused) return;

  // If clicking number keypad with no cell selected, simply set Spotlight
  if (!STATE.selected) {
    if (num > 0) {
      STATE.selectedValue = num;
      updateHighlights();
    }
    return;
  }

  const { row, col } = STATE.selected;
  if (STATE.given[row][col]) {
    // Tapping a number while a given cell is selected focuses spotlight
    if (num > 0) {
      STATE.selectedValue = num;
      updateHighlights();
    }
    return;
  }

  const prev = STATE.board[row][col];

  // Erase cell
  if (num === 0) {
    if (prev !== 0) {
      STATE.history.push({ type: 'val', row, col, prev, next: 0 });
      STATE.board[row][col] = 0;
      STATE.selectedValue = 0;
      renderCellContent(row, col);
      updateHighlights();
      updateNumberExhaustion();
    }
    return;
  }

  // Tapping the same number: focus spotlight
  if (prev === num) {
    STATE.selectedValue = num;
    updateHighlights();
    return;
  }

  STATE.board[row][col] = num;
  STATE.selectedValue = num;
  const cell = getCell(row, col);

  const isCorrect = STATE.solution[row][col] === num;

  STATE.history.push({
    type: 'val',
    row,
    col,
    prev,
    next: num
  });

  renderCellContent(row, col);

  if (isCorrect) {
    cell.classList.add('correct-anim');
    SFX.correct();
    checkVictory();
    setTimeout(() => {
      if (cell) cell.classList.remove('correct-anim');
      updateHighlights();
      checkCompletions(row, col);
    }, 450);
  } else {
    cell.classList.add('error-anim');
    SFX.error();
    registerError(row, col);
    setTimeout(() => {
      if (cell) cell.classList.remove('error-anim');
      updateHighlights();
    }, 450);
  }

  updateHighlights();
  updateNumberExhaustion();
}

function registerError(row, col) {
  STATE.errors++;
  const hearts = ['heart1', 'heart2', 'heart3'];
  const heartIdx = STATE.errors - 1;
  if (heartIdx < 3) {
    const heart = document.getElementById(hearts[heartIdx]);
    if (heart) {
      heart.classList.add('lost');
      heart.style.animation = 'errorShake 0.4s ease-out';
      setTimeout(() => { heart.style.animation = ''; }, 400);
    }
  }

  if (STATE.errors >= 3) {
    STATE.gameActive = false;
    stopTimer();
    clearSavedGame();
    setTimeout(() => triggerGameOver(), 600);
  }
}

// ─── CHECK COMPLETIONS ────────────────────────────────────────────────────────
function checkCompletions(row, col) {
  // Check row
  const rowComplete = STATE.board[row].every((v, c) => v === STATE.solution[row][c]);
  // Check column
  const colComplete = Array.from({ length: 9 }, (_, r) => r)
    .every(r => STATE.board[r][col] === STATE.solution[r][col]);
  // Check 3x3 box
  const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
  let boxComplete = true;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      if (STATE.board[r][c] !== STATE.solution[r][c]) { boxComplete = false; break; }
    }
  }

  let completionCount = 0;
  if (rowComplete) {
    flashLine('row', row);
    completionCount++;
  }
  if (colComplete) {
    flashLine('col', col);
    completionCount++;
  }
  if (boxComplete) {
    flashBox(br, bc);
    completionCount++;
  }

  if (completionCount === 1) SFX.lineComplete();
  else if (completionCount >= 2) SFX.boxComplete();
}

function flashLine(type, idx) {
  for (let i = 0; i < 9; i++) {
    const cell = type === 'row' ? getCell(idx, i) : getCell(i, idx);
    if (!cell) continue;
    setTimeout(() => {
      cell.classList.add('flash-complete');
      setTimeout(() => cell.classList.remove('flash-complete'), 500);
    }, i * 35);
  }
}

function flashBox(br, bc) {
  let delay = 0;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      const cell = getCell(r, c);
      if (!cell) continue;
      setTimeout(() => {
        cell.classList.add('flash-complete');
        setTimeout(() => cell.classList.remove('flash-complete'), 500);
      }, delay);
      delay += 30;
    }
  }
}

// ─── HINT ─────────────────────────────────────────────────────────────────────
function useHint() {
  if (!STATE.gameActive || STATE.paused) return;
  if (STATE.hintsLeft <= 0) return;

  // Pick selected cell if it's empty or wrong, otherwise pick a random empty cell
  let target = null;
  if (
    STATE.selected &&
    !STATE.given[STATE.selected.row][STATE.selected.col] &&
    STATE.board[STATE.selected.row][STATE.selected.col] !== STATE.solution[STATE.selected.row][STATE.selected.col]
  ) {
    target = [STATE.selected.row, STATE.selected.col];
  } else {
    const candidates = [];
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (!STATE.given[r][c] && STATE.board[r][c] !== STATE.solution[r][c])
          candidates.push([r, c]);

    if (candidates.length === 0) return;
    target = candidates[Math.floor(Math.random() * candidates.length)];
  }

  const [row, col] = target;
  const prev = STATE.board[row][col];
  const correctVal = STATE.solution[row][col];

  STATE.board[row][col] = correctVal;

  STATE.history.push({
    type: 'val',
    row,
    col,
    prev,
    next: correctVal,
    isHint: true
  });

  renderCellContent(row, col);
  const cell = getCell(row, col);
  if (cell) {
    cell.classList.add('hint-cell');
    setTimeout(() => cell.classList.remove('hint-cell'), 1000);
  }

  STATE.hintsLeft--;
  STATE.hintsUsed++;
  document.getElementById('hints-left').textContent = STATE.hintsLeft;

  const hintIds = ['hint1', 'hint2'];
  const usedIdx = 1 - STATE.hintsLeft;
  const hintEl = document.getElementById(hintIds[usedIdx]);
  if (hintEl) hintEl.classList.add('used');

  if (STATE.hintsLeft <= 0) {
    document.getElementById('btn-hint').disabled = true;
  }

  SFX.hint();
  selectCell(row, col);
  updateNumberExhaustion();
  checkCompletions(row, col);
  checkVictory();
  saveGame();
}

// ─── UNDO ─────────────────────────────────────────────────────────────────────
function undoAction() {
  if (!STATE.gameActive || STATE.paused || STATE.history.length === 0) return;
  const last = STATE.history.pop();

  STATE.board[last.row][last.col] = last.prev;
  renderCellContent(last.row, last.col);
  SFX.undo();
  selectCell(last.row, last.col);
  updateNumberExhaustion();
  saveGame();
}

// ─── VICTORY / GAME OVER ─────────────────────────────────────────────────────
function checkVictory() {
  if (!STATE.gameActive) return false;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (STATE.board[r][c] !== STATE.solution[r][c]) return false;

  stopTimer();
  STATE.gameActive = false;
  clearSavedGame();

  setTimeout(() => {
    triggerVictory();
  }, 500);
  return true;
}

function calcScore() {
  const baseScore = { easy: 500, medium: 1000, hard: 2000 }[STATE.difficulty] || 1000;
  const timePenalty = Math.min(STATE.timerSeconds * 0.5, baseScore * 0.5);
  const errorPenalty = STATE.errors * 100;
  const hintPenalty = STATE.hintsUsed * 150;
  return Math.max(0, Math.floor(baseScore - timePenalty - errorPenalty - hintPenalty));
}

function triggerVictory() {
  SFX.victory();
  clearSavedGame();
  updateContinueButton();
  const score = calcScore();
  const stars = STATE.errors === 0 ? '⭐⭐⭐' : STATE.errors <= 1 ? '⭐⭐' : '⭐';

  document.getElementById('victory-stars').textContent = stars;
  document.getElementById('v-time').textContent = formatTime(STATE.timerSeconds);
  document.getElementById('v-diff').textContent = diffLabel(STATE.difficulty);
  document.getElementById('v-errors').textContent = STATE.errors;
  document.getElementById('v-hints').textContent = STATE.hintsUsed;
  document.getElementById('v-score').textContent = score;

  saveScore(score);
  showOverlay('overlay-victory');
}

function triggerGameOver() {
  SFX.gameOver();
  updateContinueButton();

  document.getElementById('go-time').textContent = formatTime(STATE.timerSeconds);
  document.getElementById('go-diff').textContent = diffLabel(STATE.difficulty);
  document.getElementById('go-errors').textContent = STATE.errors;

  showOverlay('overlay-gameover');
}

function diffLabel(d) {
  return { easy: 'FÁCIL', medium: 'MEDIO', hard: 'DIFÍCIL' }[d] || d.toUpperCase();
}

// ─── SCORES ───────────────────────────────────────────────────────────────────
function saveScore(score) {
  const scores = loadScores();
  scores.unshift({
    difficulty: diffLabel(STATE.difficulty),
    time: formatTime(STATE.timerSeconds),
    errors: STATE.errors,
    score,
    date: new Date().toLocaleDateString()
  });
  scores.sort((a, b) => b.score - a.score);
  localStorage.setItem('sudoku_scores', JSON.stringify(scores.slice(0, 10)));
}

function loadScores() {
  try {
    return JSON.parse(localStorage.getItem('sudoku_scores') || '[]');
  } catch { return []; }
}

function renderScores() {
  const scores = loadScores();
  const tbody = document.getElementById('scores-body');
  if (scores.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-scores">Sin partidas registradas</td></tr>';
    return;
  }
  tbody.innerHTML = scores.map((s, i) =>
    `<tr>
      <td>${i + 1}</td>
      <td><span class="diff-tag diff-${s.difficulty.toLowerCase()}">${s.difficulty}</span></td>
      <td>${s.time}</td>
      <td>${s.errors}</td>
      <td class="score-pts">${s.score ?? 0}</td>
    </tr>`
  ).join('');
}

// ─── START GAME ───────────────────────────────────────────────────────────────
function startGame(difficulty = STATE.difficulty) {
  STATE.difficulty = difficulty;

  clearSavedGame();
  updateContinueButton();

  const { puzzle, solution } = generatePuzzle(difficulty);
  STATE.puzzle = puzzle;
  STATE.solution = solution;
  STATE.board = puzzle.map(r => [...r]);
  STATE.given = puzzle.map(r => r.map(v => v !== 0));
  STATE.selected = null;
  STATE.selectedValue = 0;
  STATE.errors = 0;
  STATE.hintsLeft = 2;
  STATE.hintsUsed = 0;
  STATE.history = [];
  STATE.timerSeconds = 0;
  STATE.paused = false;
  STATE.gameActive = true;

  // Reset UI
  ['heart1','heart2','heart3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('lost');
      el.style.animation = '';
    }
  });
  ['hint1','hint2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('used');
  });
  document.getElementById('hints-left').textContent = 2;
  document.getElementById('btn-hint').disabled = false;
  document.getElementById('game-diff-badge').textContent = diffLabel(difficulty);

  hideOverlays();
  buildGrid();
  renderBoard();
  showScreen('screen-game');
  startTimer();
  updateTimerDisplay();
  saveGame();
}

// ─── KEYBOARD INPUT ───────────────────────────────────────────────────────────
function onCellKeydown(e) {
  if (!STATE.gameActive || STATE.paused) return;
  const { row, col } = STATE.selected || {};
  if (row === undefined) return;

  if (e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    inputNumber(parseInt(e.key));
  } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
    e.preventDefault();
    inputNumber(0);
  } else if (e.key === 'ArrowUp' && row > 0) {
    e.preventDefault(); selectCell(row - 1, col);
    getCell(row - 1, col)?.focus();
  } else if (e.key === 'ArrowDown' && row < 8) {
    e.preventDefault(); selectCell(row + 1, col);
    getCell(row + 1, col)?.focus();
  } else if (e.key === 'ArrowLeft' && col > 0) {
    e.preventDefault(); selectCell(row, col - 1);
    getCell(row, col - 1)?.focus();
  } else if (e.key === 'ArrowRight' && col < 8) {
    e.preventDefault(); selectCell(row, col + 1);
    getCell(row, col + 1)?.focus();
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const pauseOverlay = document.getElementById('overlay-pause');
    if (!pauseOverlay.classList.contains('hidden')) {
      resumeGame();
    } else if (STATE.gameActive) {
      pauseGame();
    }
  } else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    undoAction();
  }
});

// ─── PAUSE & RESUME ───────────────────────────────────────────────────────────
function pauseGame({ silent = false } = {}) {
  if (!STATE.gameActive) return;
  STATE.paused = true;
  if (!silent) SFX.pause();
  showOverlay('overlay-pause');
  saveGame();
}

function resumeGame() {
  STATE.paused = false;
  hideOverlays();
}

// ─── BACKGROUND HANDLING ──────────────────────────────────────────────────────
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && STATE.gameActive && !STATE.paused) {
    pauseGame({ silent: true });
  }
});
window.addEventListener('pagehide', () => saveGame());

// ─── DIFFICULTY METADATA ──────────────────────────────────────────────────────
const diffDescriptions = {
  easy: 'Tranquilo • 36 casillas vacías • 2 pistas',
  medium: 'Equilibrado • 46 casillas vacías • 2 pistas',
  hard: 'Desafiante • 56 casillas vacías • 2 pistas',
};

function selectDifficulty(diff) {
  STATE.difficulty = diff;
  document.querySelectorAll('.diff-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.diff === diff);
  });
  const descEl = document.getElementById('diff-desc');
  if (descEl) descEl.textContent = diffDescriptions[diff] || '';
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────
function attachSoundToBtn(btn) {
  const sound = btn.dataset.sound;
  if (sound && SFX[sound]) btn.addEventListener('click', SFX[sound]);
}

document.addEventListener('DOMContentLoaded', () => {

  // Theme init & toggle
  THEME.init();
  document.getElementById('btn-theme').addEventListener('click', () => {
    THEME.toggle();
  });

  // Attach sounds to all buttons with data-sound
  document.querySelectorAll('[data-sound]').forEach(attachSoundToBtn);

  // Check for saved game on load
  updateContinueButton();

  // Menu Difficulty Segmented Control
  document.querySelectorAll('.diff-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      selectDifficulty(chip.dataset.diff);
    });
  });

  // Menu Buttons
  document.getElementById('btn-continue').addEventListener('click', () => {
    loadSavedGame();
  });

  document.getElementById('btn-start').addEventListener('click', () => {
    startGame(STATE.difficulty);
  });

  document.getElementById('btn-scores').addEventListener('click', () => {
    renderScores();
    showScreen('screen-scores');
  });

  document.getElementById('btn-scores-back').addEventListener('click', () => {
    showScreen('screen-menu');
  });

  // In-Game Topbar Buttons
  document.getElementById('btn-game-back').addEventListener('click', () => {
    pauseGame();
  });

  document.getElementById('btn-pause').addEventListener('click', () => {
    pauseGame();
  });

  // In-Game Tool Buttons
  document.getElementById('btn-undo').addEventListener('click', () => {
    undoAction();
  });

  document.getElementById('btn-erase').addEventListener('click', () => {
    SFX.erase();
    inputNumber(0);
  });

  document.getElementById('btn-hint').addEventListener('click', () => {
    useHint();
  });

  // Number Keypad
  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.num);
      SFX.click();
      inputNumber(n);
    });
  });

  // Overlays
  document.getElementById('btn-resume').addEventListener('click', () => {
    resumeGame();
  });

  document.getElementById('btn-restart').addEventListener('click', () => {
    hideOverlays();
    startGame(STATE.difficulty);
  });

  document.getElementById('btn-menu-from-pause').addEventListener('click', () => {
    saveGame();
    stopTimer();
    STATE.gameActive = false;
    STATE.paused = false;
    hideOverlays();
    updateContinueButton();
    showScreen('screen-menu');
  });

  document.getElementById('btn-play-again').addEventListener('click', () => {
    startGame(STATE.difficulty);
  });

  document.getElementById('btn-menu-victory').addEventListener('click', () => {
    stopTimer();
    hideOverlays();
    showScreen('screen-menu');
  });

  document.getElementById('btn-retry').addEventListener('click', () => {
    startGame(STATE.difficulty);
  });

  document.getElementById('btn-menu-gameover').addEventListener('click', () => {
    stopTimer();
    hideOverlays();
    showScreen('screen-menu');
  });

  showVersion();
});

// ─── VERSION DISPLAY ──────────────────────────────────────────────────────────
function showVersion() {
  const version = self.APP_VERSION || '1.1.0';
  const date = self.APP_BUILD_DATE || '';
  const badge = document.getElementById('version-badge');
  if (badge) {
    badge.textContent = `v${version}`;
    badge.title = date ? `Actualizado: ${date}` : '';
  }
  const pause = document.getElementById('pause-version');
  if (pause) pause.textContent = `Diana's Sudoku v${version}`;
}
