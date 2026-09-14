'use strict';
// Right-handed coordinates: x right, y down, z toward the viewer.
const FACES = {
  U: { name: 'Up', axis: 1, sign: -1, color: '#f2f0e5' },
  D: { name: 'Down', axis: 1, sign: 1, color: '#f5ce4c' },
  L: { name: 'Left', axis: 0, sign: -1, color: '#f5a151' },
  R: { name: 'Right', axis: 0, sign: 1, color: '#ee6560' },
  F: { name: 'Front', axis: 2, sign: 1, color: '#60cb8b' },
  B: { name: 'Back', axis: 2, sign: -1, color: '#5a99ee' }
};
function newCube() {
  const cubies = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    if (!x && !y && !z) continue;
    const pos = [x, y, z];
    const stickers = Object.entries(FACES).filter(([, f]) => pos[f.axis] === f.sign).map(([face, f]) => {
      const normal = [0, 0, 0]; normal[f.axis] = f.sign;
      return { face, normal };
    });
    cubies.push({ pos, stickers });
  }
  return cubies;
}
function rotateVector(vector, axis, direction) {
  const result = [...vector], a = (axis + 1) % 3, b = (axis + 2) % 3;
  result[a] = -direction * vector[b]; result[b] = direction * vector[a];
  return result.map(n => n === 0 ? 0 : n);
}
function applyMove(cubies, move) {
  const face = FACES[move.face], direction = face.sign * move.dir;
  for (const cubie of cubies) if (cubie.pos[face.axis] === face.sign) {
    cubie.pos = rotateVector(cubie.pos, face.axis, direction);
    for (const sticker of cubie.stickers) sticker.normal = rotateVector(sticker.normal, face.axis, direction);
  }
}
function isSolved(cubies) {
  return Object.values(FACES).every(f => {
    const stickers = cubies.flatMap(c => c.stickers).filter(s => s.normal[f.axis] === f.sign);
    return stickers.length === 9 && stickers.every(s => s.face === stickers[0].face);
  });
}
function makeScramble(random = Math.random) {
  const moves = [], faces = Object.keys(FACES);
  for (let i = 0; i < 20; i++) {
    const choices = faces.filter(f => f !== moves.at(-1)?.face);
    moves.push({ face: choices[Math.floor(random() * choices.length)], dir: random() < .5 ? 1 : -1, source: 'scramble' });
  }
  return moves;
}
const inverse = move => ({ ...move, dir: -move.dir });
const notation = move => move.face + (move.dir === -1 ? "′" : '');
// Pure model is also available to the Node-based regression checks.
if (typeof module !== 'undefined') module.exports = { newCube, applyMove, isSolved, makeScramble, inverse, FACES };
if (typeof document !== 'undefined') initGame();
function initGame() {
  const $ = id => document.getElementById(id);
  let cubies = newCube(), history = [], busy = false, mode = 'idle', paused = false;
  let viewX = -25, viewY = -35, drag = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const controls = [];
  for (const [face, data] of Object.entries(FACES)) {
    const row = document.createElement('div'); row.className = 'face-row';
    const dot = document.createElement('span'); dot.className = 'face-dot'; dot.style.background = data.color;
    const name = document.createElement('span'); name.className = 'face-name'; name.textContent = data.name;
    row.append(dot, name);
    for (const dir of [1, -1]) {
      const button = document.createElement('button'); button.textContent = notation({ face, dir });
      button.setAttribute('aria-label', `${data.name} face ${dir === 1 ? 'clockwise' : 'counterclockwise'}`);
      button.title = `${face}${dir === -1 ? ' + Shift' : ''} · ${dir === 1 ? 'Clockwise' : 'Counterclockwise'} viewed from this face`;
      button.addEventListener('click', () => manualMove({ face, dir, source: 'player' }));
      controls.push(button); row.append(button);
    }
    $('face-controls').append(row);
  }
  function unit() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--unit')); }
  function renderCube() {
    $('cube').replaceChildren();
    const size = unit();
    for (const cubie of cubies) {
      const element = document.createElement('div'); element.className = 'cubie'; cubie.element = element;
      element.style.transform = `translate3d(${cubie.pos[0] * size}px,${cubie.pos[1] * size}px,${cubie.pos[2] * size}px)`;
      for (const f of Object.values(FACES)) {
        const sticker = cubie.stickers.find(s => s.normal[f.axis] === f.sign);
        const side = document.createElement('div'); side.className = 'sticker' + (sticker ? ' colored' : '');
        const rotation = f.axis === 0 ? `rotateY(${f.sign * 90}deg)` : f.axis === 1 ? `rotateX(${-f.sign * 90}deg)` : `rotateY(${f.sign === 1 ? 0 : 180}deg)`;
        side.style.transform = `${rotation} translateZ(${size / 2}px)`;
        if (sticker) {
          side.style.backgroundColor = FACES[sticker.face].color;
          if (cubie.stickers.length === 1) { const letter = document.createElement('span'); letter.className = 'face-letter'; letter.textContent = sticker.face; side.append(letter); }
        }
        element.append(side);
      }
      $('cube').append(element);
    }
  }
  function updateUI() {
    const solved = isSolved(cubies);
    $('status').textContent = mode === 'scrambling' ? '⤨ Scrambling' : mode === 'solving' ? (paused ? 'Ⅱ Paused' : '✧ Solving') : solved ? '● Solved' : '● In progress';
    $('status').classList.toggle('mixed', !solved || mode !== 'idle');
    $('move-count').textContent = String(history.filter(m => m.source === 'player').length).padStart(2, '0');
    const blocked = busy || mode === 'scrambling' || (mode === 'solving' && !paused);
    controls.forEach(b => b.disabled = blocked);
    $('scramble').disabled = blocked;
    $('undo').disabled = blocked || !history.length;
    $('reset').disabled = busy || mode === 'scrambling' || (mode === 'solving' && !paused);
    $('solve').disabled = mode === 'scrambling' || (mode !== 'solving' && (busy || !history.length || solved));
    $('solve').innerHTML = mode === 'solving' ? (paused ? '▶ <span>Resume</span>' : 'Ⅱ <span>Pause</span>') : '✧ <span>Solve</span>';
    $('recent-moves').replaceChildren();
    if (!history.length) { const empty = document.createElement('span'); empty.className = 'empty-history'; empty.textContent = 'A fresh start. Where will you go?'; $('recent-moves').append(empty); }
    for (const move of history.slice(-12)) { const chip = document.createElement('span'); chip.className = 'move-chip'; chip.textContent = notation(move); chip.title = move.source === 'scramble' ? 'Scramble turn' : 'Your turn'; $('recent-moves').append(chip); }
    $('history-total').textContent = `${history.length} turns`;
  }
  async function turn(move, remove = false, fast = false) {
    busy = true; updateUI();
    const face = FACES[move.face], layer = document.createElement('div'); layer.className = 'layer'; $('cube').append(layer);
    cubies.filter(c => c.pos[face.axis] === face.sign).forEach(c => layer.append(c.element));
    const duration = reducedMotion.matches ? 0 : fast ? 85 : 230;
    if (duration) {
      const animation = layer.animate([{ transform: 'rotateX(0deg)' }, { transform: `rotate${'XYZ'[face.axis]}(${90 * face.sign * move.dir}deg)` }], { duration, easing: 'cubic-bezier(.35,0,.2,1)', fill: 'forwards' });
      await animation.finished;
    }
    applyMove(cubies, move);
    if (remove) history.pop(); else history.push(move);
    renderCube(); busy = false; updateUI();
  }
  function cancelPlayback() { mode = 'idle'; paused = false; }
  async function manualMove(move) {
    if (busy || mode === 'scrambling' || (mode === 'solving' && !paused)) return;
    cancelPlayback(); await turn(move);
  }
  $('scramble').addEventListener('click', async () => {
    if (busy || mode === 'scrambling' || (mode === 'solving' && !paused)) return;
    mode = 'scrambling'; paused = false; updateUI();
    for (const move of makeScramble()) await turn(move, false, true);
    mode = 'idle'; updateUI();
  });
  async function playback() {
    while (mode === 'solving' && !paused && history.length) await turn(inverse(history.at(-1)), true);
    if (mode === 'solving' && !history.length) cancelPlayback();
    updateUI();
  }
  $('solve').addEventListener('click', () => {
    if (mode === 'solving') {
      paused = !paused; updateUI();
      if (!paused && !busy) playback();
      return;
    }
    if (busy || mode !== 'idle' || !history.length || isSolved(cubies)) return;
    mode = 'solving'; paused = false; playback();
  });
  $('undo').addEventListener('click', async () => {
    if (busy || !history.length || mode === 'scrambling' || (mode === 'solving' && !paused)) return;
    cancelPlayback(); await turn(inverse(history.at(-1)), true);
  });
  function updateView() { $('camera').style.transform = `rotateX(${viewX}deg) rotateY(${viewY}deg)`; }
  function resetView() { viewX = -25; viewY = -35; updateView(); }
  $('view-reset').addEventListener('click', resetView);
  $('reset').addEventListener('click', () => {
    if (busy || mode === 'scrambling' || (mode === 'solving' && !paused)) return;
    cancelPlayback(); cubies = newCube(); history = []; resetView(); renderCube(); updateUI();
  });
  $('viewport').addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    drag = { x: event.clientX, y: event.clientY, id: event.pointerId };
    $('viewport').setPointerCapture(event.pointerId);
  });
  $('viewport').addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    viewY += (event.clientX - drag.x) * .45; viewX -= (event.clientY - drag.y) * .45;
    viewX = Math.max(-85, Math.min(85, viewX)); drag.x = event.clientX; drag.y = event.clientY; updateView();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('viewport').addEventListener(type, () => drag = null);
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    const face = event.key.toUpperCase();
    if (!FACES[face]) return;
    event.preventDefault(); manualMove({ face, dir: event.shiftKey ? -1 : 1, source: 'player' });
  });
  window.addEventListener('resize', () => { if (!busy) renderCube(); });
  renderCube(); updateUI();
}
