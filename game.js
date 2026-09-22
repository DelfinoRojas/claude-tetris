'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - azul pálido
  '#ffb74d', // L - orange
  '#90a4ae', // Tuerca - gris acero
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Tuerca (hueco central)
];

// ---- Skins ----
// Mismos 9 índices que PIECES (0 = vacío, 8 = tuerca); solo cambia la paleta y el estilo de dibujo.
const SKINS = {
  retro: {
    colors: COLORS,
    highlight: 'rgba(255,255,255,0.12)',
    draw(context, px, py, s, color, hl) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, s - 2, s - 2);
      context.fillStyle = hl;
      context.fillRect(px + 1, py + 1, s - 2, Math.max(1, Math.round(s * 4 / 30)));
    },
  },
  neon: {
    colors: [null, '#00fff2', '#fff200', '#d400ff', '#39ff14', '#ff073a', '#2d7bff', '#ff8c00', '#c0c8d8'],
    highlight: 'rgba(255,255,255,0.25)',
    draw(context, px, py, s, color, hl) {
      context.shadowColor = color;
      context.shadowBlur = Math.max(2, s * 0.4);
      context.fillStyle = color;
      context.fillRect(px + 2, py + 2, s - 4, s - 4);
      context.shadowBlur = 0;
      context.shadowColor = 'rgba(0,0,0,0)';
      context.fillStyle = hl;
      context.fillRect(px + 2, py + 2, s - 4, Math.max(1, Math.round(s * 3 / 30)));
    },
  },
  pastel: {
    colors: [null, '#a8e6ef', '#fff1b8', '#d9b8f0', '#b8e6c1', '#f7b8b8', '#b8d4f7', '#ffd6a5', '#c9d3d8'],
    highlight: 'rgba(255,255,255,0.35)',
    draw(context, px, py, s, color, hl) {
      context.fillStyle = color;
      if (typeof context.roundRect === 'function') {
        const r = s * 0.28;
        context.beginPath();
        context.roundRect(px + 1, py + 1, s - 2, s - 2, r);
        context.fill();
        context.fillStyle = hl;
        context.beginPath();
        context.roundRect(px + 3, py + 3, s - 6, Math.max(2, s * 0.15), r / 2);
        context.fill();
      } else {
        context.fillRect(px + 1, py + 1, s - 2, s - 2);
        context.fillStyle = hl;
        context.fillRect(px + 1, py + 1, s - 2, Math.max(1, Math.round(s * 4 / 30)));
      }
    },
  },
  pixel: {
    colors: [null, '#29b6c5', '#e8b923', '#9c4fb8', '#4caf50', '#d84545', '#3f7fd6', '#e8862a', '#78909c'],
    highlight: 'rgba(255,255,255,0.28)',
    draw(context, px, py, s, color, hl, cx, cy) {
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      // Textura determinista: rejilla 6x6 de "píxeles" según hash de la celda (sin Math.random)
      const n = 6;
      const t = s / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          // Solo depende de la posición dentro del bloque: no parpadea al moverse la pieza
          const h = (Math.imul(Math.imul(i + 1, 73856093) ^ Math.imul(j + 1, 19349663), 2654435761) >>> 0) % 7;
          if (h === 0) context.fillStyle = 'rgba(255,255,255,0.22)';
          else if (h === 1) context.fillStyle = 'rgba(0,0,0,0.22)';
          else continue;
          context.fillRect(px + i * t, py + j * t, Math.ceil(t), Math.ceil(t));
        }
      }
      // sombra abajo/derecha y brillo arriba/izquierda
      const b = Math.max(1, Math.round(s / 15));
      context.fillStyle = 'rgba(0,0,0,0.45)';
      context.fillRect(px, py + s - b, s, b);
      context.fillRect(px + s - b, py, b, s);
      context.fillStyle = hl;
      context.fillRect(px, py, s, b);
      context.fillRect(px, py, b, s);
    },
  },
};

const SKIN_STORAGE_KEY = 'tetris-skin';

const LINE_SCORES =[0, 100, 300, 500, 800];
const NUT = 8;
const NUT_BONUS = 50;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const startScoresEl = document.getElementById('start-scores');
const overlayScoresEl = document.getElementById('overlay-scores');
const recordForm = document.getElementById('record-form');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const gameoverExtra = document.getElementById('gameover-extra');

const pauseOverlay = document.getElementById('pause-overlay');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('start-level-select');

const skinSelect = document.getElementById('skin-select');

const THEME_STORAGE_KEY = 'tetris-theme';
const START_LEVEL_KEY = 'tetris-start-level';
const MIN_LEVEL = 1;
const MAX_START_LEVEL = 10;
const SCORES_KEY = 'tetris-highscores';
const BEST_COMBO_KEY = 'tetris-best-combo';
const BEST_LINES_KEY = 'tetris-best-lines';
const MAX_SCORES = 5;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, baseLevel;
let startLevel = MIN_LEVEL; // nivel elegido en el menú de pausa; aplica a la próxima partida
let combo, maxCombo, pendingEntry, lastSavedDate;
let gridLineColor = '#22222e';
let activeSkin = SKINS.retro; // preferencia: no se resetea en init()

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = baseLevel + Math.floor(lines / 10);
    dropInterval = intervalForLevel(level);
    updateHUD();
  } else {
    combo = 0;
  }
}

function intervalForLevel(lv) {
  return Math.max(100, 1000 - (lv - 1) * 90);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (current.type === NUT) {
    score += NUT_BONUS * level;
    updateHUD();
  }
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = activeSkin;
  context.globalAlpha = alpha ?? 1;
  skin.draw(context, x * size, y * size, size, skin.colors[colorIndex], skin.highlight, x, y);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridLineColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

// ---- Records (localStorage) ----
function loadScores() {
  try {
    const data = JSON.parse(localStorage.getItem(SCORES_KEY));
    if (!Array.isArray(data)) return [];
    return data
      .filter(e => e && typeof e.score === 'number' && isFinite(e.score))
      .map(e => ({
        name: String(e.name ?? '').slice(0, 8),
        score: e.score,
        lines: Number(e.lines) || 0,
        maxCombo: Number(e.maxCombo) || 0,
        date: Number(e.date) || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SCORES);
  } catch (err) {
    return [];
  }
}

function saveScores(list) {
  try { localStorage.setItem(SCORES_KEY, JSON.stringify(list)); } catch (err) { /* sin almacenamiento */ }
}

function loadNumber(key) {
  try {
    const n = parseInt(localStorage.getItem(key), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (err) {
    return 0;
  }
}

function saveNumber(key, value) {
  try { localStorage.setItem(key, String(value)); } catch (err) { /* sin almacenamiento */ }
}

function qualifiesForTop(sc) {
  if (sc <= 0) return false;
  const list = loadScores();
  return list.length < MAX_SCORES || sc > list[list.length - 1].score;
}

// Única función de render de la tabla (pantalla de inicio y game over)
function renderScores(listEl, highlightDate) {
  const list = loadScores();
  listEl.textContent = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin records todavía';
    listEl.appendChild(li);
  } else {
    list.forEach((e, i) => {
      const li = document.createElement('li');
      if (highlightDate && e.date === highlightDate) li.classList.add('highlight');
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = `${i + 1}.`;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = e.name || '---';
      const sc = document.createElement('span');
      sc.className = 'sc';
      sc.textContent = e.score.toLocaleString();
      const ln = document.createElement('span');
      ln.className = 'ln';
      ln.textContent = `${e.lines} L`;
      li.append(rank, name, sc, ln);
      listEl.appendChild(li);
    });
  }
  const bestCombo = loadNumber(BEST_COMBO_KEY);
  const bestLines = loadNumber(BEST_LINES_KEY);
  document.querySelectorAll('.best-combo').forEach(el => { el.textContent = bestCombo; });
  document.querySelectorAll('.best-lines').forEach(el => { el.textContent = bestLines; });
}

function submitRecord() {
  if (!pendingEntry) return;
  pendingEntry.name = playerNameInput.value.trim().slice(0, 8) || 'ANON';
  const list = loadScores();
  list.push(pendingEntry);
  list.sort((a, b) => b.score - a.score);
  saveScores(list.slice(0, MAX_SCORES));
  lastSavedDate = pendingEntry.date;
  pendingEntry = null;
  recordForm.classList.add('hidden');
  overlayTitle.textContent = 'GAME OVER';
  renderScores(overlayScoresEl, lastSavedDate);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  animId = null;
  draw();

  // Records globales: se actualizan en cada game over
  if (maxCombo > loadNumber(BEST_COMBO_KEY)) saveNumber(BEST_COMBO_KEY, maxCombo);
  if (lines > loadNumber(BEST_LINES_KEY)) saveNumber(BEST_LINES_KEY, lines);

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()} · Mejor combo: ${maxCombo}`;
  gameoverExtra.classList.remove('hidden');
  if (qualifiesForTop(score)) {
    pendingEntry = { name: '', score, lines, maxCombo, date: Date.now() };
    overlayTitle.textContent = '¡NUEVO RECORD!';
    playerNameInput.value = '';
    recordForm.classList.remove('hidden');
  } else {
    recordForm.classList.add('hidden');
  }
  renderScores(overlayScoresEl, null);
  overlay.classList.remove('hidden');
  if (pendingEntry) playerNameInput.focus();
}

function hidePauseMenu() {
  pauseOverlay.classList.add('hidden');
  pauseControls.classList.add('hidden');
  controlsBtn.setAttribute('aria-expanded', 'false');
  // Evita que un Space/Enter residual vuelva a pulsar el botón enfocado
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    hidePauseMenu();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseOverlay.classList.remove('hidden');
    resumeBtn.focus();
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  if (pendingEntry) submitRecord(); // no perder un record sin guardar al reiniciar
  cancelAnimationFrame(animId);
  board = createBoard();
  score = 0;
  lines = 0;
  baseLevel = startLevel;
  level = baseLevel;
  paused = false;
  gameOver = false;
  dropInterval = intervalForLevel(level);
  dropAccum = 0;
  lastTime = performance.now();
  combo = 0;
  maxCombo = 0;
  pendingEntry = null;
  lastSavedDate = null;
  startScreen.classList.add('hidden');
  recordForm.classList.add('hidden');
  gameoverExtra.classList.add('hidden');
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  hidePauseMenu();
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!startScreen.classList.contains('hidden')) return;
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.target === skinSelect) return; // el select maneja sus propias teclas
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    if (!e.repeat) togglePause();
    return;
  }
  if (gameOver) return;
  if (paused) {
    // Menú abierto: ninguna tecla de juego pasa. El <select> conserva sus flechas.
    const inSelect = e.target === startLevelSelect;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
      if (!inSelect) e.preventDefault();
    } else if (e.code === 'Space' || e.code === 'KeyX') {
      e.preventDefault();
    }
    return;
  }
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => {
  const open = pauseControls.classList.toggle('hidden') === false;
  controlsBtn.setAttribute('aria-expanded', String(open));
});

function loadStartLevel() {
  try {
    const n = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
    if (n >= MIN_LEVEL && n <= MAX_START_LEVEL) startLevel = n;
  } catch (e) { /* localStorage no disponible */ }
  startLevelSelect.value = String(startLevel);
}

startLevelSelect.addEventListener('change', () => {
  startLevel = parseInt(startLevelSelect.value, 10) || MIN_LEVEL;
  try { localStorage.setItem(START_LEVEL_KEY, String(startLevel)); } catch (e) { /* ignorar */ }
});
loadStartLevel();

playBtn.addEventListener('click', () => { playBtn.blur(); init(); });
saveScoreBtn.addEventListener('click', () => { submitRecord(); saveScoreBtn.blur(); });
playerNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); submitRecord(); playerNameInput.blur(); }
});
resetScoresBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los records, el mejor combo y las líneas máximas?')) return;
  try {
    localStorage.removeItem(SCORES_KEY);
    localStorage.removeItem(BEST_COMBO_KEY);
    localStorage.removeItem(BEST_LINES_KEY);
  } catch (err) { /* sin almacenamiento */ }
  renderScores(startScoresEl, null);
});

function updateGridColor() {
  gridLineColor = getComputedStyle(document.body).getPropertyValue('--grid-line').trim() || gridLineColor;
}

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  themeToggleBtn.textContent = theme === 'light' ? '☀️ Claro' : '🌙 Oscuro';
  themeToggleBtn.setAttribute('aria-pressed', theme === 'light');
  updateGridColor();
}

function toggleTheme() {
  const theme = document.body.classList.contains('light') ? 'dark' : 'light';
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

themeToggleBtn.addEventListener('click', toggleTheme);
let savedTheme = null;
try { savedTheme = localStorage.getItem(THEME_STORAGE_KEY); } catch (err) { /* sin almacenamiento */ }
applyTheme(savedTheme || 'dark');

function loadSkinName() {
  try {
    const name = localStorage.getItem(SKIN_STORAGE_KEY);
    return Object.prototype.hasOwnProperty.call(SKINS, name) ? name : 'retro';
  } catch (e) {
    return 'retro';
  }
}

function applySkin(name) {
  if (!Object.prototype.hasOwnProperty.call(SKINS, name)) name = 'retro';
  activeSkin = SKINS[name];
  document.body.dataset.skin = name;
  skinSelect.value = name;
  updateGridColor();
  // Redibujar explícitamente: en pausa/game over no hay rAF, y puede que init() aún no haya corrido.
  if (board && current) draw();
  if (next) drawNext();
}

skinSelect.addEventListener('change', () => {
  try { localStorage.setItem(SKIN_STORAGE_KEY, skinSelect.value); } catch (e) { /* ignorar */ }
  applySkin(skinSelect.value);
  skinSelect.blur(); // que las flechas/Espacio sigan controlando el juego y no el select
});
applySkin(loadSkinName());

// Arranque: deja el estado mínimo, pinta el tablero vacío y muestra la pantalla de inicio (sin loop)
function bootToStartScreen() {
  cancelAnimationFrame(animId);
  animId = null;
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  maxCombo = 0;
  pendingEntry = null;
  lastSavedDate = null;
  paused = false;
  gameOver = true; // nada jugable hasta pulsar JUGAR
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  updateHUD();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  overlay.classList.add('hidden');
  renderScores(startScoresEl, null);
  startScreen.classList.remove('hidden');
}

bootToStartScreen();
