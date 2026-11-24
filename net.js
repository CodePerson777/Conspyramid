// Conspyramid - play online against a friend with a link.
// Two ways to connect:
//  - Local (python server.py): messages go through the server on your computer. Works on home Wi-Fi with no internet.
//  - GitHub Pages: PeerJS (WebRTC), the browsers talk directly; PeerJS's free cloud server only helps them find each other.
// The host runs the real game. The guest sends its taps and draws the snapshots the host streams back,
// flipped so the guest also sees itself on the left in green.
// Loaded after game.js and screens.js.

const NET = { role: null, peer: null, conn: null, code: '', status: '', msg: '', msgT: 0,
              sendT: 0, heard: 0, armed: null, texts: [], readyMe: false, readyThem: false, copied: 0 };
const PEER_PREFIX = 'conspyramid-';
const SNAP_RATE = 1 / 15;   // snapshots per second sent to the guest
const TIMEOUT = 6;          // seconds of silence before we decide the friend is gone
const USE_RELAY = !/github\.io$/.test(location.hostname);   // served by server.py: relay through it

function roomLink() { return (NET.base || location.origin + location.pathname) + '?room=' + NET.code; }
function onLocalhost() { return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname); }
function netNotice(msg) { NET.msg = msg; NET.msgT = 5; }

// ---------- Connection ----------
// Relay connection through server.py. Looks enough like a PeerJS connection for the code below.
function relayConn(code, me) {
  const other = me === 'host' ? 'guest' : 'host', h = {};
  const c = { open: false, alive: true, q: Promise.resolve(),
    on(ev, f) { h[ev] = f; },
    send(m) { this.q = this.q.then(() => fetch('net/send?room=' + code + '&to=' + other, { method: 'POST', body: JSON.stringify(m) })).catch(() => {}); },
    close() { this.alive = false; this.open = false; } };
  (async () => {
    while (c.alive) {
      try {
        const msgs = await (await fetch('net/recv?room=' + code + '&me=' + me)).json();
        for (const m of msgs) {
          if (!c.alive) break;
          if (!c.open) { c.open = true; if (h.open) h.open(); }
          if (h.data) h.data(m);
        }
      } catch (e) { await new Promise(r => setTimeout(r, 1000)); }
    }
  })();
  return c;
}
function relayHost() {
  netLeave();
  NET.role = 'host'; NET.code = Math.random().toString(36).slice(2, 7);
  NET.status = 'Setting up...'; mode = 'lobby';
  const c = relayConn(NET.code, 'host'), peer = { open: false, destroy() { c.close(); } };
  NET.peer = peer; NET.conn = c; wireConn(c);
  c.on('open', () => netStartMatch());   // first message from the guest
  fetch('net/info').then(r => r.json()).then(info => {
    if (NET.peer !== peer) return;
    NET.base = info.base; peer.open = true; NET.status = 'Waiting for your friend to open the link...';
  }).catch(() => { NET.status = "Can't reach the game server. Is server.py running?"; });
}
function relayJoin(code) {
  netLeave();
  NET.role = 'guest'; NET.code = code; NET.status = 'Connecting to your friend...'; mode = 'lobby';
  const c = relayConn(code, 'guest');
  NET.peer = { open: true, destroy() { c.close(); } }; NET.conn = c; wireConn(c);
  c.send({ t: 'hello' });
  setTimeout(() => { if (mode === 'lobby' && NET.role === 'guest') NET.status = "Still trying... is your friend's game open on the link screen?"; }, 6000);
}

function netHost() {
  if (USE_RELAY) { relayHost(); return; }
  if (!window.Peer) { netNotice("Couldn't load the online library. Check your internet."); return; }
  netLeave();
  NET.role = 'host'; NET.code = Math.random().toString(36).slice(2, 7);
  NET.status = 'Setting up...'; mode = 'lobby';
  NET.peer = new Peer(PEER_PREFIX + NET.code);
  NET.peer.on('open', () => { NET.status = 'Waiting for your friend to open the link...'; });
  NET.peer.on('connection', c => {
    if (NET.conn) { c.close(); return; }   // room is full
    NET.conn = c; wireConn(c);
    c.on('open', () => netStartMatch());
  });
  NET.peer.on('error', e => {
    if (e.type === 'unavailable-id') { netHost(); return; }   // code taken: pick another
    NET.status = 'Connection problem: ' + e.type;
  });
}
function netJoin(code) {
  if (USE_RELAY) { relayJoin(code); return; }
  if (!window.Peer) { netNotice("Couldn't load the online library. Check your internet."); mode = 'home'; return; }
  netLeave();
  NET.role = 'guest'; NET.code = code; NET.status = 'Connecting to your friend...'; mode = 'lobby';
  NET.peer = new Peer();
  NET.peer.on('open', () => {
    const c = NET.peer.connect(PEER_PREFIX + code, { reliable: true });
    NET.conn = c; wireConn(c);
    setTimeout(() => { if (mode === 'lobby' && NET.role === 'guest') NET.status = "Still trying... is your friend's game open on the link screen?"; }, 8000);
  });
  NET.peer.on('error', e => {
    NET.status = e.type === 'peer-unavailable' ? "Couldn't find that game. Ask your friend for a new link." : 'Connection problem: ' + e.type;
  });
}
function wireConn(c) {
  NET.heard = 0;
  c.on('data', m => { NET.heard = 0; if (m.t === 'bye') onNetClose(); else if (m.t !== 'ping') onNetData(m); });
  c.on('close', onNetClose);
  c.on('error', onNetClose);
}
function netSend(m) { if (NET.conn && NET.conn.open) NET.conn.send(m); }
function netLeave() {
  const p = NET.peer;
  NET.role = null; NET.conn = null; NET.peer = null; NET.readyMe = NET.readyThem = false; NET.armed = null;
  if (p) try { p.destroy(); } catch (e) { /* already gone */ }
  history.replaceState(null, '', location.pathname);   // drop ?room= so a refresh doesn't rejoin
}
function onNetClose() {
  if (!NET.role) return;
  const wasHost = NET.role === 'host';
  netLeave();
  if (wasHost && mode === 'play' && S) { S.online = false; S.bot.name = 'BOT'; say(W / 2, 90, 'Your friend left. The bot takes over!', '#ffe066', 16); return; }
  if (mode === 'play' || mode === 'lobby') { S = null; mode = 'home'; }
  netNotice(wasHost ? 'Your friend left.' : 'Lost connection to your friend.');
}

// ---------- Messages ----------
function onNetData(m) {
  if (NET.role === 'host') {
    if (mode !== 'play' || !S || !S.online) { if (m.t === 'rematch') { NET.readyThem = true; maybeRematch(); } return; }
    if (m.t === 'deploy' && TYPES[m.c]) deploy(S.bot, m.c);
    else if (m.t === 'cast' && ABIL[m.k]) cast(S.bot, m.k, W - m.x, m.y);
  } else {
    if (m.t === 'start') { S = null; mode = 'lobby'; NET.status = 'Starting the battle...'; NET.armed = null; NET.readyMe = NET.readyThem = false; }
    else if (m.t === 'snap') { if (mode !== 'cutscene') applySnap(m.s); }
    else if (m.t === 'end') { applySnap(m.s); S.result = m.result; S.reason = m.reason; NET.readyMe = NET.readyThem = false; startCutscene(); }
    else if (m.t === 'rematch') NET.readyThem = true;
  }
}
function netStartMatch() {
  newGame(); S.online = true; S.bot.name = 'FRIEND';
  NET.readyMe = NET.readyThem = false; NET.sendT = 0;
  netSend({ t: 'start' }); netSend({ t: 'snap', s: makeSnap() });
}
function netRematch() {
  NET.readyMe = true;
  netSend({ t: 'rematch' });
  maybeRematch();
}
function maybeRematch() { if (NET.role === 'host' && NET.readyMe && NET.readyThem) netStartMatch(); }

// Host: called by endMatch() in game.js.
function netEnd() {
  if (NET.role !== 'host' || !S.online) return;
  const flip = { win: 'lose', lose: 'win', draw: 'draw' };
  NET.readyMe = NET.readyThem = false;
  netSend({ t: 'end', s: makeSnap(), result: flip[S.result], reason: S.reason });
}

// Called every fixed step from the main loop.
function netStep(dt) {
  if (NET.msgT > 0) NET.msgT -= dt;
  if (NET.copied > 0) NET.copied -= dt;
  if (mode !== 'play' || !S) return;
  if (NET.role === 'host' && S.online) {
    NET.sendT += dt;
    if (NET.sendT >= SNAP_RATE) { NET.sendT = 0; netSend({ t: 'snap', s: makeSnap() }); }
  } else if (NET.role === 'guest') guestSmooth(dt);
}

// ---------- Snapshots (host -> guest), flipped left/right ----------
const SWAP = { '#7dff7a': '#ff6bd6', '#ff6bd6': '#7dff7a', '#6be86b': '#c07bff', '#c07bff': '#6be86b' };
const mx = x => Math.round((W - x) * 10) / 10;
const r1 = v => Math.round(v * 10) / 10;
function sideSnap(s, mine) {
  return {
    isYou: mine, name: mine ? 'YOU' : 'FRIEND', dir: -s.dir, cx: W - s.cx, home: W - s.home,
    grid: s.grid.map(row => row.slice().reverse()), stock: s.stock, mana: s.mana, mTimer: r1(s.mTimer), catchup: s.catchup || 0,
    units: s.units.filter(u => u.hp > 0).map(u => ({
      id: u.id, type: u.type, x: mx(u.x), y: r1(u.y), hp: u.hp, carry: u.carry, face: -u.face, state: u.state,
      flash: u.flash > 0 ? 1 : 0, fireT: u.fireT > 0 ? 1 : 0, aiming: u.aiming ? 1 : 0, atSpot: u.atSpot ? 1 : 0,
      task: u.task ? { kind: u.task.kind, beaming: !!u.task.beaming, ty: u.task.target ? r1(u.task.target.y) : 0 } : null,
    })),
  };
}
function makeSnap() {
  return {
    t: r1(S.t), time: S.time, quarry: S.quarry,
    you: sideSnap(S.bot, true), bot: sideSnap(S.you, false),
    loose: S.loose.map(l => ({ x: mx(l.x), y: l.y, n: l.n })),
    shots: S.shots.map(sh => ({ x: mx(sh.x), y: r1(sh.y), tx: mx(sh.tx), ty: r1(sh.ty), bomb: sh.bomb, color: SWAP[sh.color] || sh.color })),
    bigBombs: S.bigBombs.map(b => ({ x: mx(b.x), y: r1(b.y), vx: -b.vx, vy: b.vy })),
    booms: S.booms.map(b => ({ x: mx(b.x), y: b.y, t: r1(b.t), small: b.small, mega: b.mega })),
    sacs: S.sacs.map(c => ({ x: mx(c.x), y: r1(c.y), vx: -c.vx, vy: c.vy, rot: r1(c.rot), spin: c.spin, t: c.t, delay: c.delay })),
    parts: S.parts.slice(-60).map(p => ({ x: mx(p.x), y: r1(p.y), vx: -p.vx, vy: p.vy, life: p.life, t: r1(p.t), color: SWAP[p.color] || p.color })),
    texts: S.texts.filter(t => t.to !== 'host').map(t => ({ x: mx(t.x), y: t.y, text: t.text, color: t.color, size: t.size, t: t.t })),
  };
}
// Guest: turn a snapshot into a game state the normal drawing code understands.
function applySnap(n) {
  const old = S, oldPos = {};
  if (old && old.you) for (const s of [old.you, old.bot]) for (const u of s.units) oldPos[u.id] = u;
  for (const s of [n.you, n.bot]) {
    for (const u of s.units) {
      u.T = TYPES[u.type]; u.side = s; u.flash = u.flash ? 0.2 : 0; u.fireT = u.fireT ? 0.12 : 0;
      if (u.task) u.task.target = { y: u.task.ty };
      u.tx = u.x; u.ty = u.y;   // where the host says it is; we glide there
      const o = oldPos[u.id]; if (o) { u.x = o.x; u.y = o.y; }
    }
  }
  n.you.enemy = n.bot; n.bot.enemy = n.you;
  n.you.armed = NET.armed; n.online = true;
  n.texts = n.texts.concat(NET.texts.filter(t => t.t < 1.3));
  S = n;
  if (mode === 'lobby') mode = 'play';
}
function guestSmooth(dt) {
  const k = Math.min(1, dt * 15);
  for (const s of [S.you, S.bot]) for (const u of s.units) { u.x += (u.tx - u.x) * k; u.y += (u.ty - u.y) * k; }
  for (const sh of S.shots) {
    const dx = sh.tx - sh.x, dy = sh.ty - sh.y, d = Math.hypot(dx, dy), step = (sh.bomb ? 230 : 380) * dt;
    if (d > step) { sh.x += dx / d * step; sh.y += dy / d * step; }
  }
  for (const b of S.bigBombs) { b.vy += 300 * dt; b.x += b.vx * dt; b.y = Math.min(GROUND, b.y + b.vy * dt); }
  for (const t of NET.texts) t.t += dt;
  NET.texts = NET.texts.filter(t => t.t < 1.3);
  S.t += dt;
  updateFx(dt);
}
function guestSay(text, color = '#f88') {
  const t = { x: W / 2, y: BAR_Y - 30, text, color, size: 13, t: 0 };
  NET.texts.push(t); S.texts.push(t);
}
// Guest taps: same buttons as offline, but actions go to the host.
function guestTap(x, y) {
  const me = S.you;
  for (let k = 0; k < CARDS.length; k++) {
    if (!inRect(x, y, cardRect(k))) continue;
    const c = CARDS[k];
    if (ABIL[c]) {
      if (NET.armed === c) NET.armed = null;
      else if (me.mana < ABIL[c].cost) guestSay('Need ' + ABIL[c].cost + ' mana');
      else if (!me.units.some(u => u.T.saucer)) guestSay('No Saucer! Deploy one first');
      else NET.armed = c;
    } else { NET.armed = null; netSend({ t: 'deploy', c }); }
    me.armed = NET.armed;
    return;
  }
  if (NET.armed && y < BAR_Y) { netSend({ t: 'cast', k: NET.armed, x, y }); NET.armed = null; me.armed = null; }
}

// ---------- Lobby screen ----------
const LOBBY = {
  copy:   { x: W / 2 - 165, y: 214, w: 160, h: 46 },
  share:  { x: W / 2 + 5,   y: 214, w: 160, h: 46 },
  cancel: { x: W / 2 - 60,  y: 300, w: 120, h: 38 },
};
function lobbyTap(x, y) {
  if (inRect(x, y, LOBBY.cancel)) { netLeave(); mode = 'home'; return; }
  if (NET.role !== 'host' || !NET.peer || !NET.peer.open) return;
  if (inRect(x, y, LOBBY.copy)) {
    const done = () => { NET.copied = 2; };
    if (navigator.clipboard) navigator.clipboard.writeText(roomLink()).then(done, () => prompt('Copy this link:', roomLink()));
    else prompt('Copy this link:', roomLink());
  } else if (inRect(x, y, LOBBY.share)) {
    if (navigator.share) navigator.share({ title: 'Conspyramid', text: 'Battle me in Conspyramid!', url: roomLink() }).catch(() => {});
    else prompt('Copy this link:', roomLink());
  }
}
function drawLobby() {
  drawBackground();
  ctx.fillStyle = 'rgba(20,5,40,0.55)'; ctx.fillRect(0, 0, W, H);
  drawUfoAt(W / 2 - 150 + Math.sin(titleT * 1.3) * 10, 70 + Math.sin(titleT * 3) * 5, true, 1.2);
  drawUfoAt(W / 2 + 150 + Math.sin(titleT * 1.5 + 1) * 10, 70 + Math.sin(titleT * 3 + 2) * 5, false, 1.2);
  text(NET.role === 'host' ? 'PLAY A FRIEND' : 'JOINING A BATTLE', W / 2, 70, 30, '#ffe066');
  if (NET.role === 'host' && NET.peer && NET.peer.open) {
    text('Send this link to your friend:', W / 2, 122, 16, '#fff', 'center', false);
    rr(W / 2 - 250, 140, 500, 40, 10); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
    text(roomLink(), W / 2, 161, roomLink().length > 50 ? 12 : 15, '#9be7ff', 'center', false);
    if (onLocalhost() && !NET.base) text('⚠️ This is a localhost link. It only works on this computer until the game is online.', W / 2, 196, 11, '#ffb0b0', 'center', false);
    button(LOBBY.copy, NET.copied > 0 ? '✅ Copied!' : '📋 Copy link', '#4a2f7a', 17);
    button(LOBBY.share, '📤 Share', '#4a2f7a', 17);
  }
  const dots = '.'.repeat(1 + Math.floor(titleT * 2) % 3);
  text(NET.status.replace(/\.\.\.$/, dots), W / 2, NET.role === 'host' ? 282 : 180, 14, '#c9a0ff', 'center', false);
  button(LOBBY.cancel, 'Cancel', '#7a2f4a', 15);
}

addEventListener('pagehide', () => netSend({ t: 'bye' }));
// Heartbeat both ways, so a closed tab or lost wifi is noticed quickly. A timer (not the draw loop)
// so it keeps going while the tab is in the background.
setInterval(() => {
  if (!NET.conn || !NET.conn.open) return;
  netSend({ t: 'ping' });
  NET.heard += 1;
  if (NET.heard > TIMEOUT) onNetClose();
}, 1000);

// ---------- Start: opened from a friend's link? ----------
(function () {
  const code = new URLSearchParams(location.search).get('room');
  if (code && /^[a-z0-9]{3,12}$/.test(code)) { store.set('seenIntro', true); netJoin(code); }
})();
