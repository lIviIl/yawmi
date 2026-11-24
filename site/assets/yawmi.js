/* Yawmi: hub + daily games. Vanilla JS, no dependencies, no backend. */
(function () {
  'use strict';
  var D = window.YD, L = JSON.parse(document.getElementById('i18n').textContent);
  var AR = document.documentElement.lang === 'ar';
  var EMO = { g: '🟩', y: '🟨', x: '⬛' }, COL = { g: '#16A9A4', y: '#F5B72E', x: '#2A3866', r: '#E0482F' };
  var STOP = null, TIMER = null;

  /* ---------- helpers ---------- */
  function h(tag, p) {
    var el = document.createElement(tag), k, i, c;
    p = p || {};
    for (k in p) {
      if (k === 'class') el.className = p[k];
      else if (k === 'text') el.textContent = p[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), p[k]);
      else if (p[k] != null && p[k] !== false) el.setAttribute(k, p[k]);
    }
    for (i = 2; i < arguments.length; i++) {
      c = arguments[i];
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
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
  var EPOCH = (function () { var p = String(L.launch || '2026-11-16').split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); })();
  function dayNum() { var d = new Date(); return Math.max(0, Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 864e5)); }
  function untilMidnight() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1) - n; }
  function hms(ms) {
    var s = Math.max(0, Math.floor(ms / 1000)), p = function (x) { return (x < 10 ? '0' : '') + x; };
    return p(Math.floor(s / 3600)) + ':' + p(Math.floor(s % 3600 / 60)) + ':' + p(s % 60);
  }
  function dailyIndex(key, n) { var o = shuffle(range(n), rngFrom('yawmi-' + key)); return o[((dayNum() % n) + n) % n]; }
  function stopCurrent() { if (STOP) { STOP(); STOP = null; } if (TIMER) { clearInterval(TIMER); TIMER = null; } }

  var S = {
    get: function (k, d) { try { var v = localStorage.getItem('ym:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('ym:' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
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
  function liveStreak(st) { var d = dayNum(); return st && st.lastWon && (st.last === d || st.last === d - 1) ? st.streak : 0; }

  /* ---------- sharing ---------- */
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(function () {});
    var t = h('textarea'); t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(t); return Promise.resolve();
  }
  function flash(btn, msg) { var o = btn.textContent; btn.textContent = msg; setTimeout(function () { btn.textContent = o; }, 1400); }
  function whenFonts(cb) {
    if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('400 90px Lalezar'), document.fonts.load('700 40px Cairo')]).then(cb, cb);
    else cb();
  }
  function rr(x, px, py, w, hh, r) {
    x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + hh, r); x.arcTo(px + w, py + hh, px, py + hh, r);
    x.arcTo(px, py + hh, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
  }
  function drawCard(o) {
    var W = 1080, H = 1350, c = h('canvas', { width: W, height: H }), x = c.getContext('2d'), i, bun = ['#E0482F', '#F5B72E', '#16A9A4', '#F6ECD6'];
    x.fillStyle = '#0F1B3D'; x.fillRect(0, 0, W, H);
    for (i = 0; i * 90 < W + 90; i++) { x.fillStyle = bun[i % 4]; x.beginPath(); x.moveTo(i * 90, 0); x.lineTo(i * 90 + 90, 0); x.lineTo(i * 90 + 45, 110); x.closePath(); x.fill(); }
    x.textAlign = 'center';
    x.fillStyle = '#F6ECD6'; x.font = '400 120px Lalezar, Cairo, sans-serif'; x.fillText(o.title, W / 2, 300);
    x.fillStyle = '#A9B4D6'; x.font = '700 50px Cairo, sans-serif'; x.fillText(o.sub, W / 2, 375);
    var rows = o.grid, step = Math.min(130, Math.floor(640 / Math.max(rows.length, 1))), cell = step - 14, y0 = 460;
    rows.forEach(function (r, ri) {
      var cs = Math.min(cell, Math.floor(900 / r.length) - 14), st = cs + 14, x0 = (W - r.length * st + 14) / 2;
      r.forEach(function (v, ci) { rr(x, x0 + ci * st, y0 + ri * step, cs, cs, 14); x.fillStyle = COL[v] || COL.x; x.fill(); x.lineWidth = 6; x.strokeStyle = '#0A1026'; x.stroke(); });
    });
    x.fillStyle = '#F5B72E'; x.font = '400 84px Lalezar, Cairo, sans-serif'; x.fillText(o.score, W / 2, 1210);
    x.fillStyle = '#A9B4D6'; x.font = '700 40px Cairo, sans-serif'; x.fillText(o.url, W / 2, 1290);
    return c;
  }
  function saveImage(canvas) {
    canvas.toBlob(function (b) {
      var f = typeof File === 'function' ? new File([b], 'yawmi.png', { type: 'image/png' }) : null;
      if (f && navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f] }).catch(function () {});
      else { var a = h('a', { href: URL.createObjectURL(b), download: 'yawmi.png' }); document.body.appendChild(a); a.click(); document.body.removeChild(a); }
    }, 'image/png');
  }
  function resultPanel(o) {
    var box = h('div', { class: 'result' }), bS, bC, bI;
    box.appendChild(h('h3', { text: o.head }));
    if (o.body) box.appendChild(o.body);
    if (o.extra) box.appendChild(o.extra);
    box.appendChild(h('pre', { text: o.text }));
    bS = h('button', { class: 'btn gold', type: 'button', text: L.share, onclick: function () {
      if (navigator.share) navigator.share({ text: o.text }).catch(function () {}); else copy(o.text).then(function () { flash(bS, L.copied); });
    } });
    bC = h('button', { class: 'btn', type: 'button', text: L.copy, onclick: function () { copy(o.text).then(function () { flash(bC, L.copied); }); } });
    bI = h('button', { class: 'btn', type: 'button', text: L.save, onclick: function () { whenFonts(function () { saveImage(drawCard(o.card)); }); } });
    box.appendChild(h('div', { class: 'row' }, bS, bC, bI));
    (o.buttons || []).forEach(function (b) { box.lastChild.appendChild(b); });
    return box;
  }
  function gridText(res) { var e = res.emo || EMO; return res.grid.map(function (r) { return r.map(function (v) { return e[v] || EMO.x; }).join(''); }).join('\n'); }
  function pageUrl() { return location.origin + location.pathname; }

  /* ---------- game 1: Jidhr (guess the root) ---------- */
  var ROOTS = D.roots.map(function (s) {
    var p = s.split('|');
    return { root: p[0], words: p[1].split(',').map(function (w) { var q = w.split(':'); return [q[0], q[1]]; }) };
  });
  var LET = ['ابتثجحخ', 'دذرزسشص', 'ضطظعغفق', 'كلمنهوي'], ALL = LET.join('');
  function evalRoot(g, ans) {
    var res = ['x', 'x', 'x'], left = {}, i;
    for (i = 0; i < 3; i++) { if (g[i] === ans[i]) res[i] = 'g'; else left[ans[i]] = (left[ans[i]] || 0) + 1; }
    for (i = 0; i < 3; i++) if (res[i] !== 'g' && left[g[i]] > 0) { res[i] = 'y'; left[g[i]]--; }
    return res;
  }
  function playJidhr(host, puz, o) {
    var ans = puz.root.split(''), rows = (o.rows || []).slice(), cur = [], keys = {}, finished = false;
    var wordsEl = h('div', { class: 'words' }), gridEl = h('div', { class: 'grid3' }), msg = h('p', { class: 'msg', 'aria-live': 'polite' }), kb = h('div', { class: 'kb', dir: 'rtl' });
    function st() { var won = rows.length > 0 && rows[rows.length - 1] === puz.root; return { won: won, lost: !won && rows.length >= 6 }; }
    function render() {
      var s = st(), over = s.won || s.lost, shown = over ? 5 : Math.min(5, 2 + rows.length), stat = {}, rank = { g: 3, y: 2, x: 1 }, r, c, g, ev, row;
      clear(wordsEl);
      puz.words.slice(0, shown).forEach(function (w) { wordsEl.appendChild(h('div', { class: 'patch' }, h('span', { class: 'aw', lang: 'ar', text: w[0] }), AR ? null : h('small', { text: w[1] }))); });
      clear(gridEl);
      for (r = 0; r < 6; r++) {
        row = h('div', { class: 'row3', dir: 'rtl' });
        g = rows[r] ? rows[r].split('') : (r === rows.length && !over ? cur : []);
        ev = rows[r] ? evalRoot(g, ans) : [];
        for (c = 0; c < 3; c++) {
          row.appendChild(h('div', { class: 'sq ' + (ev[c] || '') + (g[c] ? ' on' : ''), lang: 'ar', text: g[c] || '' }));
          if (ev[c] && (!stat[g[c]] || rank[ev[c]] > rank[stat[g[c]]])) stat[g[c]] = ev[c];
        }
        gridEl.appendChild(row);
      }
      Object.keys(keys).forEach(function (ch) { keys[ch].className = 'key ' + (stat[ch] || ''); });
    }
    function add(ch) { var s = st(); if (s.won || s.lost || cur.length >= 3) return; cur.push(ch); msg.textContent = ''; render(); }
    function del() { cur.pop(); msg.textContent = ''; render(); }
    function finish() {
      var s = st(), body, i;
      if (finished || (!s.won && !s.lost)) return;
      finished = true;
      body = h('div', { class: 'reveal' }, h('div', { class: 'rootbig', dir: 'rtl', lang: 'ar', text: ans.join(' ') }));
      o.done({ won: s.won, tries: rows.length, body: body, grid: rows.map(function (r) { return evalRoot(r.split(''), ans); }) });
    }
    function enter() {
      var s = st(); if (s.won || s.lost) return;
      if (cur.length < 3) { msg.textContent = L.jidhr.short; return; }
      rows.push(cur.join('')); cur = []; o.save({ rows: rows }); render(); finish();
    }
    function onKey(e) {
      var k;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') { enter(); e.preventDefault(); }
      else if (e.key === 'Backspace') del();
      else { k = String(e.key).replace(/[أإآ]/g, 'ا').replace('ى', 'ي'); if (k.length === 1 && ALL.indexOf(k) > -1) add(k); }
    }
    LET.forEach(function (rowStr) {
      var r = h('div');
      rowStr.split('').forEach(function (ch) { keys[ch] = h('button', { class: 'key', type: 'button', lang: 'ar', text: ch, onclick: function () { add(ch); } }); r.appendChild(keys[ch]); });
      kb.appendChild(r);
    });
    kb.appendChild(h('div', {}, h('button', { class: 'key wide', type: 'button', text: L.del, onclick: del }), h('button', { class: 'key wide', type: 'button', text: L.enter, onclick: enter })));
    host.appendChild(h('p', { class: 'hint', text: L.jidhr.hint }));
    host.appendChild(wordsEl); host.appendChild(gridEl); host.appendChild(msg); host.appendChild(kb);
    document.addEventListener('keydown', onKey);
    render(); finish();
    return function () { document.removeEventListener('keydown', onKey); };
  }
  function jidhrReveal(res, puz) {
    var wrap = res.body;
    wrap.appendChild(h('div', { class: 'words' }, puz.words.map(function (w) { return h('div', { class: 'patch' }, h('span', { class: 'aw', lang: 'ar', text: w[0] }), h('small', { text: w[1] })); })));
  }

  /* ---------- game 2: Film (emoji clues) ---------- */
  var FILMS = D.films.map(function (s, i) {
    var p = s.split('|');
    return { id: i, ar: p[0], en: p[1], e: p[2], y: +p[3], a: p[4], ae: p[5], g: p[6], k: norm(p[0]) + ' ' + p[1].toLowerCase() };
  });
  function decadeText(y) { var d = Math.floor(y / 10) * 10; return (L.decades && L.decades[d]) || (d + 's'); }
  function playFilm(host, puz, o) {
    var rows = (o.rows || []).slice(), sel = null, finished = false;
    var emoEl = h('div', { class: 'emoji', 'aria-label': 'emoji', text: puz.e }), clueEl = h('ul', { class: 'clues' }), histEl = h('div', { class: 'hist' });
    var msg = h('p', { class: 'msg', 'aria-live': 'polite' }), box = h('div', { class: 'guessbox' }), list = h('div', { class: 'sugg' });
    var input = h('input', { type: 'text', class: 'in', placeholder: L.film.ph, autocomplete: 'off', 'aria-label': L.film.ph });
    var btn = h('button', { class: 'btn gold', type: 'button', text: L.guess, disabled: true });
    function st() { var won = rows.length > 0 && rows[rows.length - 1] === puz.id; return { won: won, lost: !won && rows.length >= 6 }; }
    function clues() {
      return [[L.clue.words, fill(L.film.words, { n: puz.ar.split(' ').length })], [L.clue.genre, L.genres[puz.g] || puz.g], [L.clue.decade, decadeText(puz.y)],
        [L.clue.actor, AR ? puz.a : puz.ae], [L.clue.letter, puz.ar.charAt(0)], [L.clue.year, String(puz.y)]];
    }
    function render() {
      var s = st(), over = s.won || s.lost, n = over ? 6 : Math.min(6, 1 + rows.length);
      clear(clueEl);
      clues().forEach(function (c, i) {
        clueEl.appendChild(i < n ? h('li', {}, h('b', { text: c[0] }), h('span', { lang: i === 3 || i === 4 ? 'ar' : null, text: c[1] })) : h('li', { class: 'lock' }, '🔒 ' + c[0]));
      });
      clear(histEl);
      rows.forEach(function (id) { histEl.appendChild(h('div', { class: id === puz.id ? 'g' : 'x', text: (AR ? FILMS[id].ar : FILMS[id].en) + (id === puz.id ? ' ✓' : ' ✗') })); });
      box.hidden = over;
    }
    function pick(f) { sel = f; input.value = AR ? f.ar : f.en; clear(list); btn.disabled = false; }
    function suggest() {
      var q = norm(input.value), m;
      sel = null; btn.disabled = true; clear(list);
      if (!q) return;
      m = FILMS.filter(function (f) { return f.k.indexOf(q) > -1 && rows.indexOf(f.id) < 0; }).slice(0, 6);
      if (!m.length) { list.appendChild(h('p', { class: 'hint', text: L.film.none })); return; }
      m.forEach(function (f) { list.appendChild(h('button', { type: 'button', text: f.ar + ' · ' + f.en, onclick: function () { pick(f); } })); });
    }
    function guess() {
      if (!sel) return;
      rows.push(sel.id); sel = null; input.value = ''; btn.disabled = true; clear(list); o.save({ rows: rows }); render(); finish();
    }
    function finish() {
      var s = st(), body;
      if (finished || (!s.won && !s.lost)) return;
      finished = true;
      body = h('div', { class: 'reveal' }, h('div', { class: 'emoji', text: puz.e }), h('div', { class: 'rootbig', lang: 'ar', text: puz.ar }),
        h('p', { class: 'trans', text: puz.en + ' · ' + puz.y + ' · ' + (AR ? puz.a : puz.ae) }));
      o.done({ won: s.won, tries: rows.length, body: body, emo: { g: '🟩', x: '🟥' }, grid: [rows.map(function (id) { return id === puz.id ? 'g' : 'x'; })] });
    }
    input.addEventListener('input', suggest);
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (sel) guess(); else { var m = FILMS.filter(function (f) { return f.k.indexOf(norm(input.value)) > -1 && rows.indexOf(f.id) < 0; })[0]; if (m && norm(input.value)) pick(m); }
    });
    btn.addEventListener('click', guess);
    box.appendChild(input); box.appendChild(list); box.appendChild(btn);
    host.appendChild(h('p', { class: 'hint', text: L.film.hint }));
    host.appendChild(emoEl); host.appendChild(clueEl); host.appendChild(msg); host.appendChild(box); host.appendChild(histEl);
    render(); finish();
    return function () {};
  }

  /* ---------- game 3: Mathal (unscramble the proverb) ---------- */
  var MATHAL = D.mathal.map(function (s) { var p = s.split('|'); return { ar: p[0], en: p[1] }; });
  function playMathal(host, puz, o) {
    var sol = puz.ar.split(' '), n = sol.length, rows = (o.rows || []).map(function (r) { return r.slice(); }), slots = [], i, finished = false;
    var order = shuffle(range(n), rngFrom('m-' + puz.ar));
    if (order.every(function (v, k) { return v === k; })) order.push(order.shift());
    var chips = order.map(function (src, k) { return { id: k, text: sol[src] }; });
    for (i = 0; i < n; i++) slots.push(null);
    var slotEl = h('div', { class: 'slots', dir: 'rtl' }), poolEl = h('div', { class: 'pool', dir: 'rtl' }), histEl = h('div', { class: 'hist' });
    var hintEl = h('p', { class: 'hint' }), msg = h('p', { class: 'msg', 'aria-live': 'polite' });
    var bCheck = h('button', { class: 'btn gold', type: 'button', text: L.check }), bClear = h('button', { class: 'btn', type: 'button', text: L.clear });
    function st() { var last = rows[rows.length - 1], won = !!last && last.every(function (t, k) { return t === sol[k]; }); return { won: won, lost: !won && rows.length >= 5 }; }
    function locked() { var last = rows[rows.length - 1]; return sol.map(function (t, k) { return !!last && last[k] === t; }); }
    if (rows.length) {
      var used = {}, last = rows[rows.length - 1];
      last.forEach(function (t, k) {
        if (t !== sol[k]) return;
        var c = chips.filter(function (x) { return x.text === t && !used[x.id]; })[0];
        used[c.id] = 1; slots[k] = c;
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
        poolEl.appendChild(h('button', { class: 'chip', type: 'button', lang: 'ar', text: c.text, onclick: function () {
          var k = slots.indexOf(null); if (k < 0) return; slots[k] = c; msg.textContent = ''; render();
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
      hintEl.textContent = (rows.length >= 2 && !fin) ? (AR ? L.mathal.first + ': ' + sol[0] : L.mathal.hint + ': ' + puz.en) : L.mathal.how;
      bCheck.hidden = fin; bClear.hidden = fin;
    }
    function check() {
      var att, ok, s;
      if (!slots.every(function (c) { return !!c; })) return;
      att = slots.map(function (c) { return c.text; });
      rows.push(att); o.save({ rows: rows });
      ok = att.every(function (t, k) { return t === sol[k]; });
      slots = slots.map(function (c, k) { return att[k] === sol[k] ? c : null; });
      s = st(); msg.textContent = (!ok && !s.lost) ? fill(L.mathal.left, { n: att.filter(function (t, k) { return t === sol[k]; }).length, m: n }) : '';
      render(); finish();
    }
    function finish() {
      var s = st(), body;
      if (finished || (!s.won && !s.lost)) return;
      finished = true;
      body = h('div', { class: 'reveal' }, h('div', { class: 'rootbig', dir: 'rtl', lang: 'ar', text: puz.ar }), AR ? null : h('p', { class: 'trans', text: puz.en }));
      o.done({ won: s.won, tries: rows.length, body: body, grid: rows.map(function (att) { return att.map(function (t, k) { return t === sol[k] ? 'g' : 'x'; }); }) });
    }
    bCheck.addEventListener('click', check);
    bClear.addEventListener('click', function () { var lk = locked(); slots = slots.map(function (c, k) { return lk[k] ? c : null; }); render(); });
    host.appendChild(hintEl); host.appendChild(slotEl); host.appendChild(msg); host.appendChild(poolEl);
    host.appendChild(h('div', { class: 'row' }, bClear, bCheck)); host.appendChild(histEl);
    render(); finish();
    return function () {};
  }

  var GAMES = {
    jidhr: { puzzles: ROOTS, play: playJidhr, max: 6, rounds: 5, reveal: jidhrReveal },
    film: { puzzles: FILMS, play: playFilm, max: 6, rounds: 5 },
    mathal: { puzzles: MATHAL, play: playMathal, max: 5, rounds: 3 }
  };

  /* ---------- modes ---------- */
  function title(key) { return L.names[key].en + ' ' + L.names[key].ar; }
  function dailyMode(body, key) {
    var G = GAMES[key], d = dayNum(), puz = G.puzzles[dailyIndex(key, G.puzzles.length)], sk = key + ':d:' + d, saved = S.get(sk, null);
    var already = !!(saved && saved.done), rows = saved ? saved.rows : [], board = h('div', { class: 'board' }), out = h('div', { class: 'out' });
    body.appendChild(h('p', { class: 'daynum', text: L.puzzle + ' #' + (d + 1) }));
    body.appendChild(board); body.appendChild(out);
    STOP = G.play(board, puz, {
      rows: rows,
      save: function (s) { rows = s.rows; if (!already) S.set(sk, { rows: rows, done: false }); },
      done: function (res) {
        var st, line, text, box, left;
        if (!already) { S.set(sk, { rows: rows, done: true, won: res.won }); recordDaily(key, res.won, res.tries); already = true; }
        if (G.reveal) G.reveal(res, puz);
        st = S.get(key + ':stats', { played: 0, wins: 0 });
        line = L.brand + ' · ' + title(key) + ' #' + (d + 1) + ' ' + (res.won ? res.tries : 'X') + '/' + G.max;
        text = line + '\n' + gridText(res) + '\n' + pageUrl();
        box = resultPanel({ head: res.won ? fill(L.solvedIn, { n: res.tries }) : L.failed, body: res.body, text: text,
          extra: h('div', { class: 'stats' }, h('div', {}, h('span', { text: st.played }), L.played), h('div', {}, h('span', { text: st.played ? Math.round(100 * st.wins / st.played) + '%' : '0%' }), L.winPct), h('div', {}, h('span', { text: liveStreak(st) }), L.streak)),
          card: { title: L.names[key].ar + ' · ' + L.names[key].en, sub: L.puzzle + ' #' + (d + 1), grid: res.grid.map(function (r) { return r.map(function (v) { return v === 'x' && res.emo ? 'r' : v; }); }), score: (res.won ? res.tries : 'X') + '/' + G.max, url: location.host + location.pathname } });
        left = h('p', { class: 'next' });
        function tick() { left.textContent = L.nextIn + ' ' + hms(untilMidnight()); if (untilMidnight() < 1000) location.reload(); }
        tick(); TIMER = setInterval(tick, 1000);
        box.appendChild(left);
        clear(out).appendChild(box);
      }
    });
  }
  function randSeed() { return Math.random().toString(36).slice(2, 8); }
  function duelMode(body, key, qs) {
    var G = GAMES[key], seedIn = qs.get('duel'), vs = qs.get('vs'), vsName = qs.get('n') || '', nick = h('input', { class: 'in', type: 'text', maxlength: '16', placeholder: L.nickPh, 'aria-label': L.nick, value: S.get('nick', '') });
    var panel = h('div', { class: 'panel' });
    if (vs) panel.appendChild(h('div', { class: 'banner', text: fill(L.challenged, { name: vsName || L.friend, n: vs }) }));
    panel.appendChild(h('p', { class: 'lead', text: fill(L.duelIntro, { n: G.rounds }) }));
    panel.appendChild(nick);
    panel.appendChild(h('button', { class: 'btn gold', type: 'button', text: L.start, onclick: function () { S.set('nick', nick.value.trim()); run(seedIn || randSeed(), nick.value.trim()); } }));
    body.appendChild(panel);
    function run(seed, name) {
      var order = shuffle(range(G.puzzles.length), rngFrom('duel-' + key + '-' + seed)).slice(0, G.rounds), i = 0, total = 0, pts = [], marks = [];
      function next() {
        var board = h('div', { class: 'board' }), out = h('div', { class: 'out' });
        stopCurrent(); clear(body);
        body.appendChild(h('p', { class: 'daynum', text: L.round + ' ' + (i + 1) + '/' + G.rounds + ' · ' + L.score + ' ' + total }));
        body.appendChild(board); body.appendChild(out);
        STOP = G.play(board, G.puzzles[order[i]], { rows: [], save: function () {}, done: function (res) {
          var p = res.won ? res.tries : 7;
          if (out.firstChild) return;
          if (G.reveal) G.reveal(res, G.puzzles[order[i]]);
          total += p; pts.push(p); marks.push(res.won ? 'g' : 'r');
          out.appendChild(h('div', { class: 'result' }, h('h3', { text: res.won ? fill(L.solvedIn, { n: res.tries }) : L.failed }), res.body,
            h('button', { class: 'btn gold', type: 'button', text: i + 1 < G.rounds ? L.next : L.finish, onclick: function () { i++; if (i < G.rounds) next(); else end(); } })));
        } });
      }
      function end() {
        var link = pageUrl() + '?duel=' + seed + '&vs=' + total + (name ? '&n=' + encodeURIComponent(name) : ''), text, verdict = '', box, bL;
        stopCurrent(); clear(body);
        text = L.brand + ' · ' + title(key) + ' ' + L.duel + '\n' + marks.map(function (m, k) { return (m === 'g' ? '🟩' : '🟥') + (pts[k] === 7 ? 'X' : pts[k]); }).join(' ') + ' = ' + total + '\n' + L.lowerBetter + '\n' + link;
        if (vs) verdict = +total < +vs ? fill(L.youBeat, { name: vsName || L.friend }) : (+total === +vs ? L.tie : fill(L.theyWin, { name: vsName || L.friend }));
        bL = h('button', { class: 'btn', type: 'button', text: L.copyLink, onclick: function () { copy(link).then(function () { flash(bL, L.copied); }); } });
        box = resultPanel({ head: verdict || (L.score + ': ' + total), text: text, buttons: [bL],
          extra: h('p', { class: 'trans', text: L.score + ': ' + total + ' (' + L.lowerBetter + ')' }),
          card: { title: L.names[key].ar + ' · ' + L.duel, sub: L.lowerBetter, grid: [marks], score: L.score + ' ' + total, url: location.host + location.pathname } });
        body.appendChild(box);
      }
      next();
    }
  }

  /* ---------- hub + routing ---------- */
  function hub() {
    var d = dayNum(), done = 0, keys = Object.keys(GAMES), el = document.getElementById('today');
    keys.forEach(function (k) {
      var tile = document.querySelector('[data-game="' + k + '"]'), sv = S.get(k + ':d:' + d, null), stt = S.get(k + ':stats', null), slot, text, sk;
      if (!tile) return;
      slot = tile.querySelector('[data-stat]');
      if (sv && sv.done) { done++; tile.className += ' done'; text = sv.won ? '✓ ' + fill(L.solvedIn, { n: sv.rows.length }) : '✗ ' + L.missed; }
      else text = L.notYet;
      sk = liveStreak(stt);
      if (sk > 0) text += '  🔥 ' + sk;
      slot.textContent = text;
    });
    if (el) el.textContent = fill(L.today, { n: done, t: keys.length });
  }
  function gamePage(key) {
    var host = document.getElementById('game'), qs = new URLSearchParams(location.search), mode = qs.get('mode') === 'duel' || qs.get('duel') ? 'duel' : 'daily';
    var bar = h('div', { class: 'tabs', role: 'tablist' }), body = h('div'), modes = ['daily', 'duel'], btns;
    function pick(m) {
      stopCurrent(); clear(body);
      btns.forEach(function (b, i) { b.setAttribute('aria-selected', modes[i] === m ? 'true' : 'false'); });
      if (m === 'daily') dailyMode(body, key); else duelMode(body, key, qs);
    }
    btns = modes.map(function (m) { var b = h('button', { class: 'tab', type: 'button', role: 'tab', text: L[m], onclick: function () { pick(m); } }); bar.appendChild(b); return b; });
    host.appendChild(bar); host.appendChild(body);
    pick(mode);
  }
  var page = document.body.getAttribute('data-page');
  if (page === 'hub') hub(); else if (GAMES[page]) gamePage(page);

  /* test hook (harmless in production) */
  window.__yawmi = { evalRoot: evalRoot, norm: norm, dayNum: dayNum, dailyIndex: dailyIndex, shuffle: shuffle, rngFrom: rngFrom, ROOTS: ROOTS, FILMS: FILMS, MATHAL: MATHAL };
})();
