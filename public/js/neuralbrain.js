/**
 * NeuralBrain — the Rivira Tech site loader, as a standalone plugin.
 *
 * Loaded straight from index.html, right after the #rt-loader markup, so the
 * animated loader is on screen at first paint — long before the React bundle
 * has downloaded. The app tells it when it is ready; the loader then fades out
 * (after a minimum on-screen time) and removes itself.
 *
 * Markup (index.html):
 *   <div id="rt-loader" data-min-ms="2200"> … <canvas class="kl-brain"> … </div>
 *   <script src="/js/neuralbrain.js"></script>
 * Styles: /css/loader.css
 *
 * Public API:
 *   NeuralBrain.start(canvas, { reducedMotion }) -> stop()   the canvas engine
 *   RTLoader.ready({ onExit, onHidden })                    app mounted: fade out
 *   RTLoader.hide()                                         fade out now
 *
 * The scene recreates the brand artwork (logical 680 × 500, scaled to the
 * canvas): a glowing side-view brain built from a seeded node network
 * (identical on every load) with twinkling hub nodes, travelling signals and
 * inner dust; two tilted orbits with glowing satellites and dotted arcs; a
 * holographic platform with rings, ripples, a light beam and data streams.
 * It "draws in" over the first ~1.2 s, then keeps animating. With reduced
 * motion a single, fully revealed frame is drawn.
 * Coordinates were traced from the 1451 × 1088 artwork: scene = art − (385, 190).
 */
(function (global) {
  "use strict";

  if (global.NeuralBrain) return; // loaded once

  var W = 680, H = 500;
  var AX = 385, AY = 190;                 // artwork → scene offset
  function ax(x) { return x - AX; }
  function ay(y) { return y - AY; }

  var CYAN = [56, 210, 255];
  var SKY = [64, 160, 255];
  var BLUE = [72, 110, 255];
  var VIOLET = [140, 95, 255];
  var PURPLE = [196, 128, 255];
  var GREEN = [80, 240, 150];
  var WHITE = [240, 248, 255];

  // brain outline traced from the artwork: start + cubic segments [c1x,c1y,c2x,c2y,x,y]
  var BRAIN_START = [540, 405];
  var BRAIN_SEGS = [
    [536, 380, 544, 345, 560, 325],   // forehead
    [575, 300, 598, 280, 625, 268],
    [655, 254, 688, 246, 720, 246],   // crown
    [755, 245, 790, 250, 820, 262],
    [855, 276, 880, 295, 895, 322],   // back of the head
    [912, 348, 922, 378, 920, 405],
    [920, 432, 914, 455, 900, 470],   // occipital
    [888, 488, 872, 503, 850, 505],   // cerebellum
    [835, 508, 818, 512, 805, 512],
    [799, 532, 798, 555, 795, 572],   // stem, right side
    [792, 580, 784, 580, 781, 572],   // stem, bottom
    [778, 548, 775, 515, 770, 490],   // stem, left side
    [742, 480, 715, 474, 690, 472],   // underside
    [668, 472, 648, 482, 625, 478],   // temporal lobe
    [600, 474, 580, 462, 568, 445],
    [556, 430, 544, 420, 540, 405]
  ];
  var BRAIN_BOX = { x0: ax(536), x1: ax(922), y0: ay(245), y1: ay(582) };

  var BASE = { x: ax(725), y: ay(630) };  // platform centre
  var BEAM_X = ax(725);

  function makeOrbits() {
    return [
      // steep orbit: cyan satellite over the top-left, green one low on the right
      { cx: ax(735), cy: ay(352), rx: 282, ry: 104, rot: 0.47, sats: [{ a: 3.75, w: 0.5, c: CYAN }, { a: 0.55, w: 0.5, c: GREEN }] },
      // flat orbit: green satellite on the left, purple one on the right
      { cx: ax(730), cy: ay(388), rx: 305, ry: 58, rot: -0.21, sats: [{ a: 3.05, w: -0.38, c: GREEN }, { a: 5.75, w: -0.38, c: PURPLE }] }
    ];
  }

  /* ------------------------------------------------------------- helpers */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(a, b, v) { var t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); }
  function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function rgba(c, a) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + (a < 0 ? 0 : a) + ")"; }
  function cubic(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  }

  // artwork palette: cyan/sky at the front, blue in the middle, violet/purple
  // over the back, green along the lower front and lower back
  function brainColor(nx, ny) {
    var c = nx < 0.3 ? mix(CYAN, SKY, nx / 0.3)
      : nx < 0.55 ? mix(SKY, BLUE, (nx - 0.3) / 0.25)
        : nx < 0.75 ? mix(BLUE, VIOLET, (nx - 0.55) / 0.2)
          : mix(VIOLET, PURPLE, (nx - 0.75) / 0.25);
    var lowFront = smooth(0.45, 0.75, ny) * smooth(0.32, 0.08, nx);
    var lowBack = smooth(0.4, 0.68, ny) * smooth(0.7, 0.9, nx);
    return mix(c, GREEN, Math.min(1, (lowFront + lowBack) * 1.1));
  }

  // soft round glow sprite (drawImage is far cheaper than shadowBlur per frame)
  function glowSprite(c, core) {
    var s = 96;
    var cv = document.createElement("canvas");
    cv.width = cv.height = s;
    var g = cv.getContext("2d");
    var grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, "rgba(255,255,255," + core + ")");
    grd.addColorStop(0.12, rgba(mix(c, WHITE, 0.4), 0.95));
    grd.addColorStop(0.3, rgba(c, 0.45));
    grd.addColorStop(0.6, rgba(c, 0.12));
    grd.addColorStop(1, rgba(c, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    return cv;
  }

  /* ---------------------------------------------------------- scene data */
  function buildBrain() {
    var rnd = mulberry32(20261003);
    var path = new Path2D();
    path.moveTo(ax(BRAIN_START[0]), ay(BRAIN_START[1]));
    BRAIN_SEGS.forEach(function (s) { path.bezierCurveTo(ax(s[0]), ay(s[1]), ax(s[2]), ay(s[3]), ax(s[4]), ay(s[5])); });
    path.closePath();

    var probe = document.createElement("canvas").getContext("2d");
    function inside(x, y) { return probe.isPointInPath(path, x, y); }
    function deepInside(x, y, d) {
      return inside(x, y) && inside(x - d, y) && inside(x + d, y) && inside(x, y - d) && inside(x, y + d);
    }

    // evenly spaced outline points
    var dense = [];
    var px = BRAIN_START[0], py = BRAIN_START[1];
    BRAIN_SEGS.forEach(function (s) {
      for (var i = 1; i <= 40; i++) {
        var t = i / 40;
        dense.push([ax(cubic(px, s[0], s[2], s[4], t)), ay(cubic(py, s[1], s[3], s[5], t))]);
      }
      px = s[4]; py = s[5];
    });
    var outline = [dense[dense.length - 1]];
    var acc = 0;
    for (var i = 1; i < dense.length - 6; i++) {
      acc += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
      if (acc >= 30) { outline.push(dense[i]); acc = 0; }
    }

    // interior nodes: seeded rejection sampling with a minimum spacing
    var pts = outline.slice();
    for (var k = 0; k < 8000 && pts.length < 140; k++) {
      var x = BRAIN_BOX.x0 + rnd() * (BRAIN_BOX.x1 - BRAIN_BOX.x0);
      var y = BRAIN_BOX.y0 + rnd() * (BRAIN_BOX.y1 - BRAIN_BOX.y0);
      if (!deepInside(x, y, 9)) continue;
      var near = false;
      for (var q = 0; q < pts.length; q++) {
        if (Math.hypot(pts[q][0] - x, pts[q][1] - y) < 31) { near = true; break; }
      }
      if (!near) pts.push([x, y]);
    }

    var bw = BRAIN_BOX.x1 - BRAIN_BOX.x0, bh = ay(500) - BRAIN_BOX.y0;
    var nodes = pts.map(function (p, i) {
      var nx = (p[0] - BRAIN_BOX.x0) / bw, ny = clamp01((p[1] - BRAIN_BOX.y0) / bh);
      var hub = rnd() < (i < outline.length ? 0.26 : 0.4);
      var d = Math.hypot(nx - 0.45, (ny - 0.1) * 1.15);
      return {
        x: p[0], y: p[1], c: brainColor(nx, ny), hub: hub,
        r: hub ? 3 + rnd() * 1.5 : 1.7 + rnd() * 0.8,
        phase: rnd() * Math.PI * 2, speed: 1.1 + rnd() * 2.4,
        appear: 0.05 + d * 0.8 + rnd() * 0.12
      };
    });

    // links: the outline ring, plus nearest neighbours that stay inside the brain
    var edges = [];
    var seen = {};
    function add(a, b) {
      var key = a < b ? a + "-" + b : b + "-" + a;
      if (seen[key]) return;
      seen[key] = 1;
      var A = nodes[a], B = nodes[b];
      edges.push({ a: a, b: b, c: mix(mix(A.c, B.c, 0.5), WHITE, 0.06), len: Math.hypot(A.x - B.x, A.y - B.y) });
    }
    for (var o = 0; o < outline.length; o++) add(o, (o + 1) % outline.length);
    nodes.forEach(function (n, i) {
      nodes
        .map(function (m, j) { return { j: j, d: Math.hypot(m.x - n.x, m.y - n.y) }; })
        .filter(function (e) { return e.j !== i && e.d < 58; })
        .sort(function (p, r) { return p.d - r.d; })
        .slice(0, 5)
        .forEach(function (e) {
          var m = nodes[e.j];
          if (inside((n.x + m.x) / 2, (n.y + m.y) / 2)) add(i, e.j);
        });
    });
    var adj = nodes.map(function () { return []; });
    edges.forEach(function (e, idx) { adj[e.a].push(idx); adj[e.b].push(idx); });

    // fine dust between the nodes
    var dust = [];
    for (var z = 0; z < 4000 && dust.length < 170; z++) {
      var dx = BRAIN_BOX.x0 + rnd() * bw, dy = BRAIN_BOX.y0 + rnd() * (BRAIN_BOX.y1 - BRAIN_BOX.y0);
      if (!inside(dx, dy)) continue;
      dust.push({ x: dx, y: dy, r: 0.5 + rnd() * 0.8, ph: rnd() * 6.28, c: brainColor((dx - BRAIN_BOX.x0) / bw, clamp01((dy - BRAIN_BOX.y0) / bh)) });
    }

    // where a vertical line rising from the platform meets the brain
    function underside(x) {
      for (var yy = BASE.y - 20; yy > BRAIN_BOX.y0; yy -= 2) if (inside(x, yy)) return yy + 3;
      return BASE.y - 150;
    }

    return { path: path, nodes: nodes, edges: edges, adj: adj, dust: dust, underside: underside, rnd: rnd };
  }

  /* -------------------------------------------------------------- engine */
  function start(canvas, opts) {
    opts = opts || {};
    var ctx = canvas && canvas.getContext && canvas.getContext("2d");
    if (!ctx || typeof Path2D === "undefined") return function () {};

    var scene = buildBrain();
    var path = scene.path, nodes = scene.nodes, edges = scene.edges, adj = scene.adj,
      dust = scene.dust, underside = scene.underside, rnd = scene.rnd;
    var ORBITS = makeOrbits();
    var move = !opts.reducedMotion;

    var sprites = {};
    function glow(x, y, size, c, alpha, core) {
      if (alpha <= 0.01) return;
      if (core === undefined) core = 0.9;
      var key = (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "|" + core;
      var s = sprites[key] || (sprites[key] = glowSprite(c, core));
      ctx.globalAlpha = alpha > 1 ? 1 : alpha;
      ctx.drawImage(s, x - size / 2, y - size / 2, size, size);
      ctx.globalAlpha = 1;
    }

    // signals hopping along the links
    var signals = [];
    for (var i = 0; i < 26; i++) {
      var e0 = Math.floor(rnd() * edges.length);
      signals.push({ e: e0, from: edges[e0].a, p: rnd(), v: 0.9 + rnd() * 1.5 });
    }

    // dotted arcs (outer ellipse, left and right parts) + free particles
    var ARC = { cx: ax(735), cy: ay(395), rx: 330, ry: 200, rot: 0.05 };
    var arcDots = [];
    for (var a = 0; a < 110; a++) {
      var left = a < 62;
      arcDots.push({
        a: left ? Math.PI * (0.88 + (a / 62) * 0.5) : Math.PI * (-0.2 + ((a - 62) / 48) * 0.36),
        r: 0.6 + rnd() * 1.1, ph: rnd() * 6.28, jitter: (rnd() - 0.5) * 10,
        c: left ? (rnd() < 0.6 ? CYAN : SKY) : (rnd() < 0.6 ? PURPLE : VIOLET)
      });
    }
    var particles = [];
    for (var p = 0; p < 90; p++) {
      // cluster around the brain and orbits, thinning out towards the edges
      var ang = rnd() * Math.PI * 2, rad = Math.pow(rnd(), 0.6) * 330;
      particles.push({
        x: ax(735) + Math.cos(ang) * rad, y: ay(400) + Math.sin(ang) * rad * 0.62,
        r: 0.5 + rnd() * 1.5, v: 3 + rnd() * 9, ph: rnd() * 6.28,
        c: [CYAN, SKY, PURPLE, GREEN, VIOLET][Math.floor(rnd() * 5)]
      });
    }

    // data streams between the platform and the brain
    var streams = [];
    for (var s = 0; s < 30; s++) {
      var sx = BEAM_X - 112 + (s / 29) * 230 + (rnd() - 0.5) * 5;
      var top = Math.min(underside(sx), BASE.y - 40);
      streams.push({ x: sx, top: top - rnd() * 30, ph: rnd(), v: 0.3 + rnd() * 0.55, c: [CYAN, SKY, BLUE, VIOLET][Math.floor(rnd() * 4)], w: rnd() < 0.3 ? 1.2 : 0.7 });
    }
    var beamTop = underside(BEAM_X);

    // brain halo — blurred once into an offscreen layer (re-made on resize)
    var halo = document.createElement("canvas");
    var scale = 1;
    function buildHalo() {
      halo.width = canvas.width; halo.height = canvas.height;
      var h = halo.getContext("2d");
      h.setTransform(scale, 0, 0, scale, 0, 0);
      h.shadowColor = "rgba(60,140,255,0.95)";
      h.shadowBlur = 38 * scale;
      h.fillStyle = "rgba(30,70,200,0.22)";
      h.fill(path);
      h.shadowBlur = 14 * scale;
      h.shadowColor = "rgba(120,200,255,0.7)";
      h.fill(path);
    }

    var raf = 0, stopped = false;
    function resize() {
      var rect = canvas.getBoundingClientRect();
      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      scale = canvas.width / W;
      buildHalo();
      if (!move) raf = requestAnimationFrame(frame); // redraw the still frame
    }
    resize();
    global.addEventListener("resize", resize);

    function ellipsePoint(o, th) {
      var c = Math.cos(th) * o.rx, sn = Math.sin(th) * o.ry;
      var cr = Math.cos(o.rot), sr = Math.sin(o.rot);
      return { x: o.cx + c * cr - sn * sr, y: o.cy + c * sr + sn * cr };
    }

    var t0 = performance.now(), last = t0;

    function frame(now) {
      if (stopped) return;
      var t = move ? (now - t0) / 1000 : 10;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      var g, i, k;

      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      var sceneIn = smooth(0, 0.6, t);

      // ---- free particles
      for (i = 0; i < particles.length; i++) {
        var pt = particles[i];
        if (move) { pt.y -= pt.v * dt; if (pt.y < 0) pt.y = H; }
        var pa = (0.3 + 0.45 * Math.sin(t * 1.8 + pt.ph)) * sceneIn;
        if (pt.r > 1.4) glow(pt.x, pt.y, 9, pt.c, pa * 0.8);
        ctx.fillStyle = rgba(pt.c, pa);
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, 6.283); ctx.fill();
      }

      // ---- dotted arcs
      var arcIn = smooth(0.2, 1.0, t);
      for (i = 0; i < arcDots.length; i++) {
        var d = arcDots[i];
        var ap = ellipsePoint(ARC, d.a + Math.sin(t * 0.4) * 0.03);
        ctx.fillStyle = rgba(d.c, (0.35 + 0.45 * Math.sin(t * 3 + d.ph)) * arcIn);
        ctx.beginPath(); ctx.arc(ap.x + d.jitter * 0.3, ap.y + d.jitter, d.r, 0, 6.283); ctx.fill();
      }

      // ---- platform
      var baseIn = smooth(0, 0.5, t);
      function disc(rx, ry, stops) {
        ctx.save();
        ctx.translate(BASE.x, BASE.y); ctx.scale(1, ry / rx);
        var dg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        stops.forEach(function (st) { dg.addColorStop(st[0], rgba(st[1], st[2] * baseIn)); });
        ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 6.283); ctx.fill();
        ctx.restore();
      }
      function ring(rx, ry, c, al, lw) {
        ctx.strokeStyle = rgba(c, al * baseIn); ctx.lineWidth = lw;
        ctx.beginPath(); ctx.ellipse(BASE.x, BASE.y, rx, ry, 0, 0, 6.283); ctx.stroke();
      }
      disc(330, 52, [[0, BLUE, 0.35], [0.5, BLUE, 0.12], [1, BLUE, 0]]);   // wide floor glow
      disc(170, 26, [[0, CYAN, 0.65], [0.45, SKY, 0.28], [1, BLUE, 0]]);  // platform glow
      for (k = 0; k < 3; k++) {                                            // ripples
        var rph = (t * 0.5 + k / 3) % 1;
        var rrx = 90 + rph * 230;
        ring(rrx, rrx * 0.15, SKY, (1 - rph) * 0.4, 1.1);
      }
      ring(300, 44, BLUE, 0.28, 1);                                        // outer faint ring
      ring(152, 23, CYAN, 0.9, 2.2);
      ring(122, 18, SKY, 0.55, 1.2);
      ring(88, 13, CYAN, 0.95, 2.4);
      ring(52, 8, WHITE, 0.9, 1.8);
      ctx.save();
      ctx.setLineDash([3, 8]); ctx.lineDashOffset = -t * 20;
      ring(178, 27, CYAN, 0.45, 1.4);
      ctx.setLineDash([18, 12]); ctx.lineDashOffset = t * 30;
      ring(108, 16, PURPLE, 0.45, 1.3);
      ctx.restore();
      glow(BASE.x, BASE.y, 120, CYAN, 0.9 * baseIn, 1);
      disc(60, 9, [[0, WHITE, 0.95], [0.6, CYAN, 0.5], [1, CYAN, 0]]);      // white-hot centre

      // ---- light beam + data streams
      var beamIn = smooth(0.25, 0.75, t);
      var flick = 0.85 + 0.15 * Math.sin(t * 8) * Math.sin(t * 3.1);
      g = ctx.createLinearGradient(0, BASE.y, 0, beamTop);
      g.addColorStop(0, rgba(CYAN, 0.55 * beamIn * flick));
      g.addColorStop(0.7, rgba(BLUE, 0.18 * beamIn));
      g.addColorStop(1, rgba(BLUE, 0.04 * beamIn));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(BEAM_X - 30, BASE.y); ctx.lineTo(BEAM_X - 8, beamTop); ctx.lineTo(BEAM_X + 8, beamTop); ctx.lineTo(BEAM_X + 30, BASE.y);
      ctx.closePath(); ctx.fill();
      g = ctx.createLinearGradient(0, BASE.y, 0, beamTop);
      g.addColorStop(0, rgba(WHITE, 0.95 * beamIn * flick));
      g.addColorStop(1, rgba(CYAN, 0.2 * beamIn));
      ctx.fillStyle = g;
      ctx.fillRect(BEAM_X - 2.2, beamTop, 4.4, BASE.y - beamTop);

      for (i = 0; i < streams.length; i++) {
        var st = streams[i];
        var len = BASE.y - 8 - st.top;
        ctx.strokeStyle = rgba(st.c, beamIn * (0.22 + 0.14 * Math.sin(t * 2.2 + st.ph * 6)));
        ctx.lineWidth = st.w;
        ctx.beginPath(); ctx.moveTo(st.x, BASE.y - 8); ctx.lineTo(st.x, st.top); ctx.stroke();
        for (k = 0; k < 2; k++) {
          var sph = (t * st.v + st.ph + k * 0.5) % 1;
          ctx.fillStyle = rgba(mix(st.c, WHITE, 0.3), beamIn * (0.8 - sph * 0.6));
          ctx.fillRect(st.x - 1, BASE.y - 8 - sph * len - 5, 2, 7);
        }
      }

      // ---- orbits: back halves (behind the brain)
      var orbitIn = smooth(0.15, 1.05, t);
      function orbitHalf(back) {
        ORBITS.forEach(function (o) {
          var og = ctx.createLinearGradient(o.cx - o.rx, 0, o.cx + o.rx, 0);
          og.addColorStop(0, rgba(CYAN, back ? 0.35 : 0.9));
          og.addColorStop(0.5, rgba(SKY, back ? 0.3 : 0.75));
          og.addColorStop(1, rgba(PURPLE, back ? 0.35 : 0.9));
          ctx.strokeStyle = og; ctx.lineWidth = back ? 1.1 : 1.7;
          var a0 = back ? Math.PI : 0;
          ctx.beginPath(); ctx.ellipse(o.cx, o.cy, o.rx, o.ry, o.rot, a0, a0 + Math.PI * orbitIn); ctx.stroke();
        });
      }
      orbitHalf(true);

      // ---- brain: halo, luminous body, dust
      var brainIn = smooth(0, 0.45, t);
      var breathe = 0.88 + 0.12 * Math.sin(t * 1.7);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = brainIn * breathe;
      ctx.drawImage(halo, 0, 0);
      ctx.restore();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);

      ctx.save();
      ctx.clip(path);
      function blob(x, y, r, c, al) {
        var bg = ctx.createRadialGradient(x, y, 0, x, y, r);
        bg.addColorStop(0, rgba(c, al * brainIn * breathe));
        bg.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = bg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      blob(ax(640), ay(330), 160, SKY, 0.3);
      blob(ax(735), ay(370), 150, BLUE, 0.26);
      blob(ax(850), ay(320), 140, VIOLET, 0.42);
      blob(ax(578), ay(432), 80, GREEN, 0.5);
      blob(ax(892), ay(452), 80, GREEN, 0.5);
      ctx.restore();

      for (i = 0; i < dust.length; i++) {
        var du = dust[i];
        ctx.fillStyle = rgba(mix(du.c, WHITE, 0.3), (0.35 + 0.4 * Math.sin(t * 2.4 + du.ph)) * brainIn);
        ctx.beginPath(); ctx.arc(du.x, du.y, du.r, 0, 6.283); ctx.fill();
      }

      // ---- links, nodes, signals
      var nodeA = nodes.map(function (n) { return smooth(n.appear, n.appear + 0.22, t); });
      ctx.lineWidth = 1.1;
      for (i = 0; i < edges.length; i++) {
        var ed = edges[i];
        var ea = Math.min(nodeA[ed.a], nodeA[ed.b]);
        if (ea <= 0.01) continue;
        var A = nodes[ed.a], B = nodes[ed.b];
        ctx.strokeStyle = rgba(ed.c, ea * (0.6 - Math.min(0.28, ed.len / 190)));
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      }

      for (i = 0; i < nodes.length; i++) {
        var n = nodes[i], na = nodeA[i];
        if (na <= 0.01) continue;
        var tw = 0.55 + 0.45 * Math.sin(t * n.speed + n.phase);
        var pop = 1 + 0.7 * (1 - smooth(n.appear, n.appear + 0.3, t));
        if (n.hub) {
          glow(n.x, n.y, 54 * pop * (0.8 + 0.3 * tw), n.c, na * (0.9 + 0.1 * tw), 1);
          ctx.fillStyle = rgba(WHITE, na);
        } else {
          glow(n.x, n.y, 22 * pop, n.c, na * (0.6 + 0.35 * tw), 0.85);
          ctx.fillStyle = rgba(mix(n.c, WHITE, 0.55), na * (0.8 + 0.2 * tw));
        }
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.283); ctx.fill();
      }

      var sigIn = smooth(0.6, 1.1, t);
      for (i = 0; i < signals.length; i++) {
        var sg = signals[i], se = edges[sg.e];
        if (move) sg.p += (sg.v * 60 * dt) / Math.max(12, se.len);
        if (sg.p >= 1) {
          // hop to another link at the far node, never straight back
          var at = sg.from === se.a ? se.b : se.a;
          var next = adj[at].filter(function (x) { return x !== sg.e; });
          if (next.length) sg.e = next[Math.floor(rnd() * next.length)];
          sg.from = at; sg.p = 0;
          continue;
        }
        var S0 = nodes[sg.from], S1 = nodes[sg.from === se.a ? se.b : se.a];
        glow(lerp(S0.x, S1.x, sg.p), lerp(S0.y, S1.y, sg.p), 16, se.c, sigIn, 1);
      }

      // ---- orbits: front halves + satellites
      orbitHalf(false);
      ORBITS.forEach(function (o) {
        o.sats.forEach(function (sat) {
          if (move) sat.a += sat.w * dt;
          var sp = ellipsePoint(o, sat.a);
          var sa = orbitIn * (Math.sin(sat.a) < 0 ? 0.7 : 1);
          glow(sp.x, sp.y, 48, sat.c, sa, 1);
          ctx.fillStyle = rgba(WHITE, sa);
          ctx.beginPath(); ctx.arc(sp.x, sp.y, 3.4, 0, 6.283); ctx.fill();
        });
      });

      ctx.globalCompositeOperation = "source-over";
      if (move) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return function stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      global.removeEventListener("resize", resize);
    };
  }

  global.NeuralBrain = { start: start };

  /* ---------------------------------------------------- loader controller */
  var root = document.getElementById("rt-loader");
  var shownAt = performance.now();
  var stopEngine = null;
  var state = root ? "shown" : "gone";   // shown → exiting → gone

  if (root) {
    var reduced = !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
    stopEngine = start(root.querySelector("canvas.kl-brain"), { reducedMotion: reduced });
  }

  function hide(cb) {
    cb = cb || {};
    if (state !== "shown") {
      // already leaving or gone: still answer the caller
      if (state === "gone") { if (cb.onExit) cb.onExit(); if (cb.onHidden) cb.onHidden(); }
      return;
    }
    state = "exiting";
    document.documentElement.classList.remove("booting");
    root.classList.add("is-exiting");
    if (cb.onExit) cb.onExit();
    setTimeout(function () {
      if (stopEngine) stopEngine();
      if (root.parentNode) root.parentNode.removeChild(root);
      state = "gone";
      if (cb.onHidden) cb.onHidden();
    }, 650);
  }

  // The app calls this once it has mounted. The loader stays up for at least
  // data-min-ms (default 2200 ms) from the moment it first appeared.
  function ready(cb) {
    var minMs = root ? parseInt(root.getAttribute("data-min-ms"), 10) : 0;
    if (!(minMs >= 0)) minMs = 2200;
    var wait = Math.max(0, shownAt + minMs - performance.now());
    setTimeout(function () { hide(cb); }, wait);
  }

  // safety net: if the app never reports in, don't cover the page for ever
  global.addEventListener("load", function () {
    setTimeout(function () { if (state === "shown") hide(); }, 8000);
  });

  global.RTLoader = { ready: ready, hide: hide };
})(window);
