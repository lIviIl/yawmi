(function(){'use strict';
/* ===== core: helpers, state, progression ===== */
var D = window.YD;
var L = JSON.parse(document.getElementById('i18n').textContent);
var AR = document.documentElement.lang === 'ar';
var PAGE = document.body.getAttribute('data-page');
var KEYS = ['jidhr', 'film', 'mathal', 'rawabit'];
var STOP = null, TIMERS = [];

function addKid(el, c) {
  if (c == null || c === false) return;
  if (Array.isArray(c)) { c.forEach(function (x) { addKid(el, x); }); return; }
  el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
}
function h(tag, p) {
  var el = document.createElement(tag), k, i;
  p = p || {};
  for (k in p) {
    if (k === 'class') el.className = p[k];
    else if (k === 'text') el.textContent = p[k];
    else if (k === 'html') el.innerHTML = p[k];
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), p[k]);
    else if (p[k] != null && p[k] !== false) el.setAttribute(k, p[k]);
  }
  for (i = 2; i < arguments.length; i++) addKid(el, arguments[i]);
  return el;
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
function range(n) { var a = [], i; for (i = 0; i < n; i++) a.push(i); return a; }
function fill(s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); }
function norm(s) {
  return String(s).toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
}
function xmur3(str) {
  var i, hh = 1779033703 ^ str.length;
  for (i = 0; i < str.length; i++) { hh = Math.imul(hh ^ str.charCodeAt(i), 3432918353); hh = hh << 13 | hh >>> 19; }
  return function () { hh = Math.imul(hh ^ hh >>> 16, 2246822507); hh = Math.imul(hh ^ hh >>> 13, 3266489909); return (hh ^= hh >>> 16) >>> 0; };
}
function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function rngFrom(seed) { return mulberry32(xmur3(String(seed))()); }
function shuffle(arr, rnd) {
  var a = arr.slice(), i, j, t;
  for (i = a.length - 1; i > 0; i--) { j = Math.floor(rnd() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }
function every(fn, ms) { var id = setInterval(fn, ms); TIMERS.push(id); return id; }
function stopCurrent() {
  if (STOP) { try { STOP(); } catch (e) { /* ignore */ } STOP = null; }
  TIMERS.forEach(function (id) { clearInterval(id); }); TIMERS = [];
}

/* ----- dates ----- */
var EPOCH = (function () { var p = String(L.launch || '2026-11-16').split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); })();
function dayNum() { var d = new Date(); return Math.max(0, Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 864e5)); }
function untilMidnight() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1) - n; }
function pad(x) { return (x < 10 ? '0' : '') + x; }
function hms(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60); }
function mmss(ms) { var s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + pad(s % 60); }
function hm(ms) { var m = Math.max(0, Math.floor(ms / 60000)); return Math.floor(m / 60) + L.h + ' ' + (m % 60) + L.m; }
function weekdayOf(d) { return new Date(EPOCH + d * 864e5).getUTCDay(); }
var TIER_BY_WD = [2, 0, 0, 1, 1, 2, 2];   /* Sun hard, Mon-Tue easy, Wed-Thu medium, Fri-Sat hard */
function tierOfDay(d) { return TIER_BY_WD[weekdayOf(d)]; }
function tierIndex(d) { var t = tierOfDay(d), n = 0, i; for (i = 0; i < d; i++) if (tierOfDay(i) === t) n++; return n; }
function dailyIndex(key, n) { var o = shuffle(range(n), rngFrom('yawmi-' + key)); return o[((dayNum() % n) + n) % n]; }

/* ----- storage ----- */
var S = {
  get: function (k, d) { try { var v = localStorage.getItem('ym:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('ym:' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
};

/* ----- clock: counts only while the page is visible, starts on first action ----- */
function Clock(ms0) {
  var acc = ms0 || 0, t0 = 0, run = false, done = false, paused = false, self = {};
  function onVis() {
    if (done) return;
    if (document.hidden) { if (run) { acc += Date.now() - t0; run = false; paused = true; } }
    else if (paused) { t0 = Date.now(); run = true; paused = false; }
  }
  document.addEventListener('visibilitychange', onVis);
  self.poke = function () { if (!run && !done && !paused) { t0 = Date.now(); run = true; } };
  self.ms = function () { return acc + (run ? Date.now() - t0 : 0); };
  self.running = function () { return run; };
  self.stop = function () { if (run) { acc += Date.now() - t0; run = false; } done = true; document.removeEventListener('visibilitychange', onVis); return acc; };
  self.off = function () { document.removeEventListener('visibilitychange', onVis); };
  return self;
}

/* ----- progression: XP, levels, badges ----- */
var BADGE_IDS = ['first', 'perfect', 'speedy', 'streak3', 'streak7', 'streak14', 'streak30', 'sweep', 'blitz', 'duelwin'];
function prof() {
  var p = S.get('profile', null) || {};
  p.xp = p.xp || 0; p.badges = p.badges || {}; p.best = p.best || {}; p.blitz = p.blitz || {}; p.sweeps = p.sweeps || 0; p.sweepDay = p.sweepDay == null ? -1 : p.sweepDay;
  return p;
}
function saveProf(p) { S.set('profile', p); }
function levelOf(xp) { return 1 + Math.floor(Math.sqrt(xp / 40)); }
function levelInfo(xp) { var l = levelOf(xp), lo = 40 * (l - 1) * (l - 1), hi = 40 * l * l; return { lvl: l, lo: lo, hi: hi, pct: Math.round(100 * (xp - lo) / (hi - lo)) }; }
function titleOf(lvl) { var t = L.titles, r = t[0][1], i; for (i = 0; i < t.length; i++) if (lvl >= t[i][0]) r = t[i][1]; return r; }
function addXP(n) {
  var p = prof(), before = levelOf(p.xp), after;
  p.xp += n; saveProf(p); after = levelOf(p.xp);
  return { xp: p.xp, gained: n, up: after > before ? after : 0 };
}
function unlock(id) {
  var p = prof();
  if (p.badges[id]) return false;
  p.badges[id] = dayNum(); saveProf(p);
  toast(L.badgeUnlocked + ': ' + L.badge[id].n, '🏅');
  return true;
}

/* ----- global daily streak with shields ----- */
function stk() { var s = S.get('streak', null) || {}; return { last: s.last == null ? -99 : s.last, streak: s.streak || 0, best: s.best || 0, shield: s.shield || 0, days: s.days || [] }; }
function liveStreak() {
  var s = stk(), d = dayNum();
  if (s.last === d || s.last === d - 1) return s.streak;
  if (s.last === d - 2 && s.shield > 0) return s.streak;
  return 0;
}
function playedToday() { return stk().last === dayNum(); }
function touchStreak() {
  var s = stk(), d = dayNum(), r = { grew: false, saved: false, streak: s.streak, milestone: 0, shieldEarned: false };
  if (s.last === d) return r;
  if (s.last === d - 1) s.streak++;
  else if (s.last === d - 2 && s.shield > 0) { s.shield--; s.streak++; r.saved = true; }
  else s.streak = 1;
  s.last = d; s.best = Math.max(s.best, s.streak);
  if (s.streak % 7 === 0 && s.shield < 2) { s.shield++; r.shieldEarned = true; }
  s.days = s.days.filter(function (x) { return x > d - 60; }); s.days.push(d);
  S.set('streak', s);
  r.grew = true; r.streak = s.streak;
  if ([3, 7, 14, 30, 60, 100].indexOf(s.streak) > -1) r.milestone = s.streak;
  return r;
}

/* ----- scoring ----- */
function pointsFor(win, tries, max, ms) { return win ? Math.round(400 + (max - tries) * 100 + Math.max(0, 200 - ms / 500)) : 0; }
function fmtPts(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

/* ----- optional leaderboard API (same origin, only when enabled in config) ----- */
var LB = !!(L.cfg && L.cfg.leaderboard);
var CID = (function () { var c = S.get('cid', null); if (!c) { c = Math.random().toString(36).slice(2, 12); S.set('cid', c); } return c; })();
function apiCall(path, body) {
  if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch'));
  var opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
  return fetch(path, opt).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
}
function submitScore(game, mode, score, ms) {
  if (!LB) return Promise.resolve(null);
  return apiCall('/api/score', { cid: CID, name: S.get('nick', ''), game: game, mode: mode, day: dayNum(), score: Math.round(score), ms: Math.round(ms) }).catch(function () { return null; });
}
function getBoard(game, mode, day) {
  return apiCall('/api/board?game=' + game + '&mode=' + mode + '&day=' + day + '&cid=' + CID);
}

/* ===== ui kit ===== */
var GCOL = { jidhr: '#E0482F', film: '#16A9A4', mathal: '#F5B72E', rawabit: '#8B6CF6' };
var GGLYPH = { jidhr: 'ج', film: 'ف', mathal: 'م', rawabit: 'ر' };
var EMO = { g: '🟩', y: '🟨', x: '⬛', r: '🟥', p: '🟪', b: '🟦' };
var COL = { g: '#16A9A4', y: '#F5B72E', x: '#2A3866', r: '#E0482F', p: '#8B6CF6', b: '#3D7BFF' };
var PATHS = {
  share: 'M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M12 3v12M7 8l5-5 5 5',
  copy: 'M9 9h10a1 1 0 011 1v10a1 1 0 01-1 1H9a1 1 0 01-1-1V10a1 1 0 011-1zM5 15V5a1 1 0 011-1h10',
  image: 'M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 16l-5-5-9 8',
  clock: 'M12 21a8 8 0 100-16 8 8 0 000 16zM12 9v4l3 2M9 2h6',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  swords: 'M4 4l10 10M4 4v5M4 4h5M20 4L10 14M20 4v5M20 4h-5M6 16l-3 3M18 16l3 3M9 19l-3 3M15 19l3 3',
  play: 'M7 4l13 8-13 8z',
  calendar: 'M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zM4 10h16M8 3v4M16 3v4',
  trophy: 'M7 4h10v5a5 5 0 01-10 0zM7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4M12 14v4M8 21h8',
  lock: 'M6 11h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1zM8 11V8a4 4 0 018 0v3',
  check: 'M4 12l5 5 11-11',
  shield: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
  star: 'M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z',
  shuffle: 'M3 7h4l10 10h4M3 17h4l3-3M14 9l3-2h4M18 4l3 3-3 3M18 14l3 3-3 3',
  back: 'M15 5l-7 7 7 7'
};
function ic(name) {
  return h('span', { class: 'icw', 'aria-hidden': 'true', html: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="' + PATHS[name] + '"/></svg>' });
}
var FLAME = '<svg class="flameSvg" viewBox="0 0 32 40" aria-hidden="true"><path class="f1" d="M16 2C17 9 26 14 26 25 26 33 21 38 16 38 11 38 6 33 6 25 6 19 10 16 12 11 13 14 14 15 15.5 15.5 15 11 14.5 6 16 2Z" fill="#E0482F"/><path class="f2" d="M16 17C17 22 22 24 22 30 22 34 19.5 36 16 36 12.5 36 10 34 10 30 10 26 14 24 16 17Z" fill="#F5B72E"/><path class="f3" d="M16 27C17 29 19 30 19 32.5 19 34.5 17.7 35.5 16 35.5 14.3 35.5 13 34.5 13 32.5 13 30 15 29 16 27Z" fill="#FFF1C7"/></svg>';
function gameUrl(key) { return (AR ? '/ar/' : '/') + key + '/'; }
function gname(key) { return AR ? L.names[key].ar : L.names[key].en; }
function ttl(key) { return L.names[key].en + ' ' + L.names[key].ar; }

/* ----- buttons with press + ripple ----- */
function btn(label, o) {
  o = o || {};
  var lab = h('span', { text: label }), b = h('button', { class: 'btn ' + (o.cls || ''), type: 'button', onclick: o.onclick }, o.icon ? ic(o.icon) : null, lab);
  b._lab = lab;
  b.addEventListener('pointerdown', function (e) {
    try {
      var r = b.getBoundingClientRect(), s = h('i', { class: 'rip' });
      s.style.left = (e.clientX - r.left) + 'px'; s.style.top = (e.clientY - r.top) + 'px';
      b.appendChild(s); setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 650);
    } catch (err) { /* ripple is cosmetic */ }
  });
  return b;
}
function link(label, href, cls, icon) { return h('a', { class: 'btn ' + (cls || ''), href: href }, icon ? ic(icon) : null, h('span', { text: label })); }

/* ----- toast, confetti, count-up ----- */
function toast(msg, icon) {
  var box = document.getElementById('toasts'), t;
  if (!box) return;
  t = h('div', { class: 'toast', role: 'status' }, icon ? h('b', { text: icon }) : null, h('span', { text: msg }));
  box.appendChild(t);
  setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4200);
}
function confetti(n, power) {
  var cv = document.getElementById('confetti');
  if (!cv || !cv.getContext || typeof requestAnimationFrame !== 'function') return;
  var ctx = cv.getContext('2d'), W = cv.width = window.innerWidth, H = cv.height = window.innerHeight, cols = ['#E0482F', '#F5B72E', '#16A9A4', '#F6ECD6', '#8B6CF6'], ps = [], i;
  for (i = 0; i < (n || 90); i++) ps.push({ x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35, vx: (Math.random() - 0.5) * 14 * (power || 1), vy: -Math.random() * 14 - 4, g: 0.35 + Math.random() * 0.2, s: 6 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[i % cols.length], life: 120 + Math.random() * 60 });
  (function frame() {
    var alive = 0;
    ctx.clearRect(0, 0, W, H);
    ps.forEach(function (p) {
      if (p.life <= 0 || p.y > H + 20) return;
      alive++; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.r += p.vr; p.life--;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.6); ctx.restore();
    });
    if (alive) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  })();
}
function countUp(el, to, ms, fmt) {
  fmt = fmt || String;
  if (typeof requestAnimationFrame !== 'function' || !to) { el.textContent = fmt(to); return; }
  var t0 = Date.now();
  (function step() {
    var k = Math.min(1, (Date.now() - t0) / (ms || 900));
    el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  })();
}
function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } }

/* ----- top bar chips ----- */
function refreshChips() {
  var cs = document.getElementById('chipStreak'), cl = document.getElementById('chipLvl'), n = liveStreak(), p = prof(), li = levelInfo(p.xp);
  if (cs) {
    clear(cs);
    cs.className = 'chip streak' + (n > 0 ? ' on' : '') + (n > 0 && !playedToday() ? ' risk' : '');
    cs.appendChild(h('span', { class: 'fl', html: FLAME })); cs.appendChild(h('b', { text: String(n) }));
    cs.setAttribute('title', L.streak);
  }
  if (cl) { clear(cl); cl.appendChild(h('span', { text: L.level + ' ' })); cl.appendChild(h('b', { text: String(li.lvl) })); cl.appendChild(h('i', { class: 'xpbar', style: '--p:' + li.pct + '%' })); }
}

/* ----- share card v2 ----- */
function rr(x, px, py, w, hh, r) {
  x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + hh, r); x.arcTo(px + w, py + hh, px, py + hh, r);
  x.arcTo(px, py + hh, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
}
function star8(x, cx, cy, r) {
  var i, a, k;
  for (k = 0; k < 2; k++) {
    x.beginPath();
    for (i = 0; i < 4; i++) { a = Math.PI / 4 * (2 * i + k) + Math.PI / 4; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    x.closePath(); x.stroke();
  }
}
function lanternShape(x, cx, top, s) {
  var g = x.createRadialGradient(cx, top + 70 * s, 4, cx, top + 70 * s, 90 * s);
  g.addColorStop(0, 'rgba(255,214,120,.55)'); g.addColorStop(1, 'rgba(255,214,120,0)');
  x.fillStyle = g; x.fillRect(cx - 100 * s, top - 10, 200 * s, 220 * s);
  x.strokeStyle = '#0A1026'; x.lineWidth = 4;
  x.fillStyle = '#F5B72E'; x.beginPath(); x.moveTo(cx - 16 * s, top + 22 * s); x.lineTo(cx + 16 * s, top + 22 * s); x.lineTo(cx + 24 * s, top + 40 * s); x.lineTo(cx - 24 * s, top + 40 * s); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#E0482F'; x.beginPath(); x.moveTo(cx - 24 * s, top + 40 * s); x.lineTo(cx + 24 * s, top + 40 * s); x.lineTo(cx + 34 * s, top + 90 * s); x.lineTo(cx + 18 * s, top + 126 * s); x.lineTo(cx - 18 * s, top + 126 * s); x.lineTo(cx - 34 * s, top + 90 * s); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = 'rgba(255,236,170,.9)'; x.beginPath(); x.ellipse(cx, top + 84 * s, 11 * s, 26 * s, 0, 0, 6.3); x.fill();
  x.fillStyle = '#F5B72E'; x.beginPath(); x.moveTo(cx - 18 * s, top + 126 * s); x.lineTo(cx + 18 * s, top + 126 * s); x.lineTo(cx + 8 * s, top + 142 * s); x.lineTo(cx - 8 * s, top + 142 * s); x.closePath(); x.fill(); x.stroke();
}
function drawCard(o) {
  var W = 1080, H = 1350, c = h('canvas', { width: W, height: H }), x = c.getContext('2d'), i, j, g, bun = ['#E0482F', '#F5B72E', '#16A9A4', '#F6ECD6'], gc = GCOL[o.game] || '#F5B72E';
  g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0A1230'); g.addColorStop(1, '#1B2F6E'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(255,255,255,.055)'; x.lineWidth = 3;
  for (j = 0; j < H; j += 150) for (i = 0; i < W; i += 150) star8(x, i + 75, j + 75, 48);
  [[160, 330, '#E0482F'], [930, 1090, '#16A9A4'], [900, 360, gc]].forEach(function (p) {
    var rg = x.createRadialGradient(p[0], p[1], 10, p[0], p[1], 460); rg.addColorStop(0, p[2] + '55'); rg.addColorStop(1, p[2] + '00'); x.fillStyle = rg; x.fillRect(0, 0, W, H);
  });
  x.fillStyle = '#0A1026'; x.fillRect(0, 0, W, 28);
  for (i = 0; i < W; i += 36) { x.fillStyle = bun[(i / 36) % 4]; x.fillRect(i + 8, 7, 18, 14); }
  x.strokeStyle = '#0A1026'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 36); x.lineTo(W, 36); x.stroke();
  for (i = 0; i * 72 < W + 72; i++) { x.fillStyle = bun[i % 4]; x.beginPath(); x.moveTo(i * 72, 38); x.lineTo(i * 72 + 72, 38); x.lineTo(i * 72 + 36, 112 + (i % 2) * 8); x.closePath(); x.fill(); }
  lanternShape(x, 96, 120, 0.9); lanternShape(x, W - 96, 120, 0.9);
  x.textAlign = 'center';
  rr(x, W / 2 - 80, 168, 160, 160, 26); x.fillStyle = gc; x.fill(); x.lineWidth = 8; x.strokeStyle = '#0A1026'; x.stroke();
  x.setLineDash([10, 10]); x.lineWidth = 3; x.strokeStyle = 'rgba(10,16,38,.55)'; rr(x, W / 2 - 68, 180, 136, 136, 16); x.stroke(); x.setLineDash([]);
  x.fillStyle = '#0A1026'; x.font = '400 110px Lalezar, Cairo, sans-serif'; x.fillText(GGLYPH[o.game] || '', W / 2, 288);
  x.fillStyle = '#F6ECD6'; x.font = '400 126px Lalezar, Cairo, sans-serif'; x.fillText(o.title, W / 2, 470);
  x.fillStyle = '#A9B4D6'; x.font = '700 44px Cairo, sans-serif'; x.fillText(o.sub, W / 2, 530);
  var rows = o.grid || [], area = 330, step = Math.min(84, Math.floor(area / Math.max(rows.length, 1))), y0 = 575;
  rows.forEach(function (r, ri) {
    var cs = Math.min(step - 10, Math.floor(760 / r.length) - 10), st = cs + 10, x0 = (W - r.length * st + 10) / 2;
    r.forEach(function (v, ci) { rr(x, x0 + ci * st, y0 + ri * step, cs, cs, 12); x.fillStyle = COL[v] || COL.x; x.fill(); x.lineWidth = 5; x.strokeStyle = '#0A1026'; x.stroke(); });
  });
  x.fillStyle = '#F5B72E'; x.font = '400 170px Lalezar, Cairo, sans-serif'; x.fillText(o.main, W / 2, 1010);
  x.fillStyle = '#F6ECD6'; x.font = '700 44px Cairo, sans-serif'; x.fillText(o.mainLabel || '', W / 2, 1062);
  var stats = o.stats || [], pw = 290, gap = 24, sx = (W - stats.length * pw - (stats.length - 1) * gap) / 2;
  stats.forEach(function (s, k) {
    var px = sx + k * (pw + gap);
    rr(x, px, 1096, pw, 116, 18); x.fillStyle = k === 1 ? '#E0482F' : (k === 0 ? '#16A9A4' : '#F5B72E'); x.fill(); x.lineWidth = 6; x.strokeStyle = '#0A1026'; x.stroke();
    x.setLineDash([9, 9]); x.lineWidth = 3; x.strokeStyle = 'rgba(10,16,38,.5)'; rr(x, px + 9, 1105, pw - 18, 98, 11); x.stroke(); x.setLineDash([]);
    x.fillStyle = '#0A1026'; x.font = '700 30px Cairo, sans-serif'; x.fillText(s.k, px + pw / 2, 1138);
    x.font = '400 56px Lalezar, Cairo, sans-serif'; x.fillText(s.v, px + pw / 2, 1192);
  });
  x.fillStyle = '#F6ECD6'; x.font = '700 40px Cairo, sans-serif'; x.fillText(o.rank || '', W / 2, 1262);
  x.fillStyle = '#F5B72E'; x.font = '700 40px Cairo, sans-serif'; x.fillText(o.url, W / 2, 1316);
  return c;
}
function whenFonts(cb) {
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('400 90px Lalezar'), document.fonts.load('700 40px Cairo')]).then(cb, cb);
  else cb();
}
function saveImage(canvas) {
  canvas.toBlob(function (b) {
    var f = typeof File === 'function' ? new File([b], 'yawmi.png', { type: 'image/png' }) : null;
    if (f && navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f] }).catch(function () {});
    else { var a = h('a', { href: URL.createObjectURL(b), download: 'yawmi.png' }); document.body.appendChild(a); a.click(); document.body.removeChild(a); }
  }, 'image/png');
}
function copy(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(function () {});
  var t = h('textarea'); t.value = text; document.body.appendChild(t); t.select();
  try { document.execCommand('copy'); } catch (e) { /* ignore */ }
  document.body.removeChild(t); return Promise.resolve();
}
function flash(b, msg) { var s = b._lab || b, o = s.textContent; s.textContent = msg; setTimeout(function () { s.textContent = o; }, 1400); }
function pageUrl() { return location.origin + location.pathname; }
function gridText(res) { var e = res.emo || EMO; return res.grid.map(function (r) { return r.map(function (v) { return e[v] || EMO[v] || EMO.x; }).join(''); }).join('\n'); }
function rankLine() { var li = levelInfo(prof().xp); return L.level + ' ' + li.lvl + ' · ' + titleOf(li.lvl); }

/* ----- streak banner + result panel ----- */
function streakBanner(st) {
  var num = h('b', { text: '0' }), msg;
  if (st.saved) msg = L.shieldUsed; else if (st.shieldEarned) msg = L.shieldEarned; else if (st.milestone) msg = fill(L.milestone, { n: st.milestone }); else msg = fill(L.comeBack, { n: st.streak + 1 });
  countUp(num, st.streak, 800);
  return h('div', { class: 'sbanner' + (st.milestone ? ' big' : '') }, h('span', { class: 'fl', html: FLAME }),
    h('div', {}, h('div', { class: 'num' }, num, ' ' + L.dayStreak), h('div', { class: 'sub', text: msg })));
}
function nextUp(except) {
  var d = dayNum(), left = KEYS.filter(function (k) { var sv = S.get(k + ':d:' + d, null); return k !== except && !(sv && sv.done); });
  if (!left.length) return null;
  var box = h('div', { class: 'nextup' }, h('p', { text: L.upNext }));
  left.slice(0, 3).forEach(function (k) { box.appendChild(h('a', { class: 'mini c-' + k, href: gameUrl(k) }, h('b', { text: GGLYPH[k] }), h('span', { text: gname(k) }))); });
  return box;
}
function resultPanel(o) {
  var box = h('div', { class: 'result ' + (o.tone || '') }), row, bS, bC, bI, st;
  box.appendChild(h('h3', { text: o.head }));
  if (o.stats) {
    st = h('div', { class: 'pills' });
    o.stats.forEach(function (s) { st.appendChild(h('div', { class: 'pill2' }, h('span', { text: s.v }), h('small', { text: s.k }))); });
    box.appendChild(st);
  }
  if (o.xp) {
    var xv = h('b', { text: '+0' });
    countUp(xv, o.xp.gained, 900, function (n) { return '+' + n; });
    box.appendChild(h('div', { class: 'xp' }, h('span', { class: 'star' }, ic('star')), xv, h('span', { text: ' XP' }), o.xp.up ? h('em', { text: fill(L.levelUp, { n: o.xp.up }) }) : null));
  }
  if (o.streak) box.appendChild(streakBanner(o.streak));
  if (o.body) box.appendChild(o.body);
  if (o.extra) box.appendChild(o.extra);
  box.appendChild(h('pre', { text: o.text }));
  bS = btn(L.share, { cls: 'gold', icon: 'share', onclick: function () { if (navigator.share) navigator.share({ text: o.text }).catch(function () {}); else copy(o.text).then(function () { flash(bS, L.copied); }); } });
  bC = btn(L.copy, { icon: 'copy', onclick: function () { copy(o.text).then(function () { flash(bC, L.copied); }); } });
  bI = btn(L.save, { icon: 'image', onclick: function () { whenFonts(function () { saveImage(drawCard(o.card)); }); } });
  row = h('div', { class: 'row' }, bS, bC, bI);
  box.appendChild(row);
  if (o.buttons && o.buttons.length) { row = h('div', { class: 'row' }); o.buttons.forEach(function (b) { row.appendChild(b); }); box.appendChild(row); }
  if (o.next) box.appendChild(o.next);
  if (o.celebrate) { confetti(o.celebrate, 1); buzz([30, 40, 30]); }
  return box;
}

/* ===== games ===== */
function parseRoots(lines, tier) {
  return lines.map(function (s) {
    var p = s.split('|');
    return { root: p[0], tier: tier, words: p[1].split(',').map(function (w) { var q = w.split(':'); return [q[0], q[1]]; }) };
  });
}
var ROOTS = [parseRoots(D.roots, 0), parseRoots(D.rootsM, 1), parseRoots(D.rootsH, 2)];
var FILMS = D.films.map(function (s, i) {
  var p = s.split('|');
  return { id: i, ar: p[0], en: p[1], e: p[2], y: +p[3], a: p[4], ae: p[5], g: p[6], k: norm(p[0]) + ' ' + p[1].toLowerCase() };
});
var MATHAL = D.mathal.map(function (s) { var p = s.split('|'); return { ar: p[0], en: p[1] }; });
var RAWC = D.raw.map(function (s) { var p = s.split('|'); return { lvl: +p[0], theme: p[1], ar: p[2], en: p[3], words: p[4].split(','), rule: p[5] || '' }; });

/* ----- Jidhr ----- */
var LET = ['ءابتثجحخ', 'دذرزسشصض', 'طظعغفقكل', 'منهوي'], ALL = LET.join('');
function evalRoot(g, ans) {
  var res = ['x', 'x', 'x'], left = {}, i;
  for (i = 0; i < 3; i++) { if (g[i] === ans[i]) res[i] = 'g'; else left[ans[i]] = (left[ans[i]] || 0) + 1; }
  for (i = 0; i < 3; i++) if (res[i] !== 'g' && left[g[i]] > 0) { res[i] = 'y'; left[g[i]]--; }
  return res;
}
function jidhrFor(d) {
  var t = tierOfDay(d), pool = ROOTS[t], order = shuffle(range(pool.length), rngFrom('jidhr-' + t));
  return pool[order[tierIndex(d) % pool.length]];
}
function mapLetter(k) { k = String(k); if ('أإآؤئ'.indexOf(k) > -1) return 'ء'; if (k === 'ى') return 'ي'; return k; }
function playJidhr(host, puz, o) {
  var ans = puz.root.split(''), rows = (o.rows || []).slice(), cur = [], keys = {}, finished = false, clock = o.clock, flipRow = -1, shownPrev = 0;
  var wordsEl = h('div', { class: 'words' }), gridEl = h('div', { class: 'grid3' }), msg = h('p', { class: 'msg', 'aria-live': 'polite' }), kb = h('div', { class: 'kb', dir: 'rtl' });
  function st() { var won = rows.length > 0 && rows[rows.length - 1] === puz.root; return { won: won, lost: !won && rows.length >= 6 }; }
  function render() {
    var s = st(), over = s.won || s.lost, shown = over ? 5 : Math.min(5, 1 + rows.length), stat = {}, rank = { g: 3, y: 2, x: 1 }, r, c, g, ev, row, cell;
    clear(wordsEl);
    puz.words.slice(0, shown).forEach(function (w, i) {
      wordsEl.appendChild(h('div', { class: 'patch' + (i >= shownPrev ? ' pop' : '') }, h('span', { class: 'aw', lang: 'ar', text: w[0] }), AR ? null : h('small', { text: w[1] })));
    });
    shownPrev = shown;
    clear(gridEl);
    for (r = 0; r < 6; r++) {
      row = h('div', { class: 'row3', dir: 'rtl' });
      g = rows[r] ? rows[r].split('') : (r === rows.length && !over ? cur : []);
      ev = rows[r] ? evalRoot(g, ans) : [];
      for (c = 0; c < 3; c++) {
        cell = h('div', { class: 'sq ' + (ev[c] || '') + (g[c] ? ' on' : '') + (r === rows.length && !ev[c] && c === cur.length - 1 ? ' typed' : '') + (r === flipRow ? ' flip' : ''), lang: 'ar', text: g[c] || '' });
        if (r === flipRow) cell.style.animationDelay = (c * 140) + 'ms';
        row.appendChild(cell);
        if (ev[c] && (!stat[g[c]] || rank[ev[c]] > rank[stat[g[c]]])) stat[g[c]] = ev[c];
      }
      gridEl.appendChild(row);
    }
    flipRow = -1;
    Object.keys(keys).forEach(function (ch) { keys[ch].className = 'key ' + (stat[ch] || ''); });
  }
  function add(ch) { var s = st(); if (s.won || s.lost || cur.length >= 3) return; clock.poke(); cur.push(ch); msg.textContent = ''; render(); }
  function del() { cur.pop(); msg.textContent = ''; render(); }
  function finish() {
    var s = st(), body, ms;
    if (finished || (!s.won && !s.lost)) return;
    finished = true; ms = clock.stop();
    body = h('div', { class: 'reveal' }, h('div', { class: 'rootbig', dir: 'rtl', lang: 'ar', text: ans.join(' ') }));
    o.done({ won: s.won, tries: rows.length, ms: ms, body: body, grid: rows.map(function (r) { return evalRoot(r.split(''), ans); }) });
  }
  function enter() {
    var s = st(); if (s.won || s.lost) return;
    if (cur.length < 3) { msg.textContent = L.jidhr.short; buzz(40); return; }
    clock.poke(); rows.push(cur.join('')); cur = []; flipRow = rows.length - 1; o.save({ rows: rows, ms: clock.ms() }); render();
    setTimeout(finish, 520);
  }
  function onKey(e) {
    var k;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') { enter(); e.preventDefault(); }
    else if (e.key === 'Backspace') del();
    else { k = mapLetter(e.key); if (k.length === 1 && ALL.indexOf(k) > -1) add(k); }
  }
  LET.forEach(function (rowStr) {
    var r = h('div');
    rowStr.split('').forEach(function (ch) { keys[ch] = h('button', { class: 'key', type: 'button', lang: 'ar', text: ch, onclick: function () { add(ch); } }); r.appendChild(keys[ch]); });
    kb.appendChild(r);
  });
  kb.appendChild(h('div', {}, h('button', { class: 'key wide', type: 'button', text: L.del, onclick: del }), h('button', { class: 'key wide go', type: 'button', text: L.enter, onclick: enter })));
  host.appendChild(h('p', { class: 'hint', text: L.jidhr.hint }));
  if (puz.tier > 0) host.appendChild(h('p', { class: 'hint warn', text: L.jidhr.weak }));
  host.appendChild(wordsEl); host.appendChild(gridEl); host.appendChild(msg); host.appendChild(kb);
  document.addEventListener('keydown', onKey);
  render();
  if (st().won || st().lost) finish();
  return function () { document.removeEventListener('keydown', onKey); };
}
function jidhrReveal(res, puz) {
  res.body.appendChild(h('div', { class: 'words' }, puz.words.map(function (w) { return h('div', { class: 'patch' }, h('span', { class: 'aw', lang: 'ar', text: w[0] }), h('small', { text: w[1] })); })));
}

/* ----- Film ----- */
function decadeText(y) { var d = Math.floor(y / 10) * 10; return (L.decades && L.decades[d]) || (d + 's'); }
function playFilm(host, puz, o) {
  var rows = (o.rows || []).slice(), sel = null, finished = false, clock = o.clock;
  var emoEl = h('div', { class: 'emoji', 'aria-label': 'emoji', text: puz.e }), clueEl = h('ul', { class: 'clues' }), histEl = h('div', { class: 'hist' });
  var msg = h('p', { class: 'msg', 'aria-live': 'polite' }), box = h('div', { class: 'guessbox' }), list = h('div', { class: 'sugg' });
  var input = h('input', { type: 'text', class: 'in', placeholder: L.film.ph, autocomplete: 'off', 'aria-label': L.film.ph });
  var go = btn(L.guess, { cls: 'gold', icon: 'play', onclick: function () { guess(); } });
  go.disabled = true;
  function st() { var won = rows.length > 0 && rows[rows.length - 1] === puz.id; return { won: won, lost: !won && rows.length >= 6 }; }
  function clues() {
    return [[L.clue.words, fill(L.film.words, { n: puz.ar.split(' ').length })], [L.clue.genre, L.genres[puz.g] || puz.g], [L.clue.decade, decadeText(puz.y)],
      [L.clue.actor, AR ? puz.a : puz.ae], [L.clue.letter, puz.ar.charAt(0)], [L.clue.year, String(puz.y)]];
  }
  function render() {
    var s = st(), over = s.won || s.lost, n = over ? 6 : Math.min(6, 1 + rows.length);
    clear(clueEl);
    clues().forEach(function (c, i) {
      clueEl.appendChild(i < n ? h('li', { class: i === n - 1 && rows.length ? 'new' : '' }, h('b', { text: c[0] }), h('span', { lang: i === 3 || i === 4 ? 'ar' : null, text: c[1] })) : h('li', { class: 'lock' }, ic('lock'), h('span', { text: c[0] })));
    });
    clear(histEl);
    rows.forEach(function (id) { histEl.appendChild(h('div', { class: id === puz.id ? 'g' : 'x', text: (AR ? FILMS[id].ar : FILMS[id].en) + (id === puz.id ? ' ✓' : ' ✗') })); });
    box.hidden = over;
  }
  function pickFilm(f) { sel = f; input.value = AR ? f.ar : f.en; clear(list); go.disabled = false; }
  function suggest() {
    var q = norm(input.value), m;
    clock.poke(); sel = null; go.disabled = true; clear(list);
    if (!q) return;
    m = FILMS.filter(function (f) { return f.k.indexOf(q) > -1 && rows.indexOf(f.id) < 0; }).slice(0, 6);
    if (!m.length) { list.appendChild(h('p', { class: 'hint', text: L.film.none })); return; }
    m.forEach(function (f) { list.appendChild(h('button', { type: 'button', text: f.ar + ' · ' + f.en, onclick: function () { pickFilm(f); } })); });
  }
  function guess() {
    if (!sel) return;
    clock.poke(); rows.push(sel.id); sel = null; input.value = ''; go.disabled = true; clear(list); o.save({ rows: rows, ms: clock.ms() }); render();
    if (!st().won) buzz(40);
    finish();
  }
  function finish() {
    var s = st(), body, ms;
    if (finished || (!s.won && !s.lost)) return;
    finished = true; ms = clock.stop();
    body = h('div', { class: 'reveal' }, h('div', { class: 'emoji' , text: puz.e }), h('div', { class: 'rootbig', lang: 'ar', text: puz.ar }), h('p', { class: 'trans', text: puz.en + ' · ' + puz.y + ' · ' + (AR ? puz.a : puz.ae) }));
    o.done({ won: s.won, tries: rows.length, ms: ms, body: body, emo: { g: '🟩', x: '🟥' }, grid: [rows.map(function (id) { return id === puz.id ? 'g' : 'x'; })] });
  }
  input.addEventListener('input', suggest);
  input.addEventListener('keydown', function (e) {
    var m;
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (sel) guess(); else { m = FILMS.filter(function (f) { return f.k.indexOf(norm(input.value)) > -1 && rows.indexOf(f.id) < 0; })[0]; if (m && norm(input.value)) pickFilm(m); }
  });
  box.appendChild(input); box.appendChild(list); box.appendChild(go);
  host.appendChild(h('p', { class: 'hint', text: L.film.hint }));
  host.appendChild(emoEl); host.appendChild(clueEl); host.appendChild(msg); host.appendChild(box); host.appendChild(histEl);
  render(); finish();
  return function () {};
}

/* ----- Mathal (proverb with decoy words) ----- */
function mathalDecoys(puz) {
  var sol = puz.ar.split(' '), n = sol.length, cnt = n <= 5 ? 2 : (n <= 8 ? 3 : 4), pool = [];
  MATHAL.forEach(function (m) { if (m !== puz) m.ar.split(' ').forEach(function (t) { if (t.length > 1 && sol.indexOf(t) < 0 && pool.indexOf(t) < 0) pool.push(t); }); });
  return shuffle(pool, rngFrom('dec-' + puz.ar)).slice(0, cnt);
}
function playMathal(host, puz, o) {
  var sol = puz.ar.split(' '), n = sol.length, rows = (o.rows || []).map(function (r) { return r.slice(); }), slots = [], i, finished = false, clock = o.clock, used, last;
  var all = sol.concat(mathalDecoys(puz)), order = shuffle(range(all.length), rngFrom('m-' + puz.ar));
  var chips = order.map(function (src, k) { return { id: k, text: all[src] }; });
  for (i = 0; i < n; i++) slots.push(null);
  var slotEl = h('div', { class: 'slots', dir: 'rtl' }), poolEl = h('div', { class: 'pool', dir: 'rtl' }), histEl = h('div', { class: 'hist2' });
  var hintEl = h('p', { class: 'hint' }), msg = h('p', { class: 'msg', 'aria-live': 'polite' });
  var bCheck = btn(L.check, { cls: 'gold', icon: 'check', onclick: function () { check(); } }), bClear = btn(L.clear, { onclick: function () { clearUnlocked(); } });
  function st() { var l = rows[rows.length - 1], won = !!l && l.every(function (t, k) { return t === sol[k]; }); return { won: won, lost: !won && rows.length >= 4 }; }
  function locked() { var l = rows[rows.length - 1]; return sol.map(function (t, k) { return !!l && l[k] === t; }); }
  if (rows.length) {
    used = {}; last = rows[rows.length - 1];
    last.forEach(function (t, k) {
      if (t !== sol[k]) return;
      var c = chips.filter(function (x) { return x.text === t && !used[x.id]; })[0];
      if (c) { used[c.id] = 1; slots[k] = c; }
    });
  }
  function render() {
    var s = st(), fin = s.won || s.lost, lk = locked(), usedIds = {}, full;
    slots.forEach(function (c) { if (c) usedIds[c.id] = 1; });
    clear(slotEl);
    slots.forEach(function (c, k) {
      slotEl.appendChild(h('button', { class: 'slot' + (c ? ' on' : '') + (lk[k] ? ' g' : ''), type: 'button', lang: 'ar', disabled: fin || lk[k], text: c ? c.text : String(k + 1),
        onclick: function () { if (c && !lk[k]) { slots[k] = null; render(); } } }));
    });
    clear(poolEl);
    chips.forEach(function (c) {
      if (usedIds[c.id] || fin) return;
      poolEl.appendChild(h('button', { class: 'wchip', type: 'button', lang: 'ar', text: c.text, onclick: function () {
        var k = slots.indexOf(null); if (k < 0) return; clock.poke(); slots[k] = c; msg.textContent = ''; render();
      } }));
    });
    clear(histEl);
    rows.forEach(function (att) {
      var line = h('div', { class: 'att', dir: 'rtl' });
      att.forEach(function (t, k) { line.appendChild(h('span', { class: 'tok ' + (t === sol[k] ? 'g' : 'x'), lang: 'ar', text: t })); });
      histEl.appendChild(line);
    });
    full = slots.every(function (c) { return !!c; });
    bCheck.disabled = !full || fin; bClear.disabled = fin;
    hintEl.textContent = (rows.length >= 2 && !fin) ? (AR ? L.mathal.first + ': ' + sol[0] : L.mathal.hint + ': ' + puz.en) : fill(L.mathal.how, { n: all.length - n });
    bCheck.hidden = fin; bClear.hidden = fin;
  }
  function clearUnlocked() { var lk = locked(); slots = slots.map(function (c, k) { return lk[k] ? c : null; }); render(); }
  function check() {
    var att, ok, s, right;
    if (!slots.every(function (c) { return !!c; })) return;
    clock.poke(); att = slots.map(function (c) { return c.text; });
    rows.push(att); o.save({ rows: rows, ms: clock.ms() });
    ok = att.every(function (t, k) { return t === sol[k]; });
    right = att.filter(function (t, k) { return t === sol[k]; }).length;
    slots = slots.map(function (c, k) { return att[k] === sol[k] ? c : null; });
    s = st(); msg.textContent = (!ok && !s.lost) ? fill(L.mathal.left, { n: right, m: n }) : '';
    if (!ok) buzz(40);
    render(); finish();
  }
  function finish() {
    var s = st(), body, ms;
    if (finished || (!s.won && !s.lost)) return;
    finished = true; ms = clock.stop();
    body = h('div', { class: 'reveal' }, h('div', { class: 'rootbig', dir: 'rtl', lang: 'ar', text: puz.ar }), AR ? null : h('p', { class: 'trans', text: puz.en }));
    o.done({ won: s.won, tries: rows.length, ms: ms, body: body, grid: rows.map(function (att) { return att.map(function (t, k) { return t === sol[k] ? 'g' : 'x'; }); }) });
  }
  host.appendChild(hintEl); host.appendChild(slotEl); host.appendChild(msg); host.appendChild(poolEl);
  host.appendChild(h('div', { class: 'row' }, bClear, bCheck)); host.appendChild(histEl);
  render(); finish();
  return function () {};
}

/* ----- Rawabit (Connections-style, generated from the category bank) ----- */
var RCOL = ['y', 'g', 'r', 'p'];
function inRule(cat, w) {
  var k;
  if (!cat.rule) return false;
  k = cat.rule.split(':');
  return k[0] === 'has' ? w.indexOf(k[1]) > -1 : w.charAt(0) === k[1];
}
function makeRawabit(seed) {
  var byLvl = [[], [], [], []], attempt, rnd, cats, themes, twin, groups, words, ok, tiles;
  RAWC.forEach(function (c) { byLvl[c.lvl - 1].push(c); });
  for (attempt = 0; attempt < 500; attempt++) {
    rnd = rngFrom('rw-' + seed + '-' + attempt);
    cats = [pick(byLvl[0], rnd), pick(byLvl[1], rnd), pick(byLvl[2], rnd), pick(byLvl[3], rnd)];
    themes = cats.slice(0, 3).map(function (c) { return c.theme; });
    twin = themes.some(function (t, i) { return themes.indexOf(t) !== i; });
    if (!twin && attempt < 350) continue;
    groups = cats.map(function (c) { return { cat: c, words: shuffle(c.words, rnd).slice(0, 4) }; });
    words = [].concat.apply([], groups.map(function (g) { return g.words; }));
    if (words.some(function (w, i) { return words.indexOf(w) !== i; })) continue;
    ok = true;
    groups.forEach(function (g) {
      if (!g.cat.rule) return;
      groups.forEach(function (o2) { if (o2 !== g) o2.words.forEach(function (w) { if (inRule(g.cat, w)) ok = false; }); });
    });
    if (!ok) continue;
    tiles = [];
    groups.forEach(function (g, gi) { g.words.forEach(function (w) { tiles.push({ w: w, g: gi }); }); });
    tiles = shuffle(tiles, rnd).map(function (t, id) { return { id: id, w: t.w, g: t.g }; });
    return { groups: groups.map(function (g) { return { ar: g.cat.ar, en: g.cat.en, lvl: g.cat.lvl, words: g.words }; }), tiles: tiles };
  }
  return null;
}
function playRawabit(host, puz, o) {
  var rows = (o.rows || []).map(function (r) { return r.slice(); }), sel = [], solved = [], mistakes = 0, finished = false, clock = o.clock, order = puz.tiles.map(function (t) { return t.id; }), shuffles = 0;
  var tileEl = h('div', { class: 'rgrid' }), doneEl = h('div', { class: 'rdone' }), lives = h('div', { class: 'lives' }), msg = h('p', { class: 'msg', 'aria-live': 'polite' });
  var bSub = btn(L.submit, { cls: 'gold', icon: 'check', onclick: function () { submit(); } });
  var bShuf = btn(L.shuffle, { icon: 'shuffle', onclick: function () { shuffles++; order = shuffle(order, rngFrom('s' + shuffles + puz.tiles[0].w)); render(); } });
  var bDes = btn(L.deselect, { onclick: function () { sel = []; render(); } });
  function evalGuess(ids) { var cnt = [0, 0, 0, 0]; ids.forEach(function (id) { cnt[puz.tiles[id].g]++; }); var mx = Math.max.apply(null, cnt); return { g: cnt.indexOf(mx), n: mx }; }
  function replay() {
    solved = []; mistakes = 0;
    rows.forEach(function (ids) { var e = evalGuess(ids); if (e.n === 4 && solved.indexOf(e.g) < 0) solved.push(e.g); else if (e.n < 4) mistakes++; });
    if (solved.length === 3 && mistakes < 4) solved.push([0, 1, 2, 3].filter(function (g) { return solved.indexOf(g) < 0; })[0]);
  }
  function st() { return { won: solved.length === 4, lost: mistakes >= 4 && solved.length < 4 }; }
  function render() {
    var s = st(), fin = s.won || s.lost, rem = order.filter(function (id) { return solved.indexOf(puz.tiles[id].g) < 0; }), i;
    clear(doneEl);
    (fin ? [0, 1, 2, 3] : solved).forEach(function (gi, k) {
      var g = puz.groups[gi], c = RCOL[gi];
      doneEl.appendChild(h('div', { class: 'rgroup ' + c + (solved.indexOf(gi) < 0 ? ' missed' : ''), style: '--k:' + k }, h('b', { lang: 'ar', text: g.ar }), h('small', { text: AR ? '' : g.en }), h('span', { lang: 'ar', text: g.words.join(' · ') })));
    });
    clear(tileEl);
    if (!fin) rem.forEach(function (id) {
      var on = sel.indexOf(id) > -1;
      tileEl.appendChild(h('button', { class: 'rt' + (on ? ' sel' : ''), type: 'button', lang: 'ar', 'aria-pressed': on ? 'true' : 'false', text: puz.tiles[id].w, onclick: function () {
        clock.poke(); if (on) sel = sel.filter(function (x) { return x !== id; }); else if (sel.length < 4) sel.push(id); msg.textContent = ''; render();
      } }));
    });
    clear(lives);
    for (i = 0; i < 4; i++) lives.appendChild(h('i', { class: 'life' + (i < 4 - mistakes ? ' on' : '') }));
    bSub.disabled = sel.length !== 4 || fin; bDes.disabled = !sel.length || fin; bShuf.disabled = fin;
    bSub.hidden = fin; bDes.hidden = fin; bShuf.hidden = fin;
  }
  function submit() {
    var ids, key, e;
    if (sel.length !== 4) return;
    ids = sel.slice().sort(function (a, b) { return a - b; }); key = ids.join(',');
    if (rows.some(function (r) { return r.slice().sort(function (a, b) { return a - b; }).join(',') === key; })) { msg.textContent = L.rawabit.again; return; }
    clock.poke(); rows.push(ids); e = evalGuess(ids); sel = [];
    if (e.n === 4) { msg.textContent = ''; buzz(30); }
    else { msg.textContent = e.n === 3 ? L.rawabit.oneAway : L.rawabit.nope; buzz([60, 40, 60]); }
    replay(); o.save({ rows: rows, ms: clock.ms() });
    if (e.n < 4) { tileEl.className = 'rgrid shake'; setTimeout(function () { tileEl.className = 'rgrid'; }, 450); }
    render(); finish();
  }
  function finish() {
    var s = st(), body, ms;
    if (finished || (!s.won && !s.lost)) return;
    finished = true; ms = clock.stop();
    body = h('div', { class: 'reveal' }, h('div', { class: 'rdone static' }, puz.groups.map(function (g, gi) { return h('div', { class: 'rgroup ' + RCOL[gi] }, h('b', { lang: 'ar', text: g.ar }), h('small', { text: AR ? '' : g.en }), h('span', { lang: 'ar', text: g.words.join(' · ') })); })));
    var grid = rows.map(function (ids) { return ids.map(function (id) { return RCOL[puz.tiles[id].g]; }); }), hit = rows.filter(function (ids) { return evalGuess(ids).n === 4; });
    if (s.won && hit.length === 3) { var lastG = [0, 1, 2, 3].filter(function (g) { return !hit.some(function (ids) { return evalGuess(ids).g === g; }); })[0]; grid.push([RCOL[lastG], RCOL[lastG], RCOL[lastG], RCOL[lastG]]); }
    o.done({ won: s.won, tries: mistakes + 1, mistakes: mistakes, ms: ms, body: body, grid: grid });
  }
  host.appendChild(h('p', { class: 'hint', text: L.rawabit.hint }));
  host.appendChild(doneEl); host.appendChild(tileEl); host.appendChild(msg); host.appendChild(lives);
  host.appendChild(h('div', { class: 'row' }, bShuf, bDes, bSub));
  replay(); render(); finish();
  return function () {};
}

/* ----- blitz question generators (4 options, one answer) ----- */
function isSub(w, root) { var it = 0, i; for (i = 0; i < w.length && it < root.length; i++) if (w.charAt(i) === root.charAt(it)) it++; return it === root.length; }
function spaced(r) { return r.split('').join(' '); }
var BLITZ = {
  jidhr: function (rnd) {
    var pool = rnd() < 0.7 ? ROOTS[0] : ROOTS[1], r = pick(pool, rnd), w = pick(r.words, rnd), decoys = [], tries = 0, c, opts;
    while (decoys.length < 3 && tries++ < 80) { c = pick(pool, rnd); if (c.root !== r.root && decoys.indexOf(c.root) < 0 && !isSub(w[0], c.root)) decoys.push(c.root); }
    opts = shuffle([r.root].concat(decoys), rnd);
    return { label: L.blitzQ.jidhr, big: w[0], bigLang: 'ar', small: AR ? '' : w[1], opts: opts.map(function (x) { return { t: spaced(x), s: '' }; }), ans: opts.indexOf(r.root), rtl: true };
  },
  film: function (rnd) {
    var f = pick(FILMS, rnd), others = shuffle(FILMS.filter(function (x) { return x !== f; }), rnd).slice(0, 3), all = shuffle([f].concat(others), rnd);
    return { label: L.blitzQ.film, big: f.e, small: fill(L.film.words, { n: f.ar.split(' ').length }), opts: all.map(function (x) { return { t: x.ar, s: AR ? '' : x.en }; }), ans: all.indexOf(f) };
  },
  mathal: function (rnd) {
    var cand = MATHAL.filter(function (m) { return m.ar.split(' ').length >= 4; }), m = pick(cand, rnd), t = m.ar.split(' '), k = Math.ceil(t.length / 2), tail = t.slice(k).join(' '), need = t.length - k, decs = [], tries = 0, o2, ot, d, opts;
    while (decs.length < 3 && tries++ < 120) { o2 = pick(MATHAL, rnd); ot = o2.ar.split(' '); if (o2 === m || ot.length < 2) continue; d = ot.slice(-Math.min(need, ot.length)).join(' '); if (d !== tail && decs.indexOf(d) < 0) decs.push(d); }
    opts = shuffle([tail].concat(decs), rnd);
    return { label: L.blitzQ.mathal, big: t.slice(0, k).join(' ') + ' …', bigLang: 'ar', small: '', opts: opts.map(function (x) { return { t: x, s: '' }; }), ans: opts.indexOf(tail) };
  },
  rawabit: function (rnd) {
    var cats = RAWC.filter(function (c) { return !c.rule && c.lvl <= 3; }), A = pick(cats, rnd), B, tries = 0, three, odd, all;
    do { B = pick(cats, rnd); } while ((B === A || B.theme === A.theme) && tries++ < 50);
    three = shuffle(A.words, rnd).slice(0, 3); odd = pick(B.words, rnd); all = shuffle(three.concat([odd]), rnd);
    return { label: L.blitzQ.rawabit, big: '', small: '', opts: all.map(function (w) { return { t: w, s: '' }; }), ans: all.indexOf(odd) };
  }
};

var GAMES = {
  jidhr: { play: playJidhr, daily: function (d) { return jidhrFor(d); }, pool: ROOTS[0].concat(ROOTS[1]), max: 6, rounds: 3, reveal: jidhrReveal },
  film: { play: playFilm, daily: function () { return FILMS[dailyIndex('film', FILMS.length)]; }, pool: FILMS, max: 6, rounds: 3 },
  mathal: { play: playMathal, daily: function () { return MATHAL[dailyIndex('mathal', MATHAL.length)]; }, pool: MATHAL, max: 4, rounds: 3 },
  rawabit: { play: playRawabit, daily: function (d) { return makeRawabit('d' + d); }, pool: null, max: 5, rounds: 2 }
};
function duelPuzzles(key, seed) {
  var G = GAMES[key], i, out = [];
  if (key === 'rawabit') { for (i = 0; i < G.rounds; i++) out.push(makeRawabit('duel-' + seed + '-' + i)); return out; }
  return shuffle(range(G.pool.length), rngFrom('duel-' + key + '-' + seed)).slice(0, G.rounds).map(function (i2) { return G.pool[i2]; });
}

/* ===== modes ===== */
function recordDaily(key, won, tries) {
  var st = S.get(key + ':stats', { played: 0, wins: 0, streak: 0, best: 0, last: -99, lastWon: false }), d = dayNum();
  if (st.last === d) return st;
  st.played++;
  if (won) { st.wins++; st.streak = (st.last === d - 1 && st.lastWon) ? st.streak + 1 : 1; st.best = Math.max(st.best, st.streak); }
  else st.streak = 0;
  st.last = d; st.lastWon = won;
  S.set(key + ':stats', st);
  return st;
}
function doneToday(k, d) { var sv = S.get(k + ':d:' + d, null); return !!(sv && sv.done); }
function finishDaily(key, res, d) {
  var G = GAMES[key], secs = res.ms / 1000, gain, info = { sweep: false, newPb: false }, p, st, xp, sweepNow;
  recordDaily(key, res.won, res.tries);
  gain = res.won ? 50 + (G.max - res.tries) * 10 + Math.max(0, Math.round(30 - secs / 6)) : 10;
  st = touchStreak();
  p = prof();
  if (res.won && (!p.best[key] || res.ms < p.best[key])) { info.newPb = !!p.best[key]; p.best[key] = res.ms; }
  sweepNow = KEYS.every(function (k) { return doneToday(k, d); }) && p.sweepDay !== d;
  if (sweepNow) { gain += 100; p.sweepDay = d; p.sweeps++; info.sweep = true; }
  saveProf(p);
  xp = addXP(gain);
  if (res.won) unlock('first');
  if (res.won && res.tries === 1) unlock('perfect');
  if (res.won && res.ms < 30000) unlock('speedy');
  [3, 7, 14, 30].forEach(function (n) { if (st.streak >= n) unlock('streak' + n); });
  if (sweepNow) unlock('sweep');
  info.xp = xp; info.st = st;
  return info;
}
function timerChip(clock) {
  var t = h('b', { text: mmss(clock.ms()) }), c = h('span', { class: 'tchip' }, ic('clock'), t);
  every(function () { t.textContent = mmss(clock.ms()); c.className = 'tchip' + (clock.running() ? ' run' : ''); }, 250);
  return c;
}
function tierBadge(puz) { return puz && puz.tier != null ? h('span', { class: 'tier t' + puz.tier, text: L.tiers[puz.tier] }) : null; }
function cardGrid(res) { return res.grid.map(function (r) { return r.map(function (v) { return v === 'x' && res.emo ? 'r' : v; }); }); }
function nickBox(onSave) {
  var inp = h('input', { class: 'in', type: 'text', maxlength: '16', placeholder: L.nickPh, 'aria-label': L.nick, value: S.get('nick', '') });
  return h('div', { class: 'nickrow' }, inp, btn(L.saveName, { onclick: function () { S.set('nick', inp.value.trim()); if (onSave) onSave(); toast(L.saved, '✓'); } }));
}
function lbPanel(key, mode, day) {
  var list = h('ol'), box = h('div', { class: 'lb' }, h('h4', { text: L.leaderboard }), list);
  list.appendChild(h('li', { class: 'dim', text: L.loading }));
  getBoard(key, mode, day).then(function (r) {
    clear(list);
    (r.top || []).forEach(function (e, i) { list.appendChild(h('li', { class: e.me ? 'me' : '' }, h('b', { text: String(i + 1) }), h('span', { text: e.name || L.anon }), h('i', { text: fmtPts(e.score) }))); });
    if (!(r.top || []).length) list.appendChild(h('li', { class: 'dim', text: L.lbEmpty }));
    if (r.rank && r.rank > 10) list.appendChild(h('li', { class: 'me' }, h('b', { text: '#' + r.rank }), h('span', { text: L.you }), h('i', { text: fmtPts(r.score || 0) })));
    if (r.total) box.appendChild(h('p', { class: 'dim', text: fill(L.players, { n: r.total }) }));
  }, function () { box.hidden = true; });
  return box;
}

/* ----- daily ----- */
function dailyMode(body, key) {
  var G = GAMES[key], d = dayNum(), puz = G.daily(d), sk = key + ':d:' + d, saved = S.get(sk, null);
  var already = !!(saved && saved.done), rows = saved ? saved.rows : [], clock = Clock(saved ? saved.ms : 0), board = h('div', { class: 'board' }), out = h('div', { class: 'out' });
  if (!puz) { body.appendChild(h('p', { class: 'msg', text: L.oops })); return; }
  body.appendChild(h('div', { class: 'ghead' }, h('span', { class: 'daynum', text: L.puzzle + ' #' + (d + 1) }), tierBadge(puz), timerChip(clock)));
  body.appendChild(board); body.appendChild(out);
  STOP = G.play(board, puz, {
    rows: rows, clock: clock,
    save: function (s) { rows = s.rows; if (!already) S.set(sk, { rows: rows, ms: s.ms, done: false }); },
    done: function (res) {
      var info = null, pts, streakNow, text, left, tick, box, line, base;
      if (!already) { S.set(sk, { rows: rows, ms: res.ms, done: true, won: res.won }); info = finishDaily(key, res, d); already = true; submitScore(key, 'daily', pointsFor(res.won, res.tries, G.max, res.ms), res.ms); }
      if (G.reveal) G.reveal(res, puz);
      pts = pointsFor(res.won, res.tries, G.max, res.ms); streakNow = liveStreak();
      line = L.brand + ' · ' + ttl(key) + ' #' + (d + 1) + ' ' + (res.won ? res.tries : 'X') + '/' + G.max;
      text = line + '\n⏱ ' + mmss(res.ms) + (streakNow ? ' · 🔥 ' + streakNow : '') + '\n' + gridText(res) + '\n' + pageUrl();
      box = resultPanel({
        head: res.won ? fill(L.solvedIn, { n: res.tries }) : L.failed, tone: res.won ? 'win' : 'lose', body: res.body, text: text,
        stats: [{ k: L.time, v: mmss(res.ms) }, { k: L.points, v: fmtPts(pts) }, { k: L.tries, v: res.tries + '/' + G.max }],
        xp: info ? { gained: info.xp.gained, up: info.xp.up } : null,
        streak: info && info.st && info.st.grew ? info.st : null,
        celebrate: info ? (info.st.milestone ? 240 : (res.won ? 120 : 0)) : 0,
        buttons: [link(L.challengeBtn, gameUrl(key) + '?mode=duel', 'teal', 'swords')],
        next: nextUp(key),
        card: { game: key, title: L.names[key].ar, sub: L.names[key].en + ' · ' + L.puzzle + ' #' + (d + 1), grid: cardGrid(res), main: (res.won ? res.tries : 'X') + '/' + G.max, mainLabel: res.won ? L.solved : L.failed,
          stats: [{ k: L.time, v: mmss(res.ms) }, { k: L.streak, v: String(streakNow) }, { k: L.points, v: fmtPts(pts) }], rank: rankLine(), url: location.host + location.pathname }
      });
      if (info && info.sweep) { base = h('div', { class: 'sweepmsg' }, ic('trophy'), h('span', { text: L.sweepDone })); box.insertBefore(base, box.firstChild); }
      if (LB) { box.appendChild(nickBox(function () { submitScore(key, 'daily', pts, res.ms); })); box.appendChild(lbPanel(key, 'daily', d)); }
      left = h('p', { class: 'next' });
      tick = function () { left.textContent = L.nextIn + ' ' + hms(untilMidnight()); if (untilMidnight() < 1000) location.reload(); };
      tick(); every(tick, 1000);
      box.appendChild(left);
      clear(out).appendChild(box); refreshChips();
    }
  });
}

/* ----- duel (same seeded puzzles, points + time, challenge links) ----- */
function duelMode(body, key, qs) {
  var G = GAMES[key], seedIn = qs.get('duel'), vs = qs.get('vs'), vsT = qs.get('t'), vsName = qs.get('n') || '', panel = h('div', { class: 'panel' }), nick;
  if (vs) panel.appendChild(h('div', { class: 'banner' }, ic('swords'), h('span', { text: fill(L.challenged, { name: vsName || L.friend, n: fmtPts(vs), t: vsT ? mmss(vsT * 1000) : '-' }) })));
  panel.appendChild(h('p', { class: 'lead', text: fill(L.duelIntro, { n: G.rounds }) }));
  nick = h('input', { class: 'in', type: 'text', maxlength: '16', placeholder: L.nickPh, 'aria-label': L.nick, value: S.get('nick', '') });
  panel.appendChild(nick);
  panel.appendChild(btn(L.start, { cls: 'gold big', icon: 'swords', onclick: function () { S.set('nick', nick.value.trim()); run(seedIn || Math.random().toString(36).slice(2, 8), nick.value.trim()); } }));
  body.appendChild(panel);
  function run(seed, name) {
    var puzzles = duelPuzzles(key, seed).filter(function (x) { return !!x; }), i = 0, total = 0, totalMs = 0, marks = [], pts = [];
    function next() {
      var board = h('div', { class: 'board' }), out = h('div', { class: 'out' }), clock = Clock(0);
      stopCurrent(); clear(body);
      body.appendChild(h('div', { class: 'ghead' }, h('span', { class: 'daynum', text: L.round + ' ' + (i + 1) + '/' + puzzles.length + ' · ' + fmtPts(total) + ' ' + L.points }), tierBadge(puzzles[i]), timerChip(clock)));
      body.appendChild(board); body.appendChild(out);
      STOP = G.play(board, puzzles[i], { rows: [], clock: clock, save: function () {}, done: function (res) {
        var p;
        if (out.firstChild) return;
        if (G.reveal) G.reveal(res, puzzles[i]);
        p = pointsFor(res.won, res.tries, G.max, res.ms); total += p; totalMs += res.ms; marks.push(res.won ? 'g' : 'r'); pts.push(p);
        out.appendChild(h('div', { class: 'result ' + (res.won ? 'win' : 'lose') }, h('h3', { text: res.won ? '+' + fmtPts(p) : L.failed }), res.body,
          btn(i + 1 < puzzles.length ? L.next : L.finish, { cls: 'gold', icon: 'play', onclick: function () { i++; if (i < puzzles.length) next(); else end(); } })));
        if (res.won) { confetti(60, 0.8); buzz(30); }
      } });
    }
    function end() {
      var link = pageUrl() + '?duel=' + seed + '&vs=' + total + '&t=' + Math.round(totalMs / 1000) + (name ? '&n=' + encodeURIComponent(name) : ''), verdict = '', win = false, text, box, bL, xp;
      stopCurrent(); clear(body);
      if (vs) {
        win = total > +vs || (total === +vs && totalMs / 1000 < +(vsT || 1e9));
        verdict = win ? fill(L.youBeat, { name: vsName || L.friend }) : (total === +vs && Math.round(totalMs / 1000) === +vsT ? L.tie : fill(L.theyWin, { name: vsName || L.friend }));
      }
      xp = addXP(20 + Math.round(total / 80) + (win ? 30 : 0));
      if (win) unlock('duelwin');
      text = L.brand + ' · ' + ttl(key) + ' ' + L.duel + '\n' + marks.map(function (m, k) { return (m === 'g' ? '🟩' : '🟥') + fmtPts(pts[k]); }).join(' ') + '\n= ' + fmtPts(total) + ' ' + L.points + ' · ⏱ ' + mmss(totalMs) + '\n' + L.beatMe + '\n' + link;
      bL = btn(L.copyLink, { icon: 'copy', onclick: function () { copy(link).then(function () { flash(bL, L.copied); }); } });
      box = resultPanel({
        head: verdict || (fmtPts(total) + ' ' + L.points), tone: win || !vs ? 'win' : 'lose', text: text, buttons: [bL], celebrate: win ? 150 : 40,
        stats: [{ k: L.points, v: fmtPts(total) }, { k: L.time, v: mmss(totalMs) }, { k: L.round, v: String(puzzles.length) }],
        xp: { gained: xp.gained, up: xp.up },
        card: { game: key, title: L.names[key].ar, sub: L.duel + ' · ' + L.names[key].en, grid: [marks], main: fmtPts(total), mainLabel: L.points, stats: [{ k: L.time, v: mmss(totalMs) }, { k: L.streak, v: String(liveStreak()) }, { k: L.round, v: String(puzzles.length) }], rank: rankLine(), url: location.host + location.pathname }
      });
      if (LB) { submitScore(key, 'duel', total, totalMs); }
      body.appendChild(box); refreshChips();
    }
    next();
  }
}

/* ----- blitz: 60 seconds, +3s per correct, -5s and a strike per mistake, 3 strikes ----- */
function blitzMode(body, key) {
  var panel = h('div', { class: 'panel' }), p = prof(), pb = p.blitz[key] || 0;
  panel.appendChild(h('p', { class: 'lead', text: L.blitzIntro }));
  if (pb) panel.appendChild(h('p', { class: 'pbline' }, ic('trophy'), h('span', { text: L.pb + ': ' + fmtPts(pb) })));
  panel.appendChild(btn(L.start, { cls: 'gold big', icon: 'bolt', onclick: function () { run(); } }));
  body.appendChild(panel);
  if (LB) body.appendChild(lbPanel(key, 'blitz', dayNum()));
  function run() {
    var rnd = rngFrom('blitz-' + key + '-' + Date.now()), deadline = Date.now() + 60000, score = 0, combo = 0, bestCombo = 0, correct = 0, asked = 0, strikes = 0, locked = false, over = false, item, t0 = Date.now();
    var timeEl = h('b', { text: '60' }), barEl = h('i', { class: 'fill' }), scoreEl = h('b', { text: '0' }), hearts = h('div', { class: 'lives' }), qBox = h('div', { class: 'bq' }), optBox = h('div', { class: 'bopts' });
    stopCurrent(); clear(body);
    body.appendChild(h('div', { class: 'bhud' }, h('div', { class: 'bt' }, ic('clock'), timeEl), h('div', { class: 'bs' }, scoreEl, h('small', { text: L.points })), hearts));
    body.appendChild(h('div', { class: 'bbar' }, barEl)); body.appendChild(qBox); body.appendChild(optBox);
    function hud() {
      var left = Math.max(0, deadline - Date.now()), i;
      timeEl.textContent = String(Math.ceil(left / 1000)); barEl.style.width = Math.min(100, left / 900) + '%';
      barEl.className = 'fill' + (left < 10000 ? ' low' : '');
      clear(hearts); for (i = 0; i < 3; i++) hearts.appendChild(h('i', { class: 'life' + (i < 3 - strikes ? ' on' : '') }));
      scoreEl.textContent = fmtPts(score);
    }
    function ask() {
      var i;
      item = BLITZ[key](rnd); locked = false; asked++;
      clear(qBox); clear(optBox);
      qBox.appendChild(h('p', { class: 'ql', text: item.label }));
      if (item.big) qBox.appendChild(h('div', { class: key === 'film' ? 'emoji' : 'qbig', lang: item.bigLang || null, dir: item.bigLang ? 'rtl' : null, text: item.big }));
      if (item.small) qBox.appendChild(h('p', { class: 'trans', text: item.small }));
      item.opts.forEach(function (o, k) {
        optBox.appendChild(h('button', { class: 'bo', type: 'button', lang: 'ar', dir: item.rtl ? 'rtl' : null, onclick: function () { answer(k); } }, h('i', { text: String(k + 1) }), h('span', { text: o.t }), o.s ? h('small', { text: o.s }) : null));
      });
      hud();
    }
    function answer(k) {
      var ok = k === item.ans, btns = optBox.children;
      if (locked || over) return;
      locked = true;
      if (ok) { combo++; bestCombo = Math.max(bestCombo, combo); correct++; score += 100 + 25 * Math.min(combo, 8); deadline = Math.min(Date.now() + 90000, deadline + 3000); buzz(15); }
      else { combo = 0; strikes++; deadline -= 5000; buzz([50, 30, 50]); }
      if (btns[k]) btns[k].className = 'bo ' + (ok ? 'ok' : 'bad');
      if (!ok && btns[item.ans]) btns[item.ans].className = 'bo ok';
      hud();
      setTimeout(function () { if (strikes >= 3 || deadline <= Date.now()) finish(); else ask(); }, ok ? 260 : 700);
    }
    function onKey(e) { var n = +e.key; if (n >= 1 && n <= 4) answer(n - 1); }
    function finish() {
      var pr, newBest, xp, text, box, again, acc;
      if (over) return;
      over = true; document.removeEventListener('keydown', onKey); stopCurrent();
      pr = prof(); newBest = score > (pr.blitz[key] || 0); if (newBest) pr.blitz[key] = score; saveProf(pr);
      xp = addXP(Math.max(5, Math.round(score / 25)));
      if (score >= 1000) unlock('blitz');
      acc = asked ? Math.round(100 * correct / Math.max(1, correct + strikes)) : 0;
      text = L.brand + ' · ' + ttl(key) + ' Blitz ⚡\n' + fmtPts(score) + ' ' + L.points + ' · ' + correct + ' ✓ · ' + L.combo + ' ' + bestCombo + '\n' + pageUrl() + '?mode=blitz';
      again = btn(L.again, { cls: 'teal', icon: 'bolt', onclick: function () { run(); } });
      box = resultPanel({
        head: newBest ? L.newPb : L.timeUp, tone: 'win', text: text, buttons: [again], celebrate: newBest ? 140 : 30,
        stats: [{ k: L.points, v: fmtPts(score) }, { k: L.correct, v: String(correct) }, { k: L.combo, v: String(bestCombo) }],
        xp: { gained: xp.gained, up: xp.up }, next: nextUp(key),
        card: { game: key, title: L.names[key].ar, sub: 'Blitz · ' + L.names[key].en, grid: [range(Math.min(correct, 8)).map(function () { return 'g'; }).concat(range(strikes).map(function () { return 'r'; }))], main: fmtPts(score), mainLabel: L.points,
          stats: [{ k: L.correct, v: String(correct) }, { k: L.combo, v: String(bestCombo) }, { k: L.streak, v: String(liveStreak()) }], rank: rankLine(), url: location.host + location.pathname + '?mode=blitz' }
      });
      clear(body); body.appendChild(box);
      if (LB) { submitScore(key, 'blitz', score, Date.now() - t0); body.appendChild(nickBox(function () { submitScore(key, 'blitz', score, Date.now() - t0); })); body.appendChild(lbPanel(key, 'blitz', dayNum())); }
      refreshChips();
    }
    every(function () { if (!over) { hud(); if (deadline <= Date.now() && !locked) finish(); } }, 100);
    document.addEventListener('keydown', onKey);
    STOP = function () { document.removeEventListener('keydown', onKey); };
    ask();
  }
}

/* ===== app: hub, game page, ambience ===== */
var BADGE_EMO = { first: '🌱', perfect: '🎯', speedy: '⚡', streak3: '🔥', streak7: '🔥', streak14: '🏅', streak30: '👑', sweep: '🏆', blitz: '💥', duelwin: '⚔️' };
var MILESTONES = [3, 7, 14, 30, 60, 100];

function ambience() {
  var lw = document.getElementById('letters'), st = document.querySelector ? document.querySelector('.stars') : null, i, abc = 'جذرفلمبتنهويسكعقص', rnd = rngFrom('amb' + dayNum());
  if (lw) for (i = 0; i < 14; i++) lw.appendChild(h('span', { style: '--x:' + Math.round(rnd() * 96) + '%;--s:' + (60 + Math.round(rnd() * 120)) + 'px;--d:' + (-Math.round(rnd() * 40)) + 's;--t:' + (28 + Math.round(rnd() * 30)) + 's', text: abc.charAt(i % abc.length) }));
  if (st) for (i = 0; i < 46; i++) st.appendChild(h('i', { style: 'left:' + Math.round(rnd() * 100) + '%;top:' + Math.round(rnd() * 100) + '%;--d:' + (Math.round(rnd() * 50) / 10) + 's;--z:' + (1 + Math.round(rnd() * 2)) + 'px' }));
}
function tilt(el) {
  try {
    if (!window.matchMedia || !window.matchMedia('(pointer:fine)').matches) return;
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--rx', (-y * 7).toFixed(2) + 'deg'); el.style.setProperty('--ry', (x * 9).toFixed(2) + 'deg');
    });
    el.addEventListener('pointerleave', function () { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  } catch (e) { /* cosmetic */ }
}

/* ----- hub: streak card ----- */
function renderStreakCard(el) {
  var s = stk(), n = liveStreak(), d = dayNum(), today = playedToday(), risk = n > 0 && !today, p = prof(), li = levelInfo(p.xp), num = h('b', { text: '0' }), msg, week = h('div', { class: 'week' }), i, day, nextM, pct, sh = h('div', { class: 'shields' });
  clear(el); el.className = 'streakcard' + (n > 0 ? ' on' : '') + (risk ? ' risk' : '');
  countUp(num, n, 900);
  if (n === 0) msg = L.startStreak; else if (risk) msg = fill(L.keepAlive, { t: hm(untilMidnight()) }); else msg = fill(L.comeBack, { n: n + 1 });
  for (i = 6; i >= 0; i--) {
    day = d - i;
    week.appendChild(h('div', { class: 'wd' + (s.days.indexOf(day) > -1 ? ' on' : '') + (day === d ? ' today' : '') }, h('i', { html: s.days.indexOf(day) > -1 ? FLAME : '' }), h('small', { text: L.wdays[weekdayOf(day)] })));
  }
  nextM = MILESTONES.filter(function (m) { return m > n; })[0] || n + 10; pct = Math.min(100, Math.round(100 * n / nextM));
  for (i = 0; i < 2; i++) sh.appendChild(h('span', { class: 'sh' + (i < s.shield ? ' on' : '') }, ic('shield')));
  el.appendChild(h('div', { class: 'sl' }, h('div', { class: 'bigflame', html: FLAME }), h('div', { class: 'stext' }, h('div', { class: 'snum' }, num, h('span', { text: ' ' + L.dayStreak })), h('div', { class: 'ssub', text: msg }))));
  el.appendChild(week);
  el.appendChild(h('div', { class: 'sr' },
    h('div', { class: 'prog' }, h('small', { text: fill(L.nextMilestone, { n: nextM }) }), h('div', { class: 'meter' }, h('i', { style: 'width:' + pct + '%' }))),
    h('div', { class: 'shrow' }, sh, h('small', { text: L.shields + ' · ' + L.best + ' ' + s.best })),
    h('div', { class: 'lvlrow' }, h('b', { text: L.level + ' ' + li.lvl }), h('span', { text: titleOf(li.lvl) }), h('div', { class: 'meter xp' }, h('i', { style: 'width:' + li.pct + '%' })), h('small', { text: (p.xp - li.lo) + '/' + (li.hi - li.lo) + ' XP' }))
  ));
}
function renderSweep(el) {
  var d = dayNum(), done = KEYS.filter(function (k) { return doneToday(k, d); }).length, C = 213.6, off = C * (1 - done / KEYS.length), full = done === KEYS.length;
  clear(el); el.className = 'sweep' + (full ? ' full' : '');
  el.appendChild(h('div', { class: 'ring', html: '<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="bg"/><circle cx="40" cy="40" r="34" class="fg" style="stroke-dasharray:' + C + ';stroke-dashoffset:' + off.toFixed(1) + '"/></svg><b>' + done + '/' + KEYS.length + '</b>' }));
  el.appendChild(h('div', {}, h('h3', { text: L.sweepTitle }), h('p', { text: full ? L.sweepDone : fill(L.sweepLeft, { n: KEYS.length - done }) })));
}
function renderTrophies(el) {
  var p = prof(), box = h('div', { class: 'tgrid' }), got = 0;
  clear(el);
  BADGE_IDS.forEach(function (id) {
    var on = !!p.badges[id]; if (on) got++;
    box.appendChild(h('div', { class: 'tro' + (on ? ' on' : ''), title: L.badge[id].d }, h('b', { text: on ? BADGE_EMO[id] : '' }, on ? null : ic('lock')), h('span', { text: L.badge[id].n }), h('small', { text: L.badge[id].d })));
  });
  el.appendChild(h('h2', { text: L.trophies + ' ' + got + '/' + BADGE_IDS.length })); el.appendChild(box);
}
function hubTiles() {
  var d = dayNum(), p = prof();
  KEYS.forEach(function (k) {
    var tile = document.querySelector('[data-game="' + k + '"]'), sv = S.get(k + ':d:' + d, null), slot, text, pb, tag;
    if (!tile) return;
    tilt(tile);
    slot = tile.querySelector('[data-stat]');
    if (sv && sv.done) { tile.className += ' done'; text = sv.won ? '✓ ' + fill(L.solvedIn, { n: sv.rows.length }) + ' · ' + mmss(sv.ms || 0) : '✗ ' + L.missed; }
    else text = L.notYet;
    pb = p.best[k];
    if (slot) slot.textContent = text + (pb ? '  ·  ' + L.best + ' ' + mmss(pb) : '');
    if (k === 'jidhr') { tag = tile.querySelector('[data-tier]'); if (tag) { var t = tierOfDay(d); tag.textContent = L.tiers[t]; tag.className = 'tier t' + t; } }
  });
}
function renderHub() {
  var el = document.getElementById('streakCard'), sw = document.getElementById('sweep'), tr = document.getElementById('trophies'), inst = document.getElementById('install'), inv = document.getElementById('invite'), deferred = null, done = 0, d = dayNum(), today = document.getElementById('today');
  if (el) { renderStreakCard(el); every(function () { renderStreakCard(el); }, 60000); }
  if (sw) renderSweep(sw);
  if (tr) renderTrophies(tr);
  hubTiles();
  KEYS.forEach(function (k) { if (doneToday(k, d)) done++; });
  if (today) today.textContent = fill(L.today, { n: done, t: KEYS.length });
  if (inv) inv.appendChild(btn(L.invite, { cls: 'teal', icon: 'share', onclick: function () { var u = location.origin + (AR ? '/ar/' : '/'), t = L.inviteText + ' ' + u; if (navigator.share) navigator.share({ text: t, url: u }).catch(function () {}); else copy(t).then(function () { toast(L.copied, '✓'); }); } }));
  if (inst && window.addEventListener) {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferred = e; clear(inst);
      inst.appendChild(btn(L.install, { cls: 'gold', icon: 'play', onclick: function () { deferred.prompt(); } }));
    });
  }
}

/* ----- game page ----- */
function gamePage(key) {
  var host = document.getElementById('game'), qs = new URLSearchParams(location.search), mode = qs.get('mode'), bar = h('div', { class: 'tabs', role: 'tablist' }), body = h('div', { class: 'gbody' }), modes = ['daily', 'duel', 'blitz'], icons = ['calendar', 'swords', 'bolt'], btns;
  if (qs.get('duel')) mode = 'duel';
  if (modes.indexOf(mode) < 0) mode = 'daily';
  function pickMode(m) {
    stopCurrent(); clear(body);
    btns.forEach(function (b, i) { b.setAttribute('aria-selected', modes[i] === m ? 'true' : 'false'); });
    if (m === 'daily') dailyMode(body, key); else if (m === 'duel') duelMode(body, key, qs); else blitzMode(body, key);
  }
  btns = modes.map(function (m, i) { var b = h('button', { class: 'tab', type: 'button', role: 'tab', onclick: function () { pickMode(m); } }, ic(icons[i]), h('span', { text: L[m] })); bar.appendChild(b); return b; });
  host.appendChild(bar); host.appendChild(body);
  pickMode(mode);
}

/* ----- boot ----- */
ambience();
refreshChips();
if (PAGE === 'hub') renderHub(); else if (GAMES[PAGE]) gamePage(PAGE);
window.__yawmi = { Clock: Clock, drawCard: drawCard, stk: stk, prof: prof, playJidhr: playJidhr, evalRoot: evalRoot, norm: norm, dayNum: dayNum, dailyIndex: dailyIndex, shuffle: shuffle, rngFrom: rngFrom, range: range, ROOTS: ROOTS, FILMS: FILMS, MATHAL: MATHAL, RAWC: RAWC, makeRawabit: makeRawabit, jidhrFor: jidhrFor, tierOfDay: tierOfDay, tierIndex: tierIndex, GAMES: GAMES, duelPuzzles: duelPuzzles, BLITZ: BLITZ, pointsFor: pointsFor, touchStreak: touchStreak, liveStreak: liveStreak, levelInfo: levelInfo, S: S };

})();
