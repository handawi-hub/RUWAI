/* agent-commander.js — Command Center Virtual Office RUWAI (BPS Provinsi Lampung)
   Pasang di virtual-office.html, tepat sebelum </body>:
   Tambahkan satu tag script dengan src="agent-commander.js" di sana.
   Tidak perlu mengubah kode lama: file ini membaca scene, agen, dan API Bridge yang sudah ada. */
(function () {
  'use strict';

  /* 1. Lewati kartu login: dashboard monitoring sudah menjadi pintu masuk */
  const SK = 'sigerhub_bps_lampung_session';
  try {
    if (!sessionStorage.getItem(SK)) sessionStorage.setItem(SK, JSON.stringify({ username: 'humas', role: 'Tim Humas BPS', isAdmin: false, loginAt: Date.now() }));
  } catch (e) {}
  const css = document.createElement('style');
  css.textContent = '#voLoginGate{display:none!important}';
  document.head.appendChild(css);
  window.logoutVoSession = () => { location.href = 'index.html'; }; // tombol Keluar kini hanya kembali ke dashboard

  /* 2. Data dasar */
  const IDS = ['crawler', 'drafter', 'auditor'];
  const LABEL = { crawler: 'Crawler', drafter: 'Penulis BRS', auditor: 'Auditor' };
  const WORK = {
    crawler: ['Memindai Google News RSS & media online...', 'Pemindaian selesai, berita terklasifikasi.'],
    drafter: ['Menyusun draf siaran pers dari bahan tayang...', 'Draf siaran pers selesai disusun.'],
    auditor: ['Memeriksa presisi angka & sentimen...', 'Lolos audit, siap rilis.']
  };
  const EML = { wave: 'melambai', dance: 'menari', headbang: 'headbang', jump: 'melompat', spin: 'berputar', celebrate: 'merayakan', bow: 'membungkuk', think: 'berpikir', work: 'bekerja', chat: 'ngobrol', sit: 'duduk', sleep: 'tidur' };
  const V = (x, z) => new THREE.Vector3(x, 0.12, z);
  const animalPos = a => { const p = (a.mesh || a.group).position; return V(p.x, p.z); };
  const now = () => performance.now() / 1000;

  // [pola kata, nama, fungsi posisi]; null = meja kerja agen itu sendiri
  const PLACES = [
    [/jembatan|taiko/, 'jembatan', () => V(3.15, -1.6)],
    [/sungai|angsa/, 'tepi sungai', () => V(1.35, 2.8)],
    [/kolam|koi|ikan/, 'kolam', () => V(-8.6, 4.6)],
    [/taman|kebun/, 'taman', () => V(-6.5, 5.4)],
    [/rumah kaca|glass|greenhouse/, 'rumah kaca', () => V(9.2, -1.0)],
    [/sofa|beanbag|lounge/, 'sofa', () => V(7.9, -0.5)],
    [/sakura|bunga/, 'pohon sakura', () => V(5.2, -3.2)],
    [/poster|band/, 'poster band', () => V(-7.2, -5.3)],
    [/studio|tengah/, 'tengah studio', () => V(-4.5, -1.6)],
    [/kucing/, 'kucing', () => animalPos(cats[0])],
    [/kelinci/, 'kelinci', () => animalPos(rabbits[0])],
    [/meja|kembali|balik|\bpos\b/, 'meja kerja', null]
  ];
  const PL = n => PLACES.find(p => p[1] === n);

  let target = 'all', auto = true, plans = [], items = [], follow = null, ready = false, internalSet = false;
  const lockUntil = {};

  /* 3. Navigasi: jembatan melengkung & pintu rumah kaca */
  function groundY(x, z) {
    if (Math.abs(z + 1.6) < 0.8 && Math.abs(x - 3.15) < 1.93) return 0.16 + Math.cos((x - 3.15) / 1.925 * Math.PI / 2) * 0.58;
    return 0.12;
  }
  function planPath(a, b) {
    const side = p => (p.x < 3.15 ? -1 : 1), gh = p => p.x > 5.9 && p.x < 12.4 && p.z < 0.5 && p.z > -5.1;
    const pts = [];
    if (gh(a) && !gh(b)) pts.push(V(9.2, -0.2), V(9.2, 1.3), V(5.7, 1.4));
    const sa = gh(a) ? 1 : side(a), sb = gh(b) ? 1 : side(b);
    if (sa < sb) pts.push(V(1.2, -1.6), V(3.15, -1.6), V(5.1, -1.6));
    if (sa > sb) pts.push(V(5.1, -1.6), V(3.15, -1.6), V(1.2, -1.6));
    if (gh(b) && !gh(a)) pts.push(V(5.7, 1.4), V(9.2, 1.3), V(9.2, -0.2));
    if (Math.abs(b.x - 3.15) < 1.93 && Math.abs(b.z + 1.6) < 0.8) pts.push(a.x < 3.15 ? V(1.2, -1.6) : V(5.1, -1.6));
    pts.push(b);
    return pts;
  }

  /* 4. Gelembung ucapan, chat, status, serah-terima item */
  function showBubble(id, text, sec) {
    const av = cartoonAgents[id]; if (!av) return;
    if (!av.bub) {
      const c = document.createElement('canvas'); c.width = 640; c.height = 200;
      const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      sp.scale.set(3.2, 1, 1); sp.position.set(0, 2.75, 0); sp.renderOrder = 10; av.root.add(sp);
      av.bub = { sp, c, tex, until: 0 };
    }
    const b = av.bub, x = b.c.getContext('2d');
    x.clearRect(0, 0, 640, 200);
    x.font = '700 30px "Plus Jakarta Sans", sans-serif';
    const lines = []; let cur = '';
    text.split(' ').forEach(w => { if (x.measureText((cur + ' ' + w).trim()).width > 520) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
    lines.push(cur);
    const L = lines.slice(0, 3), h = 36 + L.length * 38;
    x.fillStyle = '#ffffff'; x.strokeStyle = '#161114'; x.lineWidth = 6;
    createRoundRectPath(x, 40, 10, 560, h, 24); x.fill(); x.stroke();
    x.fillStyle = '#161114'; x.textAlign = 'center'; x.textBaseline = 'middle';
    L.forEach((l, i) => x.fillText(l, 320, 40 + i * 38));
    b.tex.needsUpdate = true; b.sp.visible = true; b.until = now() + (sec || 3);
  }

  function logChat(who, text, cls) {
    const box = document.getElementById('cmdMessages'); if (!box) return;
    const row = document.createElement('div'), b = document.createElement('span');
    if (cls === 'user') row.className = 'text-right';
    b.className = 'inline-block max-w-[90%] px-2.5 py-1 rounded-xl text-[11px] leading-snug ' +
      (cls === 'user' ? 'bg-slate-900 text-white' : cls === 'agent' ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'bg-stone-100 border border-stone-200 text-slate-600');
    b.textContent = (cls === 'user' ? '' : who + ': ') + text;
    row.appendChild(b); box.appendChild(row); box.scrollTop = box.scrollHeight;
  }

  function setStatus(id, status, msg) {
    lockUntil[id] = Date.now() + 25000; // data live dari Apps Script tidak menimpa status perintah selama 25 detik
    internalSet = true; updateAgentUI(id, status, msg, 'Perintah chat'); internalSet = false;
    addLog('[' + LABEL[id].toUpperCase() + '] ' + status + ': ' + msg, status === 'DONE' ? 'success' : 'work');
  }

  function giveItem(from, to, emo) {
    const a = cartoonAgents[from].root.position;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); x.font = '96px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(emo, 64, 70);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    sp.scale.set(0.6, 0.6, 1); sp.renderOrder = 11; scene.add(sp);
    items.push({ sp, fx: a.x, fz: a.z, to, t0: now() });
    ctl(cartoonAgents[to]).q.unshift({ type: 'emote', kind: 'wave', t: 1.6, say: 'Diterima! ' + emo });
    logChat(LABEL[from], 'menyerahkan ' + emo + ' ke ' + LABEL[to], 'agent');
  }

  /* 5. Penerjemah perintah bahasa Indonesia -> tahapan aksi per agen */
  const AG = { crawler: /crawler|pemantau|pemindai/, drafter: /drafter|penulis|writer/, auditor: /auditor|\bqc\b/ };
  const ALL = /\b(semua|seluruh|bertiga|all)\b/;
  const AGN = 'crawler|pemantau|pemindai|drafter|penulis|writer|auditor|qc';
  const SEQ = /\s*(?:;|→|->|\n)\s*|\s+(?:lalu|kemudian|setelah itu|terus|habis itu|selanjutnya|baru)\s+/;
  const PAR = new RegExp('\\s*,\\s*|\\s+(?:sementara itu|sementara|dan)\\s+(?=@?(?:' + AGN + '|semua|seluruh|bertiga))');
  const TGT = new RegExp('\\b(?:ke|kepada|dengan|pada|menemui|temui|hampiri|samperin|ikuti|ikut|temani)\\s+@?(' + AGN + ')\\b');
  const findAgents = s => IDS.filter(i => AG[i].test(s));

  function parsePart(p, qs, last) {
    let tgt = null, tv = '';
    p = p.replace(TGT, (m, g) => { tgt = IDS.find(i => AG[i].test(g)); tv = m; return ' '; });
    const exp = ALL.test(p) ? IDS.slice() : findAgents(p).filter(i => i !== tgt);
    let ids = exp.length ? exp : last.filter(i => i !== tgt);
    if (!ids.length) ids = IDS.filter(i => i !== tgt);
    const T = r => r.test(p), dur = (p.match(/(\d+)\s*(?:detik|dtk)/) || [])[1], run = T(/lari|cepat|buru|sprint/);
    const qm = p.match(/__q(\d+)__/), quote = qm ? qs[+qm[1]] : null;
    const loc = PLACES.find(pl => pl[0].test(p));
    const item = T(/berita/) ? '📰' : T(/draf|brs|naskah|rilis/) ? '📄' : T(/angka|data/) ? '📊' : '📦';
    const stop = T(/\b(stop|berhenti|batal|reset|diam)\b/);
    const pw = p.replace(new RegExp('@?(?:' + AGN + ')', 'g'), ' ').replace(/meja kerja|pos kerja/g, ' '); // nama agen bukan kata perintah
    const EM = (k, t, say) => ({ type: 'emote', kind: k, t: dur ? +dur : t, say, lbl: EML[k] });
    const goPl = (n, who) => ({ type: 'goto', run, lbl: 'ke ' + n, pos: PL(n)[2] || (() => cartoonAgents[who].basePos.clone()) });

    const mk = id => {
      const a = [];
      if (stop) return [{ type: 'fn', fn: () => { follow = null; }, lbl: 'berhenti & kembali ke meja' }, { type: 'home' }];
      if (tgt) {
        a.push({ type: 'goto', run, lbl: 'menghampiri ' + LABEL[tgt], pos: () => { const g = cartoonAgents[id].root.position, q = cartoonAgents[tgt].root.position; return V(q.x + (g.x < q.x ? -1 : 1), q.z + 0.15); } });
        if (T(/serah|beri|kirim|oper|lapor|setor|titip/)) a.push({ type: 'fn', fn: () => giveItem(id, tgt, item), lbl: 'menyerahkan ' + item }, { type: 'wait', t: 1.8 });
        else if (T(/ngobrol|bicara|diskusi|rapat|bahas/)) a.push({ type: 'fn', fn: () => ctl(cartoonAgents[tgt]).q.unshift(EM('chat', 4.5, 'Oke, saya dengarkan.')) }, EM('chat', 4.5, 'Boleh kita diskusi sebentar?'));
        else if (/ikut|temani/.test(tv)) { a.pop(); a.push({ type: 'follow', tg: tgt, t: dur ? +dur : 14, lbl: 'mengikuti ' + LABEL[tgt] }); }
        else a.push(EM('wave', 2.5, 'Halo, ' + LABEL[tgt] + '! 🤝'));
        return a;
      }
      const sit = T(/duduk|santai|rebahan/), slp = T(/tidur|istirahat|ngantuk|rehat/);
      if (loc) a.push(goPl(loc[1], id));
      if (T(/(beri|kasih|suapi)\s*makan/)) { if (!loc) a.push(goPl('tepi sungai', id)); a.push(EM('wave', 3, 'Ayo makan, jangan rebutan! 🍞')); }
      if ((sit || slp) && !loc) a.push(goPl('sofa', id));
      let say = quote;
      if (say === null) { const m = p.match(/(?:katakan|bilang|ucapkan|sampaikan)\s+(.+)/); if (m) say = m[1].trim(); }
      if (say) a.push({ type: 'wait', t: Math.max(2.5, say.length * 0.09), say, log: true, lbl: 'berbicara' });
      if (T(/lambai|sapa|\bhalo\b|\bhai\b/)) a.push(EM('wave', 3, 'Halo semuanya! 👋'));
      if (T(/menari|joget|dansa|dance/)) a.push(EM('dance', 6, '♪ ♫ Yeay! ♪'));
      if (T(/headbang|mosh|metal|hardcore/)) a.push(EM('headbang', 6, '🤘 METAL!'));
      if (T(/lompat|loncat|jump/)) a.push(EM('jump', 3, 'Hop!'));
      if (T(/putar|muter|spin/)) a.push(EM('spin', 3, 'Wheee~ 🌀'));
      if (T(/rayakan|merayakan|selebrasi|hore|senang/)) a.push(EM('celebrate', 4, 'Hore! Berhasil! 🎉'));
      if (T(/bungkuk|hormat|\bbow\b/)) a.push(EM('bow', 2.5, 'Salam hormat 🙇'));
      if (T(/pikir|analisa|analisis|renung/)) a.push(EM('think', 3.5, 'Hmm... 🤔'));
      if (sit) a.push(EM('sit', 8, 'Santai dulu~ ☕'));
      if (slp) a.push(EM('sleep', 8, 'Zzz... 😴'));
      if (T(/kamera|sorot|fokus/)) a.push({ type: 'fn', fn: () => { focusCamera(id); follow = id; }, lbl: 'menyorot kamera' });
      if (/kerja|pantau|monitor|crawl|scan|tulis|susun|draf|audit|periksa|validasi|verifikasi|\bcek\b/.test(pw) && !sit && !slp) {
        const w = WORK[id];
        a.push(goPl('meja kerja', id),
          { type: 'status', status: 'WORKING', msg: w[0], say: w[0].slice(0, 40), lbl: 'bekerja' },
          { type: 'emote', kind: 'work', t: dur ? +dur : 7 },
          { type: 'status', status: 'DONE', msg: w[1], say: w[1] },
          { type: 'wait', t: 2.2 },
          { type: 'status', status: 'IDLE', msg: 'Menunggu perintah berikutnya.' });
      }
      return a;
    };

    if (!mk(ids[0]).length) return exp.length ? { ids: exp, acts: null } : null;
    return { ids, acts: mk, lbl: mk(ids[0]).map(x => x.lbl).filter(Boolean).join(' → ') || 'melaksanakan perintah', stop };
  }

  function compile(raw, defIds) {
    const qs = [];
    const s = raw.replace(/["“”]([^"“”]{1,140})["“”]/g, (m, g) => { qs.push(g); return ' __q' + (qs.length - 1) + '__ '; }).toLowerCase();
    const stages = [], labels = []; let last = defIds, stopped = false;
    s.split(SEQ).filter(x => x && x.trim()).forEach(cl => {
      const st = {}; let pend = [];
      cl.split(PAR).forEach(part => {
        if (!part || !part.trim()) return;
        const r = parsePart(part, qs, last); if (!r) return;
        if (!r.acts) { pend = pend.concat(r.ids); return; }
        const ids = [...new Set(pend.concat(r.ids))]; pend = [];
        ids.forEach(i => { st[i] = (st[i] || []).concat(r.acts(i)); });
        labels.push(r.lbl); last = ids; if (r.stop) stopped = true;
      });
      if (Object.keys(st).length) stages.push(st);
    });
    if (!stages.length) return null;
    if (!stopped) { // setelah tugas, agen berdiam sebentar lalu pulang ke meja lewat jembatan
      const f = {}; [...new Set(stages.flatMap(x => Object.keys(x)))].forEach(i => { f[i] = [{ type: 'wait', t: 7 }, { type: 'home' }]; });
      stages.push(f);
    }
    stages.labels = labels;
    return stages;
  }

  /* 6. Eksekutor aksi per frame (berjalan tepat sebelum render, mengambil alih perilaku bawaan) */
  function ctl(av) { return av.ctl || (av.ctl = { q: [], cur: null, t0: 0, init: false, idleAt: 0, auto: false, active: false, pos: new THREE.Vector3() }); }

  function updatePlans() {
    plans = plans.filter(p => {
      const ids = Object.keys(p.stages[p.i] || {});
      const busy = ids.some(i => { const c = ctl(cartoonAgents[i]); return c.cur || c.q.length; });
      if (p.launched && busy) return true;
      if (p.launched) p.i++;
      if (p.i >= p.stages.length) return false;
      Object.entries(p.stages[p.i]).forEach(([i, acts]) => ctl(cartoonAgents[i]).q.push(...acts.map(a => Object.assign({}, a))));
      p.launched = true; return true;
    });
  }

  function autoPlan(id, c) {
    const o = IDS.filter(i => i !== id)[Math.floor(Math.random() * 2)];
    const ph = ['ke kolam lalu berpikir', 'ke jembatan lalu melambai', 'ke sofa lalu duduk', 'ke taman lalu menari', 'ke poster lalu headbang', 'ke kucing lalu melambai', 'ke sakura lalu berpikir', 'ngobrol dengan ' + o];
    const st = compile(ph[Math.floor(Math.random() * ph.length)], [id]);
    if (st) st.forEach(s => (s[id] || []).forEach(x => c.q.push(Object.assign({}, x))));
    c.auto = true; c.idleAt = 0;
  }

  function walk(av, c, tg, sp, t, st, run) {
    const dx = tg.x - c.pos.x, dz = tg.z - c.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.1) return true;
    const s = Math.min(d, sp); c.pos.x += dx / d * s; c.pos.z += dz / d * s;
    if (Math.abs(dx) > 0.01) av.facingDir = dx >= 0 ? 1 : -1;
    const f = run ? 18 : 11;
    st.facingDir = av.facingDir; st.walkPhase = t * f; st.armWave = t * (run ? 9 : 5);
    av.root.position.set(c.pos.x, groundY(c.pos.x, c.pos.z) + Math.abs(Math.sin(t * f)) * (run ? 0.16 : 0.09), c.pos.z);
    return false;
  }

  function drive(av, id, t) {
    const c = ctl(av), X = av.root.position, stt = (AGENT_META[id].status || 'IDLE').toUpperCase();
    if (c.auto && stt !== 'IDLE') { c.q = []; c.cur = null; c.auto = false; }
    if (!c.cur && c.q.length) { c.cur = c.q.shift(); c.t0 = t; c.init = false; }
    if (!c.cur) {
      if (c.active) { c.active = false; av.mesh.position.y = 1.09; av.mesh.scale.set(1, 1, 1); }
      if (!c.idleAt) c.idleAt = t + 10 + Math.random() * 15;
      if (auto && stt === 'IDLE' && !isMoshPitActive && t > c.idleAt) autoPlan(id, c);
      return;
    }
    if (!c.active) { c.active = true; c.pos.copy(X); }
    X.set(c.pos.x, groundY(c.pos.x, c.pos.z), c.pos.z); // tahan posisi agar perilaku bawaan tidak menarik agen
    const a = c.cur, el = t - c.t0, p = a.t ? Math.min(1, el / a.t) : 1;
    const st = { status: stt, walkPhase: 0, armWave: t * 2.5 + av.phase, headTilt: Math.sin((t + av.phase) * 1.6) * 0.04, isMoshing: false, isChatting: false, isHandshaking: false, facingDir: av.facingDir };
    let done = false, spin = 0, sy = 1;

    if (!c.init) {
      c.init = true;
      if (a.say) { showBubble(id, a.say, a.t ? Math.max(2.5, a.t) : 3); if (a.log) logChat(LABEL[id], a.say, 'agent'); }
      if (a.type === 'goto' || a.type === 'home') { a.path = planPath(c.pos, a.type === 'home' ? av.basePos : a.pos()); a.k = 0; }
      if (a.type === 'status') setStatus(id, a.status, a.msg);
      if (a.type === 'fn') a.fn();
    }
    switch (a.type) {
      case 'goto': case 'home':
        done = a.k >= a.path.length || (walk(av, c, a.path[a.k], a.run ? 0.085 : 0.04, t, st, a.run) && ++a.k >= a.path.length); break;
      case 'follow': {
        const q = cartoonAgents[a.tg].root.position;
        if (!a.rp || t > a.rp) { a.path = planPath(c.pos, V(q.x - 1, q.z)); a.k = 0; a.rp = t + 1; }
        if (a.k < a.path.length && walk(av, c, a.path[a.k], 0.045, t, st, false)) a.k++;
        done = el >= a.t; break;
      }
      case 'wait': st.armWave = t; done = el >= a.t; break;
      case 'emote': {
        const g = groundY(c.pos.x, c.pos.z);
        switch (a.kind) {
          case 'wave': st.isHandshaking = true; st.armWave = t * 4; break;
          case 'dance': st.isMoshing = true; st.armWave = t * 6; st.facingDir = Math.sin(t * 3) > 0 ? 1 : -1; st.headTilt = Math.sin(t * 6) * 0.12; X.set(c.pos.x + Math.sin(t * 3) * 0.25, g + Math.abs(Math.sin(t * 7)) * 0.2, c.pos.z); break;
          case 'headbang': st.isMoshing = true; st.armWave = t * 8; st.headTilt = Math.sin(t * 16) * 0.26; X.y = g + Math.abs(Math.sin(t * 14)) * 0.2; break;
          case 'jump': st.status = 'DONE'; st.armWave = t * 5; X.y = g + Math.abs(Math.sin(p * Math.PI * 3)) * 0.75; break;
          case 'spin': st.status = 'DONE'; spin = p * Math.PI * 6; X.y = g + Math.sin(p * Math.PI) * 0.35; break;
          case 'celebrate': st.status = 'DONE'; st.armWave = t * 5; st.headTilt = Math.sin(t * 6) * 0.08; X.y = g + Math.abs(Math.sin(t * 5.5)) * 0.22; break;
          case 'bow': st.headTilt = Math.sin(p * Math.PI) * 0.5; break;
          case 'think': st.headTilt = Math.sin(t * 1.5) * 0.14; st.armWave = t; break;
          case 'work': st.status = 'WORKING'; st.armWave = t * 6; X.y = g + Math.abs(Math.sin(t * 8)) * 0.04; break;
          case 'chat': st.isChatting = true; st.armWave = t * 4; st.headTilt = Math.sin(t * 5) * 0.08; break;
          case 'sit': case 'sleep': sy = 0.82 + Math.sin(t * 2.4) * 0.02; X.y = g - 0.02; st.headTilt = a.kind === 'sleep' ? 0.18 : Math.sin(t) * 0.05; break;
        }
        done = el >= a.t; break;
      }
      default: done = true;
    }

    av.root.rotation.y += spin;
    av.mesh.scale.set(1, sy, 1); av.mesh.position.y = 1.09 * sy;
    drawCultOfTheLambAgent(av.ctx, av.id, st); av.texture.needsUpdate = true;
    if (done) { c.cur = null; if (!c.q.length && c.auto) { c.auto = false; c.idleAt = t + 14 + Math.random() * 18; } }
  }

  function frame() {
    const t = now();
    updatePlans();
    IDS.forEach(id => drive(cartoonAgents[id], id, t));
    items = items.filter(it => {
      const u = Math.min(1, (t - it.t0) / 1.1), q = cartoonAgents[it.to].root.position;
      it.sp.position.set(it.fx + (q.x - it.fx) * u, 1.7 + Math.sin(u * Math.PI) * 0.9, it.fz + (q.z - it.fz) * u);
      if (u >= 1) { scene.remove(it.sp); return false; }
      return true;
    });
    IDS.forEach(i => { const b = cartoonAgents[i].bub; if (b && b.sp.visible && t > b.until) b.sp.visible = false; });
    if (follow && cartoonAgents[follow]) {
      const q = cartoonAgents[follow].root.position, d = new THREE.Vector3(q.x, 1.1, q.z).sub(controls.target).multiplyScalar(0.08);
      controls.target.add(d); camera.position.add(d);
      if (isCameraTransitioning) { targetCamPos.add(d); targetLookAt.add(d); }
    }
  }

  /* 7. Antarmuka Command Center */
  const HELP = 'Contoh: "crawler lari ke jembatan lalu melambai" · "semua menari 6 detik" · "penulis serahkan draf ke auditor" · "auditor ke rumah kaca lalu duduk di sofa" · "crawler katakan \\"Halo!\\"" · "kamera sorot auditor" · "stop". Pakai "lalu" untuk urutan, "dan" atau koma untuk agen berbeda, dan nama agen (atau @nama) untuk memilih pelaku.';
  const CHIPS = [
    ['▶ Pipeline lengkap', 'crawler dan drafter mulai kerja lalu crawler serahkan berita ke auditor lalu drafter serahkan draf ke auditor lalu auditor periksa angka lalu semua rayakan'],
    ['🌉 Lari ke jembatan', 'crawler lari ke jembatan lalu melambai'],
    ['🏡 Rumah kaca', 'auditor ke rumah kaca lalu duduk di sofa'],
    ['🤝 Ngobrol', 'penulis ngobrol dengan auditor'],
    ['🤘 Semua headbang', 'semua headbang 6 detik'],
    ['🦢 Beri makan angsa', 'drafter beri makan angsa'],
    ['💬 Bicara', 'crawler katakan "Berita baru sudah masuk!"'],
    ['🎥 Sorot auditor', 'kamera sorot auditor']
  ];

  function setTarget(id) {
    target = id;
    document.querySelectorAll('#cmdTargets button').forEach(b => {
      b.className = 'px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ' + (b.dataset.id === id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-stone-200 hover:bg-stone-100');
    });
  }
  function paintAuto() {
    const b = document.getElementById('cmdAuto'); if (!b) return;
    b.textContent = auto ? '🤖 Otonom: ON' : '🤖 Otonom: OFF';
    b.className = 'px-2.5 py-2 rounded-xl text-[11px] font-bold border ' + (auto ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-stone-100 text-slate-500 border-stone-200');
  }

  function runCommand(raw) {
    raw = (raw || '').trim(); if (!raw) return;
    logChat('Anda', raw, 'user');
    if (/^(bantuan|help|\?)$/i.test(raw)) return logChat('Sistem', HELP, 'sys');
    if (!ready) return logChat('Sistem', 'Scene 3D belum siap, coba lagi sebentar.', 'sys');
    const stages = compile(raw, target === 'all' ? IDS.slice() : [target]);
    if (!stages) return logChat('Sistem', 'Perintah belum dikenali. Ketik "bantuan" untuk contoh.', 'sys');
    const ids = [...new Set(stages.flatMap(s => Object.keys(s)))];
    plans = plans.filter(p => !p.stages.some(s => ids.some(i => s[i])));
    ids.forEach(i => { const c = ctl(cartoonAgents[i]); c.q = []; c.cur = null; c.auto = false; });
    plans.push({ stages, i: 0, launched: false });
    logChat(ids.map(i => LABEL[i]).join(', '), 'Siap! ' + stages.labels.join(', lalu '), 'agent');
    addLog('[PERINTAH] ' + raw, 'work');
  }

  function buildPanel() {
    const log = document.getElementById('terminalLog'); if (!log || document.getElementById('cmdCenter')) return;
    log.parentElement.insertAdjacentHTML('beforebegin',
      '<div id="cmdCenter" class="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-sm space-y-2.5">' +
      '<div class="flex flex-wrap items-center justify-between gap-2"><span class="text-xs font-extrabold text-slate-800">💬 Command Center Agen</span><div id="cmdTargets" class="flex flex-wrap items-center gap-1.5"></div></div>' +
      '<div id="cmdMessages" class="space-y-1.5 max-h-36 overflow-y-auto bg-stone-50 border border-stone-200/80 rounded-xl p-2.5"></div>' +
      '<div id="cmdChips" class="flex flex-wrap gap-1.5"></div>' +
      '<div class="flex items-center gap-1.5"><input id="cmdInput" type="text" autocomplete="off" placeholder="Contoh: auditor ke rumah kaca lalu duduk di sofa" class="flex-1 min-w-0 px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:bg-white focus:border-sky-500">' +
      '<button id="cmdMic" title="Perintah suara" class="px-2.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs">🎤</button><button id="cmdAuto"></button>' +
      '<button id="cmdSend" class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold">Kirim</button></div></div>');
    const tg = document.getElementById('cmdTargets');
    [['all', 'Semua'], ['crawler', 'Crawler'], ['drafter', 'Penulis BRS'], ['auditor', 'Auditor']].forEach(([id, t]) => {
      const b = document.createElement('button'); b.dataset.id = id; b.textContent = t; b.onclick = () => setTarget(id); tg.appendChild(b);
    });
    const ch = document.getElementById('cmdChips');
    CHIPS.forEach(([t, cmd]) => {
      const b = document.createElement('button'); b.textContent = t;
      b.className = 'px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 transition';
      b.onclick = () => runCommand(cmd); ch.appendChild(b);
    });
    const inp = document.getElementById('cmdInput');
    const send = () => { const v = inp.value; inp.value = ''; runCommand(v); };
    document.getElementById('cmdSend').onclick = send;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    document.getElementById('cmdAuto').onclick = () => { auto = !auto; paintAuto(); logChat('Sistem', auto ? 'Mode otonom aktif: agen yang menganggur berjalan-jalan sendiri.' : 'Mode otonom dimatikan: agen hanya bergerak atas perintah.', 'sys'); };
    document.getElementById('cmdMic').onclick = () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return logChat('Sistem', 'Browser ini belum mendukung input suara.', 'sys');
      const r = new SR(); r.lang = 'id-ID';
      r.onresult = e => { inp.value = e.results[0][0].transcript; send(); };
      r.start();
    };
    setTarget('all'); paintAuto();
    logChat('Sistem', 'Pilih agen di atas (atau klik karakternya di scene), lalu ketik perintah. Ketik "bantuan" untuk contoh.', 'sys');
  }

  /* 8. Pasang kait setelah scene 3D selesai dibuat */
  function install() {
    const orig = renderer.render.bind(renderer);
    renderer.render = function (s, c) { try { frame(); } catch (e) { console.warn('[agent-commander]', e); } orig(s, c); };
    const oUp = window.updateAgentUI;
    window.updateAgentUI = function (id) { if (!internalSet && lockUntil[String(id).toLowerCase()] > Date.now()) return; return oUp.apply(this, arguments); };
    const oSel = window.selectAgentCard;
    window.selectAgentCard = function (id) { setTarget(id); return oSel.apply(this, arguments); };
    ready = true;
  }

  if (typeof document.addEventListener === 'function') document.addEventListener('DOMContentLoaded', buildPanel);
  const wait = setInterval(() => {
    if (typeof renderer !== 'undefined' && renderer && typeof cartoonAgents !== 'undefined' && cartoonAgents.auditor) {
      clearInterval(wait); buildPanel(); install();
    }
  }, 300);

  window.RUWAI_CMD = { run: runCommand, compile };
})();
