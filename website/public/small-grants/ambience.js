/* Outdoor soundscape for the landing screen: birdsong and insects (no wind), generated
   in the browser, plus an optional real recording (children playing in a park) layered on top.
   To add the recording, put the file in the audio folder and set RECORDING below.
   It only sounds while the page is at the very top and fades out on the first scroll.
   Browsers do not allow sound before the visitor's first tap, click or key press. */
(() => {
  const btn = document.querySelector('.sound');
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!btn || !AC || !document.documentElement.classList.contains('js')) return;

  const LABELS = {
    en: { idle: 'Tap for sound', on: 'Sound on', off: 'Sound off' },
    kn: { idle: 'ಧ್ವನಿಗಾಗಿ ಒತ್ತಿ', on: 'ಧ್ವನಿ ಆನ್', off: 'ಧ್ವನಿ ಆಫ್' },
  };
  const label = btn.querySelector('.sound__label');
  const TOP_ZONE = 60;      // px of scroll that still counts as "the first screen"
  const LEVEL = 0.6;        // loudness of the birds and insects (0 to 1)
  const RECORDING = '';     // e.g. 'audio/kids-playing.mp3'; leave empty for birds and insects only
  const REC_LEVEL = 0.55;   // loudness of the recording (0 to 1)

  let muted = false;
  // The mute choice is not remembered: every visit starts with the sound on
  try { localStorage.removeItem('notf-sound'); } catch (e) {}
  let ctx = null, master = null, built = false, suspendTimer = 0;

  const atTop = () => scrollY < TOP_ZONE;
  const state = () => (muted ? 'off' : built ? 'on' : 'idle');
  const paint = () => {
    const s = state();
    const lang = document.documentElement.lang === 'kn' ? 'kn' : 'en';
    btn.dataset.state = s;
    btn.setAttribute('aria-pressed', String(s === 'on'));
    btn.setAttribute('aria-label', LABELS[lang][s]);
    label.textContent = LABELS[lang][s];
  };

  /* ---------- The sound itself ---------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  let birdBus, crickets = [], nextBird = 0, nextFar = 0;
  const side = x => {
    if (!ctx.createStereoPanner) return master;
    const pan = ctx.createStereoPanner(); pan.pan.value = x; pan.connect(master);
    return pan;
  };

  const build = () => {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(comp); comp.connect(ctx.destination);

    // Insect bed: a thin, steady shimmer far in the background (narrow band of hiss, gently pulsing)
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 5600; band.Q.value = 9;
    const bed = ctx.createGain(); bed.gain.value = 0.02;
    const pulse = ctx.createOscillator(); pulse.frequency.value = 0.18;
    const depth = ctx.createGain(); depth.gain.value = 0.008;
    pulse.connect(depth); depth.connect(bed.gain);
    noise.connect(band); band.connect(bed); bed.connect(master);
    noise.start(); pulse.start();

    // Two crickets, one each side, chirping at their own pace
    crickets = [
      { out: side(-0.6), freq: 4350, gap: 0.62, level: 0.007, next: ctx.currentTime + 1.5 },
      { out: side(0.7), freq: 4800, gap: 0.81, level: 0.005, next: ctx.currentTime + 3 },
    ];

    // Birds: dry + a faint echo so they sit out in the open rather than in your ear
    birdBus = ctx.createGain(); birdBus.gain.value = 1;
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.19;
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    birdBus.connect(master); birdBus.connect(delay); delay.connect(wet); wet.connect(master);

    nextBird = ctx.currentTime + 0.8;
    nextFar = ctx.currentTime + 7;
    setInterval(schedule, 300);
    built = true;
  };

  // One whistle: a sine that glides through a few pitches inside a soft envelope
  const note = (out, t, freqs, dur, level) => {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freqs[0], t);
    freqs.slice(1).forEach((f, i) => o.frequency.exponentialRampToValueAtTime(f, t + dur * (i + 1) / (freqs.length - 1)));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + Math.min(0.03, dur * 0.3));
    g.gain.linearRampToValueAtTime(level * 0.7, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  };
  const placed = () => {
    if (!ctx.createStereoPanner) return birdBus;
    const pan = ctx.createStereoPanner(); pan.pan.value = rand(-0.85, 0.85); pan.connect(birdBus);
    return pan;
  };

  const BIRDS = [
    // Sparrow-like chatter: a handful of quick chirps
    t => {
      const out = placed(), base = rand(3000, 4200), vol = rand(0.012, 0.022);
      let s = t;
      for (let i = Math.floor(rand(3, 8)); i > 0; i--) {
        note(out, s, [base * rand(0.95, 1.05), base * rand(1.2, 1.45), base * rand(0.85, 1)], rand(0.07, 0.11), vol);
        s += rand(0.12, 0.26);
      }
    },
    // Two-note "tu-wit, tu-wit" like a tailorbird
    t => {
      const out = placed(), lo = rand(3100, 3600), vol = rand(0.01, 0.018), gap = rand(0.15, 0.19);
      for (let i = 0, n = Math.floor(rand(4, 9)); i < n; i++) {
        note(out, t + i * gap, [lo, lo * 1.02], 0.05, vol);
        note(out, t + i * gap + 0.065, [lo * 1.3, lo * 1.24], 0.06, vol);
      }
    },
    // A single clear falling whistle, answered once
    t => {
      const out = placed(), top = rand(2300, 2900), vol = rand(0.012, 0.02);
      note(out, t, [top, top * 0.97, top * 0.72], 0.34, vol);
      if (Math.random() < 0.6) note(out, t + rand(0.5, 0.8), [top * 0.9, top * 0.88, top * 0.66], 0.3, vol * 0.8);
    },
    // Fast high trill
    t => {
      const out = placed(), f = rand(4300, 5200), vol = rand(0.007, 0.012);
      for (let i = 0, n = Math.floor(rand(8, 16)); i < n; i++) note(out, t + i * 0.055, [f, f * 1.08, f * 0.96], 0.04, vol);
    },
  ];

  // Far off: a koel's rising "ku-oo, ku-oo", each call a little higher than the last
  const koel = t => {
    const out = placed(), start = rand(760, 880);
    for (let i = 0, n = Math.floor(rand(4, 7)); i < n; i++) {
      const f = start * (1 + i * 0.045);
      note(out, t + i * 0.62, [f, f * 1.08, f * 1.5, f * 1.46], 0.4, 0.006 + i * 0.0018);
    }
  };

  // Queue up the next second or so of sound. The audio clock stops while the context is
  // suspended, so nothing piles up when the sound is paused.
  const schedule = () => {
    if (ctx.state !== 'running') return;
    const horizon = ctx.currentTime + 1;
    while (nextBird < horizon) {
      pick(BIRDS)(nextBird);
      if (Math.random() < 0.35) pick(BIRDS)(nextBird + rand(0.4, 1.2));   // sometimes another bird answers
      nextBird += rand(1.6, 4.8);
    }
    while (nextFar < horizon) { koel(nextFar); nextFar += rand(16, 30); }
    // Each cricket chirp is three tiny pulses; now and then a cricket rests for a few seconds
    crickets.forEach(c => {
      while (c.next < horizon) {
        for (let i = 0; i < 3; i++) note(c.out, c.next + i * 0.034, [c.freq, c.freq * 1.01], 0.024, c.level);
        c.next += Math.random() < 0.06 ? rand(3, 7) : c.gap * rand(0.96, 1.04);
      }
    });
  };

  /* ---------- Optional recording, looped and faded by hand ---------- */
  const rec = RECORDING ? new Audio(RECORDING) : null;
  let recFade = 0;
  if (rec) { rec.loop = true; rec.preload = 'none'; rec.volume = 0; }
  const fadeRec = to => {
    if (!rec) return;
    clearInterval(recFade);
    if (to > 0) rec.play().catch(() => {});
    recFade = setInterval(() => {
      const v = rec.volume + Math.sign(to - rec.volume) * 0.03;
      if (Math.abs(to - v) < 0.03) { rec.volume = to; clearInterval(recFade); if (to === 0) rec.pause(); }
      else rec.volume = Math.max(0, Math.min(1, v));
    }, 40);
  };

  /* ---------- Play only on the first screen ---------- */
  const update = () => {
    paint();
    if (!built) return;
    const want = !muted && atTop() && !document.hidden;
    clearTimeout(suspendTimer);
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    if (want) {
      ctx.resume();
      master.gain.setTargetAtTime(LEVEL, now, 0.6);
      fadeRec(REC_LEVEL);
    } else {
      master.gain.setTargetAtTime(0, now, 0.22);
      fadeRec(0);
      suspendTimer = setTimeout(() => ctx.suspend(), 1400);
    }
  };

  const unlock = () => {
    if (built || muted) return;
    if (!ctx) ctx = new AC();
    const ready = () => { if (!built && ctx.state === 'running') { build(); update(); } };
    ctx.resume().then(ready, () => {});
  };

  document.addEventListener('click', e => {
    if (!btn.contains(e.target)) { unlock(); return; }
    if (state() === 'on') muted = true;
    else { muted = false; unlock(); }
    update();
  });
  ['keydown', 'pointerdown', 'mousedown', 'touchend'].forEach(type =>
    document.addEventListener(type, e => { if (!btn.contains(e.target)) unlock(); }, { passive: true }));
  // Try to start as soon as the page opens. Browsers that allow it play straight away;
  // the rest hold the sound back until the visitor's first tap, click or key press.
  unlock();

  let wasTop = atTop();
  addEventListener('scroll', () => { const t = atTop(); if (t !== wasTop) { wasTop = t; update(); } }, { passive: true });
  document.addEventListener('visibilitychange', update);
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  paint();
})();
