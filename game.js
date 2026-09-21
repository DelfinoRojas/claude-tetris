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
const skinSelect = document.getElementById('skin-select');

const THEME_STORAGE_KEY = 'tetris-theme';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
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
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
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

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  animId = null;
  draw();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
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
  cancelAnimationFrame(animId);
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === skinSelect) return; // el select maneja sus propias teclas
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
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
applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || 'dark');

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

init();
