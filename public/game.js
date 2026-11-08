/* ═══════════════════════════════════════════════
   Diana's Sudoku - Game Logic (game.js)
   PWA Ready | Dark & Light Mode
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
      metaColor.content = theme === 'dark' ? '#0f1117' : '#f0f2f8';
    }
  },

  toggle() {
    this.apply(this.current === 'dark' ? 'light' : 'dark');
  }
};

// ─── AUDIO ENGINE ────────────────────────────────────────────────────────────
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
    const { type = 'square', freq = 440, freq2 = null, duration = 0.15,
            gain = 0.18, gainEnd = 0, delay = 0, detune = 0 } = opts;

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
    gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(gainEnd, 0.001), ctx.currentTime + delay + duration
    );

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.02);
  } catch (e) {/* silently ignore */ }
}

const SFX = {
  select: () => {
    playTone({ type: 'square', freq: 440, duration: 0.08, gain: 0.15 });
    playTone({ type: 'square', freq: 660, duration: 0.08, gain: 0.12, delay: 0.07 });
  },
  back: () => {
    playTone({ type: 'square', freq: 330, duration: 0.08, gain: 0.12 });
    playTone({ type: 'square', freq: 220, duration: 0.1, gain: 0.1, delay: 0.07 });
  },
  click: () => {
    playTone({ type: 'square', freq: 520, duration: 0.06, gain: 0.12 });
  },
  correct: () => {
    // Satisfying ascending chime
    playTone({ type: 'square', freq: 523, duration: 0.1, gain: 0.18 });
    playTone({ type: 'square', freq: 659, duration: 0.1, gain: 0.15, delay: 0.1 });
    playTone({ type: 'square', freq: 784, duration: 0.12, gain: 0.12, delay: 0.2 });
  },
  error: () => {
    // Unsatisfying buzz
    playTone({ type: 'sawtooth', freq: 220, freq2: 110, duration: 0.25, gain: 0.2 });
    playTone({ type: 'sawtooth', freq: 180, duration: 0.15, gain: 0.15, delay: 0.15 });
  },
  hint: () => {
    playTone({ type: 'triangle', freq: 880, duration: 0.08, gain: 0.15 });
    playTone({ type: 'triangle', freq: 1109, duration: 0.1, gain: 0.12, delay: 0.09 });
    playTone({ type: 'triangle', freq: 1319, duration: 0.12, gain: 0.1, delay: 0.18 });
  },
  lineComplete: () => {
    // Short fanfare
    [0, 0.07, 0.14, 0.21].forEach((d, i) => {
      playTone({ type: 'square', freq: [523, 659, 784, 1047][i], duration: 0.1, gain: 0.14, delay: d });
    });
  },
  victory: () => {
    const melody = [523, 659, 784, 1047, 784, 1047, 1319];
    melody.forEach((f, i) => {
      playTone({ type: 'square', freq: f, duration: 0.14, gain: 0.15, delay: i * 0.13 });
    });
  },
  gameOver: () => {
    [440, 370, 311, 220].forEach((f, i) => {
      playTone({ type: 'sawtooth', freq: f, duration: 0.22, gain: 0.2, delay: i * 0.2 });
    });
  },
  undo: () => {
    playTone({ type: 'triangle', freq: 660, freq2: 440, duration: 0.15, gain: 0.13 });
  },
  pause: () => {
    playTone({ type: 'square', freq: 440, duration: 0.07, gain: 0.12 });
    playTone({ type: 'square', freq: 440, duration: 0.07, gain: 0.12, delay: 0.1 });
  },
  erase: () => {
    playTone({ type: 'square', freq: 200, duration: 0.08, gain: 0.1 });
  },
  boxComplete: () => {
    [659, 784, 880, 1047, 880, 1047].forEach((f, i) => {
      playTone({ type: 'square', freq: f, duration: 0.1, gain: 0.13, delay: i * 0.09 });
    });
  },
};

// ─── STATE ────────────────────────────────────────────────────────────────────
const STATE = {
  difficulty: 'medium',
  puzzle: null,        // 9x9 array (0 = empty)
  solution: null,      // 9x9 answer
  board: null,         // player's current board
  given: null,         // bool matrix of pre-filled cells
  notes: null,         // 9x9 matrix of candidate number arrays
  notesMode: false,    // whether pencil/notes mode is active
  selected: null,      // { row, col }
  selectedValue: 0,    // value of selected cell (for same-number highlight)
  errors: 0,
  hintsLeft: 2,
  hintsUsed: 0,
  history: [],         // stack of actions
  timerSeconds: 0,
  timerInterval: null,
  paused: false,
  gameActive: false,
};

function createEmptyNotes() {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
}

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
    notes: STATE.notes,
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
    STATE.notes = save.notes || createEmptyNotes();
    STATE.notesMode = false;
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
      el.classList.toggle('lost', i < STATE.errors);
      el.style.animation = '';
    });
    ['hint1','hint2'].forEach((id, i) => {
      const el = document.getElementById(id);
      el.classList.toggle('used', i < STATE.hintsUsed);
    });
    document.getElementById('hints-left').textContent = STATE.hintsLeft;
    document.getElementById('btn-hint').disabled = STATE.hintsLeft <= 0;
    document.getElementById('game-diff-badge').textContent = diffLabel(STATE.difficulty);
    updateNotesUI();

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

// ─── SUDOKU GENERATOR (client-side fallback) ──────────────────────────────────
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

  if (bestRow === -1) return 1; // Fully solved

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
      // Persist elapsed time periodically so a killed web app loses at most a few seconds.
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
  document.getElementById('timer-display').textContent = formatTime(STATE.timerSeconds);
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
    cell.classList.remove('wrong-val');
    const cellNotes = (STATE.notes && STATE.notes[r] && STATE.notes[r][c]) ? STATE.notes[r][c] : [];
    if (cellNotes.length > 0) {
      const selVal = STATE.selectedValue;
      let html = '<div class="cell-notes">';
      for (let n = 1; n <= 9; n++) {
        const has = cellNotes.includes(n);
        const sameClass = (has && selVal > 0 && selVal === n) ? ' note-same' : '';
        html += `<span class="note-num${sameClass}">${has ? n : ''}</span>`;
      }
      html += '</div>';
      cell.innerHTML = html;
    } else {
      cell.textContent = '';
    }
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

// ─── SELECTION & HIGHLIGHTS ──────────────────────────────────────────────────
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
      // Clear all highlight classes first
      cell.classList.remove('selected', 'highlight-row', 'highlight-col', 'highlight-box', 'highlight-same');

      // Update candidate note highlights if cell is empty with notes
      if (STATE.board[r][c] === 0 && STATE.notes && STATE.notes[r][c].length > 0) {
        renderCellContent(r, c);
      }

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
        // Same number takes priority over axis highlights
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

// ─── NOTES MODE ───────────────────────────────────────────────────────────────
function updateNotesUI() {
  const btn = document.getElementById('btn-notes');
  const label = document.getElementById('notes-state');
  if (btn && label) {
    btn.classList.toggle('active', STATE.notesMode);
    label.textContent = STATE.notesMode ? 'ON' : 'OFF';
  }
}

function toggleNotesMode() {
  if (!STATE.gameActive || STATE.paused) return;
  STATE.notesMode = !STATE.notesMode;
  updateNotesUI();
}

function prunePeerNotes(row, col, num) {
  const removed = [];
  const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (r === row && c === col) continue;
      const inPeer = r === row || c === col || (r >= br && r < br + 3 && c >= bc && c < bc + 3);
      if (inPeer && STATE.notes[r][c].includes(num)) {
        STATE.notes[r][c] = STATE.notes[r][c].filter(n => n !== num);
        removed.push({ r, c, num });
        renderCellContent(r, c);
      }
    }
  }
  return removed;
}

// ─── NUMBER INPUT ─────────────────────────────────────────────────────────────
function inputNumber(num) {
  applyNumber(num);
  saveGame(); // autosave after every move (no-op once the game has ended)
}

function applyNumber(num) {
  if (!STATE.gameActive || STATE.paused) return;
  if (!STATE.selected) return;
  const { row, col } = STATE.selected;
  if (STATE.given[row][col]) return;

  const prev = STATE.board[row][col];
  const prevNotes = [...STATE.notes[row][col]];

  if (num === 0) {
    // Erase value or notes
    if (prev !== 0) {
      STATE.history.push({ type: 'val', row, col, prev, next: 0, prevNotes, removedPeerNotes: [] });
      STATE.board[row][col] = 0;
      STATE.selectedValue = 0;
      renderCellContent(row, col);
      updateHighlights();
      updateNumberExhaustion();
    } else if (prevNotes.length > 0) {
      STATE.history.push({ type: 'note', row, col, prevNotes });
      STATE.notes[row][col] = [];
      renderCellContent(row, col);
      updateHighlights();
    }
    return;
  }

  // Notes mode: toggle candidate note on empty cell
  if (STATE.notesMode) {
    if (prev !== 0) return; // only annotate empty cells
    STATE.history.push({ type: 'note', row, col, prevNotes });
    if (STATE.notes[row][col].includes(num)) {
      STATE.notes[row][col] = STATE.notes[row][col].filter(n => n !== num);
    } else {
      STATE.notes[row][col].push(num);
      STATE.notes[row][col].sort((a, b) => a - b);
    }
    renderCellContent(row, col);
    updateHighlights();
    return;
  }

  if (prev === num) return; // same value, no-op

  STATE.board[row][col] = num;
  STATE.notes[row][col] = [];
  STATE.selectedValue = num;
  const cell = getCell(row, col);

  const isCorrect = STATE.solution[row][col] === num;
  const removedPeerNotes = isCorrect ? prunePeerNotes(row, col, num) : [];

  STATE.history.push({
    type: 'val',
    row,
    col,
    prev,
    next: num,
    prevNotes,
    removedPeerNotes
  });

  renderCellContent(row, col);

  if (isCorrect) {
    cell.classList.add('correct-anim');
    SFX.correct();
    // Check victory right away (not after the animation) so the game ends
    // immediately and later inputs can't trigger a second victory.
    checkVictory();
    setTimeout(() => {
      if (cell) cell.classList.remove('correct-anim');
      updateHighlights();
      checkCompletions(row, col);
    }, 500);
  } else {
    cell.classList.add('error-anim');
    SFX.error();
    registerError(row, col);
    setTimeout(() => {
      if (cell) cell.classList.remove('error-anim');
      updateHighlights();
    }, 500);
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
    heart.classList.add('lost');
    // shake animation
    heart.style.animation = 'errorShake 0.4s ease-out';
    setTimeout(() => { heart.style.animation = ''; }, 400);
  }

  if (STATE.errors >= 3) {
    // End the game now so extra taps during the delay can't add errors
    // or trigger Game Over twice.
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
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++)
      if (STATE.board[r][c] !== STATE.solution[r][c]) { boxComplete = false; break; }

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
      setTimeout(() => cell.classList.remove('flash-complete'), 400);
    }, i * 40);
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
        setTimeout(() => cell.classList.remove('flash-complete'), 400);
      }, delay);
      delay += 30;
    }
  }
}

// ─── NUMBER EXHAUSTION ────────────────────────────────────────────────────────
function updateNumberExhaustion() {
  const counts = Array(10).fill(0);
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (STATE.board[r][c] > 0 && STATE.board[r][c] === STATE.solution[r][c]) {
        counts[STATE.board[r][c]]++;
      }

  document.querySelectorAll('.num-btn').forEach(btn => {
    const n = parseInt(btn.dataset.num);
    if (n > 0) {
      btn.classList.toggle('exhausted', counts[n] >= 9);
    }
  });
}

// ─── HINT ─────────────────────────────────────────────────────────────────────
function useHint() {
  if (!STATE.gameActive || STATE.paused) return;
  if (STATE.hintsLeft <= 0) return;

  // Pick the selected cell if it needs solving, otherwise a random empty/wrong cell
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
  const prevNotes = [...STATE.notes[row][col]];
  const correctVal = STATE.solution[row][col];

  STATE.board[row][col] = correctVal;
  STATE.notes[row][col] = [];
  const removedPeerNotes = prunePeerNotes(row, col, correctVal);

  STATE.history.push({
    type: 'val',
    row,
    col,
    prev,
    next: correctVal,
    prevNotes,
    removedPeerNotes,
    isHint: true
  });

  renderCellContent(row, col);
  const cell = getCell(row, col);
  cell.classList.add('hint-cell');
  setTimeout(() => cell.classList.remove('hint-cell'), 1000);

  STATE.hintsLeft--;
  STATE.hintsUsed++;
  document.getElementById('hints-left').textContent = STATE.hintsLeft;

  // Mark hint icon as used
  const hintIds = ['hint1', 'hint2'];
  const usedIdx = 1 - STATE.hintsLeft; // 0 or 1
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

  if (last.type === 'note') {
    STATE.notes[last.row][last.col] = [...last.prevNotes];
    renderCellContent(last.row, last.col);
    SFX.undo();
    selectCell(last.row, last.col);
    saveGame();
    return;
  }

  STATE.board[last.row][last.col] = last.prev;
  if (last.prevNotes) {
    STATE.notes[last.row][last.col] = [...last.prevNotes];
  }
  if (last.removedPeerNotes && last.removedPeerNotes.length > 0) {
    for (const item of last.removedPeerNotes) {
      if (!STATE.notes[item.r][item.c].includes(item.num)) {
        STATE.notes[item.r][item.c].push(item.num);
        STATE.notes[item.r][item.c].sort((a, b) => a - b);
        renderCellContent(item.r, item.c);
      }
    }
  }
  renderCellContent(last.row, last.col);
  SFX.undo();
  selectCell(last.row, last.col);
  updateNumberExhaustion();
  saveGame();
}

// ─── VICTORY / GAME OVER ─────────────────────────────────────────────────────
function checkVictory() {
  if (!STATE.gameActive) return false; // already won/lost: never fire twice
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (STATE.board[r][c] !== STATE.solution[r][c]) return false;

  // All cells correct!
  stopTimer();
  STATE.gameActive = false;
  clearSavedGame();

  setTimeout(() => {
    triggerVictory();
  }, 600);
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
    tbody.innerHTML = '<tr><td colspan="5" class="no-scores">Sin partidas aún</td></tr>';
    return;
  }
  tbody.innerHTML = scores.map((s, i) =>
    `<tr>
      <td>${i + 1}</td>
      <td>${s.difficulty}</td>
      <td>${s.time}</td>
      <td>${s.errors}</td>
      <td class="score-pts">${s.score ?? 0}</td>
    </tr>`
  ).join('');
}

// ─── START GAME ───────────────────────────────────────────────────────────────
function startGame(difficulty = STATE.difficulty) {
  STATE.difficulty = difficulty;

  // Clear any saved game when starting fresh
  clearSavedGame();
  updateContinueButton();

  // Generate puzzle client-side (immediate, no server needed)
  const { puzzle, solution } = generatePuzzle(difficulty);
  STATE.puzzle = puzzle;
  STATE.solution = solution;
  STATE.board = puzzle.map(r => [...r]);
  STATE.given = puzzle.map(r => r.map(v => v !== 0));
  STATE.notes = createEmptyNotes();
  STATE.notesMode = false;
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
    el.classList.remove('lost');
    el.style.animation = '';
  });
  ['hint1','hint2'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('used');
  });
  document.getElementById('hints-left').textContent = 2;
  document.getElementById('btn-hint').disabled = false;
  document.getElementById('game-diff-badge').textContent = diffLabel(difficulty);
  updateNotesUI();

  hideOverlays();
  buildGrid();
  renderBoard();
  showScreen('screen-game');
  startTimer();
  updateTimerDisplay();
  saveGame(); // a brand-new puzzle is recoverable even before the first move
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
  } else if ((e.key === 'n' || e.key === 'N') && STATE.gameActive && !STATE.paused) {
    e.preventDefault();
    SFX.click();
    toggleNotesMode();
  }
});

// ─── PAUSE ────────────────────────────────────────────────────────────────────
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

// ─── BACKGROUND HANDLING (iPhone web app) ─────────────────────────────────────
// When Diana switches apps or locks the phone: stop the clock and save,
// because iOS may kill the web app while it is in the background.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && STATE.gameActive && !STATE.paused) {
    pauseGame({ silent: true });
  }
});
window.addEventListener('pagehide', () => saveGame());

// ─── DIFFICULTY INFO ──────────────────────────────────────────────────────────
const diffInfoText = {
  easy: '36 celdas vacías • 2 pistas disponibles',
  medium: '46 celdas vacías • 2 pistas disponibles',
  hard: '56 celdas vacías • 2 pistas disponibles',
};

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────
function attachSoundToBtn(btn) {
  const sound = btn.dataset.sound;
  if (sound && SFX[sound]) btn.addEventListener('click', SFX[sound]);
}

document.addEventListener('DOMContentLoaded', () => {

  // ── Theme init & toggle
  THEME.init();
  document.getElementById('btn-theme').addEventListener('click', () => {
    THEME.toggle();
  });

  // Attach sounds to all buttons
  document.querySelectorAll('[data-sound]').forEach(attachSoundToBtn);

  // ── Check for saved game on load
  updateContinueButton();

  // ── Menu buttons
  document.getElementById('btn-continue').addEventListener('click', () => {
    loadSavedGame();
  });

  document.getElementById('btn-start').addEventListener('click', () => {
    startGame(STATE.difficulty);
  });

  document.getElementById('btn-difficulty').addEventListener('click', () => {
    showScreen('screen-difficulty');
    const diffBtns = document.querySelectorAll('.diff-btn');
    diffBtns.forEach(b => b.classList.toggle('active-diff', b.dataset.diff === STATE.difficulty));
    document.getElementById('diff-info-text').textContent = diffInfoText[STATE.difficulty];
  });

  document.getElementById('btn-scores').addEventListener('click', () => {
    renderScores();
    showScreen('screen-scores');
  });

  document.getElementById('btn-exit').addEventListener('click', () => {
    SFX.back();
    setTimeout(() => {
      window.close();
      // Fallback: show message
      alert('Cierra esta ventana para salir.');
    }, 200);
  });

  // ── Difficulty buttons
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      STATE.difficulty = btn.dataset.diff;
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active-diff'));
      btn.classList.add('active-diff');
      document.getElementById('diff-info-text').textContent = diffInfoText[btn.dataset.diff];
      document.getElementById('diff-display').textContent = diffLabel(btn.dataset.diff);
    });
  });

  document.getElementById('btn-diff-back').addEventListener('click', () => {
    showScreen('screen-menu');
  });

  document.getElementById('btn-scores-back').addEventListener('click', () => {
    showScreen('screen-menu');
  });

  // ── Game buttons
  document.getElementById('btn-pause').addEventListener('click', () => {
    pauseGame();
  });

  document.getElementById('btn-undo').addEventListener('click', () => {
    undoAction();
  });

  document.getElementById('btn-notes').addEventListener('click', () => {
    toggleNotesMode();
  });

  document.getElementById('btn-hint').addEventListener('click', () => {
    useHint();
  });

  // ── Number panel
  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.num);
      if (n === 0) { SFX.erase(); }
      else { SFX.click(); }
      inputNumber(n);
    });
  });

  // ── Pause overlay
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

  // ── Victory overlay
  document.getElementById('btn-play-again').addEventListener('click', () => {
    startGame(STATE.difficulty);
  });

  document.getElementById('btn-menu-victory').addEventListener('click', () => {
    stopTimer();
    hideOverlays();
    showScreen('screen-menu');
  });

  // ── Game Over overlay
  document.getElementById('btn-retry').addEventListener('click', () => {
    startGame(STATE.difficulty);
  });

  document.getElementById('btn-menu-gameover').addEventListener('click', () => {
    stopTimer();
    hideOverlays();
    showScreen('screen-menu');
  });

  // ── Initialize display
  document.getElementById('diff-display').textContent = diffLabel(STATE.difficulty);
  showVersion();
});

// ─── VERSION ──────────────────────────────────────────────────────────────────
// APP_VERSION / APP_BUILD_DATE come from version.js (generated from package.json).
function showVersion() {
  const version = self.APP_VERSION || '?';
  const date = self.APP_BUILD_DATE || '';
  const badge = document.getElementById('version-badge');
  if (badge) {
    badge.textContent = `VERSIÓN ${version}`;
    badge.title = date ? `Publicada el ${date}` : '';
  }
  const pause = document.getElementById('pause-version');
  if (pause) pause.textContent = `Diana's Sudoku v${version}${date ? ' • ' + date : ''}`;
  console.info(`Diana's Sudoku v${version} (${date})`);
}
