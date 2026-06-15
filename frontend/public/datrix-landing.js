/* ============================================================================
   datrix-three.js
   ============================================================================ */

/* Datrix — WebGL hero (Three.js). Real 3D, accent-reactive, four scenes:
   network · grid · lattice · globe. Mouse parallax + auto motion + scroll fade.
   Keeps the window.DatrixHero API so the Tweaks panel drives it unchanged. */
(function () {
  'use strict';

  var THREE = window.THREE;
  var canvas = document.getElementById('hero-canvas');
  if (!THREE || !canvas) { window.DatrixHero = { update: function(){}, refreshAccent: function(){}, step: function(){} }; return; }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var renderer, scene, camera, group, raf = null;
  var mode = 'grid', density = 1;
  var accent = new THREE.Color('#63b3ff');
  var dot = makeDot();
  var mx = 0, my = 0, tmx = 0, tmy = 0, t = 0;
  var grid = null;
  var net = null;

  function animOn() { return document.body.getAttribute('data-anim') === 'on' && !reduce; }

  function makeDot() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    var rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(32, 32, 32, 0, 6.2832); g.fill();
    var tex = new THREE.CanvasTexture(c); tex.needsUpdate = true; return tex;
  }

  function readAccent() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#63b3ff';
    try { accent.set(v); } catch (e) {}
    applyColors();
  }
  function applyColors() {
    if (!group) return;
    group.traverse(function (o) {
      if (o.material && o.material.color) o.material.color.copy(accent);
    });
  }

  function clearGroup() {
    if (!group) return;
    for (var i = group.children.length - 1; i >= 0; i--) {
      var o = group.children[i];
      group.remove(o);
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    }
    grid = null; net = null;
  }

  function pointsMat(size) {
    return new THREE.PointsMaterial({
      color: accent.clone(), size: size, map: dot, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, opacity: 0.95
    });
  }
  function lineMat(op) {
    return new THREE.LineBasicMaterial({ color: accent.clone(), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
  }

  /* ── scenes ── */
  function buildNetwork() {
    var N = Math.max(16, Math.round(46 * density));
    var pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      pos[i*3]   = (Math.random()*2-1) * 2.3;
      pos[i*3+1] = (Math.random()*2-1) * 1.5;
      pos[i*3+2] = (Math.random()*2-1) * 2.3;
      vel[i*3]   = (Math.random()*2-1) * 0.0016;
      vel[i*3+1] = (Math.random()*2-1) * 0.0016;
      vel[i*3+2] = (Math.random()*2-1) * 0.0016;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var pts = new THREE.Points(geo, pointsMat(0.14));
    group.add(pts);
    var linePos = new Float32Array(N * N * 6);
    var lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    var lines = new THREE.LineSegments(lineGeo, lineMat(0.22));
    group.add(lines);
    net = { N: N, pos: pos, vel: vel, geo: geo, lineGeo: lineGeo, linePos: linePos };
  }
  function stepNetwork() {
    if (!net) return;
    var N = net.N, pos = net.pos, vel = net.vel, lp = net.linePos;
    if (animOn()) {
      for (var i = 0; i < N; i++) {
        pos[i*3]+=vel[i*3]; pos[i*3+1]+=vel[i*3+1]; pos[i*3+2]+=vel[i*3+2];
        if (pos[i*3] < -2.3 || pos[i*3] > 2.3) vel[i*3]*=-1;
        if (pos[i*3+1] < -1.5 || pos[i*3+1] > 1.5) vel[i*3+1]*=-1;
        if (pos[i*3+2] < -2.3 || pos[i*3+2] > 2.3) vel[i*3+2]*=-1;
      }
      net.geo.attributes.position.needsUpdate = true;
    }
    var lim = 1.5, k = 0;
    for (var a = 0; a < N; a++) for (var b = a+1; b < N; b++) {
      var dx=pos[a*3]-pos[b*3], dy=pos[a*3+1]-pos[b*3+1], dz=pos[a*3+2]-pos[b*3+2];
      if (dx*dx+dy*dy+dz*dz < lim*lim) {
        lp[k++]=pos[a*3]; lp[k++]=pos[a*3+1]; lp[k++]=pos[a*3+2];
        lp[k++]=pos[b*3]; lp[k++]=pos[b*3+1]; lp[k++]=pos[b*3+2];
      }
    }
    net.lineGeo.setDrawRange(0, k/3);
    net.lineGeo.attributes.position.needsUpdate = true;
  }

  function buildGlobe() {
    var M = Math.max(120, Math.round(320 * density)), R = 2.1;
    var pos = new Float32Array(M*3), gold = Math.PI*(3-Math.sqrt(5));
    var lp = [];
    for (var i = 0; i < M; i++) {
      var y = 1 - (i/(M-1))*2, r = Math.sqrt(1-y*y), th = gold*i;
      var x=Math.cos(th)*r*R, yy=y*R, z=Math.sin(th)*r*R;
      pos[i*3]=x; pos[i*3+1]=yy; pos[i*3+2]=z;
      if (i>0 && r>0.25) { lp.push(pos[(i-1)*3],pos[(i-1)*3+1],pos[(i-1)*3+2], x,yy,z); }
    }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    group.add(new THREE.Points(geo, pointsMat(0.085)));
    var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lp),3));
    group.add(new THREE.LineSegments(lg, lineMat(0.14)));
  }

  function buildLattice() {
    var G = Math.max(3, Math.min(6, Math.round(3 + 2*density))), s = 3.4/(G-1), off=(G-1)/2;
    var pos = [], idx = {}, n = 0;
    for (var i=0;i<G;i++) for (var j=0;j<G;j++) for (var k=0;k<G;k++){ idx[i+','+j+','+k]=n++; pos.push((i-off)*s,(j-off)*s,(k-off)*s); }
    var lp = [];
    function ln(A,B){ lp.push(pos[A*3],pos[A*3+1],pos[A*3+2],pos[B*3],pos[B*3+1],pos[B*3+2]); }
    for (i=0;i<G;i++) for (j=0;j<G;j++) for (k=0;k<G;k++){ var c=idx[i+','+j+','+k];
      if(i+1<G)ln(c,idx[(i+1)+','+j+','+k]); if(j+1<G)ln(c,idx[i+','+(j+1)+','+k]); if(k+1<G)ln(c,idx[i+','+j+','+(k+1)]); }
    var geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));
    group.add(new THREE.Points(geo, pointsMat(0.12)));
    var lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(lp),3));
    group.add(new THREE.LineSegments(lg, lineMat(0.3)));
  }

  function buildGrid() {
    var seg = Math.max(14, Math.round(26 * density)), span = 7;
    var g = new THREE.PlaneGeometry(span, span, seg, seg);
    g.rotateX(-Math.PI/2);
    var base = g.attributes.position.array.slice(0);
    var wire = new THREE.LineSegments(new THREE.WireframeGeometry(g), lineMat(0.26));
    wire.position.y = -0.6;
    group.add(wire);
    grid = { wire: wire, geo: g, base: base, seg: seg };
    var pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute('position', g.attributes.position);
    var pts = new THREE.Points(pgeo, pointsMat(0.07)); pts.position.y = -0.6;
    group.add(pts);
    grid.pts = pts; grid.pgeo = pgeo;
  }
  function stepGrid() {
    if (!grid) return;
    var p = grid.geo.attributes.position.array, base = grid.base;
    for (var i = 0; i < p.length; i += 3) {
      var x = base[i], z = base[i+2];
      p[i+1] = Math.sin(x*0.9 + t) * Math.cos(z*0.9 + t*0.8) * 0.55;
    }
    grid.geo.attributes.position.needsUpdate = true;
    grid.wire.geometry.dispose();
    grid.wire.geometry = new THREE.WireframeGeometry(grid.geo);
    grid.wire.material = grid.wire.material;
  }

  function build() {
    clearGroup();
    if (mode === 'network') buildNetwork();
    else if (mode === 'globe') buildGlobe();
    else if (mode === 'lattice') buildLattice();
    else if (mode === 'grid') buildGrid();
    applyColors();
  }

  /* ── loop ── */
  function render(now) {
    raf = requestAnimationFrame(render);
    if ((window.scrollY || 0) > (canvas.clientHeight || 600) * 1.15) { renderer.render(scene, camera); return; }
    var live = animOn();
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    if (live) t += 0.016;

    if (mode === 'network') stepNetwork();
    else if (mode === 'grid') stepGrid();

    var spin = live ? t * 0.12 : 0;
    if (group) {
      if (mode === 'grid') { group.rotation.y = mx * 0.25; group.rotation.x = 0.05 + my * 0.12; }
      else { group.rotation.y = spin + mx * 0.5; group.rotation.x = my * 0.32 + (mode==='lattice'? t*0.05 : 0); }
    }
    renderer.render(scene, camera);
  }
  function start() { if (!raf && mode !== 'off') { raf = requestAnimationFrame(render); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  function resize() {
    var w = canvas.clientWidth || canvas.parentElement.clientWidth;
    var h = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function update(modeStr, dens) {
    var m = ({ None:'off', Network:'network', 'Grid terrain':'grid', Lattice:'lattice', Globe:'globe' })[modeStr] || modeStr || 'off';
    var changed = (m !== mode) || (dens != null && (dens/100) !== density);
    mode = m;
    if (dens != null) density = dens / 100;
    if (mode === 'off') { stop(); if (renderer) renderer.clear(); if (group) clearGroup(); return; }
    if (changed || !group || group.children.length === 0) build();
    start();
  }

  function init() {
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setClearColor(0x000000, 0);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.set(0, 0, 6);
      group = new THREE.Group(); scene.add(group);
      readAccent();
      resize();
      build();
      start();
      window.addEventListener('resize', resize);
      window.addEventListener('mousemove', function (e) {
        tmx = (e.clientX / window.innerWidth - 0.5) * 2;
        tmy = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
      window.addEventListener('scroll', function () { if (mode !== 'off') start(); }, { passive: true });
      document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    } catch (e) { /* WebGL unavailable — leave canvas blank */ }
  }

  window.DatrixHero = { update: update, refreshAccent: readAccent, step: function(){ if (renderer) render(performance.now()); } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();


/* ============================================================================
   datrix-motion.js
   ============================================================================ */

/* Datrix — interactions retained alongside GSAP: the feature switcher and the
   hero cursor glow. (Reveals, counters, score bars, and parallax now live in
   datrix-gsap.js.) */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function animOn() { return document.body.getAttribute('data-anim') === 'on' && !reduce; }

  /* ── hero cursor glow ── */
  function initGlow() {
    var glow = document.getElementById('cursor-glow');
    var hero = document.querySelector('.hero');
    if (!glow || !hero) return;
    var x = window.innerWidth / 2, y = window.innerHeight * 0.42, tx = x, ty = y, raf = null;
    glow.style.left = x + 'px'; glow.style.top = y + 'px';
    function loop() {
      x += (tx - x) * 0.12; y += (ty - y) * 0.12;
      glow.style.left = x + 'px'; glow.style.top = y + 'px';
      if (Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5) raf = requestAnimationFrame(loop); else raf = null;
    }
    document.addEventListener('mousemove', function (e) {
      if (document.body.getAttribute('data-cursorglow') !== 'on') return;
      var r = hero.getBoundingClientRect();
      glow.classList.toggle('lit', e.clientY < r.bottom);
      tx = e.clientX; ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(loop);
    });
    setTimeout(function () {
      if (document.body.getAttribute('data-cursorglow') === 'on' && !reduce) glow.classList.add('lit');
    }, 600);
  }

  /* ── feature switcher ── */
  var previews = [
    { label: 'Quality Engine — live scan', rows: [
      ['Null rate (label col)', '8.3% ↑', 'bad'],
      ['Class imbalance ratio', '1 : 480', 'warn'],
      ['Near-duplicate rows', '2,841', 'warn'],
      ['Label noise estimate', '6.1%', 'bad'],
      ['Date format consistency', '100%', 'good'],
      ['Est. accuracy gain if fixed', '+14.2%', 'good'] ] },
    { label: 'Pipeline Builder — NLP classification', rows: [
      ['Task identified', 'Sentiment classification', 'good'],
      ['Steps generated', '7 pipeline nodes', 'good'],
      ['Train / val / test split', '70 / 15 / 15', 'good'],
      ['Tokenizer selected', 'BPE, max 512 tokens', 'good'],
      ['Output format', 'HuggingFace datasets', 'good'],
      ['Build time', '1m 42s', 'good'] ] },
    { label: 'Synthetic Engine — class augmentation', rows: [
      ['Minority class examples', '203 → 10,203', 'good'],
      ['Generation method', 'CTGAN + validation', 'good'],
      ['Privacy score', '94 / 100', 'good'],
      ['TSTR accuracy delta', '−1.2% (within target)', 'good'],
      ['Class ratio after blend', '1 : 4.8', 'good'],
      ['Time to generate', '8m 14s', 'good'] ] },
    { label: 'Active Learning — iteration 7', rows: [
      ['Unlabeled pool', '142,000 examples', 'good'],
      ['Selected for labeling', '340 examples', 'good'],
      ['Selection strategy', 'BADGE (gradient diversity)', 'good'],
      ['Est. accuracy gain', '+4.2%', 'good'],
      ['Budget used', '$142 of $500', 'good'],
      ['Labels vs random baseline', '−63% to same accuracy', 'good'] ] },
    { label: 'Compliance Autopilot — GDPR', rows: [
      ['Overall compliance', '94 / 100', 'good'],
      ['Open findings', '2 medium severity', 'warn'],
      ['ROPA document', 'Current as of today', 'good'],
      ['PII detected & tagged', '6 column types', 'good'],
      ['Next audit readiness', '91%', 'good'],
      ['Days to next deadline', '47 days', 'warn'] ] }
  ];

  window.setFeature = function (idx) {
    document.querySelectorAll('.feature-item').forEach(function (el, i) { el.classList.toggle('active', i === idx); });
    var p = previews[idx];
    var preview = document.getElementById('feature-preview');
    if (!preview) return;
    var stagger = animOn();
    preview.innerHTML = '<p class="preview-label">' + p.label + '</p>' +
      p.rows.map(function (r, i) {
        var delay = stagger ? (i * 45) + 'ms' : '0ms';
        return '<div class="preview-stat" style="animation-delay:' + delay + '">' +
          '<span class="preview-stat-name">' + r[0] + '</span>' +
          '<span class="preview-stat-val val-' + r[2] + '">' + r[1] + '</span></div>';
      }).join('');
  };

  function init() { initGlow(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();


/* ============================================================================
   datrix-gsap.js
   ============================================================================ */

/* Datrix — GSAP + ScrollTrigger motion system.
   Drives hero intro, scroll-batched reveals, counters, score bars, and
   scroll-scrub parallax. Falls back to a fully-visible static page if GSAP is
   unavailable, the doc is hidden, or reduced motion is requested. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var G = window.gsap, ST = window.ScrollTrigger;
  var hasG = !!(G && ST);

  function num(el) { return parseFloat(el.getAttribute('data-count')); }

  // Final/static state — used as the no-animation fallback.
  function showFinal() {
    document.querySelectorAll('[data-reveal]').forEach(function (el) { el.style.opacity = ''; el.style.transform = ''; });
    document.querySelectorAll('[data-count]').forEach(function (el) { el.textContent = String(num(el)); });
    document.querySelectorAll('.metric-bar-fill[data-w]').forEach(function (b) { b.style.width = b.getAttribute('data-w') + '%'; });
  }

  // No GSAP or reduced motion → permanent static fallback (correct + no strand).
  if (!hasG || reduce) {
    document.body.classList.add('gsap-off');
    showFinal();
    return;
  }

  // If the view is hidden at load, rAF is paused — animating now would strand
  // content at opacity:0. Show everything static, then UPGRADE to full GSAP the
  // first time the view becomes visible.
  var started = false;
  if (document.visibilityState === 'visible') {
    runGSAP();
  } else {
    showFinal();
    var onVis = function () { if (!document.hidden) { document.removeEventListener('visibilitychange', onVis); runGSAP(); } };
    document.addEventListener('visibilitychange', onVis);
  }

  function runGSAP() {
    if (started) return; started = true;
    G.registerPlugin(ST);
    document.body.classList.remove('gsap-off');
    document.body.classList.add('gsap-on');
    setupGSAP();
  }

  function setupGSAP() {

  /* ── counters ── */
  function countUp(el) {
    if (el.dataset.counted) return; el.dataset.counted = '1';
    var end = num(el), o = { v: 0 };
    G.to(o, { v: end, duration: 1.3, ease: 'power2.out', onUpdate: function () { el.textContent = String(Math.round(o.v)); } });
  }

  /* ── HERO intro timeline ── */
  var heroEls = ['.hero-eyebrow', '.hero-title', '.hero-sub', '.hero-actions', '.hero-trust'];
  G.set(heroEls, { opacity: 0, y: 28 });
  var tl = G.timeline({ defaults: { ease: 'power3.out' }, delay: 0.15 });
  tl.to('.hero-eyebrow', { opacity: 1, y: 0, duration: 0.6 })
    .to('.hero-title',   { opacity: 1, y: 0, duration: 0.9 }, '-=0.35')
    .to('.hero-sub',     { opacity: 1, y: 0, duration: 0.7 }, '-=0.55')
    .to('.hero-actions', { opacity: 1, y: 0, duration: 0.6 }, '-=0.5')
    .to('.hero-trust',   { opacity: 1, y: 0, duration: 0.6 }, '-=0.45');

  /* ── scroll-batched reveals (everything except the hero) ── */
  var revealEls = G.utils.toArray('[data-reveal]').filter(function (el) { return !el.closest('.hero'); });
  ST.batch(revealEls, {
    start: 'top 86%',
    once: true,
    onEnter: function (batch) {
      G.from(batch, {
        opacity: 0, y: 30, duration: 0.8, ease: 'power3.out',
        stagger: 0.09, overwrite: true,
        onComplete: function () { this.targets().forEach(function (el) { el.style.transform = ''; }); }
      });
      batch.forEach(function (el) {
        if (el.classList.contains('score-card')) {
          el.querySelectorAll('.metric-value[data-count]').forEach(countUp);
          el.querySelectorAll('.metric-bar-fill[data-w]').forEach(function (b) {
            G.to(b, { width: b.getAttribute('data-w') + '%', duration: 1.15, ease: 'power3.out', delay: 0.15 });
          });
        }
        el.querySelectorAll && el.querySelectorAll('.cu[data-count]').forEach(countUp);
      });
    }
  });

  /* ── scroll-scrub parallax on the hero ── */
  if (document.body.getAttribute('data-parallax') !== 'off') {
    G.to('#hero-canvas', {
      yPercent: 16, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
    G.to('.hero-inner', {
      yPercent: -10, opacity: 0.15, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
  }

  /* ── section heads get a touch of depth on scrub ── */
  G.utils.toArray('.section-title').forEach(function (el) {
    G.fromTo(el, { letterSpacing: '-0.05em' }, {
      letterSpacing: '-0.02em', ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 55%', scrub: true }
    });
  });

  // Safety net: if anything is still hidden after load (e.g. ST mis-measured in
  // an odd iframe), force the final visible state.
  window.addEventListener('load', function () { ST.refresh(); });
  setTimeout(function () {
    revealEls.forEach(function (el) {
      if (parseFloat(getComputedStyle(el).opacity) < 0.05) { el.style.opacity = ''; el.style.transform = ''; }
    });
  }, 4500);
  document.addEventListener('visibilitychange', function () { if (document.hidden) showFinal(); });

  } // end setupGSAP
})();


/* ============================================================================
   datrix-premium.js
   ============================================================================ */

/* Datrix — premium micro-interactions layer (vanilla, additive).
   Cursor spotlight on cards · 3D tilt on the product card · magnetic buttons ·
   scroll progress · film grain. Everything degrades gracefully and respects the
   Tweaks toggles (body[data-spotlight|data-tilt|data-magnetic]) + reduced motion. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function on(attr) { return document.body.getAttribute(attr) === 'on'; }

  /* ── scroll progress bar ── */
  function initProgress() {
    var bar = document.createElement('div');
    bar.id = 'scroll-progress';
    document.body.appendChild(bar);
    var ticking = false;
    function update() {
      ticking = false;
      var h = document.documentElement;
      var max = (h.scrollHeight - h.clientHeight) || 1;
      var p = Math.min(1, Math.max(0, (window.scrollY || 0) / max));
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* ── film grain overlay ── */
  function initGrain() {
    if (document.getElementById('grain')) return;
    var g = document.createElement('div');
    g.id = 'grain';
    document.body.appendChild(g);
  }

  /* ── cursor spotlight on cards ── */
  function initSpotlight() {
    var sel = '.how-step, .feature-preview, .feature-item, .score-card, .stat-cell, .cta-section, .integ-tile, .badge-card, .case-card';
    var cards = [].slice.call(document.querySelectorAll(sel));
    cards.forEach(function (card) {
      card.classList.add('spot-card');
      card.addEventListener('pointermove', function (e) {
        if (!on('data-spotlight')) return;
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(2) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(2) + '%');
        card.classList.add('lit');
      }, { passive: true });
      card.addEventListener('pointerleave', function () { card.classList.remove('lit'); });
    });
  }

  /* ── 3D tilt on the product / score card ── */
  function initTilt() {
    var card = document.querySelector('.score-card');
    if (!card) return;
    var MAX = 6; // degrees
    var raf = null, tx = 0, ty = 0, cx = 0, cy = 0;
    function render() {
      raf = null;
      cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
      card.style.transform = 'perspective(1100px) rotateX(' + cy.toFixed(2) + 'deg) rotateY(' + cx.toFixed(2) + 'deg)';
      if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) raf = requestAnimationFrame(render);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(render); }
    card.addEventListener('pointermove', function (e) {
      if (!on('data-tilt') || reduce) return;
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      tx = px * MAX * 2; ty = -py * MAX * 2;
      card.style.transition = 'transform 0.08s ease-out, box-shadow 0.3s ease';
      card.classList.add('tilting');
      kick();
    }, { passive: true });
    card.addEventListener('pointerleave', function () {
      tx = 0; ty = 0;
      card.style.transition = 'transform 0.6s cubic-bezier(.2,.8,.2,1), box-shadow 0.3s ease';
      card.classList.remove('tilting');
      kick();
    });
  }

  /* ── magnetic buttons ── */
  function initMagnetic() {
    var btns = [].slice.call(document.querySelectorAll('.btn-primary, .nav-cta'));
    btns.forEach(function (btn) {
      var raf = null, tx = 0, ty = 0, cx = 0, cy = 0;
      function render() {
        raf = null;
        cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
        btn.style.transform = 'translate(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px)';
        if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) raf = requestAnimationFrame(render);
        else btn.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
      }
      function kick() { if (!raf) raf = requestAnimationFrame(render); }
      btn.addEventListener('pointermove', function (e) {
        if (!on('data-magnetic') || reduce) return;
        var r = btn.getBoundingClientRect();
        var strength = 0.35;
        tx = (e.clientX - (r.left + r.width / 2)) * strength;
        ty = (e.clientY - (r.top + r.height / 2)) * strength;
        kick();
      }, { passive: true });
      btn.addEventListener('pointerleave', function () { tx = 0; ty = 0; kick(); });
    });
  }

  function init() {
    initProgress();
    initGrain();
    initSpotlight();
    initTilt();
    initMagnetic();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
