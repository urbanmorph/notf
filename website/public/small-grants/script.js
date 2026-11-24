(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const inOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const out = t => 1 - Math.pow(1 - t, 3);
  const NBSP = ' ';

  /* =====================================================================
     Language (EN / ಕನ್ನಡ)
     English lives in the HTML; Kannada comes from i18n-kn.js.
     ===================================================================== */
  const KN = window.NOTF_KN || {};
  let lang = 'en';
  const afterLang = []; // callbacks re-run whenever the language changes

  $$('[data-i18n]').forEach(n => { n.dataset.en = n.innerHTML; });
  $$('[data-i18n-ph]').forEach(n => { n.dataset.enPh = n.placeholder; });

  // Keep the last two words of a block together so no line ends on a lone word
  const WIDOW_SEL = 'h2, .step h3 > span:first-child, .step p, .how__intro > p, .grant__caption, .grant__stats li > span, .who__list li, .asks li, .asks h3, .fit__note, .fit__qs p, .faq summary b, .faq details p, .lede, .faq__more, .cta__inner > p, [data-verdict-text], [data-verdict-title]';
  const fixWidow = el => {
    if (el.textContent.trim().split(/\s+/).length < 4) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node, last = null;
    while ((node = walker.nextNode())) if (/\S\s+\S/.test(node.nodeValue)) last = node;
    if (last) last.nodeValue = last.nodeValue.replace(/\s+(\S+\s*)$/, NBSP + '$1');
  };
  const noWidows = () => $$(WIDOW_SEL).forEach(fixWidow);

  const setLang = next => {
    lang = next === 'kn' ? 'kn' : 'en';
    root.lang = lang;
    $$('[data-i18n]').forEach(n => { n.innerHTML = (lang === 'kn' && KN[n.dataset.i18n]) || n.dataset.en; });
    $$('[data-i18n-ph]').forEach(n => { n.placeholder = (lang === 'kn' && KN[n.dataset.i18nPh]) || n.dataset.enPh; });
    $$('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    try { localStorage.setItem('notf-lang', lang); } catch (e) { /* private mode */ }
    afterLang.forEach(fn => fn());
    noWidows();
  };
  $$('.lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));

  /* ---------- Liquid-glass lens ----------
     styles.css draws the lens. Here: (1) real refraction, which bends whatever is behind the
     rim of the lens (Chromium only; other browsers keep the frosted fallback), and (2) the
     language lens sliding, squeezing and settling between EN and Kannada. */
  const canRefract = /Chrome\//.test(navigator.userAgent);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let lensDefs = null;
  const refract = (el, id, strength) => {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!canRefract || !w || !h) return;
    if (!lensDefs) {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      lensDefs = svg.appendChild(document.createElementNS(SVG_NS, 'defs'));
      document.body.appendChild(svg);
    }
    // Displacement map: red pushes pixels sideways, green up and down. The middle is neutral,
    // so only a band near the rim bends, the way a thick lens distorts at its edge.
    const r = Math.min(w, h) / 2, band = Math.max(5, r * 0.42);
    const map = `<svg xmlns="${SVG_NS}" width="${w}" height="${h}">` +
      '<defs><linearGradient id="x"><stop stop-color="#f00"/><stop offset="1" stop-color="#000"/></linearGradient>' +
      '<linearGradient id="y" x2="0" y2="1"><stop stop-color="#0f0"/><stop offset="1" stop-color="#000"/></linearGradient></defs>' +
      `<rect width="${w}" height="${h}" fill="#000"/>` +
      `<rect width="${w}" height="${h}" rx="${r}" fill="url(#x)"/>` +
      `<rect width="${w}" height="${h}" rx="${r}" fill="url(#y)" style="mix-blend-mode:screen"/>` +
      `<rect x="${band}" y="${band}" width="${w - band * 2}" height="${h - band * 2}" rx="${Math.max(0, r - band)}" fill="#808000" style="filter:blur(${band * 0.55}px)"/></svg>`;
    let f = document.getElementById(id);
    if (!f) {
      f = document.createElementNS(SVG_NS, 'filter');
      f.id = id;
      f.setAttribute('color-interpolation-filters', 'sRGB');
      f.innerHTML = '<feImage result="map" preserveAspectRatio="none"/><feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G"/>';
      lensDefs.appendChild(f);
    }
    ['x', 'y'].forEach(k => f.setAttribute(k, 0));
    f.setAttribute('filterUnits', 'userSpaceOnUse');
    f.setAttribute('width', w); f.setAttribute('height', h);
    const img = f.firstChild;
    img.setAttribute('x', 0); img.setAttribute('y', 0);
    img.setAttribute('width', w); img.setAttribute('height', h);
    img.setAttribute('href', 'data:image/svg+xml,' + encodeURIComponent(map));
    f.lastChild.setAttribute('scale', strength);
    el.style.backdropFilter = `url(#${id}) blur(0.6px) saturate(1.7) brightness(1.06)`;
  };

  // Slide a lens over `target` (or fade it out when there is none)
  const moveLens = (lens, target, id) => {
    if (!target || !target.offsetWidth) { lens.classList.remove('is-placed'); lens._at = null; return; }
    const moved = lens._at && lens._at !== target;
    if (!lens._at) lens.classList.remove('is-ready');   // appear in place rather than flying in
    lens._at = target;
    lens.style.width = `${target.offsetWidth}px`;
    lens.style.transform = `translateX(${target.offsetLeft}px)`;
    lens.classList.add('is-placed');
    requestAnimationFrame(() => requestAnimationFrame(() => lens.classList.add('is-ready')));
    // Size the refraction for where the lens is heading, once the layout has settled
    setTimeout(() => refract(lens, id, 14), 0);
    // Squeeze while travelling, overshoot on landing, then wobble to rest
    if (moved && !reduce && lens.animate) {
      lens.animate(
        { scale: ['1 1', '1.16 0.76', '0.92 1.1', '1.04 0.96', '0.99 1.01', '1 1'], offset: [0, 0.28, 0.6, 0.78, 0.9, 1] },
        { duration: 680, easing: 'ease-out' }
      );
    }
  };

  // Language switch
  const langLens = $('.lang .tab-lens');
  const placeLang = () => moveLens(langLens, $('.lang button[aria-pressed="true"]'), 'lens-lang');

  // Main nav: the lens rests on the section you are reading and follows the pointer on hover
  const nav = $('.top__nav');
  const navLens = $('.tab-lens', nav);
  const navLinks = $$('a', nav);
  let navHover = null, navCurrent = null;
  const placeNav = () => {
    const at = navHover || navCurrent;
    navLinks.forEach(a => a.classList.toggle('is-current', a === at));
    moveLens(navLens, at, 'lens-nav');
  };
  navLinks.forEach(a => {
    ['pointerenter', 'focus'].forEach(type => a.addEventListener(type, () => { navHover = a; placeNav(); }));
    a.addEventListener('blur', () => { navHover = null; placeNav(); });
  });
  nav.addEventListener('pointerleave', () => { navHover = null; placeNav(); });
  // Home goes to the framed opening view (image card, headline and buttons), not the very top
  $('a[href="#home"]', nav).addEventListener('click', e => {
    e.preventDefault();
    const home = $('#home');
    scrollTo({ top: Math.max(0, home.offsetTop + home.offsetHeight - innerHeight), behavior: 'smooth' });
  });
  const spyNav = () => {
    const mid = innerHeight * 0.45;
    let cur = null;
    navLinks.forEach(a => {
      const sec = $(a.getAttribute('href'));
      if (!sec) return;
      const r = sec.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) cur = a;
    });
    if (cur !== navCurrent) { navCurrent = cur; placeNav(); }
  };
  addEventListener('scroll', spyNav, { passive: true });

  const placeLenses = () => { placeLang(); placeNav(); };
  afterLang.push(placeLenses);
  addEventListener('resize', placeLenses);
  addEventListener('load', () => {
    spyNav();
    placeLenses();
    const cueLens = $('.hero__cue i');
    if (cueLens) refract(cueLens, 'lens-cue', 26);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeLenses);

  /* ---------- Marquees: repeat items to fill, then double for a seamless loop ---------- */
  $$('[data-marquee]').forEach(track => {
    const originals = [...track.children];
    let guard = 0;
    while (track.scrollWidth < innerWidth * 1.5 && guard++ < 8) {
      originals.forEach(n => track.appendChild(n.cloneNode(true)));
    }
    [...track.children].forEach(n => track.appendChild(n.cloneNode(true)));
  });

  /* ---------- Rotating Bengaluru area names ---------- */
  const wardEl = $('[data-ward]');
  const WARDS_EN = ['Malleshwaram', 'Basavanagudi', 'Whitefield', 'Jayanagar', 'Indiranagar', 'Koramangala', 'Yelahanka', 'Shivajinagar', 'Rajajinagar', 'HSR Layout', 'Hebbal', 'Banashankari', 'Chickpet', 'Ulsoor', 'Shanthinagar', 'KR Puram'];
  const wards = () => (lang === 'kn' && KN.wards) || WARDS_EN;
  let wardIndex = 0;
  afterLang.push(() => { wardEl.textContent = wards()[wardIndex]; });
  if (!reduce) {
    setInterval(() => {
      if (document.hidden) return;
      wardEl.classList.remove('is-in');
      wardEl.classList.add('is-out');
      setTimeout(() => {
        wardIndex = (wardIndex + 1) % WARDS_EN.length;
        wardEl.textContent = wards()[wardIndex];
        wardEl.classList.remove('is-out');
        wardEl.classList.add('is-in');
      }, 320);
    }, 2200);
  }

  /* =====================================================================
     Fit check: build a sentence, answer three, watch the verdict fill in
     ===================================================================== */
  const V_EN = {
    idleTitle: 'Answer all three.',
    idleText: 'Your verdict shows up here. Nothing is saved or sent.',
    left: n => `${n} more to go.`,
    fitTitle: 'Sounds like a fit.',
    fitText: (who, what, where) => `${who.charAt(0).toUpperCase() + who.slice(1)} working on ${what} in ${where}? We'd love to hear from you.`,
    noTitle: 'Maybe not this round.',
    noText: 'This round is for Bengaluru-based fixes to a specific neighbourhood problem, that could travel. Not sure? <a href="#faq">Read the FAQs</a> or write to us.',
  };
  const verdict = $('[data-verdict]');
  const vTitle = $('[data-verdict-title]');
  const vText = $('[data-verdict-text]');
  const vCta = $('[data-verdict-cta]');
  const vBar = $$('.verdict__bar i');
  const questions = $$('[data-q]');
  const fitWho = $('#fitWho'), fitWhat = $('#fitWhat'), fitWhere = $('#fitWhere');
  const optText = sel => sel.options[sel.selectedIndex].textContent.trim();

  const confetti = () => {
    if (reduce) return;
    const colors = ['#FAB52A', '#C5562C', '#B5C37C', '#FFEFD6', '#D2865D', '#3E6281'];
    for (let i = 0; i < 22; i++) {
      const bit = document.createElement('span');
      bit.className = 'confetti';
      const angle = (Math.PI * 2 * i) / 22 + Math.random() * 0.4;
      const dist = 70 + Math.random() * 90;
      bit.style.setProperty('--x', `${Math.cos(angle) * dist}px`);
      bit.style.setProperty('--y', `${Math.sin(angle) * dist - 30}px`);
      bit.style.setProperty('--r', `${Math.random() * 540 - 270}deg`);
      bit.style.background = colors[i % colors.length];
      if (i % 3 === 0) bit.style.borderRadius = '50%';
      verdict.appendChild(bit);
      setTimeout(() => bit.remove(), 1100);
    }
  };

  let lastState = 'idle';
  const renderVerdict = () => {
    const V = (lang === 'kn' && KN.verdict) || V_EN;
    const answers = questions.map(q => q.dataset.answer);
    const done = answers.filter(Boolean).length;
    vBar.forEach((seg, i) => { seg.dataset.a = answers[i] || ''; });
    let state = 'idle';
    if (done === 3) state = answers.every(a => a === 'yes') ? 'fit' : 'nofit';
    else if (done > 0) state = 'progress';
    verdict.dataset.state = state;
    vCta.hidden = state !== 'fit';
    if (state === 'idle') { vTitle.textContent = V.idleTitle; vText.textContent = V.idleText; }
    else if (state === 'progress') { vTitle.textContent = V.left(3 - done); vText.textContent = V.idleText; }
    else if (state === 'fit') {
      const where = fitWhere.value.trim() || fitWhere.placeholder;
      vTitle.textContent = V.fitTitle;
      vText.textContent = V.fitText(optText(fitWho), optText(fitWhat), where);
    } else { vTitle.textContent = V.noTitle; vText.innerHTML = V.noText; }
    if (state !== lastState) {
      verdict.classList.remove('pop');
      void verdict.offsetWidth; // restart the pop animation
      verdict.classList.add('pop');
      if (state === 'fit') confetti();
    }
    lastState = state;
    fixWidow(vText);
  };

  questions.forEach(q => {
    $$('button', q).forEach(btn => {
      btn.addEventListener('click', () => {
        $$('button', q).forEach(b => b.setAttribute('aria-checked', String(b === btn)));
        q.dataset.answer = btn.dataset.a;
        renderVerdict();
      });
    });
  });
  const sizeChip = sel => { sel.style.width = `calc(${Math.max(4, optText(sel).length)}ch + 3.6em)`; };
  [fitWho, fitWhat].forEach(sel => sel.addEventListener('change', () => { sizeChip(sel); renderVerdict(); }));
  fitWhere.addEventListener('input', renderVerdict);
  afterLang.push(() => { [fitWho, fitWhat].forEach(sizeChip); renderVerdict(); });

  /* ---------- Header: tuck away on scroll down, return on scroll up ---------- */
  const top = $('.top');
  const hero = $('.hero');
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    const heroEnd = hero.offsetHeight - innerHeight * 0.5;
    if (y < heroEnd) top.classList.remove('is-hidden');
    else if (y > lastY + 6) top.classList.add('is-hidden');
    else if (y < lastY - 6) top.classList.remove('is-hidden');
    if (Math.abs(y - lastY) > 6) lastY = y;
  }, { passive: true });

  /* ---------- Apply button: white artwork over dark backgrounds, rust over light ones ---------- */
  const fab = $('.apply-fab');
  const darkZones = $$('.about, .grant, .breaker, .how__panel, .cta');
  const updateFab = () => {
    const y = innerHeight - parseFloat(getComputedStyle(fab).bottom) - fab.offsetHeight / 2;
    const covers = el => { const r = el.getBoundingClientRect(); return r.top <= y && r.bottom > y; };
    let dark;
    if (covers(hero)) {
      // Over the hero the button sits on the image only until the image frames up into its card
      const r = hero.getBoundingClientRect();
      dark = reduce ? false : -r.top / Math.max(1, r.height - innerHeight) <= 0.35;
    } else {
      dark = darkZones.some(covers);
    }
    document.body.classList.toggle('fab-on-dark', dark);
  };
  addEventListener('scroll', updateFab, { passive: true });
  addEventListener('resize', updateFab);
  updateFab();

  /* ---------- About: split into words (scroll-lit when motion is allowed) ---------- */
  const aboutText = $('[data-words]');
  let wordEls = [];
  let wordState = [];
  afterLang.push(() => {
    const text = aboutText.textContent.trim();
    const words = text.split(/\s+/);
    aboutText.setAttribute('aria-label', text);
    aboutText.innerHTML = words
      .map((w, i) => `<span class="w" aria-hidden="true">${w}</span>${i === words.length - 1 ? '' : i === words.length - 2 ? NBSP : ' '}`)
      .join('');
    wordEls = $$('.w', aboutText);
    wordState = new Array(wordEls.length).fill(-1);
  });

  // Initial language: saved choice, else English
  let saved = 'en';
  try { saved = localStorage.getItem('notf-lang') || 'en'; } catch (e) { /* ignore */ }
  setLang(saved);

  if (reduce) return; // static layout, no scroll-driven motion
  root.classList.add('js');

  /* ---------- Reveal on enter ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.2 });
  $$('.reveal').forEach(el => io.observe(el));

  /* ---------- Grant ruler ---------- */
  const grantNumber = $('[data-grant-number]');
  const ruler = $('.ruler');
  const rulerMarker = $('.ruler__marker');
  const rulerLabel = $('[data-ruler-label]');
  const fmt = new Intl.NumberFormat('en-IN');
  let lastGrant = null;
  const stages = $$('.grant__stages li');

  /* ---------- Hero refs ---------- */
  const heroCard = $('.hero__card');
  const heroImg = $('img', heroCard);
  const heroWide = $('.hero__wide', heroCard);
  const heroHeadline = $('.hero__headline');
  const heroBelow = $('.hero__below');
  const heroCue = $('.hero__cue');
  const heroSound = $('.sound');
  // The scroll cue is a button: it carries you through the opening animation
  heroCue.addEventListener('click', () => scrollTo({ top: hero.offsetTop + hero.offsetHeight - innerHeight, behavior: 'smooth' }));
  const heroProbe = $('.hero__probe');
  const logo = $('.top__logo');
  let logoScale = 1;
  const topRight = $('.top__right');

  const renderers = {
    hero(p) {
      // Full-bleed landing image -> framed card with header, headline and sub-line
      const e = inOut(clamp(p / 0.7));
      const stage = heroProbe.parentElement;
      const t = heroProbe.offsetTop;
      const side = heroProbe.offsetLeft;
      const bottom = stage.offsetHeight - t - heroProbe.offsetHeight;
      heroCard.style.clipPath = `inset(${e * t}px ${e * side}px ${e * bottom}px ${e * side}px round ${e * 18}px)`;
      heroImg.style.transform = `translate3d(0, ${-e * 9}vh, 0)`;
      // The wide picture tracks the shrinking frame and takes over from the opening picture
      heroWide.style.left = `${e * side}px`;
      heroWide.style.top = `${e * t}px`;
      heroWide.style.width = `${stage.offsetWidth - e * side * 2}px`;
      heroWide.style.height = `${stage.offsetHeight - e * (t + bottom)}px`;
      heroWide.style.opacity = clamp((e - 0.15) / 0.6);
      const h = out(clamp((p - 0.3) / 0.5));
      heroHeadline.style.transform = `translate3d(0, ${(1 - h) * (bottom + heroHeadline.offsetHeight * 1.2)}px, 0)`;
      const b = clamp((p - 0.55) / 0.25);
      heroBelow.style.opacity = b;
      heroBelow.style.transform = `translate3d(0, ${(1 - b) * 24}px, 0)`;
      heroBelow.style.pointerEvents = b > 0.6 ? '' : 'none';
      const cue = 1 - clamp(p / 0.05);
      [heroCue, heroSound].forEach(b => { b.style.opacity = cue; b.style.pointerEvents = cue > 0.5 ? '' : 'none'; b.tabIndex = cue > 0.5 ? 0 : -1; });
      // Logo travels from top-centre (on the image) to the top-left of the header bar
      const w = logo.offsetWidth / logoScale;   // header-size width, whatever size it is drawn at right now
      const s = 1 + (1 - e) * 0.705;   // logo on the opening image is 1.705x its header size
      logoScale = s;
      top.style.setProperty('--bar', e);
      top.style.setProperty('--ls', s);
      top.style.setProperty('--lx', `${(1 - e) * (innerWidth / 2 - logo.offsetLeft - (w * s) / 2)}px`);
      top.style.setProperty('--ly', `${(1 - e) * 14}px`);
      topRight.style.pointerEvents = e > 0.6 ? '' : 'none';
    },
    about(p) {
      const lit = clamp(p / 0.82) * (wordEls.length + 3);
      wordEls.forEach((el, i) => {
        const o = Math.round((0.18 + 0.82 * clamp((lit - i) / 3)) * 100) / 100;
        if (wordState[i] !== o) { wordState[i] = o; el.style.setProperty('--o', o); }
      });
    },
    grant(p) {
      const t = clamp((p - 0.06) / 0.7);
      const v = Math.round((50000 + t * 150000) / 1000) * 1000;
      if (v !== lastGrant) {
        lastGrant = v;
        grantNumber.textContent = fmt.format(v);
        rulerLabel.textContent = v >= 100000 ? `₹${+(v / 100000).toFixed(2)}L` : `₹${v / 1000}k`;
      }
      stages.forEach((el, i) => el.classList.toggle('is-on', t >= i / 3 - 0.02));
      rulerMarker.style.transform = `translate3d(0, ${(1 - t) * ruler.offsetHeight}px, 0)`;
    },
    breaker(p, el) {
      const img = el.querySelector(':scope > img');
      img.style.transform = `translate3d(0, ${(p - 0.5) * 0.4 * el.offsetHeight}px, 0) scale(1.04)`;
    },
    float(p, el) {
      const [a, b] = $$('.how__orb', el);
      a.style.transform = `translate3d(0, ${(0.5 - p) * 190}px, 0) rotate(${(p - 0.5) * 14}deg)`;
      b.style.transform = `translate3d(0, ${(0.5 - p) * -110}px, 0) rotate(${(0.5 - p) * 10}deg)`;
    },
  };
  const pinned = new Set(['hero', 'about', 'grant']);

  const scrubs = $$('[data-scrub]').map(el => ({ el, type: el.dataset.scrub, cur: null }));
  const target = s => {
    const r = s.el.getBoundingClientRect();
    const vh = innerHeight;
    return pinned.has(s.type)
      ? clamp(-r.top / Math.max(1, r.height - vh))
      : clamp((vh - r.top) / (vh + r.height));
  };

  let force = true;
  addEventListener('resize', () => { force = true; });
  afterLang.push(() => { force = true; });
  const tick = () => {
    scrubs.forEach(s => {
      const t = target(s);
      if (s.cur === null) s.cur = t;
      const prev = s.cur;
      s.cur += (t - s.cur) * 0.14;
      if (Math.abs(t - s.cur) < 0.0004) s.cur = t;
      if (force || s.cur !== prev) renderers[s.type](s.cur, s.el);
    });
    force = false;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
