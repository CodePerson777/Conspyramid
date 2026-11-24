// Conspyramid - intro, home screen and the post-battle "present day" cutscene.
// Loaded after game.js and uses its globals (S, mode, ctx, W, H, drawing helpers).

// ---------- Saved stats (per browser; works without storage too) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('conspyramid.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('conspyramid.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
};

function updateScreens(dt) {
  if (mode === 'intro') intro.t += dt;
  if (mode === 'cutscene' && S && S.cut) updateCutscene(dt);
}
function drawScreen() {
  if (mode === 'intro') drawIntro();
  else if (mode === 'home') drawHome();
  else if (mode === 'cutscene') drawCutscene();
}
function button(r, label, color, size = 20) {
  rr(r.x, r.y, r.w, r.h, 14);
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#2a1240'; ctx.stroke();
  text(label, r.x + r.w / 2, r.y + r.h / 2 + 1, size, '#fff');
}
function drawUfoAt(x, y, isYou = true, size = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
  ctx.fillStyle = isYou ? '#9be7ff' : '#ffb0d0'; ctx.beginPath(); ctx.ellipse(0, -4, 10, 10, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = isYou ? '#6be86b' : '#c07bff'; ctx.beginPath(); ctx.arc(0, -6, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = isYou ? '#5a6b7d' : '#7d5a6b'; ctx.beginPath(); ctx.ellipse(0, 2, 24, 6.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe066'; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.arc(k * 9, 3, 1.8, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
// A pyramid that's `shown` blocks into being built (bottom row first).
function drawGrowingPyramid(cx, base, size, shown, gold = false) {
  let n = 0;
  for (let r = 0; r < base; r++) for (let i = 0; i < base - r; i++) {
    if (n++ >= shown) return;
    drawBlock(cx - (base - r) * size / 2 + i * size, GROUND - (r + 1) * size, size, gold && r === base - 1);
  }
}

// ---------- Intro ----------
const INTRO = [
  'You are an alien commander.',
  'Your goal: confuse future historians...',
  '...by building MASSIVE structures in the desert.',
  'But other aliens have the same idea.',
  'Build the tallest one. Leave the humans baffled.',
];
const intro = { line: 0, t: 0 };
const SKIP_BTN = { x: W - 92, y: 12, w: 78, h: 30 };
function startIntro() { intro.line = 0; intro.t = 0; mode = 'intro'; }
function introChars() { return Math.floor(intro.t * 30); }
function introTap(x, y) {
  if (inRect(x, y, SKIP_BTN)) { goHome(); return; }
  if (introChars() < INTRO[intro.line].length) { intro.t = 99; return; }   // finish typing first
  intro.line++; intro.t = 0;
  if (intro.line >= INTRO.length) goHome();
}
function drawIntro() {
  const t = titleT, L = intro.line;
  drawBackground();
  ctx.fillStyle = 'rgba(10,0,30,0.35)'; ctx.fillRect(0, 0, W, GROUND);
  ctx.fillStyle = '#2a1240'; ctx.fillRect(0, BAR_Y - 10, W, H - BAR_Y + 10);

  // Your pyramid grows as the story goes on.
  const target = [0, 3, 12, 22, 36][L], prev = [0, 0, 3, 12, 22][L];
  const shown = Math.floor(prev + (target - prev) * Math.min(1, intro.t / 2));
  drawGrowingPyramid(L >= 3 ? 250 : W / 2, 8, 20, shown, L === 4);

  // Your saucer flies in, then beams blocks down.
  const ux = L === 0 ? -40 + Math.min(1, intro.t / 1.8) * (W / 2 + 40) : (L >= 3 ? 250 : W / 2) + Math.sin(t * 1.5) * 20;
  const uy = 110 + Math.sin(t * 3) * 6;
  if (L >= 1 && shown < target) {
    ctx.fillStyle = 'rgba(200,255,150,0.25)';
    ctx.beginPath(); ctx.moveTo(ux - 8, uy + 8); ctx.lineTo(ux + 8, uy + 8); ctx.lineTo(ux + 40, GROUND); ctx.lineTo(ux - 40, GROUND); ctx.closePath(); ctx.fill();
  }
  drawUfoAt(ux, uy, true, 1.6);

  // A rival shows up and starts its own pyramid.
  if (L >= 3) {
    const rx = W + 40 - Math.min(1, (L === 3 ? intro.t : 9) / 1.8) * (W + 40 - 560);
    drawGrowingPyramid(560, 8, 20, L === 3 ? Math.floor(Math.min(1, intro.t / 2) * 14) : 20);
    drawUfoAt(rx, 100 + Math.sin(t * 3 + 2) * 6, false, 1.6);
    if (L === 4) text('VS', W / 2 + 5, 200, 40, '#ffe066');
  }

  // Story text, typed out.
  const line = INTRO[L].slice(0, introChars());
  text(line, W / 2, 352, 24, '#fff');
  if (introChars() >= INTRO[L].length && Math.sin(t * 5) > -0.3) text('tap to continue ▶', W / 2, 386, 12, '#c9a0ff', 'center', false);
  for (let k = 0; k < INTRO.length; k++) {   // progress dots
    ctx.fillStyle = k <= L ? '#ffe066' : 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.arc(W / 2 - (INTRO.length - 1) * 8 + k * 16, 322, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  button(SKIP_BTN, 'Skip ▶', '#4a2f7a', 14);
}

// ---------- Home screen ----------
const HOME = {
  battle: { x: W / 2 - 115, y: 168, w: 230, h: 66 },
  how:    { x: W / 2 - 115, y: 244, w: 110, h: 40 },
  intro:  { x: W / 2 + 5,   y: 244, w: 110, h: 40 },
};
let showHelp = false;
function goHome() { store.set('seenIntro', true); showHelp = false; mode = 'home'; }
function homeTap(x, y) {
  if (showHelp) { showHelp = false; return; }
  if (inRect(x, y, HOME.battle)) newGame();
  else if (inRect(x, y, HOME.how)) showHelp = true;
  else if (inRect(x, y, HOME.intro)) startIntro();
}
function drawHome() {
  const t = titleT;
  drawBackground();
  ctx.fillStyle = '#2a1240'; ctx.fillRect(0, BAR_Y, W, H - BAR_Y);
  drawGrowingPyramid(110, 8, 18, 99, true);
  drawGrowingPyramid(W - 110, 6, 18, 99);
  drawUfoAt(110 + Math.sin(t * 1.2) * 30, 110 + Math.sin(t * 3) * 5, true, 1.3);
  drawUfoAt(W - 110 + Math.sin(t * 1.4 + 1) * 30, 130 + Math.sin(t * 3 + 2) * 5, false, 1.1);
  text('CONSPYRAMID', W / 2, 66, 54, '#ffe066');
  text('aliens built them. now they fight over them.', W / 2, 106, 15, '#fff');
  const wins = store.get('wins', 0), losses = store.get('losses', 0);
  text('🏆 ' + wins + ' wins   💀 ' + losses + ' losses', W / 2, 140, 15, '#c9a0ff');
  const pulse = 1 + Math.sin(t * 4) * 0.03, b = HOME.battle;
  ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(pulse, pulse); ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
  button(b, '⚔️ BATTLE', '#ff7b3a', 30);
  ctx.restore();
  button(HOME.how, 'How to play', '#4a2f7a', 14);
  button(HOME.intro, 'Watch intro', '#4a2f7a', 14);
  text('Home base, tech tree and real opponents coming soon!', W / 2, 362, 13, '#a58cc9', 'center', false);
  if (showHelp) drawHelp();
}
function drawHelp() {
  ctx.fillStyle = 'rgba(20,5,40,0.85)'; ctx.fillRect(0, 0, W, H);
  rr(60, 40, W - 120, 300, 18); ctx.fillStyle = '#3a1f63'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#c77dff'; ctx.stroke();
  text('HOW TO PLAY', W / 2, 74, 26, '#ffe066');
  const lines = [
    'Spend 🔮 mana on troops. They fetch stone and your pyramid builds itself.',
    '👽 Martian: grabs stone and shoots enemies',
    '🥷 Sneaky: only fights other Sneakies    🦍 Big Guy: carries 5 stone',
    '🚀 Battleship: bombs troops    🔨 Builder: builds faster',
    '🛸 Saucer: casts 🌀 Abduct and 💥 Explode',
    '💣 Mega Ship: drops 3 big bombs on their front line. Only another Mega Ship can stop it',
    'Tallest pyramid after 2:30 wins, or finish yours first!',
  ];
  lines.forEach((l, k) => text(l, W / 2, 112 + k * 28, 14, k === 6 ? '#7dff7a' : '#fff', 'center', false));
  text('tap anywhere to close', W / 2, 322, 12, '#c9a0ff', 'center', false);
}

// ---------- Post-battle cutscene: present day ----------
const CUT_L = 230, CUT_R = 570, CUT_BS = 22;
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const SHIRT = ['#ff5a5a', '#3aa0ff', '#ffd23a', '#5ad16b', '#ff8ad8', '#ffffff', '#ff9a3a'];
const QUOTES_WIN = ['Wow!', 'So tall!', 'Aliens?!', 'Selfie!', 'How??', 'Amazing!'];
const CUT_RESULTS = { win: 'YOU WIN!', lose: 'YOU LOSE!', draw: 'DRAW!' };
const CUT_COLORS = { win: '#3ad16b', lose: '#ff5a5a', draw: '#ffb300' };
const CUT_BTNS = { home: { x: W / 2 - 170, y: 344, w: 160, h: 44 }, again: { x: W / 2 + 10, y: 344, w: 160, h: 44 } };

function startCutscene() {
  mode = 'cutscene';
  if (S.result === 'win') store.set('wins', store.get('wins', 0) + 1);
  if (S.result === 'lose') store.set('losses', store.get('losses', 0) + 1);
  const c = S.cut = { t: 0, tourists: [] };
  for (let k = 0; k < 28; k++) {
    let goal;
    if (S.result === 'win') goal = CUT_L;
    else if (S.result === 'lose') goal = CUT_R;
    else goal = k % 2 ? CUT_L : CUT_R;
    const fromLeft = goal === CUT_L ? Math.random() < 0.7 : Math.random() < 0.3;
    c.tourists.push({
      x: fromLeft ? rand(-60, -15) : rand(W + 15, W + 60), y: GROUND + rand(10, 40),
      tx: goal + rand(-150, 150), delay: 2.8 + k * 0.18, speed: rand(45, 75),
      skin: pick(SKIN), shirt: pick(SHIRT), hat: Math.random() < 0.4, camera: Math.random() < 0.6,
      quote: k % 4 === 0 ? pick(QUOTES_WIN) : null, flashT: rand(0, 3), id: k,
    });
  }
  c.tourists.sort((a, b) => a.y - b.y);
}
function updateCutscene(dt) {
  const c = S.cut; c.t += dt;
  for (const p of c.tourists) {
    if (c.t < p.delay) continue;
    const dx = p.tx - p.x;
    if (Math.abs(dx) > 2) { p.x += Math.sign(dx) * Math.min(Math.abs(dx), p.speed * dt); p.walking = true; }
    else { p.walking = false; p.flashT -= dt; if (p.flashT < -0.15) p.flashT = rand(1.5, 4); }
  }
}
function cutsceneTap(x, y) {
  const c = S.cut;
  if (c.t < 6.5) {   // skip ahead to the results
    c.t = 6.5;
    for (const p of c.tourists) { p.x = p.tx; p.walking = false; }
    return;
  }
  if (inRect(x, y, CUT_BTNS.home)) goHome();
  else if (inRect(x, y, CUT_BTNS.again)) newGame();
}
function drawStone(x, y, size) {
  ctx.fillStyle = '#d8b377'; ctx.fillRect(x + 0.5, y + 0.5, size - 1, size - 1);
  ctx.fillStyle = '#e6c891'; ctx.fillRect(x + 2, y + 2, size - 4, 3);
  ctx.strokeStyle = '#a8844a'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
}
function drawAncientPyramid(side, cx) {
  forSlots((r, i) => {
    if (side.grid[r][i]) drawStone(cx - (BASE - r) * CUT_BS / 2 + i * CUT_BS, GROUND - (r + 1) * CUT_BS, CUT_BS);
  });
}
function drawTourist(p) {
  const t = titleT, bobY = p.walking ? -Math.abs(Math.sin(t * 9 + p.id)) * 2.5 : 0;
  const x = p.x, y = p.y + bobY, face = p.walking ? Math.sign(p.tx - p.x) || 1 : 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(1.3 * face, 1.3);
  const sw = p.walking ? Math.sin(t * 12 + p.id) * 3 : 0;
  ctx.strokeStyle = '#3a3a5a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-2, -6); ctx.lineTo(-2 + sw, 0); ctx.moveTo(2, -6); ctx.lineTo(2 - sw, 0); ctx.stroke();
  ctx.fillStyle = p.shirt; ctx.fillRect(-4, -15, 8, 9);
  ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(0, -19, 4, 0, Math.PI * 2); ctx.fill();
  if (p.hat) { ctx.fillStyle = '#f5e6a8'; ctx.fillRect(-6, -23, 12, 1.5); ctx.fillRect(-3.5, -26, 7, 3); }
  if (p.camera) {
    ctx.fillStyle = '#222'; ctx.fillRect(3, -15, 5, 4);
    if (!p.walking && p.flashT < 0) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(8, -13, 5, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
  if (p.quote && !p.walking && S.cut.t > p.delay + 1) {
    ctx.font = 'bold 11px ' + FONT;
    const w = ctx.measureText(p.quote).width + 12;
    rr(x - w / 2, y - 52, w, 18, 8); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 3, y - 34); ctx.lineTo(x + 3, y - 34); ctx.lineTo(x, y - 29); ctx.fill();
    text(p.quote, x, y - 43, 11, '#2a1240', 'center', false);
  }
}
function drawCutscene() {
  const c = S.cut, t = c.t;
  if (t < 2.6) {   // "Thousands of years later..."
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = Math.min(1, t / 0.6, (2.6 - t) / 0.6);
    text('Thousands of years later...', W / 2, H / 2, 30, '#fff', 'center', false);
    ctx.globalAlpha = 1;
    return;
  }
  // Present-day desert
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, '#5ab4ff'); g.addColorStop(1, '#cdeeff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND);
  ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(690, 60, 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9fb7cc';   // far-off city skyline
  [[20, 30], [50, 18], [70, 40], [100, 24], [690, 22], [715, 44], [745, 28], [770, 36]].forEach(([x, h]) => ctx.fillRect(x, GROUND - h, 22, h));
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (const [cx, cy] of [[150, 60], [420, 40], [560, 85]]) {
    const dx = ((cx + titleT * 8) % (W + 120)) - 60;
    ctx.beginPath(); ctx.arc(dx, cy, 14, 0, Math.PI * 2); ctx.arc(dx + 16, cy - 6, 16, 0, Math.PI * 2); ctx.arc(dx + 32, cy, 12, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ecd08f'; ctx.fillRect(0, GROUND, W, H - GROUND);

  drawAncientPyramid(S.you, CUT_L);
  drawAncientPyramid(S.bot, CUT_R);
  text('PRESENT DAY', 16, 20, 16, '#fff', 'left');

  // Tumbleweed at the loser's pyramid
  if (S.result !== 'draw' && t > 3.5) {
    const lx = (S.result === 'win' ? CUT_R : CUT_L) - 160 + ((t - 3.5) * 40) % 320;
    ctx.save(); ctx.translate(lx, GROUND + 44); ctx.rotate(t * 4);
    ctx.strokeStyle = '#a07a40'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(0, 0, 7, k, k + 2.5); ctx.stroke(); }
    ctx.restore();
  }
  c.tourists.forEach(drawTourist);
  // Height signs in front of each pyramid (drawn over the crowd)
  if (t > 4) {
    for (const [side, cx, label] of [[S.you, CUT_L, 'YOUR PYRAMID'], [S.bot, CUT_R, 'RIVAL PYRAMID']]) {
      rr(cx - 62, GROUND + 4, 124, 22, 6); ctx.fillStyle = '#7a5230'; ctx.fill();
      text(label + '  ▲' + height(side), cx, GROUND + 15, 12, '#fff', 'center', false);
    }
  }

  if (t > 6) {
    rr(W / 2 - 200, 26, 400, 92, 18); ctx.fillStyle = 'rgba(42,18,64,0.85)'; ctx.fill();
    text(CUT_RESULTS[S.result], W / 2, 60, 42, CUT_COLORS[S.result]);
    const sub = { win: 'Tourists flock to your pyramid!', lose: "Everyone's visiting theirs instead...", draw: "The tourists can't decide." }[S.result];
    text(sub + '  (' + S.reason + ')', W / 2, 98, 13, '#fff', 'center', false);
  }
  if (t > 7) {
    button(CUT_BTNS.home, '🏠 Home', '#4a2f7a', 18);
    button(CUT_BTNS.again, '⚔️ Battle again', '#ff7b3a', 18);
  } else if (Math.sin(titleT * 5) > -0.3) {
    text('tap to skip', W - 14, H - 12, 11, '#7a5a30', 'right', false);
  }
}

// ---------- Start ----------
if (store.get('seenIntro', false)) mode = 'home'; else startIntro();
