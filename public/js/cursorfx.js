/*!
 * cursorfx.js — custom cursor followers, six types, no dependencies.
 * Picks a different type each browser session unless you pin one.
 * CursorFX.init();
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CursorFX = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TYPES = Object.create(null);
  var STYLE_ID = 'cursorfx-css';
  var inst = null;
  var memory = {};                 // fallback when storage is unavailable

  var DEFAULTS = {
    type: null,                    // pin one type; overrides rotation
    types: null,                   // pool to rotate through (default: all)
    rotate: 'session',             // session | random | fixed
    color: '#7A2BA6',
    size: 40,                      // ring diameter in px
    speed: 1,                      // >1 snappier, <1 lazier
    blend: null,                   // e.g. 'multiply', 'difference'
    hideNative: true,
    hoverSelector: 'a,button,input,textarea,select,summary,[role="button"],[data-cursor-hover]',
    stickSelector: '[data-cursor-stick]',
    storageKey: 'cursorfx:type',
    respectMotion: true,
    enableOnTouch: false
  };

  /* ---------------- storage (never throws) ---------------- */

  function store(kind, key, val) {
    var api = kind === 'session' ? 'sessionStorage' : 'localStorage';
    try {
      if (val === undefined) return window[api].getItem(key);
      if (val === null) { window[api].removeItem(key); return null; }
      window[api].setItem(key, val);
      return val;
    } catch (e) {
      if (val === undefined) return memory[api + key] || null;
      if (val === null) { delete memory[api + key]; return null; }
      memory[api + key] = val;
      return val;
    }
  }

  /* ---------------- utils ---------------- */

  function el(cls, html) {
    var d = document.createElement('div');
    d.className = cls;
    if (html) d.innerHTML = html;
    return d;
  }

  function approach(cur, target, smooth, dt) {
    return cur + (target - cur) * (1 - Math.pow(1 - smooth, dt / 16.67));
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function coarse() {
    return window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
  }

  function reduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  }

  /* ---------------- stylesheet ---------------- */

  var CSS = [
    '.cfx-root{position:fixed;inset:0;pointer-events:none;z-index:2147483000}',
    '.cfx-el{position:fixed;top:0;left:0;pointer-events:none;will-change:transform}',
    '.cfx-el > i{display:block;transform:translate(-50%,-50%);transition:width .25s,height .25s,opacity .25s,background .25s}',
    'html.cfx-hide,html.cfx-hide *{cursor:none!important}',

    /* dot-ring */
    '.cfx-dot > i{width:8px;height:8px;border-radius:50%;background:var(--cfx-color)}',
    '.cfx-ring > i{width:var(--cfx-size);height:var(--cfx-size);border-radius:50%;',
    'border:1.5px solid var(--cfx-color);transition:width .3s cubic-bezier(.2,.8,.2,1),height .3s cubic-bezier(.2,.8,.2,1),opacity .3s,background .3s}',
    '.cfx-on-hover .cfx-ring > i{width:calc(var(--cfx-size)*1.7);height:calc(var(--cfx-size)*1.7);background:color-mix(in srgb,var(--cfx-color) 12%,transparent)}',
    '.cfx-on-hover .cfx-dot > i{width:4px;height:4px}',
    '.cfx-down .cfx-ring > i{width:calc(var(--cfx-size)*.7);height:calc(var(--cfx-size)*.7)}',

    /* trail */
    '.cfx-trail > i{width:var(--d);height:var(--d);border-radius:50%;background:var(--cfx-color)}',

    /* blob */
    '.cfx-blob > i{width:var(--cfx-size);height:var(--cfx-size);border-radius:50%;',
    'background:color-mix(in srgb,var(--cfx-color) 22%,transparent);border:1.5px solid var(--cfx-color)}',
    '.cfx-on-hover .cfx-blob > i{width:calc(var(--cfx-size)*1.5);height:calc(var(--cfx-size)*1.5)}',

    /* glow */
    '.cfx-glow > i{width:calc(var(--cfx-size)*7);height:calc(var(--cfx-size)*7);border-radius:50%;',
    'background:radial-gradient(circle,color-mix(in srgb,var(--cfx-color) 42%,transparent) 0%,transparent 62%)}',
    '.cfx-glow-dot > i{width:7px;height:7px;border-radius:50%;background:var(--cfx-color)}',

    /* crosshair */
    '.cfx-line{position:fixed;background:color-mix(in srgb,var(--cfx-color) 45%,transparent)}',
    '.cfx-line-h{left:0;top:0;width:100vw;height:1px}',
    '.cfx-line-v{left:0;top:0;width:1px;height:100vh}',
    '.cfx-cross > i{width:calc(var(--cfx-size)*.5);height:calc(var(--cfx-size)*.5);',
    'border:1.5px solid var(--cfx-color);border-radius:2px}',
    '.cfx-on-hover .cfx-cross > i{width:calc(var(--cfx-size)*.9);height:calc(var(--cfx-size)*.9);border-radius:50%}',

    /* magnet */
    '.cfx-magnet > i{border:1.5px solid var(--cfx-color);border-radius:999px;',
    'background:color-mix(in srgb,var(--cfx-color) 10%,transparent);transition:background .2s,border-radius .2s}',
    '.cfx-magnet-dot > i{width:6px;height:6px;border-radius:50%;background:var(--cfx-color);transition:opacity .2s}',
    '.cfx-stuck .cfx-magnet-dot > i{opacity:0}',

    '@media (prefers-reduced-motion:reduce){.cfx-el{transition:none!important}}'
  ].join('');

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------------- built-in types ---------------- */
  /* Each type: build(root, cfg) -> { update(state, dt) } */

  function register(name, def) { TYPES[name] = def; }

  register('dot-ring', {
    label: 'Dot and ring',
    build: function (root, cfg) {
      var dot = el('cfx-el cfx-dot', '<i></i>');
      var ring = el('cfx-el cfx-ring', '<i></i>');
      root.appendChild(ring); root.appendChild(dot);
      var r = { x: 0, y: 0 };
      return function (s, dt) {
        dot.style.transform = 'translate3d(' + s.x + 'px,' + s.y + 'px,0)';
        r.x = approach(r.x, s.x, .16 * cfg.speed, dt);
        r.y = approach(r.y, s.y, .16 * cfg.speed, dt);
        ring.style.transform = 'translate3d(' + r.x + 'px,' + r.y + 'px,0)';
      };
    }
  });

  register('trail', {
    label: 'Comet trail',
    build: function (root, cfg) {
      var n = 14, nodes = [], pts = [], i;
      for (i = 0; i < n; i++) {
        var d = el('cfx-el cfx-trail', '<i></i>');
        d.style.setProperty('--d', Math.max(2, (1 - i / n) * cfg.size * .32).toFixed(1) + 'px');
        d.style.opacity = (1 - i / n).toFixed(2);
        root.appendChild(d);
        nodes.push(d); pts.push({ x: 0, y: 0 });
      }
      return function (s, dt) {
        var tx = s.x, ty = s.y;
        for (var j = 0; j < n; j++) {
          var p = pts[j];
          p.x = approach(p.x, tx, .42 * cfg.speed, dt);
          p.y = approach(p.y, ty, .42 * cfg.speed, dt);
          nodes[j].style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0)';
          tx = p.x; ty = p.y;
        }
      };
    }
  });

  register('blob', {
    label: 'Elastic blob',
    build: function (root, cfg) {
      var b = el('cfx-el cfx-blob', '<i></i>');
      root.appendChild(b);
      var p = { x: 0, y: 0 }, ang = 0, str = 0;
      return function (s, dt) {
        var px = p.x, py = p.y;
        p.x = approach(p.x, s.x, .18 * cfg.speed, dt);
        p.y = approach(p.y, s.y, .18 * cfg.speed, dt);
        var dx = p.x - px, dy = p.y - py;
        var sp = Math.min(Math.sqrt(dx * dx + dy * dy) / 26, .45);
        if (sp > .01) ang = Math.atan2(dy, dx) * 180 / Math.PI;
        str = approach(str, sp, .25, dt);
        b.style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0) rotate(' + ang + 'deg)' +
          ' scale(' + (1 + str) + ',' + (1 - str * .8) + ')';
      };
    }
  });

  register('glow', {
    label: 'Soft glow',
    build: function (root, cfg) {
      var g = el('cfx-el cfx-glow', '<i></i>');
      var d = el('cfx-el cfx-glow-dot', '<i></i>');
      if (!cfg.blend) g.style.mixBlendMode = 'multiply';
      root.appendChild(g); root.appendChild(d);
      var p = { x: 0, y: 0 };
      return function (s, dt) {
        d.style.transform = 'translate3d(' + s.x + 'px,' + s.y + 'px,0)';
        p.x = approach(p.x, s.x, .09 * cfg.speed, dt);
        p.y = approach(p.y, s.y, .09 * cfg.speed, dt);
        g.style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0) scale(' + (s.hover ? 1.35 : 1) + ')';
      };
    }
  });

  register('crosshair', {
    label: 'Crosshair',
    build: function (root, cfg) {
      var h = el('cfx-line cfx-line-h'), v = el('cfx-line cfx-line-v');
      var c = el('cfx-el cfx-cross', '<i></i>');
      root.appendChild(h); root.appendChild(v); root.appendChild(c);
      var p = { x: 0, y: 0 };
      return function (s, dt) {
        p.x = approach(p.x, s.x, .3 * cfg.speed, dt);
        p.y = approach(p.y, s.y, .3 * cfg.speed, dt);
        h.style.transform = 'translate3d(0,' + p.y + 'px,0)';
        v.style.transform = 'translate3d(' + p.x + 'px,0,0)';
        c.style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0)';
      };
    }
  });

  register('magnet', {
    label: 'Magnetic ring',
    build: function (root, cfg) {
      var m = el('cfx-el cfx-magnet', '<i></i>');
      var d = el('cfx-el cfx-magnet-dot', '<i></i>');
      root.appendChild(m); root.appendChild(d);
      var box = m.firstChild;
      var p = { x: 0, y: 0, w: cfg.size, h: cfg.size };
      return function (s, dt) {
        d.style.transform = 'translate3d(' + s.x + 'px,' + s.y + 'px,0)';
        var tx = s.x, ty = s.y, tw = cfg.size, th = cfg.size, sm = .18 * cfg.speed;
        if (s.stick) {
          var r = s.stick.getBoundingClientRect();
          tx = r.left + r.width / 2;
          ty = r.top + r.height / 2;
          tw = r.width + 12;
          th = r.height + 12;
          sm = .3 * cfg.speed;
        }
        p.x = approach(p.x, tx, sm, dt);
        p.y = approach(p.y, ty, sm, dt);
        p.w = approach(p.w, tw, sm, dt);
        p.h = approach(p.h, th, sm, dt);
        m.style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0)';
        box.style.width = p.w.toFixed(1) + 'px';
        box.style.height = p.h.toFixed(1) + 'px';
        box.style.borderRadius = s.stick ? '10px' : '999px';
      };
    }
  });

  /* ---------------- type selection ---------------- */

  function pool(cfg) {
    var list = (cfg.types && cfg.types.length ? cfg.types : Object.keys(TYPES))
      .filter(function (t) { return TYPES[t]; });
    return list.length ? list : Object.keys(TYPES);
  }

  function pickType(cfg) {
    var list = pool(cfg);
    if (cfg.type && TYPES[cfg.type]) return cfg.type;
    if (cfg.rotate === 'fixed') return list[0];
    if (cfg.rotate === 'random') return list[Math.floor(Math.random() * list.length)];

    var saved = store('session', cfg.storageKey);
    if (saved && list.indexOf(saved) > -1) return saved;

    var last = store('local', cfg.storageKey + ':last');
    var choices = list.length > 1 ? list.filter(function (t) { return t !== last; }) : list;
    var pick = choices[Math.floor(Math.random() * choices.length)];
    store('session', cfg.storageKey, pick);
    store('local', cfg.storageKey + ':last', pick);
    return pick;
  }

  /* ---------------- engine ---------------- */

  function init(options) {
    var cfg = {}, k;
    for (k in DEFAULTS) cfg[k] = DEFAULTS[k];
    for (k in options || {}) if (options[k] !== undefined) cfg[k] = options[k];

    if (coarse() && !cfg.enableOnTouch) return null;
    if (cfg.respectMotion && reduced()) return null;
    if (inst) destroy();
    ensureStyle();

    var root = el('cfx-root');
    root.style.setProperty('--cfx-color', cfg.color);
    root.style.setProperty('--cfx-size', cfg.size + 'px');
    if (cfg.blend) root.style.mixBlendMode = cfg.blend;
    document.body.appendChild(root);
    if (cfg.hideNative) document.documentElement.classList.add('cfx-hide');

    var s = {
      x: window.innerWidth / 2, y: window.innerHeight / 2,
      hover: null, stick: null, down: false
    };
    var raf = 0, last = 0, render = null, name = null;

    function mount(type) {
      root.querySelectorAll('.cfx-el,.cfx-line').forEach(function (n) { n.remove(); });
      name = TYPES[type] ? type : pool(cfg)[0];
      render = TYPES[name].build(root, cfg);
      root.dataset.type = name;
    }

    function onMove(e) {
      s.x = e.clientX; s.y = e.clientY;
      var t = e.target;
      s.hover = t && t.closest ? t.closest(cfg.hoverSelector) : null;
      s.stick = t && t.closest ? t.closest(cfg.stickSelector) : null;
      root.classList.toggle('cfx-on-hover', !!s.hover);
      root.classList.toggle('cfx-stuck', !!s.stick);
      root.style.opacity = '1';
    }
    function onDown() { s.down = true; root.classList.add('cfx-down'); }
    function onUp() { s.down = false; root.classList.remove('cfx-down'); }
    function onLeave() { root.style.opacity = '0'; }

    function frame(t) {
      var dt = clamp(t - (last || t), 1, 32);
      last = t;
      if (render) render(s, dt);
      raf = requestAnimationFrame(frame);
    }

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('mouseleave', onLeave);

    mount(pickType(cfg));
    raf = requestAnimationFrame(frame);

    inst = {
      cfg: cfg, root: root,
      type: function () { return name; },
      setType: function (t, remember) {
        if (!TYPES[t]) return;
        mount(t);
        if (remember !== false) store('session', cfg.storageKey, t);
      },
      newSession: function () {
        store('session', cfg.storageKey, null);
        var t = pickType(cfg);
        mount(t);
        return t;
      },
      set: function (key, value) {
        cfg[key] = value;
        if (key === 'color') root.style.setProperty('--cfx-color', value);
        if (key === 'size') { root.style.setProperty('--cfx-size', value + 'px'); mount(name); }
      },
      teardown: function () {
        cancelAnimationFrame(raf);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerdown', onDown);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointerleave', onLeave);
        document.removeEventListener('mouseleave', onLeave);
        root.remove();
        document.documentElement.classList.remove('cfx-hide');
      }
    };
    return inst;
  }

  function destroy() { if (inst) { inst.teardown(); inst = null; } }

  return {
    init: init,
    destroy: destroy,
    register: register,
    types: function () { return Object.keys(TYPES); },
    labels: function () {
      var o = {};
      Object.keys(TYPES).forEach(function (t) { o[t] = TYPES[t].label || t; });
      return o;
    },
    type: function () { return inst ? inst.type() : null; },
    setType: function (t, remember) { if (inst) inst.setType(t, remember); },
    newSession: function () { return inst ? inst.newSession() : null; },
    set: function (k, v) { if (inst) inst.set(k, v); },
    instance: function () { return inst; },
    defaults: DEFAULTS,
    version: '1.0.0'
  };
});
