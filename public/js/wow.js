/*!
 * Wow — a self-contained scroll-reveal animation engine.
 * (Replaces AOS / animate-on-scroll for this site. Pairs with wow.css.)
 *
 * Drop-in: reads the existing `data-aos` / `data-aos-delay` / `data-aos-duration`
 * / `data-aos-once` markup (255+ elements) with ZERO changes, and exposes an
 * AOS-compatible global — window.AOS.init()/refresh()/refreshHard() keep working.
 * Also supports a richer native API: `.wow` + `data-wow="fade-up"` and friends.
 *
 * Upgrades over AOS / WOW.js:
 *   • IntersectionObserver (no scroll thrashing) + MutationObserver, so
 *     React-rendered / dynamically-inserted elements animate automatically —
 *     no manual refresh() needed after navigation or modal opens.
 *   • Progressive enhancement: content is hidden ONLY once the engine is ready
 *     (<html class="wow-ready">). A script error or missing IO never leaves the
 *     page invisible (a real risk with the old CSS-hides-everything approach).
 *   • prefers-reduced-motion aware — reveals instantly, no motion.
 *   • Arbitrary per-element duration / delay / easing via inline styles
 *     (no multi-thousand-line generated stylesheet).
 *   • Group stagger: `data-wow-stagger="90"` on a parent cascades child delays.
 *   • Bigger effect library (fade / zoom / flip / slide families + blur-in,
 *     reveal-wipe, rotate-in, bounce-in). See wow.css.
 *   • `once` (default) or `mirror` (re-animate when scrolled back), per element
 *     or globally.
 *
 * Global: window.Wow (singleton) === window.AOS (compatibility alias).
 */
(function (window, document) {
  "use strict";

  if (window.Wow && window.Wow.__isWow) return; // idempotent load guard

  var mm = window.matchMedia;
  var REDUCED = !!(mm && mm("(prefers-reduced-motion: reduce)").matches);
  var HAS_IO = typeof window.IntersectionObserver === "function";
  var SELECTOR = "[data-aos],[data-wow],.wow";

  // Gate hiding as early as possible (this script is in <head>) so elements
  // start hidden with no flash — but ONLY when we can actually animate them.
  if (!REDUCED && HAS_IO) document.documentElement.classList.add("wow-ready");

  function attr(el, a) { return el.getAttribute(a); }
  function firstAttr(el, a, b) { var v = attr(el, a); return v != null ? v : attr(el, b); }
  function toInt(v, d) { v = parseInt(v, 10); return isNaN(v) ? d : v; }
  function boolAttr(el, a, fallback) {
    var v = attr(el, a);
    if (v == null) return fallback;
    return v !== "false" && v !== "0";
  }

  function Wow() {
    this.__isWow = true;
    this.opts = null;
    this.io = null;
    this.mo = null;
    this.seen = (typeof WeakSet === "function") ? new WeakSet() : null;
    this._raf = 0;
    this._legacySeen = []; // fallback when WeakSet unsupported
  }

  var P = Wow.prototype;

  P.init = function (options) {
    var o = this.opts = Object.assign({
      offset: 120,        // px before the viewport bottom to trigger
      delay: 0,
      duration: 700,
      easing: "cubic-bezier(.5, 0, 0, 1)",
      once: false,        // AOS default; the app passes once:true
      mirror: false,      // re-hide/replay when scrolled back out of view
      disable: false      // true | 'phone' | 'tablet' | 'mobile' | fn
    }, options || {});

    // Fully reset so init() is safe to call repeatedly (app + aosrun both call it).
    this.destroy();
    this.seen = (typeof WeakSet === "function") ? new WeakSet() : null;
    this._legacySeen = [];

    if (REDUCED || !HAS_IO || this._disabled(o.disable)) {
      document.documentElement.classList.remove("wow-ready");
      this._revealAll();
      return this;
    }

    document.documentElement.classList.add("wow-ready");
    this._buildObserver();
    this.refresh();
    this._watchDom();
    return this;
  };

  P._disabled = function (d) {
    if (typeof d === "function") return !!d();
    if (d === true) return true;
    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    if (d === "phone" || d === "mobile") return w < 768;
    if (d === "tablet") return w < 1024;
    return false;
  };

  P._marked = function (el) {
    if (this.seen) return this.seen.has(el);
    return this._legacySeen.indexOf(el) !== -1;
  };
  P._mark = function (el) {
    if (this.seen) this.seen.add(el);
    else if (this._legacySeen.indexOf(el) === -1) this._legacySeen.push(el);
  };

  P._buildObserver = function () {
    var self = this;
    var off = self.opts.offset || 0;
    self.io = new window.IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i], el = e.target;
        if (e.isIntersecting) {
          self._reveal(el);
          if (self._isOnce(el)) self.io.unobserve(el);
        } else if (!self._isOnce(el)) {
          // Out of view and allowed to replay — decide by which edge it left so
          // the animation runs in REVERSE when the user scrolls back up.
          var rb = e.rootBounds;
          var vh = window.innerHeight || document.documentElement.clientHeight || 0;
          var box = e.boundingClientRect;
          var rbBottom = rb ? rb.bottom : vh;
          var rbTop = rb ? rb.top : 0;
          if (box.top >= rbBottom) {
            // element is BELOW the viewport → scrolled up past it → reset it so
            // it animates in again (reverse) when scrolled back down.
            self._hide(el);
          } else if (box.bottom <= rbTop) {
            // element is ABOVE the viewport (already scrolled past going down)
            if (self._isMirror(el)) self._hide(el); // mirror: also reverse-out downward
            else self._reveal(el);                  // otherwise keep it revealed
          }
        }
      }
    }, { rootMargin: "0px 0px " + (-off) + "px 0px", threshold: 0 });
  };

  // Prepare a single element: normalize its name, apply timing, add hooks.
  P._prepare = function (el) {
    this._mark(el);

    var name = firstAttr(el, "data-aos", "data-wow") || "fade-up";
    if (!el.hasAttribute("data-aos")) el.setAttribute("data-aos", name);
    el.classList.add("wow");

    var dur = toInt(firstAttr(el, "data-aos-duration", "data-wow-duration"), this.opts.duration);
    var del = toInt(firstAttr(el, "data-aos-delay", "data-wow-delay"), this.opts.delay);
    var ease = firstAttr(el, "data-aos-easing", "data-wow-easing") || this.opts.easing;

    // Group stagger — a parent with data-wow-stagger cascades child delays.
    var parent = el.parentElement;
    if (parent && parent.hasAttribute("data-wow-stagger")) {
      var step = toInt(attr(parent, "data-wow-stagger"), 100);
      var idx = Array.prototype.indexOf.call(parent.children, el);
      if (idx > 0) del += idx * step;
    }

    el.style.transitionDuration = dur + "ms";
    el.style.transitionDelay = del + "ms";
    el.style.transitionTimingFunction = ease;
  };

  P._reveal = function (el) { el.classList.add("aos-animate", "wow-in"); };
  P._hide = function (el) { el.classList.remove("aos-animate", "wow-in"); };

  P._isOnce = function (el) {
    var v = firstAttr(el, "data-aos-once", "data-wow-once");
    if (v != null) return v !== "false" && v !== "0";
    return !!this.opts.once;
  };
  P._isMirror = function (el) {
    return boolAttr(el, "data-aos-mirror", !!this.opts.mirror);
  };

  // Scan the DOM and observe any not-yet-tracked target.
  P.refresh = function () {
    if (!this.io) return this;
    var self = this;
    var nodes = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      // Tracked already — unless its reveal state was stripped (no .wow) and it
      // was marked for reveal again: then it is hidden with no observer, so
      // watch it again rather than leave it invisible for good.
      if (self._marked(el) && el.classList.contains("wow")) continue;
      self._prepare(el);
      self.io.observe(el);
    }
    return this;
  };

  // AOS API compatibility — with IO, a plain re-scan is all that's needed.
  P.refreshHard = function () { return this.refresh(); };
  P.refreshFixed = function () { return this.refresh(); };

  P._watchDom = function () {
    var self = this;
    if (self.mo || typeof window.MutationObserver !== "function" || !document.body) return;
    self.mo = new window.MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].addedNodes && muts[i].addedNodes.length) { self._schedule(); return; }
      }
    });
    self.mo.observe(document.body, { childList: true, subtree: true });
  };

  P._schedule = function () {
    var self = this;
    if (self._raf) return;
    var run = function () { self._raf = 0; self.refresh(); };
    if (window.requestAnimationFrame) self._raf = window.requestAnimationFrame(run);
    else self._raf = window.setTimeout(run, 50);
  };

  P._revealAll = function () {
    var nodes = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.add("aos-animate", "wow-in");
  };

  P.destroy = function () {
    if (this.io) { this.io.disconnect(); this.io = null; }
    if (this.mo) { this.mo.disconnect(); this.mo = null; }
    if (this._raf) {
      if (window.cancelAnimationFrame) window.cancelAnimationFrame(this._raf);
      else clearTimeout(this._raf);
      this._raf = 0;
    }
    return this;
  };

  var wow = new Wow();
  window.Wow = wow;
  window.AOS = wow; // AOS-compatible alias (init / refresh / refreshHard / refreshFixed)

  // Auto-init for plain HTML pages. The React app calls Wow.init() itself; the
  // reset-on-init makes the later call harmless.
  function autostart() { if (!wow.io && !wow.opts) wow.init(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autostart);
  } else {
    autostart();
  }
})(window, document);
