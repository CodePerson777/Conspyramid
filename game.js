// Conspyramid - prototype v2 (landscape, troop command)
// You (left, green) vs bot (right, purple). Spend mana to deploy troops.
// Gatherers bring stone home, and your pyramid builds itself from stone.
// Your Saucer casts Abduct and Explode.

// ---------- Tuning ----------
const W = 800, H = 400;
const GROUND = 300;                 // ground line (units walk around here)
const BAR_Y = 326;                  // bottom UI bar starts here
const BASE = 10, BS = 15;           // pyramid: 10-wide base, 15px blocks (55 blocks total)
const QX = 400;                     // quarry center x
const MATCH_TIME = 150;
const MANA_MAX = 10, MANA_RATE = 3.0, START_MANA = 5;   // +1 mana every 3s
const QUARRY_MAX = 12, QUARRY_START = 4, QUARRY_REGEN = 1.2;   // +1 quarry stone every 1.2s (shared by both sides)
const STONE_MAX = 5;                // stone you can hold at home; extra is sacrificed to the gods
const KILL_MANA = 1;                // mana you earn for each enemy troop you kill
const CATCHUP_PER_BLOCK = 0.05, CATCHUP_MAX = 0.6;   // side with fewer blocks gets +5% mana speed per block behind (max +60%)
const UNIT_CAP = 8;                 // per side
const BUILD_TIME = 4.0;             // seconds per block with no builders
const BUILDER_BONUS = 0.5;          // each builder adds +50% build speed (max 4 count)
const FONT = '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif';

const TYPES = {
  martian:    { name: 'Martian',    icon: '👽', cost: 3, hp: 15, speed: 45, carry: 1, mine: 0.9, dmg: 8, rate: 0.9, range: 60, ground: true, gather: true, fights: true, retreat: 0.5 },
  sneaky:     { name: 'Sneaky',     icon: '🥷', cost: 2, hp: 8, speed: 80, carry: 1, mine: 0.7, dmg: 5, rate: 1.0, range: 45, ground: true, gather: true, sneaky: true, retreat: 0.5 },
  bigguy:     { name: 'Big Guy',    icon: '🦍', cost: 4, hp: 35, speed: 20, carry: 5, mine: 0.6, dmg: 14, rate: 1.6, range: 45, ground: true, gather: true, retreat: 0.3 },
  battleship: { name: 'Battleship', icon: '🚀', cost: 5, hp: 25, speed: 55, dmg: 12, rate: 0.8, range: 100, air: true, fights: true, bomb: true, retreat: 0.4 },
  mega:       { name: 'Mega Ship',  icon: '💣', cost: 10, hp: 60, speed: 110, air: true, mega: true },
  builder:    { name: 'Builder',    icon: '🔨', cost: 3, hp: 10, speed: 35, ground: true, builder: true },
  saucer:     { name: 'Saucer',     icon: '🛸', cost: 5, hp: 18, speed: 75, carry: 2, mine: 0.6, air: true, gather: true, saucer: true, retreat: 0.4 },
};
const MEGA_BOMB_DMG = 30, MEGA_BOMB_RADIUS = 68, MEGA_BOMBS = 2;   // a Mega Ship drops 2 bombs, then leaves
const ABIL = {
  abduct:  { name: 'Abduct',  icon: '🌀', cost: 4 },
  explode: { name: 'Explode', icon: '💥', cost: 6 },
};
const CARDS = ['martian', 'sneaky', 'bigguy', 'battleship', 'mega', 'builder', 'saucer', 'abduct', 'explode'];   // max 1 Saucer at a time

// ---------- Canvas ----------
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let dpr = 1, scale = 1, offX = 0, offY = 0;
function resize() {
  dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
  scale = Math.min(innerWidth / W, innerHeight / H);
  offX = (innerWidth - W * scale) / 2; offY = (innerHeight - H * scale) / 2;
}
addEventListener('resize', resize); resize();

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ---------- Pyramid ----------
const BUILD_ORDER = [];  // lowest row first, center outward
for (let r = 0; r < BASE; r++) {
  const n = BASE - r, idx = [...Array(n).keys()].sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2));
  for (const i of idx) BUILD_ORDER.push([r, i]);
}
function slotRect(s, r, i) { return { x: s.cx - (BASE - r) * BS / 2 + i * BS, y: GROUND - (r + 1) * BS, w: BS, h: BS }; }
function slotCenter(s, r, i) { const q = slotRect(s, r, i); return { x: q.x + BS / 2, y: q.y + BS / 2 }; }
function canPlace(s, r, i) { return !s.grid[r][i] && (r === 0 || (s.grid[r - 1][i] && s.grid[r - 1][i + 1])); }
function isExposed(s, r, i) {
  if (!s.grid[r][i]) return false;
  if (r + 1 >= BASE) return true;
  const up = s.grid[r + 1];
  return !((i - 1 >= 0 && up[i - 1]) || (i < up.length && up[i]));
}
function forSlots(fn) { for (let r = 0; r < BASE; r++) for (let i = 0; i < BASE - r; i++) fn(r, i); }
function listSlots(s, test) { const o = []; forSlots((r, i) => { if (test(s, r, i)) o.push([r, i]); }); return o; }
function height(s) { let h = 0; forSlots((r, i) => { if (s.grid[r][i]) h = Math.max(h, r + 1); }); return h; }
function blockCount(s) { let n = 0; forSlots((r, i) => { n += s.grid[r][i]; }); return n; }

// ---------- State ----------
let mode = 'home';    // intro | home | play | cutscene  (screens.js picks the first one)
let S = null, nextId = 1;
function makeSide(isYou) {
  const dir = isYou ? 1 : -1, cx = isYou ? 92 : W - 92;
  const grid = []; for (let r = 0; r < BASE; r++) grid.push(new Array(BASE - r).fill(0));
  return { isYou, dir, cx, name: isYou ? 'YOU' : 'BOT', home: cx + dir * (BASE * BS / 2 + 12),
           grid, stock: 0, mana: START_MANA, mTimer: 0, buildT: 0, units: [], armed: null };
}
function newGame() {
  S = { t: 0, time: MATCH_TIME, quarry: QUARRY_START, qTimer: 0, loose: [], parts: [], sacs: [], texts: [], zaps: [],
        booms: [], shots: [], bigBombs: [], botT: 2, you: makeSide(true), bot: makeSide(false) };
  S.you.enemy = S.bot; S.bot.enemy = S.you;
  for (const s of [S.you, S.bot]) { spawn(s, 'saucer'); spawn(s, 'martian'); }
  mode = 'play';
}
function say(x, y, text, color = '#fff', size = 13) { S.texts.push({ x, y, text, color, size, t: 0 }); }
function puff(x, y, color, n = 10, sp = 80) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, v = sp * rand(0.4, 1.4);
    S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: rand(0.5, 1), t: 0, color });
  }
}

// ---------- Units ----------
function spawn(s, type) {
  const T = TYPES[type];
  const u = { id: nextId++, type, T, side: s, hp: T.hp, carry: 0, mineT: 0, waitT: 0, state: 'toQuarry',
              face: s.dir, task: null, cd: rand(0, 0.5), fireT: 0, flash: 0, revealT: 0, aiming: false };
  if (T.air) { u.x = s.cx; u.y = rand(60, 120); }
  else { u.x = s.home; u.y = GROUND + rand(-6, 10); }
  u.qx = QX - s.dir * rand(0, 28);
  if (T.builder) u.bf = Math.random();   // where along the top of the pyramid this builder stands
  s.units.push(u);
  return u;
}
const hasSaucer = s => s.units.some(u => u.T.saucer && u.hp > 0);
function deploy(s, type) {
  const T = TYPES[type];
  if (T.saucer && hasSaucer(s)) { if (s.isYou) say(W / 2, BAR_Y - 30, 'Only 1 Saucer at a time!', '#f88'); return false; }
  if (s.units.length >= UNIT_CAP) { if (s.isYou) say(W / 2, BAR_Y - 30, 'Too many troops!', '#f88'); return false; }
  if (s.mana < T.cost) { if (s.isYou) say(W / 2, BAR_Y - 30, 'Need ' + T.cost + ' mana', '#f88'); return false; }
  s.mana -= T.cost; spawn(s, type);
  return true;
}
function moveTo(u, tx, ty, dt, spd) {
  const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy), step = (spd || u.T.speed) * dt;
  if (Math.abs(dx) > 1) u.face = Math.sign(dx);
  if (d <= step) { u.x = tx; u.y = ty; return true; }
  u.x += dx / d * step; u.y += dy / d * step; return false;
}
function enemiesOf(u) { return u.side.enemy.units; }
function nearestEnemy(u, maxD, filter) {
  let best = null, bd = maxD;
  for (const e of enemiesOf(u)) {
    if (e.hp <= 0 || (filter && !filter(e))) continue;
    const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function kill(u, dropStone = true) {
  u.hp = 0;
  const k = u.side.enemy;   // the other side earns mana for the kill
  k.mana = Math.min(MANA_MAX, k.mana + KILL_MANA);
  if (k.isYou) say(u.x, u.y - 34, '+' + KILL_MANA + '🔮', '#c9a4ff', 12);
  if (dropStone && u.carry > 0) { S.loose.push({ x: u.x, y: GROUND + rand(0, 8), n: u.carry }); }
  u.carry = 0;
  puff(u.x, u.y - 10, u.side.isYou ? '#6be86b' : '#c07bff', 12, 90);
}

// ---------- Shooting ----------
function canSee(u, e) {
  if (e.hp <= 0) return false;
  if (u.T.sneaky || e.T.sneaky) return !!(u.T.sneaky && e.T.sneaky);  // Sneakies only fight Sneakies
  if (e.T.mega) return false;                                          // only another Mega Ship can stop one
  if (u.T.air) return true;                                            // battleships hit anything else
  return !!e.T.ground;
}
function inRange(u, e) { return Math.hypot(e.x - u.x, e.y - u.y) <= u.T.range; }
function tryShoot(u, dt) {
  const T = u.T; if (!T.dmg) return false;
  const foe = nearestEnemy(u, 9999, e => canSee(u, e) && inRange(u, e));
  if (!foe) return false;
  u.aiming = true; u.face = Math.sign(foe.x - u.x) || u.face;
  if (u.cd <= 0) {
    u.cd = T.rate * rand(0.85, 1.15); u.fireT = 0.12;
    const sc = u.type === 'bigguy' ? 1.7 : u.type === 'sneaky' ? 0.8 : 1;
    const gx = u.x + u.face * (T.air ? 18 : 12 * sc), gy = T.air ? u.y + 3 : u.y - 10 * sc;
    S.shots.push({ x: gx, y: gy, target: foe, tx: foe.x, ty: foe.y, dmg: T.dmg, bomb: !!T.bomb,
                   color: u.side.isYou ? '#7dff7a' : '#ff6bd6' });
  }
  return true;
}
function updateShots(dt) {
  for (const sh of S.shots) {
    const v = sh.target;
    if (v.hp > 0) { sh.tx = v.x; sh.ty = v.y - (v.T.air ? 0 : 10); }
    const dx = sh.tx - sh.x, dy = sh.ty - sh.y, d = Math.hypot(dx, dy), step = (sh.bomb ? 230 : 380) * dt;
    if (d > step) { sh.x += dx / d * step; sh.y += dy / d * step; continue; }
    sh.done = true; sh.x = sh.tx; sh.y = sh.ty;
    if (sh.bomb) { S.booms.push({ x: sh.x, y: sh.y, t: 0, small: true }); puff(sh.x, sh.y, '#ff7b3a', 10, 110); puff(sh.x, sh.y, '#ffe066', 5, 70); }
    else puff(sh.x, sh.y, sh.color, 6, 70);
    if (v.hp > 0) { v.hp -= sh.dmg; v.flash = 0.2; if (v.hp <= 0) kill(v); }
  }
  S.shots = S.shots.filter(sh => !sh.done);
}

function updateGatherer(u, dt) {
  const s = u.side, T = u.T;
  // Martians stop to shoot any enemy ground troop in range.
  if (T.fights && tryShoot(u, dt)) return;
  // Pick up dropped stone (e.g. from a fallen Big Guy).
  if (T.ground && u.carry < T.carry) {
    for (const l of S.loose) {
      if (l.n > 0 && Math.abs(l.x - u.x) < 14) {
        const take = Math.min(l.n, T.carry - u.carry); l.n -= take; u.carry += take;
        if (s.isYou) say(u.x, u.y - 30, '+' + take, '#ffd27a');
        if (u.carry >= T.carry) u.state = 'toHome';
      }
    }
    S.loose = S.loose.filter(l => l.n > 0);
  }
  const homeY = T.air ? 170 : u.y, qy = T.air ? 235 : u.y;
  if (T.sneaky && S.quarry <= 0 && u.state !== 'toHome') {
    if (u.carry > 0) { u.state = 'toHome'; return; }
    u.state = 'toQuarry';
    if (tryShoot(u, dt)) return;   // still fights enemy Sneakies that come close
    if (u.hangX == null || (Math.abs(u.x - u.hangX) < 1 && Math.random() < dt * 0.4))
      u.hangX = s.cx + s.dir * rand(BASE * BS / 2 - 10, BASE * BS / 2 + 60);
    moveTo(u, u.hangX, u.y, dt, T.speed * 0.5);
    return;
  }
  u.hangX = null;
  if (u.state === 'toQuarry') {
    if (moveTo(u, u.qx, qy, dt)) { u.state = 'mining'; u.mineT = 0; u.waitT = 0; }
  } else if (u.state === 'mining') {
    if (S.quarry > 0) { u.mineT += dt; if (u.mineT >= T.mine) { u.mineT = 0; S.quarry--; u.carry++; } }
    else {   // nothing to grab: everybody fights at the front line
      u.waitT += dt;
      if (T.dmg && T.ground && !tryShoot(u, dt)) moveTo(u, QX - s.dir * 6, u.y, dt);
    }
    if (u.carry >= T.carry || (u.carry > 0 && u.waitT > 3)) u.state = 'toHome';
  } else if (u.state === 'toHome') {
    if (moveTo(u, s.home, homeY, dt)) {
      if (u.carry) addStone(s, u.carry, s.home, u.y);
      u.carry = 0; u.state = 'toQuarry'; u.qx = QX - s.dir * rand(0, 28);
    }
  }
}
// Hurt troops run home once (dropping off any stone), then head back out. No healing.
function updateRetreat(u, dt) {
  const T = u.T, s = u.side;
  if (!T.retreat) return false;
  if (u.state !== 'retreat' && !u.retreated && !u.task && u.hp <= T.hp * T.retreat) {
    u.state = 'retreat';
    if (s.isYou) say(u.x, u.y - 30, 'Ouch! Retreat!', '#ffb0b0', 11);
  }
  if (u.state === 'retreat') {
    if (moveTo(u, T.air ? s.cx : s.home, T.air ? 150 : u.y, dt, T.speed * 1.4)) {
      if (u.carry) addStone(s, u.carry, s.home, u.y);
      u.carry = 0; u.retreated = true; u.state = 'toQuarry'; u.qx = QX - s.dir * rand(0, 28);
    }
    return true;
  }
  return false;
}
function updateBattleship(u, dt) {
  const s = u.side;
  if (tryShoot(u, dt)) return;
  const tgt = nearestEnemy(u, 9999, e => canSee(u, e));
  if (!tgt) { moveTo(u, QX - s.dir * 70, 100, dt); return; }
  moveTo(u, tgt.x - s.dir * 50, tgt.T.air ? tgt.y : 215, dt);
}
// Mega Ship: fly to the middle, drop a big bomb on the enemy front line, fly home. After MEGA_BOMBS bombs it flies away.
function updateMega(u, dt) {
  const s = u.side;
  const rival = s.enemy.units.find(v => v.T.mega && v.hp > 0);
  if (rival && Math.hypot(rival.x - u.x, rival.y - u.y) < 70) {   // two Mega Ships destroy each other
    S.booms.push({ x: (u.x + rival.x) / 2, y: (u.y + rival.y) / 2, t: 0 });
    puff(u.x, u.y, '#ff7b3a', 20, 150); puff(rival.x, rival.y, '#ff7b3a', 20, 150);
    say(QX, 140, 'MEGA CRASH!', '#ffb347', 20);
    kill(u); kill(rival); return;
  }
  if (u.state === 'leave') {   // out of bombs: fly off the top of the screen and vanish
    if (moveTo(u, s.cx, -80, dt)) u.hp = 0;
  } else if (u.state !== 'back') {
    if (moveTo(u, QX - s.dir * 20, 170, dt)) {
      S.bigBombs.push({ x: u.x, y: u.y + 12, vx: s.dir * 50, vy: 0, side: s });
      u.drops = (u.drops || 0) + 1; u.fireT = 0.25;
      u.state = u.drops >= MEGA_BOMBS ? 'leave' : 'back';
    }
  } else if (moveTo(u, s.cx + s.dir * 30, 110, dt)) u.state = 'out';
}
function updateBigBombs(dt) {
  for (const b of S.bigBombs) {
    b.vy += 300 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < GROUND - 2) continue;
    b.done = true;
    S.booms.push({ x: b.x, y: GROUND - 6, t: 0, mega: true });
    puff(b.x, GROUND - 6, '#ff7b3a', 34, 200); puff(b.x, GROUND - 6, '#ffe066', 18, 140);
    for (const v of b.side.enemy.units) {
      if (v.T.ground && Math.abs(v.x - b.x) < MEGA_BOMB_RADIUS) { v.hp -= MEGA_BOMB_DMG; v.flash = 0.2; if (v.hp <= 0) kill(v); }
    }
  }
  S.bigBombs = S.bigBombs.filter(b => !b.done);
}
function updateSaucer(u, dt) {
  const t = u.task;
  if (!t) { updateGatherer(u, dt); return; }
  const s = u.side, e = s.enemy;
  if (t.kind === 'abductUnit' && t.target.hp <= 0) { u.task = null; return; }
  let tx, ty;
  if (t.kind === 'abductUnit') { tx = t.target.x; ty = t.target.y - 50; }
  else if (t.kind === 'abductBlock') { const c = slotCenter(e, t.r, t.i); tx = c.x; ty = c.y - 45; }
  else { tx = t.x; ty = Math.max(50, t.y - 70); }
  const there = moveTo(u, tx, ty, dt, 200);
  if (!there && !t.beaming) return;
  if (t.kind === 'explode') {
    boom(s, t.x, t.y); u.task = null; return;
  }
  t.beaming = true; t.bt = (t.bt || 0) + dt;
  if (t.bt < 0.8) return;
  if (t.kind === 'abductUnit') {
    const v = t.target; if (v.carry) addStone(s, v.carry, s.home, GROUND); v.carry = 0;
    say(v.x, v.y - 30, 'ABDUCTED!', '#7dff7a');
    puff(v.x, v.y - 10, '#7dff7a', 10, 60); v.hp = 0;
  } else {
    const c = slotCenter(e, t.r, t.i);
    if (isExposed(e, t.r, t.i)) { e.grid[t.r][t.i] = 0; addStone(s, 1, s.home, GROUND, true); say(c.x, c.y - 20, 'STOLEN!', '#7dff7a'); puff(c.x, c.y, '#7dff7a', 8, 50); }
  }
  u.task = null;
}
// Top of the pyramid at x (where a builder's feet go). Ground if there's no block there.
function surfaceY(s, x) {
  let y = GROUND;
  forSlots((r, i) => { if (s.grid[r][i]) { const q = slotRect(s, r, i); if (x >= q.x && x < q.x + q.w) y = Math.min(y, q.y); } });
  return y;
}
// Builders stand scattered across the top two rows, climbing as the pyramid grows.
function builderSpot(u) {
  const s = u.side, row = Math.max(0, height(s) - 2);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < BASE - row; i++) if (s.grid[row][i]) { const q = slotRect(s, row, i); lo = Math.min(lo, q.x + 3); hi = Math.max(hi, q.x + q.w - 3); }
  if (lo > hi) { lo = s.cx - BASE * BS / 2 + 6; hi = s.cx + BASE * BS / 2 - 6; }
  const x = lo + u.bf * (hi - lo);
  return { x, y: surfaceY(s, x) };
}
// Bring stone home. You can only hold STONE_MAX; anything extra gets hurled into the sky for the gods.
function addStone(s, n, x, y, quiet) {
  const keep = Math.max(0, Math.min(n, STONE_MAX - s.stock)), extra = n - keep;
  s.stock += keep;
  if (keep && s.isYou && !quiet) say(x, y - 30, '+' + keep + ' stone', '#ffd27a');
  for (let k = 0; k < extra; k++)
    S.sacs.push({ x: x + rand(-6, 6), y: GROUND - 10, vx: rand(-25, 25), vy: rand(-330, -280), rot: 0, spin: rand(-8, 8), t: 0, delay: k * 0.12 });
  if (extra) say(x, y - (keep ? 46 : 30), extra > 1 ? 'Sacrificed ' + extra + ' to the gods!' : 'Sacrificed to the gods!', '#ffe9a8', 11);
}
function updateBuilder(u, dt) {
  const p = builderSpot(u);
  u.atSpot = moveTo(u, p.x, p.y, dt, Math.abs(p.y - u.y) > 2 ? u.T.speed * 1.5 : u.T.speed);
}

function boom(s, x, y) {
  const e = s.enemy, R = 60;
  S.booms.push({ x, y, t: 0 });
  puff(x, y, '#ff7b3a', 24, 160); puff(x, y, '#ffe066', 12, 120);
  for (const v of e.units) if (!v.T.mega && Math.hypot(v.x - x, v.y - y) < R) { v.hp -= 45; if (v.hp <= 0) kill(v); }
  const hits = listSlots(e, isExposed).filter(([r, i]) => { const c = slotCenter(e, r, i); return Math.hypot(c.x - x, c.y - y) < R; })
    .sort((a, b) => b[0] - a[0]).slice(0, 3);
  for (const [r, i] of hits) e.grid[r][i] = 0;
  say(x, y - 30, hits.length ? 'KABOOM! -' + hits.length + ' blocks' : 'KABOOM!', '#ffb347', 16);
}

// ---------- Abilities ----------
function freeSaucer(s, x) {
  const ss = s.units.filter(u => u.T.saucer && u.hp > 0);
  if (!ss.length) return null;
  const idle = ss.filter(u => !u.task); const pool = idle.length ? idle : ss;
  return pool.reduce((a, b) => (Math.abs(a.x - x) < Math.abs(b.x - x) ? a : b));
}
function cast(s, kind, x, y) {   // returns true if cast
  const cost = ABIL[kind].cost;
  if (s.mana < cost) return false;
  const e = s.enemy;
  let task = null;
  if (kind === 'explode') task = { kind: 'explode', x, y };
  else {
    const unit = e.units.filter(v => v.hp > 0 && !v.T.mega && Math.hypot(v.x - x, (v.y - 10) - y) < 22)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (unit) task = { kind: 'abductUnit', target: unit };
    else {
      let blk = null; forSlots((r, i) => { const q = slotRect(e, r, i); if (isExposed(e, r, i) && x > q.x - 5 && x < q.x + BS + 5 && y > q.y - 5 && y < q.y + BS + 5) blk = [r, i]; });
      if (blk) task = { kind: 'abductBlock', r: blk[0], i: blk[1] };
    }
    if (!task) { if (s.isYou) say(x, y - 15, 'Tap an enemy or a top block', '#f88'); return false; }
  }
  const sc = freeSaucer(s, x);
  if (!sc) { if (s.isYou) say(x, y - 15, 'No Saucer!', '#f88'); return false; }
  s.mana -= cost; sc.task = task; sc.state = 'toHome';
  return true;
}

// ---------- Bot brain ----------
function botThink() {
  const b = S.bot, y = S.you;
  const count = (s, t) => s.units.filter(u => u.type === t).length;
  const gotSaucer = hasSaucer(b);
  // Abilities
  if (!b.savingForMega && gotSaucer && b.mana >= ABIL.explode.cost && Math.random() < 0.5) {
    const c = y.units.find(u => y.units.filter(v => Math.hypot(v.x - u.x, v.y - u.y) < 55).length >= 3);
    if (c) { cast(b, 'explode', c.x, c.y - 10); return; }
  }
  if (!b.savingForMega && gotSaucer && b.mana >= ABIL.abduct.cost && Math.random() < 0.35) {
    const big = y.units.find(u => u.carry >= 3);
    if (big) { cast(b, 'abduct', big.x, big.y - 10); return; }
    const top = listSlots(y, isExposed).sort((a, c) => c[0] - a[0])[0];
    if (top && top[0] >= 2) { const c = slotCenter(y, ...top); cast(b, 'abduct', c.x, c.y); return; }
  }
  // Mega Ship: counter the player's, or sometimes buy one mid-match
  const megas = side => side.units.filter(u => u.T.mega).length;
  if (megas(y) > megas(b) || (S.t > 40 && megas(b) === 0 && Math.random() < 0.05)) b.savingForMega = true;
  if (b.savingForMega) {
    if (b.mana >= TYPES.mega.cost) { deploy(b, 'mega'); b.savingForMega = false; }
    return;   // save mana until it can afford one
  }
  // Deploy
  let want;
  if (!gotSaucer) want = 'saucer';
  else if (count(b, 'builder') < 1 && S.t > 8) want = 'builder';
  else if (count(y, 'martian') > count(b, 'martian') + 1) want = Math.random() < 0.5 ? 'battleship' : 'martian';
  else {
    const w = { martian: 4, sneaky: 2, bigguy: 1.5, battleship: 1.2, builder: count(b, 'builder') < 3 ? 0.8 : 0 };
    let r = Math.random() * Object.values(w).reduce((a, c) => a + c, 0);
    for (const k in w) { r -= w[k]; if (r <= 0) { want = k; break; } }
  }
  if (want && b.mana >= TYPES[want].cost) deploy(b, want);
}

// ---------- Update ----------
function update(dt) {
  S.t += dt;
  if (mode !== 'play') return;
  S.time -= dt;
  if (S.time <= 0) { S.time = 0; endMatch(); return; }

  S.qTimer += dt;
  if (S.qTimer >= QUARRY_REGEN) { S.qTimer = 0; S.quarry = Math.min(QUARRY_MAX, S.quarry + 1); }

  for (const s of [S.you, S.bot]) {
    // Catch-up: the side that's behind gets mana faster.
    const behind = Math.max(0, blockCount(s.enemy) - blockCount(s));
    s.catchup = Math.min(CATCHUP_MAX, behind * CATCHUP_PER_BLOCK);
    s.mTimer += dt * (1 + s.catchup);
    while (s.mTimer >= MANA_RATE) { s.mTimer -= MANA_RATE; s.mana = Math.min(MANA_MAX, s.mana + 1); }
    for (const u of s.units) {
      if (u.hp <= 0) continue;
      u.cd -= dt; u.fireT -= dt; u.flash -= dt; u.revealT -= dt; u.aiming = false;
      if (!updateRetreat(u, dt)) {
        if (u.T.saucer) updateSaucer(u, dt);
        else if (u.T.gather) updateGatherer(u, dt);
        else if (u.T.builder) updateBuilder(u, dt);
        else if (u.type === 'battleship') updateBattleship(u, dt);
        else if (u.T.mega) updateMega(u, dt);
      }
      // Everyone stays on their own half (Saucers can cross to cast abilities).
      if (!u.T.saucer) u.x = s.dir > 0 ? Math.min(u.x, QX - 4) : Math.max(u.x, QX + 4);
    }
    // Auto-build: builders make it faster.
    const builders = Math.min(4, s.units.filter(u => u.T.builder && u.hp > 0).length);
    const interval = BUILD_TIME / (1 + BUILDER_BONUS * builders);
    s.buildT = Math.min(interval, s.buildT + dt);
    if (s.stock > 0 && s.buildT >= interval) {
      const slot = BUILD_ORDER.find(([r, i]) => canPlace(s, r, i));
      if (slot) {
        s.grid[slot[0]][slot[1]] = 1; s.stock--; s.buildT = 0;
        const c = slotCenter(s, ...slot); puff(c.x, c.y, '#f3d38a', 5, 40);
        if (blockCount(s) === BASE * (BASE + 1) / 2) { endMatch(s); return; }
      }
    }
  }
  for (const s of [S.you, S.bot]) s.units = s.units.filter(u => u.hp > 0);

  S.botT -= dt;
  updateShots(dt);
  updateBigBombs(dt);
  if (S.botT <= 0) { botThink(); S.botT = rand(0.9, 1.5); }
  updateFx(dt);
}
function updateFx(dt) {
  for (const p of S.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; }
  S.parts = S.parts.filter(p => p.t < p.life);
  for (const c of S.sacs) {
    if (c.delay > 0) { c.delay -= dt; continue; }
    c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy -= 60 * dt; c.rot += c.spin * dt;
    if (Math.random() < dt * 25) S.parts.push({ x: c.x, y: c.y, vx: rand(-20, 20), vy: rand(10, 40), life: 0.5, t: 0, color: '#ffe9a8' });
  }
  S.sacs = S.sacs.filter(c => c.y > -30);
  for (const t of S.texts) t.t += dt;
  S.texts = S.texts.filter(t => t.t < 1.3);
  for (const b of S.booms) b.t += dt;
  S.booms = S.booms.filter(b => b.t < 0.4);
}
function endMatch(capper) {
  if (capper) { S.result = capper.isYou ? 'win' : 'lose'; S.reason = 'Pyramid completed!'; }
  else {
    const hy = height(S.you), hb = height(S.bot), cy = blockCount(S.you), cb = blockCount(S.bot);
    S.result = hy !== hb ? (hy > hb ? 'win' : 'lose') : cy !== cb ? (cy > cb ? 'win' : 'lose') : 'draw';
    S.reason = 'Time up!';
  }
  startCutscene();   // screens.js
}

// ---------- Input ----------
const CARD_W = 80, CARD_GAP = 6, CARD_Y = 340, CARD_H = 56;
const CARD_X0 = (W - CARDS.length * CARD_W - (CARDS.length - 1) * CARD_GAP) / 2;
function cardRect(k) { return { x: CARD_X0 + k * (CARD_W + CARD_GAP), y: CARD_Y, w: CARD_W, h: CARD_H }; }
function inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  const x = (e.clientX - offX) / scale, y = (e.clientY - offY) / scale;
  if (mode === 'intro') introTap(x, y);
  else if (mode === 'home') homeTap(x, y);
  else if (mode === 'cutscene') cutsceneTap(x, y);
  else tap(x, y);
});
function tap(x, y) {
  const me = S.you;
  for (let k = 0; k < CARDS.length; k++) {
    if (!inRect(x, y, cardRect(k))) continue;
    const c = CARDS[k];
    if (ABIL[c]) {
      if (me.armed === c) me.armed = null;
      else if (me.mana < ABIL[c].cost) say(W / 2, BAR_Y - 30, 'Need ' + ABIL[c].cost + ' mana', '#f88');
      else if (!me.units.some(u => u.T.saucer)) say(W / 2, BAR_Y - 30, 'No Saucer! Deploy one first', '#f88');
      else me.armed = c;
    } else { me.armed = null; deploy(me, c); }
    return;
  }
  if (me.armed && y < BAR_Y) { if (cast(me, me.armed, x, y)) me.armed = null; }
}

// ---------- Drawing ----------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function text(str, x, y, size, color, align = 'center', stroke = true) {
  ctx.font = 'bold ' + size + 'px ' + FONT; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = '#2a1240'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
function emoji(ch, x, y, size) { ctx.font = size + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, x, y); }
const STARS = Array.from({ length: 60 }, () => [Math.random() * W, Math.random() * 200, rand(0.5, 2)]);
const now = () => (mode === 'play' && S ? S.t : titleT);

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, '#2b1055'); g.addColorStop(0.65, '#a24a8a'); g.addColorStop(1, '#ffb27a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND);
  ctx.fillStyle = '#fff';
  for (const [x, y, s] of STARS) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now() * 2 + x); ctx.fillRect(x, y, s, s); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(615, 120, 16, 0, Math.PI * 2); ctx.fill();   // moon
  ctx.fillStyle = '#e8c27a'; ctx.fillRect(0, GROUND, W, BAR_Y - GROUND);
  ctx.fillStyle = '#d4a85c';
  for (let k = 0; k < 18; k++) ctx.fillRect((k * 53) % W, GROUND + 6 + (k * 7) % 16, 12, 2);
}
function drawBlock(x, y, size = BS, gold = false) {
  ctx.fillStyle = gold ? '#ffd700' : '#d9a441'; ctx.fillRect(x + 0.5, y + 0.5, size - 1, size - 1);
  ctx.fillStyle = gold ? '#fff3a0' : '#efc56f'; ctx.fillRect(x + 2, y + 2, size - 4, Math.max(2, size / 6));
  ctx.strokeStyle = '#8a5a1c'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
}
function drawPyramid(s) {
  const me = S.you, targeting = me.armed === 'abduct' && !s.isYou;
  forSlots((r, i) => {
    const q = slotRect(s, r, i);
    if (s.grid[r][i]) {
      drawBlock(q.x, q.y);
      if (targeting && isExposed(s, r, i)) { ctx.strokeStyle = '#7dff7a'; ctx.lineWidth = 2; ctx.strokeRect(q.x + 2, q.y + 2, BS - 4, BS - 4); }
    } else if (canPlace(s, r, i) && r < height(s) + 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.strokeRect(q.x + 1, q.y + 1, BS - 2, BS - 2);
    }
  });
  // stockpile next to the pyramid
  const sx = s.home + s.dir * 4;
  for (let k = 0; k < Math.min(s.stock, 6); k++) drawBlock(sx - 5 + (k % 3) * 5 * s.dir, GROUND - 8 - Math.floor(k / 3) * 8, 9);
  if (s.stock > 0) text('🧱' + s.stock, sx, GROUND - 32, 11, '#fff');
}
function drawQuarry() {
  const n = S.quarry, rows = [8, 6, 5, 3, 2];
  let left = n, y = GROUND;
  for (const w of rows) {
    const c = Math.min(w, left); if (c <= 0) break;
    for (let k = 0; k < c; k++) drawBlock(QX - c * 6 + k * 12, y - 12, 12);
    left -= c; y -= 12;
  }
  text('QUARRY ' + n, QX, GROUND + 14, 11, '#6b4a1f', 'center', false);
  for (const l of S.loose) for (let k = 0; k < Math.min(l.n, 4); k++) drawBlock(l.x - 8 + k * 5, l.y - 6 - (k % 2) * 4, 9);
}
function bob(u, amt) { return Math.sin(now() * 10 + u.id) * amt; }
function drawUnit(u) {
  const you = u.side.isYou, body = you ? '#6be86b' : '#c07bff', dark = you ? '#2f8a3a' : '#6a2fa8';
  const x = u.x, T = u.T;
  ctx.save();
  if (T.air) {
    const y = u.y + Math.sin(now() * 3 + u.id) * 3;
    if (u.type === 'battleship' || T.mega) {
      const m = T.mega ? 2.2 : 1;
      ctx.translate(x + (u.flash > 0 ? rand(-2, 2) : 0), y); ctx.scale(u.face * m, m);
      ctx.fillStyle = u.flash > 0 ? '#fff' : T.mega ? '#4b4f5c' : '#7a8496'; rr(-18, -5, 36, 10, 5); ctx.fill();
      ctx.fillStyle = '#4b5263'; ctx.beginPath(); ctx.moveTo(-18, -5); ctx.lineTo(-26, -10); ctx.lineTo(-22, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(4, -6, 7, 5, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#ffb347'; ctx.fillRect(-24, -2, 5 + Math.random() * 3, 4);
      ctx.fillStyle = '#3a3f4b'; ctx.fillRect(12, 3, 7, 3);   // cannon
      if (T.mega) { ctx.fillStyle = you ? '#6be86b' : '#c07bff'; ctx.fillRect(-14, -1, 26, 2); }   // team stripe
      if (u.fireT > 0) { ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(20, 4.5, 4, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    } else { // saucer
      const t = u.task;
      if (t && t.beaming) {
        ctx.fillStyle = 'rgba(125,255,122,0.35)';
        const ty = t.kind === 'abductUnit' ? t.target.y : u.y + 45;
        ctx.beginPath(); ctx.moveTo(x - 8, y + 6); ctx.lineTo(x + 8, y + 6); ctx.lineTo(x + 18, ty + 6); ctx.lineTo(x - 18, ty + 6); ctx.closePath(); ctx.fill();
      } else if (u.state === 'mining' && !t) {
        ctx.fillStyle = 'rgba(255,240,150,0.25)';
        ctx.beginPath(); ctx.moveTo(x - 6, y + 6); ctx.lineTo(x + 6, y + 6); ctx.lineTo(x + 14, GROUND); ctx.lineTo(x - 14, GROUND); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = you ? '#9be7ff' : '#ffb0d0'; ctx.beginPath(); ctx.ellipse(x, y - 4, 8, 8, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(x, y - 5, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = you ? '#5a6b7d' : '#7d5a6b'; ctx.beginPath(); ctx.ellipse(x, y + 1, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe066'; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.arc(x + k * 8, y + 2, 1.6, 0, Math.PI * 2); ctx.fill(); }
      if (u.carry) drawBlock(x - 4, y + 7, 8);
      ctx.restore();
    }
  } else {
    const walking = u.state !== 'mining' && u.state !== 'healing' && !u.aiming && !(T.builder && u.atSpot);
    const y = u.y + (walking ? -Math.abs(bob(u, 3)) : 0);
    const big = u.type === 'bigguy' ? 1.7 : u.type === 'sneaky' ? 0.8 : 1;
    if (u.type === 'sneaky') ctx.globalAlpha = 0.6;   // ghostly: only other Sneakies can touch them
    ctx.translate(x + (u.flash > 0 ? rand(-2, 2) : 0), y); ctx.scale(big * u.face, big);
    // legs
    ctx.strokeStyle = dark; ctx.lineWidth = 2;
    const sw = walking ? Math.sin(now() * 14 + u.id) * 3 : 0;
    ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(-3 + sw, 0); ctx.moveTo(2, -4); ctx.lineTo(3 - sw, 0); ctx.stroke();
    // body + head
    ctx.fillStyle = u.type === 'sneaky' ? (you ? '#3c8a4a' : '#5a3a8a') : body;
    ctx.beginPath(); ctx.ellipse(0, -8, 4.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -17, 6, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    if (u.flash > 0) {   // got hit: flash white
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.ellipse(0, -8, 4.5, 5, 0, 0, Math.PI * 2); ctx.ellipse(0, -17, 6, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    // eyes
    ctx.fillStyle = '#111';
    if (u.type === 'sneaky') { ctx.fillRect(-6, -19, 12, 3); ctx.fillStyle = '#fff'; ctx.fillRect(0, -18.5, 3, 1.5); ctx.fillRect(-3.5, -18.5, 2, 1.5); }
    else { ctx.beginPath(); ctx.ellipse(2.5, -17.5, 1.8, 2.5, 0.3, 0, Math.PI * 2); ctx.ellipse(-1.5, -17.5, 1.5, 2.3, -0.3, 0, Math.PI * 2); ctx.fill(); }
    // antenna or hat
    if (T.builder) { ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.ellipse(0, -21, 7, 4, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(-8, -21.5, 16, 1.5); }
    else if (u.type !== 'sneaky') { ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(1, -27); ctx.stroke(); ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(1, -27, 1.5, 0, Math.PI * 2); ctx.fill(); }
    // builder hammer swing / martian punch
    if (T.builder && !walking) { ctx.save(); ctx.translate(5, -9); ctx.rotate(Math.sin(now() * 12 + u.id) * 0.8); ctx.fillStyle = '#8a5a1c'; ctx.fillRect(0, -1, 7, 2); ctx.fillStyle = '#999'; ctx.fillRect(6, -3, 3, 6); ctx.restore(); }
    if (T.dmg) {   // ray gun
      ctx.fillStyle = '#4a4f5c'; ctx.fillRect(3, -11, 8, 2.5); ctx.fillRect(3, -10, 2, 4);
      ctx.fillStyle = you ? '#7dff7a' : '#ff6bd6'; ctx.fillRect(9, -11, 2, 2.5);
      if (u.fireT > 0) { ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(12.5, -9.8, 2.6, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
    // carried stone
    for (let k = 0; k < u.carry; k++) drawBlock(x - 4, y - big * 23 - 8 - k * 7, 8);
  }
  // health bar
  if (u.hp < T.hp) {
    const top = T.mega ? u.y - 30 : T.air ? u.y - 16 : u.y - (u.type === 'bigguy' ? 52 : 34), bw = T.mega ? 40 : 20;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(u.x - bw / 2, top, bw, 3);
    ctx.fillStyle = u.side.isYou ? '#7dff7a' : '#ff6b6b'; ctx.fillRect(u.x - bw / 2, top, bw * Math.max(0, u.hp / T.hp), 3);
  }
}
function drawHud() {
  const m = Math.floor(S.time / 60), sec = Math.floor(S.time % 60);
  rr(W / 2 - 42, 8, 84, 30, 10); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  text(m + ':' + String(sec).padStart(2, '0'), W / 2, 24, 20, S.time < 20 ? '#ff6b6b' : '#fff');
  text('YOU ▲' + height(S.you), 16, 22, 18, '#7dff7a', 'left');
  text('▲' + height(S.bot) + ' BOT', W - 16, 22, 18, '#d6a6ff', 'right');
  text('🔮 ' + S.bot.mana, W - 16, 44, 11, '#d6a6ff', 'right', false);

  // bottom bar
  ctx.fillStyle = '#2a1240'; ctx.fillRect(0, BAR_Y, W, H - BAR_Y);
  const me = S.you, segW = (W - 70) / MANA_MAX;
  text('🔮', 22, 333, 12, '#fff', 'center', false);
  for (let k = 0; k < MANA_MAX; k++) {
    rr(36 + k * segW, 329, segW - 3, 8, 3);
    ctx.fillStyle = k < me.mana ? '#c77dff' : 'rgba(255,255,255,0.1)'; ctx.fill();
  }
  if (me.mana < MANA_MAX) { rr(36 + me.mana * segW, 329, (segW - 3) * (me.mTimer / MANA_RATE), 8, 3); ctx.fillStyle = 'rgba(199,125,255,0.4)'; ctx.fill(); }
  text(me.mana + '/' + MANA_MAX, W - 18, 333, 10, '#c77dff', 'right', false);
  if (me.catchup > 0) text('⚡ catch-up +' + Math.round(me.catchup * 100) + '% mana', W / 2, 318, 11, '#ffe066', 'center');

  CARDS.forEach((c, k) => {
    const r = cardRect(k), info = TYPES[c] || ABIL[c], ok = me.mana >= info.cost && !(c === 'saucer' && hasSaucer(me)), armed = me.armed === c;
    rr(r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = armed ? '#fff' : ABIL[c] ? (ok ? '#ff7b3a' : '#5a3a4a') : (ok ? '#4a2f7a' : '#3a2a4a'); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = armed ? '#ffe066' : ok ? '#c77dff' : '#4a3a5a'; ctx.stroke();
    ctx.globalAlpha = ok ? 1 : 0.45;
    emoji(info.icon, r.x + r.w / 2, r.y + 18, 20);
    text(info.name, r.x + r.w / 2, r.y + 37, 11, armed ? '#2a1240' : '#fff', 'center', false);
    text(info.cost + '🔮', r.x + r.w / 2, r.y + 49, 10, armed ? '#2a1240' : '#e0b3ff', 'center', false);
    ctx.globalAlpha = 1;
  });
  if (me.armed) text(me.armed === 'abduct' ? 'Tap an enemy troop or a glowing top block' : 'Tap where to blow up', W / 2, 56, 14, '#ffe066');
}
function drawFx() {
  for (const c of S.sacs) {   // stone flying up to the gods, with a golden glow
    if (c.delay > 0) continue;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
    ctx.fillStyle = 'rgba(255,233,168,0.35)'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    drawBlock(-5, -5, 10); ctx.restore();
  }
  for (const b of S.booms) {
    ctx.globalAlpha = 1 - b.t / 0.4; ctx.fillStyle = b.small ? '#ff9a3a' : '#ffdd55';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.small ? 5 + b.t * 45 : b.mega ? 26 + b.t * 150 : 20 + b.t * 120, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const b of S.bigBombs) {
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = Math.sin(now() * 40) > 0 ? '#ffe066' : '#ff5a2a'; ctx.beginPath(); ctx.arc(b.x, b.y - 10, 2.8, 0, Math.PI * 2); ctx.fill();
  }
  for (const sh of S.shots) {
    if (sh.bomb) {
      ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(sh.x, sh.y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff9a3a'; ctx.beginPath(); ctx.arc(sh.x, sh.y - 3, 1.5, 0, Math.PI * 2); ctx.fill();
    } else {
      const dx = sh.tx - sh.x, dy = sh.ty - sh.y, d = Math.hypot(dx, dy) || 1;
      ctx.lineCap = 'round';
      ctx.strokeStyle = sh.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sh.x - dx / d * 9, sh.y - dy / d * 9); ctx.lineTo(sh.x, sh.y); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sh.x - dx / d * 6, sh.y - dy / d * 6); ctx.lineTo(sh.x, sh.y); ctx.stroke();
    }
  }
  for (const p of S.parts) { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }
  ctx.globalAlpha = 1;
  for (const t of S.texts) { ctx.globalAlpha = 1 - t.t / 1.3; text(t.text, t.x, t.y - t.t * 25, t.size, t.color); }
  ctx.globalAlpha = 1;
}
function overlay(a = 0.6) { ctx.fillStyle = 'rgba(20,5,40,' + a + ')'; ctx.fillRect(0, 0, W, H); }

let titleT = 0;
function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#1a0b33'; ctx.fillRect(0, 0, innerWidth, innerHeight);
  if (innerHeight > innerWidth) {   // portrait: nudge the player to rotate
    ctx.font = 'bold 18px ' + FONT; ctx.fillStyle = '#ffe066'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('↻ Turn your phone sideways', innerWidth / 2, Math.max(30, offY / 2));
  }
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  if (mode !== 'play') { drawScreen(); ctx.restore(); return; }   // screens.js
  drawBackground();
  drawQuarry();
  drawPyramid(S.you); drawPyramid(S.bot);
  const all = [...S.you.units, ...S.bot.units];
  all.filter(u => u.T.ground).sort((a, b) => a.y - b.y).forEach(drawUnit);
  all.filter(u => u.T.air).forEach(drawUnit);
  drawFx();
  drawHud();
  ctx.restore();
}

// ---------- Main loop ----------
let last = performance.now();
function frame(t) {
  let dt = Math.min(0.5, (t - last) / 1000); last = t;
  titleT += dt;
  while (dt > 0) {   // small fixed steps keep slow phones at real-time speed
    const step = Math.min(0.05, dt); dt -= step;
    if (S && mode === 'play') update(step);
    updateScreens(step);
  }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
