// Conspyramid - battle prototype
// One screen: you (left) vs a bot (right). Grab blocks from the quarry,
// place them on your pyramid, abduct or blast the bot's exposed blocks.

// ---------- Tuning ----------
const W = 400, H = 700;          // logical screen size (portrait)
const BASE = 7;                  // pyramid base width in blocks (also max height)
const BS = 26;                   // block size in px
const GROUND = 560;              // y of the ground line
const UFO_Y = 300;               // resting height of UFOs
const QUARRY = { x: 15, y: 60, w: 370, h: 190 };
const MATCH_TIME = 150;          // seconds (2:30)
const MAX_QUARRY = 3;            // max blocks lying around at once
const SPAWN_MIN = 2.0, SPAWN_MAX = 3.5;
const BLOCK_LIFE = 10;           // seconds before a quarry block vanishes
const GOLD_CHANCE = 0.15;        // golden blocks give 2
const COLLECT_TIME = 1.4;        // beam time to grab a quarry block
const ABDUCT_TIME = 1.0;         // beam time to steal an enemy block
const ENERGY_MAX = 10, ENERGY_RATE = 1.2; // +1 energy every 1.2s
const COST = { abduct: 3, blast: 5, shield: 4 };
const SHIELD_TIME = 5;
const FONT = '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif';

// ---------- Canvas setup ----------
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let dpr = 1, scale = 1, offX = 0, offY = 0;
function resize() {
  dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  scale = Math.min(innerWidth / W, innerHeight / H);
  offX = (innerWidth - W * scale) / 2;
  offY = (innerHeight - H * scale) / 2;
}
addEventListener('resize', resize);
resize();

// ---------- Pyramid helpers ----------
function makeSide(cx, name) {
  const grid = [];
  for (let r = 0; r < BASE; r++) grid.push(new Array(BASE - r).fill(0));
  return { cx, name, grid, stash: 0, energy: 3, eTimer: 0, shieldUntil: 0,
           beam: null, ufo: { x: cx, y: UFO_Y }, blastMode: false };
}
function slotRect(p, r, i) {
  return { x: p.cx - (BASE - r) * BS / 2 + i * BS, y: GROUND - (r + 1) * BS, w: BS, h: BS };
}
function slotCenter(p, r, i) { const s = slotRect(p, r, i); return { x: s.x + BS / 2, y: s.y + BS / 2 }; }
function canPlace(p, r, i) {
  if (p.grid[r][i]) return false;
  return r === 0 || (p.grid[r - 1][i] && p.grid[r - 1][i + 1]);
}
// A block is exposed if nothing is resting on it (top or outer surface).
function isExposed(p, r, i) {
  if (!p.grid[r][i]) return false;
  if (r + 1 >= BASE) return true;
  const above = p.grid[r + 1];
  if (i - 1 >= 0 && above[i - 1]) return false;
  if (i < above.length && above[i]) return false;
  return true;
}
function forSlots(fn) { for (let r = 0; r < BASE; r++) for (let i = 0; i < BASE - r; i++) fn(r, i); }
function listSlots(p, test) { const out = []; forSlots((r, i) => { if (test(p, r, i)) out.push([r, i]); }); return out; }
function height(p) { let h = 0; forSlots((r, i) => { if (p.grid[r][i]) h = Math.max(h, r + 1); }); return h; }
function blockCount(p) { let n = 0; forSlots((r, i) => { n += p.grid[r][i]; }); return n; }
function shielded(p) { return p.shieldUntil > S.t; }

// ---------- Game state ----------
let mode = 'title';   // title | play | over
let S = null;
function newGame() {
  S = { t: 0, time: MATCH_TIME, quarry: [], spawnT: 0.5, parts: [], texts: [], zaps: [], botT: 1.5,
        you: makeSide(105, 'YOU'), bot: makeSide(295, 'BOT') };
  S.you.enemy = S.bot; S.bot.enemy = S.you;
  mode = 'play';
}

function say(x, y, text, color = '#fff') { S.texts.push({ x, y, text, color, t: 0 }); }
function puff(x, y, color, n = 10, speed = 80) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random());
    S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.6 + Math.random() * 0.4, t: 0, color });
  }
}

// ---------- Actions (shared by player and bot) ----------
function place(p, r, i) {
  p.grid[r][i] = 1; p.stash--;
  const c = slotCenter(p, r, i); puff(c.x, c.y, '#f3d38a', 6, 50);
}
function startCollect(p, q) {
  q.claimedBy = p; q.vx = q.vy = 0;
  p.beam = { kind: 'collect', q, t: 0, dur: COLLECT_TIME };
}
function startAbduct(p, r, i) {
  p.energy -= COST.abduct;
  p.beam = { kind: 'abduct', r, i, t: 0, dur: ABDUCT_TIME };
}
function blast(p, r, i) {
  const e = p.enemy; p.energy -= COST.blast; p.blastMode = false;
  const c = slotCenter(e, r, i);
  S.zaps.push({ x1: p.ufo.x, y1: p.ufo.y + 10, x2: c.x, y2: c.y, t: 0 });
  if (shielded(e)) { say(c.x, c.y - 20, 'BLOCKED!', '#8ef'); return; }
  const hits = [[r, i]];
  for (const d of [-1, 1]) { const j = i + d; if (j >= 0 && j < BASE - r && isExposed(e, r, j)) hits.push([r, j]); }
  for (const [a, b] of hits) { const s = slotCenter(e, a, b); e.grid[a][b] = 0; puff(s.x, s.y, '#ff7b3a', 14, 140); }
  say(c.x, c.y - 20, 'KABOOM!', '#ffb347');
}
function shield(p) {
  p.energy -= COST.shield; p.shieldUntil = S.t + SHIELD_TIME;
  say(p.cx, GROUND - BASE * BS - 20, 'SHIELD UP', '#8ef');
}
function beamTarget(p) {
  const b = p.beam;
  if (b.kind === 'collect') return { x: b.q.x, y: b.q.y };
  return slotCenter(p.enemy, b.r, b.i);
}
function updateBeam(p, dt) {
  const b = p.beam; if (!b) return;
  if (b.kind === 'collect' && !S.quarry.includes(b.q)) { p.beam = null; return; }
  b.t += dt;
  if (b.kind === 'collect') { // block floats up toward the UFO
    b.q.y += (p.ufo.y + 25 - b.q.y) * Math.min(1, dt * 1.5) * (b.t / b.dur);
  }
  if (b.t < b.dur) return;
  if (b.kind === 'collect') {
    const n = b.q.gold ? 2 : 1; p.stash += n;
    S.quarry.splice(S.quarry.indexOf(b.q), 1);
    if (p === S.you) say(b.q.x, b.q.y - 15, '+' + n + ' block' + (n > 1 ? 's' : ''), b.q.gold ? '#ffd700' : '#fff');
  } else {
    const e = p.enemy, c = slotCenter(e, b.r, b.i);
    if (shielded(e)) say(c.x, c.y - 20, 'BLOCKED!', '#8ef');
    else if (isExposed(e, b.r, b.i)) {
      e.grid[b.r][b.i] = 0; p.stash++;
      puff(c.x, c.y, '#7dff7a', 10, 60);
      say(c.x, c.y - 20, 'ABDUCTED!', '#7dff7a');
    }
  }
  p.beam = null;
}

// ---------- Bot brain ----------
function botThink() {
  const b = S.bot, y = S.you;
  if (b.stash > 0) {
    const slots = listSlots(b, canPlace);
    if (slots.length) {
      const minR = Math.min(...slots.map(s => s[0]));
      const opts = slots.filter(s => s[0] === minR);
      const [r, i] = opts[Math.floor(Math.random() * opts.length)];
      place(b, r, i); return;
    }
  }
  if (y.beam && y.beam.kind === 'abduct' && b.energy >= COST.shield && !shielded(b) && Math.random() < 0.5) { shield(b); return; }
  if (b.beam) return;
  const exp = listSlots(y, isExposed).sort((a, c) => c[0] - a[0]);
  if (!shielded(y) && exp.length && exp[0][0] >= 1) {
    if (b.energy >= COST.blast && Math.random() < 0.3) { blast(b, ...exp[0]); return; }
    if (b.energy >= COST.abduct && Math.random() < 0.4) { startAbduct(b, ...exp[0]); return; }
  }
  const free = S.quarry.filter(q => !q.claimedBy);
  if (free.length) startCollect(b, free[Math.floor(Math.random() * free.length)]);
}

// ---------- Update ----------
function update(dt) {
  S.t += dt;
  if (mode !== 'play') return;
  S.time -= dt;
  if (S.time <= 0) { S.time = 0; endMatch(); return; }

  S.spawnT -= dt;
  if (S.spawnT <= 0 && S.quarry.length < MAX_QUARRY) {
    S.quarry.push({ x: QUARRY.x + 30 + Math.random() * (QUARRY.w - 60), y: QUARRY.y + 40 + Math.random() * (QUARRY.h - 70),
                    vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 30,
                    gold: Math.random() < GOLD_CHANCE, life: BLOCK_LIFE, claimedBy: null });
    S.spawnT = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
  }
  for (let k = S.quarry.length - 1; k >= 0; k--) {
    const q = S.quarry[k];
    if (q.claimedBy) continue;
    q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
    if (q.x < QUARRY.x + 15 || q.x > QUARRY.x + QUARRY.w - 15) q.vx *= -1;
    if (q.y < QUARRY.y + 30 || q.y > QUARRY.y + QUARRY.h - 15) q.vy *= -1;
    if (q.life <= 0) { puff(q.x, q.y, '#c9b28a', 8, 40); S.quarry.splice(k, 1); }
  }

  for (const p of [S.you, S.bot]) {
    p.eTimer += dt;
    while (p.eTimer >= ENERGY_RATE) { p.eTimer -= ENERGY_RATE; p.energy = Math.min(ENERGY_MAX, p.energy + 1); }
    updateBeam(p, dt);
    let tx = p.cx, ty = UFO_Y;
    if (p.beam) { const t = beamTarget(p); tx = t.x; ty = Math.max(40, t.y - 55); }
    p.ufo.x += (tx - p.ufo.x) * Math.min(1, dt * 6);
    p.ufo.y += (ty - p.ufo.y) * Math.min(1, dt * 6);
  }

  S.botT -= dt;
  if (S.botT <= 0) { botThink(); S.botT = 0.9 + Math.random() * 0.7; }

  updateFx(dt);
}
function updateFx(dt) {
  for (const p of S.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; }
  S.parts = S.parts.filter(p => p.t < p.life);
  for (const t of S.texts) t.t += dt;
  S.texts = S.texts.filter(t => t.t < 1.2);
  for (const z of S.zaps) z.t += dt;
  S.zaps = S.zaps.filter(z => z.t < 0.25);
}
function endMatch() {
  mode = 'over';
  const hy = height(S.you), hb = height(S.bot), cy = blockCount(S.you), cb = blockCount(S.bot);
  S.result = hy !== hb ? (hy > hb ? 'win' : 'lose') : cy !== cb ? (cy > cb ? 'win' : 'lose') : 'draw';
  S.overAt = S.t;
}

// ---------- Input ----------
const BTN = {
  blast:  { x: 15,  y: 615, w: 180, h: 60 },
  shield: { x: 205, y: 615, w: 180, h: 60 },
};
function inRect(x, y, r, pad = 0) { return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad; }
function hitSlot(p, x, y, test) {
  let best = null;
  forSlots((r, i) => { if (test(p, r, i) && inRect(x, y, slotRect(p, r, i), 4)) best = [r, i]; });
  return best;
}
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  const x = (e.clientX - offX) / scale, y = (e.clientY - offY) / scale;
  if (mode === 'title') { newGame(); return; }
  if (mode === 'over') { if (S.t - S.overAt > 0.8) newGame(); return; }
  tap(x, y);
});
function tap(x, y) {
  const me = S.you, foe = S.bot;
  if (inRect(x, y, BTN.blast)) {
    if (me.blastMode) me.blastMode = false;
    else if (me.energy < COST.blast) say(x, y - 10, 'Need ' + COST.blast + ' energy', '#f88');
    else me.blastMode = true;
    return;
  }
  if (inRect(x, y, BTN.shield)) {
    if (shielded(me)) say(x, y - 10, 'Already shielded', '#8ef');
    else if (me.energy < COST.shield) say(x, y - 10, 'Need ' + COST.shield + ' energy', '#f88');
    else shield(me);
    return;
  }
  // enemy pyramid
  const target = hitSlot(foe, x, y, isExposed);
  if (target) {
    if (me.blastMode) { blast(me, ...target); return; }
    if (me.beam) { say(x, y - 15, 'Beam busy!', '#f88'); return; }
    if (me.energy < COST.abduct) { say(x, y - 15, 'Need ' + COST.abduct + ' energy', '#f88'); return; }
    startAbduct(me, ...target); return;
  }
  me.blastMode = false;
  // quarry blocks
  for (const q of S.quarry) {
    if (Math.hypot(q.x - x, q.y - y) < 24) {
      if (q.claimedBy === foe) { say(x, y - 15, 'Taken!', '#f88'); return; }
      if (q.claimedBy === me) return;
      if (me.beam) { say(x, y - 15, 'Beam busy!', '#f88'); return; }
      startCollect(me, q); return;
    }
  }
  // own pyramid
  const slot = hitSlot(me, x, y, canPlace);
  if (slot) {
    if (me.stash <= 0) { say(x, y - 15, 'No blocks!', '#f88'); return; }
    place(me, ...slot);
  }
}

// ---------- Drawing ----------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function text(str, x, y, size, color, align = 'center', stroke = true) {
  ctx.font = 'bold ' + size + 'px ' + FONT; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = '#2a1240'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
const STARS = Array.from({ length: 40 }, () => [Math.random() * W, Math.random() * 300, Math.random() * 1.5 + 0.5]);

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, '#2b1055'); g.addColorStop(0.6, '#a24a8a'); g.addColorStop(1, '#ffb27a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND);
  ctx.fillStyle = '#fff';
  for (const [x, y, s] of STARS) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(S ? S.t * 2 + x : x); ctx.fillRect(x, y, s, s); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#e8c27a'; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#d4a85c';
  for (let k = 0; k < 12; k++) ctx.fillRect((k * 37) % W, GROUND + 8 + (k * 13) % 30, 14, 3);
}
function drawBlock(x, y, gold, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gold ? '#ffd700' : '#d9a441';
  ctx.fillRect(x + 1, y + 1, BS - 2, BS - 2);
  ctx.fillStyle = gold ? '#fff3a0' : '#efc56f';
  ctx.fillRect(x + 3, y + 3, BS - 6, 4);
  ctx.strokeStyle = gold ? '#a07800' : '#8a5a1c'; ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, BS - 2, BS - 2);
  ctx.globalAlpha = 1;
}
function drawPyramid(p, isMe) {
  const me = S.you;
  forSlots((r, i) => {
    const s = slotRect(p, r, i);
    if (p.grid[r][i]) {
      drawBlock(s.x, s.y, false);
      if (!isMe && isExposed(p, r, i) && mode === 'play') { // show targets
        ctx.strokeStyle = me.blastMode ? '#ff5a2a' : 'rgba(125,255,122,0.8)';
        ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.strokeRect(s.x + 3, s.y + 3, BS - 6, BS - 6); ctx.setLineDash([]);
      }
    } else if (isMe && me.stash > 0 && canPlace(p, r, i) && mode === 'play') {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.3 * Math.sin(S.t * 6)) + ')';
      ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.strokeRect(s.x + 2, s.y + 2, BS - 4, BS - 4); ctx.setLineDash([]);
    }
  });
  if (shielded(p)) {
    const left = p.shieldUntil - S.t;
    ctx.globalAlpha = left < 1.5 ? 0.25 + 0.2 * Math.sin(S.t * 20) : 0.35;
    ctx.fillStyle = '#7fe0ff';
    ctx.beginPath(); ctx.ellipse(p.cx, GROUND, BASE * BS / 2 + 12, BASE * BS + 15, 0, Math.PI, 0); ctx.fill();
    ctx.globalAlpha = 1;
  }
  text(p.name + '  ▲' + height(p), p.cx, GROUND + 18, 16, isMe ? '#7dff7a' : '#ff8a8a');
}
function drawUfo(p, isMe) {
  const { x } = p.ufo, y = p.ufo.y + Math.sin(S.t * 3 + (isMe ? 0 : 2)) * 4;
  if (p.beam) {
    const t = beamTarget(p);
    ctx.fillStyle = p.beam.kind === 'abduct' ? 'rgba(125,255,122,0.35)' : 'rgba(200,255,150,0.3)';
    ctx.beginPath(); ctx.moveTo(x - 10, y + 8); ctx.lineTo(x + 10, y + 8);
    ctx.lineTo(t.x + 18, t.y + 14); ctx.lineTo(t.x - 18, t.y + 14); ctx.closePath(); ctx.fill();
    // progress ring
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(t.x, t.y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (p.beam.t / p.beam.dur)); ctx.stroke();
  }
  ctx.fillStyle = isMe ? '#9be7ff' : '#ffb0d0';
  ctx.beginPath(); ctx.ellipse(x, y - 6, 12, 11, 0, Math.PI, 0); ctx.fill();
  ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(isMe ? '👽' : '👾', x, y - 9);
  ctx.fillStyle = isMe ? '#5a6b7d' : '#7d5a6b';
  ctx.beginPath(); ctx.ellipse(x, y + 2, 28, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe066';
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.arc(x + k * 10, y + 3, 2.2, 0, Math.PI * 2); ctx.fill(); }
}
function drawQuarry() {
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
  rr(QUARRY.x, QUARRY.y, QUARRY.w, QUARRY.h, 14); ctx.stroke(); ctx.setLineDash([]);
  text('QUARRY - tap blocks to beam them up', W / 2, QUARRY.y + 14, 12, 'rgba(255,255,255,0.7)', 'center', false);
  for (const q of S.quarry) {
    const fade = !q.claimedBy && q.life < 2 ? (Math.sin(S.t * 20) > 0 ? 1 : 0.3) : 1;
    drawBlock(q.x - BS / 2, q.y - BS / 2 + (q.claimedBy ? 0 : Math.sin(S.t * 4 + q.x) * 2), q.gold, fade);
  }
}
function drawHud() {
  const m = Math.floor(S.time / 60), s = Math.floor(S.time % 60);
  rr(W / 2 - 45, 10, 90, 36, 12); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  text(m + ':' + String(s).padStart(2, '0'), W / 2, 29, 22, S.time < 20 ? '#ff6b6b' : '#fff');
  text('🧱 ' + S.bot.stash, W - 20, 29, 14, '#ffb0d0', 'right');

  const me = S.you;
  text('🧱 x ' + me.stash, 20, 592, 20, '#fff', 'left');
  for (let k = 0; k < ENERGY_MAX; k++) {
    rr(170 + k * 21.5, 582, 18, 20, 4);
    ctx.fillStyle = k < me.energy ? '#5ef0ff' : 'rgba(0,0,0,0.25)'; ctx.fill();
  }
  text('⚡', 158, 592, 16, '#5ef0ff', 'center', false);

  drawButton(BTN.blast, me.blastMode ? 'TAP A TARGET' : 'BLAST', COST.blast, me.energy >= COST.blast, me.blastMode, '#ff7b3a');
  drawButton(BTN.shield, shielded(me) ? 'SHIELDED' : 'SHIELD', COST.shield, me.energy >= COST.shield && !shielded(me), shielded(me), '#4fc3f7');
  text('Tap a glowing enemy block to ABDUCT it (' + COST.abduct + '⚡)', W / 2, 688, 11, '#6b4a1f', 'center', false);
}
function drawButton(b, label, cost, ready, active, color) {
  rr(b.x, b.y, b.w, b.h, 14);
  ctx.fillStyle = active ? '#fff' : ready ? color : '#a08a6a'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#2a1240'; ctx.stroke();
  text(label, b.x + b.w / 2, b.y + 24, 18, active ? color : '#fff');
  text(cost + '⚡', b.x + b.w / 2, b.y + 46, 12, active ? color : '#fff', 'center', false);
}
function drawFx() {
  for (const z of S.zaps) {
    ctx.strokeStyle = 'rgba(255,120,60,' + (1 - z.t / 0.25) + ')'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(z.x1, z.y1); ctx.lineTo(z.x2, z.y2); ctx.stroke();
  }
  for (const p of S.parts) {
    ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
  for (const t of S.texts) {
    ctx.globalAlpha = 1 - t.t / 1.2; text(t.text, t.x, t.y - t.t * 30, 14, t.color);
  }
  ctx.globalAlpha = 1;
}
function overlay(alpha = 0.55) { ctx.fillStyle = 'rgba(20,5,40,' + alpha + ')'; ctx.fillRect(0, 0, W, H); }

function drawTitle(t) {
  drawBackground();
  // a decorative pyramid
  for (let r = 0; r < 6; r++) for (let i = 0; i < 6 - r; i++) drawBlock(W / 2 - (6 - r) * BS / 2 + i * BS, GROUND - (r + 1) * BS, r === 5);
  const bob = Math.sin(t * 3) * 6;
  ctx.font = '60px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🛸', W / 2, 330 + bob);
  text('CONSPYRAMID', W / 2, 110, 44, '#ffe066');
  text('aliens built them. now they fight over them.', W / 2, 150, 13, '#fff');
  const lines = ['1. Tap quarry blocks to beam them up', '2. Tap the dotted spots to build your pyramid',
                 '3. Tap glowing enemy blocks to abduct them', '4. BLAST and SHIELD cost energy',
                 'Tallest pyramid after 2:30 wins!'];
  lines.forEach((l, k) => text(l, W / 2, 190 + k * 24, 14, k === 4 ? '#7dff7a' : '#fff'));
  if (Math.sin(t * 5) > -0.3) text('TAP TO START', W / 2, 640, 26, '#fff');
}
function drawOver() {
  overlay(0.6);
  const msg = { win: 'YOU WIN!', lose: 'YOU LOSE!', draw: 'DRAW!' }[S.result];
  const col = { win: '#7dff7a', lose: '#ff6b6b', draw: '#ffe066' }[S.result];
  text(msg, W / 2, 230, 50, col);
  text('You ▲' + height(S.you) + ' (' + blockCount(S.you) + ' blocks)', W / 2, 290, 20, '#fff');
  text('Bot ▲' + height(S.bot) + ' (' + blockCount(S.bot) + ' blocks)', W / 2, 320, 20, '#fff');
  if (S.result === 'win') text('+10 crystals (coming soon)', W / 2, 360, 14, '#c9a0ff');
  if (S.t - S.overAt > 0.8) text('TAP TO PLAY AGAIN', W / 2, 430, 22, '#fff');
}

let titleT = 0;
function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#1a0b33'; ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  if (mode === 'title') { drawTitle(titleT); ctx.restore(); return; }
  drawBackground();
  drawQuarry();
  drawPyramid(S.you, true);
  drawPyramid(S.bot, false);
  drawUfo(S.bot, false);
  drawUfo(S.you, true);
  drawFx();
  drawHud();
  if (mode === 'over') drawOver();
  ctx.restore();
}

// ---------- Main loop ----------
let last = performance.now();
function frame(now) {
  // Run the sim in small steps so slow phones keep real-time speed.
  let dt = Math.min(0.5, (now - last) / 1000); last = now;
  titleT += dt;
  while (dt > 0) {
    const step = Math.min(0.05, dt); dt -= step;
    if (S) { update(step); if (mode === 'over') updateFx(step); }
  }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
