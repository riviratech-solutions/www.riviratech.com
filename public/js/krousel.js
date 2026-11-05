/**
 * Krousel — a tiny, dependency-free carousel/slider (Rivira Tech + carousel).
 *
 * A self-contained replacement for Swiper / Owl Carousel. Two engines:
 *
 *   effect: "slide"  (default) — multi-item track carousel with seamless infinite
 *                    loop, responsive slidesPerView, spaceBetween, pointer drag.
 *
 *   effect: "fade" | "zoom" | "flip" | "rotate" | "bounce" | "slide-h" | "slide-v"
 *                    — one-slide-at-a-time animated slideshow (stacked slides,
 *                    CSS keyframe in/out transitions). "slide-h"/"slide-v" are
 *                    page-slide (horizontal / vertical).
 *
 * Owl-style extras (work in both engines):
 *   - nav:  true       → prev / next arrows
 *   - dots: true       → pagination dots
 *   - autoplay { delay, disableOnInteraction, pauseOnMouseEnter }
 *   - loop, speed, initialSlide, breakpoints (min-width), drag
 *
 * Slide-engine extras:
 *   - autoWidth: true   → each slide keeps its own CSS width (no slidesPerView sizing)
 *   - continuous: true | { speed: px per second (40), pauseOnHover: true,
 *                          snap: false, snapDelay: 2500 }
 *                       → smooth, constant-speed marquee scrolling with a seamless
 *                         loop. Pauses on hover / keyboard focus / off-screen /
 *                         prefers-reduced-motion; drag scrubs it; nav glides one slide.
 *                         snap: true → glide one slide at a time and rest with a slide
 *                         exactly centred (snapDelay ms); drags settle centred too.
 *                         `snap` can also be set per breakpoint (e.g. phones only).
 *   - centerFocus: true | { effect: false }
 *                       → every frame each slide gets --k-focus (1 at the centre → 0
 *                         two slides away), --k-lift (1 → 0 across half the width,
 *                         curved) and --k-tilt (-1 left … 1 right), plus .is-center on
 *                         the nearest. The built-in scale/fade effect can be turned off
 *                         ({ effect: false }) to drive your own CSS from the variables.
 *
 * Usage:  new Krousel(".selector", { effect:"flip", nav:true, dots:true, autoplay:{delay:3000} })
 *         new Krousel(".rail", { autoWidth:true, spaceBetween:24, continuous:{speed:48}, centerFocus:true, nav:true })
 *
 * Markup:
 *   <div class="krousel selector">
 *     <div class="krousel-track">
 *       <div class="krousel-slide">…</div> …
 *     </div>
 *   </div>
 *
 * API: instance.next() | prev() | goReal(i) | autoplay.start() | autoplay.stop() | destroy()
 *      (in continuous mode autoplay.stop()/start() pause and resume the scrolling)
 */
(function (global) {
  "use strict";

  if (global.Krousel) return;

  var EFFECTS = { fade: 1, zoom: 1, flip: 1, rotate: 1, bounce: 1, "slide-h": 1, "slide-v": 1 };

  function Krousel(selector, options) {
    if (!(this instanceof Krousel)) return new Krousel(selector, options);

    var root = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!root) return;
    if (root._krousel) return root._krousel;
    root._krousel = this;
    this.root = root;

    this.opts = Object.assign({
      slidesPerView: 1,
      spaceBetween: 0,
      loop: false,
      speed: 500,
      initialSlide: 0,
      autoplay: false,
      breakpoints: null,
      effect: "slide",   // "slide" | fade | zoom | flip | rotate | bounce | slide-h | slide-v
      nav: false,        // prev / next arrows
      dots: false,       // pagination dots
      navText: ["‹", "›"],
      drag: true,
      autoWidth: false,    // keep each slide's own CSS width
      continuous: false,   // true | { speed: px/s, pauseOnHover }
      centerFocus: false,  // true | { effect: false }
    }, options || {});

    this.track = root.querySelector(".krousel-track");
    if (!this.track) return;

    this.reals = Array.prototype.slice.call(this.track.children);
    this.count = this.reals.length;
    if (!this.count) return;

    this.anim = !!EFFECTS[this.opts.effect];
    root.classList.add("krousel");
    if (this.anim) root.classList.add("krousel--anim", "krousel--" + this.opts.effect);
    root.style.setProperty("--k-speed", this.opts.speed + "ms");

    // continuous (marquee) + center-focus are slide-engine features
    var c = this.opts.continuous;
    this.cont = !this.anim && !!c;
    this.cSpeed = c && typeof c === "object" && c.speed ? c.speed : 40;
    this.cHoverPause = !(c && typeof c === "object" && c.pauseOnHover === false);
    this.cSnap = !!(c && typeof c === "object" && c.snap);
    this.cSnapDelay = c && typeof c === "object" && c.snapDelay ? c.snapDelay : 2500;
    var f = this.opts.centerFocus;
    this.focusOn = !this.anim && !!f;
    if (this.cont) root.classList.add("krousel--continuous");
    if (this.focusOn) {
      root.classList.add("krousel--center");
      if (!(f && typeof f === "object" && f.effect === false)) root.classList.add("krousel--center-fx");
    }

    var self = this;
    this.autoplay = {
      start: function () { if (self.cont) self._contOn = true; else self._resume(); },
      stop: function () { if (self.cont) self._contOn = false; else self._stop(); },
    };

    this._build();
    this._buildControls();
    this._bind();
    this._resume();
    if (this.cont || this.focusOn) this._startLoop();
  }

  var proto = Krousel.prototype;

  /* ---------- responsive ---------- */
  proto._resolveResponsive = function () {
    var pv = this.opts.slidesPerView;
    var gap = this.opts.spaceBetween;
    var bp = this.opts.breakpoints;
    var snap = this.cSnap;

    if (bp) {
      var w = window.innerWidth, best = -1;
      Object.keys(bp).forEach(function (k) {
        var min = parseInt(k, 10);
        if (w >= min && min > best) {
          best = min;
          if (bp[k].slidesPerView != null) pv = bp[k].slidesPerView;
          if (bp[k].spaceBetween != null) gap = bp[k].spaceBetween;
          if (bp[k].snap != null) snap = !!bp[k].snap;
        }
      });
    }
    this.perView = Math.max(1, Math.floor(pv));
    this.gap = gap || 0;
    this.snapOn = !!this.cont && snap;
  };

  function cleanClone(node) {
    var c = node.cloneNode(true);
    if (c.removeAttribute) c.removeAttribute("data-aos");
    if (c.querySelectorAll) {
      var els = c.querySelectorAll("[data-aos]");
      for (var i = 0; i < els.length; i++) els[i].removeAttribute("data-aos");
      // Clones are visual duplicates: keep them out of the a11y tree / tab order
      var focusables = c.querySelectorAll("a, button, input, select, textarea, iframe, [tabindex]");
      for (var j = 0; j < focusables.length; j++) focusables[j].setAttribute("tabindex", "-1");
    }
    c.setAttribute("data-krousel-clone", "");
    c.setAttribute("aria-hidden", "true");
    return c;
  }

  /* ---------- build ---------- */
  proto._build = function () {
    if (this.anim) this._buildAnim();
    else this._buildSlide();
    if (this.dotsWrap) this._updateDots();
  };

  proto._buildSlide = function () {
    if (this.cont) return this._buildContinuous();
    this._resolveResponsive();
    this.loop = !!this.opts.loop && this.count > this.perView;
    this.pad = this.loop ? this.perView : 0;

    this.track.innerHTML = "";
    var frag = document.createDocumentFragment();
    var i;
    if (this.loop) for (i = this.count - this.pad; i < this.count; i++) frag.appendChild(cleanClone(this.reals[i]));
    for (i = 0; i < this.count; i++) frag.appendChild(this.reals[i]);
    if (this.loop) for (i = 0; i < this.pad; i++) frag.appendChild(cleanClone(this.reals[i]));
    this.track.appendChild(frag);

    this.slides = Array.prototype.slice.call(this.track.children);
    this._layout();
    this.pos = this.pad + Math.min(Math.max(this.opts.initialSlide || 0, 0), this.count - 1);
    this._setTransform(false);
  };

  /* continuous: real slides + enough full-set clones to always cover the view */
  proto._buildContinuous = function () {
    this._resolveResponsive();
    this.loop = true;
    this.pad = 0;

    this.track.innerHTML = "";
    var i;
    for (i = 0; i < this.count; i++) this.track.appendChild(this.reals[i]);
    this.slides = this.reals.slice();
    this._layout();

    // width of one full set = distance the track travels before it repeats
    var setW = 0;
    for (i = 0; i < this.count; i++) setW += this.reals[i].offsetWidth + this.gap;
    this.setW = Math.max(1, setW);
    this.step = this.setW / this.count;   // average pitch (nav moves one slide)
    this.cSlideW = this.reals[0].offsetWidth;

    var copies = Math.ceil(this.root.clientWidth / this.setW) + 1;
    var frag = document.createDocumentFragment();
    for (var k = 0; k < copies; k++) {
      for (i = 0; i < this.count; i++) frag.appendChild(cleanClone(this.reals[i]));
    }
    this.track.appendChild(frag);
    this.slides = Array.prototype.slice.call(this.track.children);
    this._layout();

    this.offset = ((this.offset || 0) % this.setW + this.setW) % this.setW;
    if (this.snapOn) { this._tween = null; this.offset = this._wrap(this._snapTarget(0)); this._holdUntil = 0; }
    this.track.style.transition = "none";
    this.track.style.transform = "translate3d(" + (-this.offset) + "px,0,0)";
  };

  proto._buildAnim = function () {
    this.perView = 1;
    this.track.innerHTML = "";
    for (var i = 0; i < this.count; i++) this.track.appendChild(this.reals[i]);
    this.slides = this.reals;
    this.index = Math.min(Math.max(this.opts.initialSlide || 0, 0), this.count - 1);

    var idx = this.index;
    this.slides.forEach(function (s, i) {
      s.classList.add("krousel-slide");
      s.classList.toggle("is-active", i === idx);
      s.style.visibility = i === idx ? "visible" : "hidden";
    });
  };

  proto._layout = function () {
    if (this.opts.autoWidth) {
      var g = this.gap;
      this.track.style.display = "flex";
      this.track.style.willChange = "transform";
      this.slides.forEach(function (s) {
        s.style.boxSizing = "border-box";
        s.style.flex = "0 0 auto";
        s.style.width = "";
        s.style.marginLeft = "0px";
        s.style.marginRight = g + "px";
      });
      var first = this.slides[0];
      this.slideW = first ? first.offsetWidth : 0;
      if (!this.cont) this.step = this.slideW + this.gap;
      return;
    }
    var cs = window.getComputedStyle(this.root);
    var inner = this.root.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    if (inner <= 0) inner = this.root.clientWidth;
    this.slideW = (inner - this.gap * (this.perView - 1)) / this.perView;
    this.step = this.slideW + this.gap;
    this.track.style.display = "flex";
    this.track.style.willChange = "transform";
    var w = this.slideW, gap = this.gap;
    this.slides.forEach(function (s) {
      s.style.boxSizing = "border-box";
      s.style.flex = "0 0 " + w + "px";
      s.style.width = w + "px";
      s.style.marginLeft = "0px";
      s.style.marginRight = gap + "px";
    });
  };

  proto._setTransform = function (animate) {
    this.track.style.transition = animate
      ? "transform " + this.opts.speed + "ms cubic-bezier(.4,0,.2,1)"
      : "none";
    this.track.style.transform = "translate3d(" + (-this.pos * this.step) + "px,0,0)";
    if (!animate) void this.track.offsetHeight;
  };

  proto._normalize = function () {
    if (!this.loop) return;
    if (this.pos >= this.pad + this.count) { this.pos -= this.count; this._setTransform(false); }
    else if (this.pos < this.pad) { this.pos += this.count; this._setTransform(false); }
  };

  proto._scheduleNormalize = function () {
    var self = this;
    clearTimeout(this._normTimer);
    this._normTimer = setTimeout(function () { self._normalize(); }, this.opts.speed + 30);
  };

  /* ---------- navigation ---------- */
  proto.next = function () {
    if (this.anim) return this._animGo((this.index + 1) % this.count);
    if (this.cont) return this._glide(1);
    if (this.loop) {
      // FE-07: snap back synchronously if a previous advance pushed us past the
      // clone buffer (rapid next() spam) — don't wait for the debounced normalize.
      if (this.pos >= this.pad + this.count) { this.pos -= this.count; this._setTransform(false); }
      this.pos++; this._setTransform(true); this._scheduleNormalize();
    }
    else { var m = Math.max(0, this.count - this.perView); this.pos = this.pos + 1 > m ? 0 : this.pos + 1; this._setTransform(true); }
    this._updateDots();
  };

  proto.prev = function () {
    if (this.anim) return this._animGo((this.index - 1 + this.count) % this.count);
    if (this.cont) return this._glide(-1);
    if (this.loop) {
      // FE-07: snap forward synchronously if a previous retreat dropped us below
      // the clone buffer (rapid prev() spam) — don't wait for the debounced normalize.
      if (this.pos < this.pad) { this.pos += this.count; this._setTransform(false); }
      this.pos--; this._setTransform(true); this._scheduleNormalize();
    }
    else { var m = Math.max(0, this.count - this.perView); this.pos = this.pos - 1 < 0 ? m : this.pos - 1; this._setTransform(true); }
    this._updateDots();
  };

  proto.goReal = function (i) {
    i = ((i % this.count) + this.count) % this.count;
    if (this.anim) return this._animGo(i);
    this.pos = this.pad + i;
    this._setTransform(true);
    this._scheduleNormalize();
    this._updateDots();
  };

  /* animated (stacked) transition */
  proto._animGo = function (to) {
    if (to === this.index || this._animating) return;
    var eff = this.opts.effect;
    var out = this.slides[this.index];
    var inc = this.slides[to];
    var self = this;
    this._animating = true;

    inc.style.visibility = "visible";
    inc.style.zIndex = "2";
    out.style.zIndex = "1";
    inc.classList.add("is-active", "krousel-in-" + eff);
    out.classList.add("krousel-out-" + eff);

    clearTimeout(this._animTimer);
    this._animTimer = setTimeout(function () {
      out.classList.remove("is-active", "krousel-out-" + eff);
      out.style.visibility = "hidden";
      out.style.zIndex = "";
      inc.classList.remove("krousel-in-" + eff);
      inc.style.zIndex = "";
      self.index = to;
      self._animating = false;
      self._updateDots();
    }, this.opts.speed + 20);
  };

  /* ---------- continuous + center-focus frame loop ---------- */

  // nav in continuous mode: ease to the next / previous slide, centred. In
  // smooth (non-snap) mode the marquee then rests there for snapDelay ms
  // before it carries on, so the slide the visitor asked for is seen centred.
  proto._glide = function (dir) {
    var from = this._tween ? this._tween.to : this.offset;
    var to = this._snapTarget(dir, from);
    this._tween = { from: this.offset, to: to, start: 0, dur: this.opts.speed, nav: !this.snapOn };
    this._holdUntil = 0;
    this._navHold = 0;
    this._updateDots();
  };

  // offset that puts a slide's centre on the viewport centre: the nearest one
  // to `from` (dir 0), or the next / previous one (dir ±1)
  proto._snapTarget = function (dir, from) {
    var base = (this.cSlideW || this.step) / 2 - this.root.clientWidth / 2;
    var cur = from == null ? this.offset : from;
    var idx = Math.round((cur - base) / this.step) + (dir || 0);
    return base + idx * this.step;
  };

  proto._wrap = function (v) {
    return ((v % this.setW) + this.setW) % this.setW;
  };

  proto._frame = function (t) {
    if (this.cont) {
      var dt = this._lastT ? Math.min(64, t - this._lastT) : 0;
      if (this._tween) {
        var tw = this._tween;
        if (!tw.start) tw.start = t;
        var p = Math.min(1, (t - tw.start) / Math.max(1, tw.dur));
        var e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   // easeInOutQuad
        this.offset = tw.from + (tw.to - tw.from) * e;
        if (p >= 1) {
          if (tw.nav) this._navHold = t + this.cSnapDelay;
          this._tween = null; this._holdUntil = 0;
        }
      } else if (this._contOn && !this._hover && !this._focusIn && !this._drag && !this._reduced) {
        if (this.snapOn) {
          // rest centred, then glide to the next slide
          if (!this._holdUntil) this._holdUntil = t + this.cSnapDelay;
          else if (t >= this._holdUntil) this._glide(1);
        } else if (!this._navHold || t >= this._navHold) {
          this._navHold = 0;
          this.offset += this.cSpeed * dt / 1000;
        }
      } else {
        this._holdUntil = 0;
      }
      this.offset = this._wrap(this.offset);
      this.track.style.transform = "translate3d(" + (-this.offset) + "px,0,0)";
    }
    this._lastT = t;
    if (this.focusOn) this._applyFocus();
  };

  // per-slide focus variables, from each slide's distance to the viewport centre
  proto._applyFocus = function () {
    var rb = this.root.getBoundingClientRect();
    var centre = rb.left + rb.width / 2;
    var span = Math.max(1, rb.width / 2);
    var reach = Math.max(1, (this.step || rb.width) * 2);
    var slides = this.slides, n = slides.length, i;
    var boxes = new Array(n);
    for (i = 0; i < n; i++) boxes[i] = slides[i].getBoundingClientRect();   // read all, then write
    var best = -1, bestOff = Infinity;
    for (i = 0; i < n; i++) {
      var delta = boxes[i].left + boxes[i].width / 2 - centre;
      var off = Math.abs(delta);
      var away = Math.min(1, off / span);
      var st = slides[i].style;
      st.setProperty("--k-focus", (1 - Math.min(1, off / reach)).toFixed(3));
      st.setProperty("--k-lift", (1 - away * away).toFixed(3));
      st.setProperty("--k-tilt", Math.max(-1, Math.min(1, delta / span)).toFixed(3));
      if (off < bestOff) { bestOff = off; best = i; }
    }
    if (best !== this._centerIdx) {
      if (this._centerIdx != null && slides[this._centerIdx]) slides[this._centerIdx].classList.remove("is-center");
      if (slides[best]) slides[best].classList.add("is-center");
      this._centerIdx = best;
    }
  };

  // rAF loop, running only while the carousel is on screen
  proto._startLoop = function () {
    var self = this;
    this._contOn = true;
    var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    this._reduced = !!(mq && mq.matches);
    if (mq) {
      this._onMotion = function () { self._reduced = mq.matches; };
      if (mq.addEventListener) mq.addEventListener("change", this._onMotion);
      this._mq = mq;
    }

    var run = function (t) {
      self._frame(t);
      self._raf = requestAnimationFrame(run);
    };
    this._play = function () { if (!self._raf) { self._lastT = 0; self._raf = requestAnimationFrame(run); } };
    this._pauseLoop = function () { if (self._raf) cancelAnimationFrame(self._raf); self._raf = 0; };

    if (window.IntersectionObserver) {
      this._io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) self._play(); else self._pauseLoop();
      }, { threshold: 0 });
      this._io.observe(this.root);
    } else {
      this._play();
    }

    if (this.cont) {
      if (this.cHoverPause) {
        this._onHoverIn = function () { self._hover = true; };
        this._onHoverOut = function () { self._hover = false; };
        this.root.addEventListener("mouseenter", this._onHoverIn);
        this.root.addEventListener("mouseleave", this._onHoverOut);
      }
      // keyboard focus inside stops the travel (no moving targets)
      this._onFocusIn = function () { self._focusIn = true; };
      this._onFocusOut = function () { self._focusIn = false; };
      this.root.addEventListener("focusin", this._onFocusIn);
      this.root.addEventListener("focusout", this._onFocusOut);
    }
  };

  proto._currentReal = function () {
    if (this.anim) return this.index;
    if (this.cont) {
      var r = Math.round(this.offset / this.step) % this.count;
      return r < 0 ? r + this.count : r;
    }
    var i = (this.pos - this.pad) % this.count;
    return i < 0 ? i + this.count : i;
  };

  /* ---------- controls (nav + dots) ---------- */
  proto._buildControls = function () {
    var self = this;
    this._controls = [];   // FE-13: track injected nodes so destroy() can remove them

    if (this.opts.nav) {
      var mk = function (cls, txt, fn) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "krousel-btn " + cls;
        b.setAttribute("aria-label", cls.indexOf("prev") > -1 ? "Previous" : "Next");
        b.innerHTML = txt;
        b.addEventListener("click", function (e) { e.preventDefault(); self._interact(); fn(); });
        self.root.appendChild(b);
        self._controls.push(b);
        return b;
      };
      mk("krousel-prev", this.opts.navText[0], function () { self.prev(); });
      mk("krousel-next", this.opts.navText[1], function () { self.next(); });
    }

    if (this.opts.dots) {
      this.dotsWrap = document.createElement("div");
      this.dotsWrap.className = "krousel-dots";
      for (var i = 0; i < this.count; i++) {
        (function (idx) {
          var d = document.createElement("button");
          d.type = "button";
          d.className = "krousel-dot";
          d.setAttribute("aria-label", "Go to slide " + (idx + 1));
          d.addEventListener("click", function () { self._interact(); self.goReal(idx); });
          self.dotsWrap.appendChild(d);
        })(i);
      }
      this.root.appendChild(this.dotsWrap);
      this._controls.push(this.dotsWrap);
      this._updateDots();
    }
  };

  proto._updateDots = function () {
    if (!this.dotsWrap) return;
    var cur = this._currentReal();
    var dots = this.dotsWrap.children;
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle("is-active", i === cur);
  };

  proto._interact = function () {
    var ap = this.opts.autoplay;
    if (ap && ap.disableOnInteraction) this._stop();
  };

  /* ---------- autoplay ---------- */
  proto._resume = function () {
    var ap = this.opts.autoplay;
    if (!ap) return;
    this._apDelay = ap.delay || 3000;
    this._apOn = true;
    this._tick();
  };
  proto._tick = function () {
    clearTimeout(this._apTimer);
    if (!this._apOn) return;
    var self = this;
    this._apTimer = setTimeout(function () { self.next(); self._tick(); }, this._apDelay);
  };
  proto._stop = function () { this._apOn = false; clearTimeout(this._apTimer); };

  /* ---------- events ---------- */
  proto._bind = function () {
    var self = this;

    // rebuild only in slide mode — the animated (grid) engine auto-sizes, and a
    // rebuild there would reset the active slide.
    this._reflow = function () {
      if (self.anim) return;
      if (self.cont) { self._build(); return; }
      var wasOn = self._apOn;
      // FE-08: preserve the current slide across a rebuild instead of snapping
      // back to initialSlide when the window/container resizes or images settle.
      var saved = self._currentReal();
      self._stop();
      self._build();
      var maxReal = self.loop ? self.count - 1 : Math.max(0, self.count - self.perView);
      self.pos = self.pad + Math.min(Math.max(saved, 0), maxReal);
      self._setTransform(false);
      self._updateDots();
      if (wasOn) self._resume();
    };
    this._onResize = function () {
      clearTimeout(self._rzTimer);
      self._rzTimer = setTimeout(self._reflow, 150);
    };
    window.addEventListener("resize", this._onResize);

    // Re-layout whenever the carousel's OWN width changes (fonts/images settling
    // after init, container resize, sidebar toggles). A window 'resize' listener
    // alone misses these, which left the last slide short of the container edge.
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(function () {
        clearTimeout(self._rzTimer);
        self._rzTimer = setTimeout(self._reflow, 150);
      });
      this._ro.observe(this.root);
    }

    var ap = this.opts.autoplay;
    if (ap && ap.pauseOnMouseEnter) {
      // FE-13: keep refs so destroy() can remove these root listeners.
      this._onEnter = function () { self._stop(); };
      this._onLeave = function () { self._resume(); };
      this.root.addEventListener("mouseenter", this._onEnter);
      this.root.addEventListener("mouseleave", this._onLeave);
    }

    if (!this.opts.drag) return;

    this.root.style.touchAction = "pan-y";
    this._drag = false;
    this._decided = false;

    this._onDown = function (e) {
      if (e.button != null && e.button !== 0) return;
      self._drag = true;
      self._decided = false;
      self._downX = e.clientX;
      self._downY = e.clientY;
      self._startPos = self.pos;
      self._startOffset = self.offset;
      self._tween = null;
      self._stop();
    };

    this._onMove = function (e) {
      if (!self._drag) return;
      var dx = e.clientX - self._downX;
      var dy = e.clientY - self._downY;
      if (!self._decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dy) > Math.abs(dx)) { self._drag = false; return; }
        self._decided = true;
      }
      if (e.cancelable) e.preventDefault();
      if (self.cont) {
        self.offset = self._wrap(self._startOffset - dx);   // the frame loop paints it
      } else if (!self.anim) {
        // live drag only in slide mode
        self.track.style.transition = "none";
        self.track.style.transform = "translate3d(" + (-self._startPos * self.step + dx) + "px,0,0)";
      }
    };

    this._onUp = function (e) {
      if (!self._drag) return;
      self._drag = false;
      var dx = (e.clientX != null ? e.clientX : self._downX) - self._downX;
      var swiped = self._decided && Math.abs(dx) > 40;

      if (self.cont) {
        // smooth mode carries on from here; snap mode settles on a centred slide
        if (self.snapOn) {
          // a swipe moves one slide from where the drag began; a nudge springs back
          var dirS = self._decided && Math.abs(dx) > 40 ? (dx < 0 ? 1 : -1) : 0;
          var target = dirS ? self._snapTarget(dirS, self._startOffset) : self._snapTarget(0);
          // keep the tween continuous with the (wrapped) current offset
          target += Math.round((self.offset - target) / self.setW) * self.setW;
          self._tween = { from: self.offset, to: target, start: 0, dur: self.opts.speed };
          self._holdUntil = 0;
        }
      } else if (self.anim) {
        if (swiped) (dx < 0 ? self.next() : self.prev());
      } else {
        if (swiped) {
          // FE-06: clamp the target in non-loop mode so dragging past the first/
          // last slide can't scroll blank space in; loop mode is left as-is.
          var dir = dx < 0 ? 1 : -1;
          self.pos = self.loop
            ? self._startPos + dir
            : Math.min(Math.max(0, self._startPos + dir), Math.max(0, self.count - self.perView));
        }
        else self.pos = self._startPos;
        self._setTransform(true);
        self._scheduleNormalize();
        self._updateDots();
      }

      var ap2 = self.opts.autoplay;
      if (ap2 && !ap2.disableOnInteraction) self._resume();
    };

    this.root.addEventListener("pointerdown", this._onDown);
    window.addEventListener("pointermove", this._onMove, { passive: false });
    window.addEventListener("pointerup", this._onUp);
    window.addEventListener("pointercancel", this._onUp);

    // FE-13: keep a ref so destroy() can remove this capture-phase root listener.
    this._onClickCapture = function (e) {
      if (self._decided) { e.preventDefault(); e.stopPropagation(); self._decided = false; }
    };
    this.root.addEventListener("click", this._onClickCapture, true);
  };

  proto.destroy = function () {
    this._stop();
    if (this._pauseLoop) this._pauseLoop();
    if (this._io) this._io.disconnect();
    if (this._mq && this._onMotion && this._mq.removeEventListener) this._mq.removeEventListener("change", this._onMotion);
    if (this._onHoverIn) this.root.removeEventListener("mouseenter", this._onHoverIn);
    if (this._onHoverOut) this.root.removeEventListener("mouseleave", this._onHoverOut);
    if (this._onFocusIn) this.root.removeEventListener("focusin", this._onFocusIn);
    if (this._onFocusOut) this.root.removeEventListener("focusout", this._onFocusOut);
    clearTimeout(this._normTimer);
    clearTimeout(this._rzTimer);
    clearTimeout(this._animTimer);
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("pointermove", this._onMove);
    window.removeEventListener("pointerup", this._onUp);
    window.removeEventListener("pointercancel", this._onUp);
    // FE-13: also remove the root-level listeners so a React remount on a reused
    // node doesn't stack duplicate handlers.
    if (this._onDown) this.root.removeEventListener("pointerdown", this._onDown);
    if (this._onClickCapture) this.root.removeEventListener("click", this._onClickCapture, true);
    if (this._onEnter) this.root.removeEventListener("mouseenter", this._onEnter);
    if (this._onLeave) this.root.removeEventListener("mouseleave", this._onLeave);
    if (this._ro) this._ro.disconnect();
    // FE-13: remove the injected arrow buttons / dots (their per-element click
    // listeners go away with the nodes) so controls aren't duplicated on re-init.
    if (this._controls) {
      for (var i = 0; i < this._controls.length; i++) {
        var el = this._controls[i];
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }
      this._controls = null;
    }
    this.dotsWrap = null;
    // Put the track back the way the page rendered it: clones out, real slides
    // in original order, no transform — so a re-init (or React) starts clean.
    if (!this.anim && this.track && this.reals) {
      var clones = this.track.querySelectorAll("[data-krousel-clone]");
      for (var c = 0; c < clones.length; c++) if (clones[c].parentNode === this.track) this.track.removeChild(clones[c]);
      for (var r = 0; r < this.reals.length; r++) this.track.appendChild(this.reals[r]);
      this.track.style.transform = "";
      this.track.style.transition = "";
    }
    this.root._krousel = null;
  };

  global.Krousel = Krousel;
})(window);
