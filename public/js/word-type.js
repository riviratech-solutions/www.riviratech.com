/*!
 * WordTyper v1.1.0 — a typing effect that reveals text one word or one character
 * at a time. No dependencies. UMD. MIT licence.
 * <h1 data-word-typer data-mode="char" data-loop="true">Ready when you are</h1>
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.WordTyper = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DEFAULTS = {
    strings: null,          // array of sentences. Falls back to the element's own text.
    mode: 'word',           // 'word' or 'char'
    speed: null,            // ms per unit. Unset: 170 in word mode, 45 in char mode.
    deleteSpeed: null,      // ms per unit while erasing. Unset: 70 / 25.
    startDelay: 300,        // wait before the first unit
    pause: 1600,            // hold time on a finished sentence
    loopDelay: 400,         // extra wait before the list restarts
    loop: false,
    shuffle: false,
    smartBackspace: true,   // keep the opening words/characters two sentences share
    humanize: 0,            // 0–1, random variance on every delay
    cursor: true,
    cursorChar: '|',
    autoStart: true,
    onUnit: null,           // (unit, index, instance) — a word or a character
    onSentence: null,       // (sentence, index, instance)
    onComplete: null        // (instance)
  };

  var AUTO = {
    word: { speed: 170, deleteSpeed: 70 },
    char: { speed: 45, deleteSpeed: 25 }
  };

  var STYLE_ID = 'word-typer-css';
  var CSS = [
    '.wt{display:inline}',
    '.wt-unit{display:inline-block}',
    /* whole words fade up as they land; single characters just appear, the way
       a typewriter does — an animation per character reads as flicker */
    '.wt-word{animation:wt-in 260ms ease both}',
    '.wt-char{white-space:pre}',
    '.wt-group{display:inline-block;white-space:pre}',
    '.wt-cursor{display:inline-block;margin-left:.08em;animation:wt-blink 1.05s steps(1) infinite}',
    '.wt-cursor[data-idle="true"]{animation-duration:1.8s}',
    '.wt-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;',
    'clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}',
    '@keyframes wt-in{from{opacity:0;transform:translateY(.28em)}to{opacity:1;transform:none}}',
    '@keyframes wt-blink{50%{opacity:0}}',
    '@media (prefers-reduced-motion:reduce){.wt-word{animation:none}.wt-cursor{animation:none}}'
  ].join('');

  function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    var tag = document.createElement('style');
    tag.id = STYLE_ID;
    tag.textContent = CSS;
    document.head.appendChild(tag);
  }

  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      for (var key in src) {
        if (Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) {
          target[key] = src[key];
        }
      }
    }
    return target;
  }

  // Splits a sentence into the units this instance types.
  function split(sentence, mode) {
    var text = String(sentence).trim();
    if (mode !== 'char') return text.split(/\s+/).filter(Boolean);
    // Array.from keeps emoji and accented pairs in one piece
    return typeof Array.from === 'function' ? Array.from(text) : text.split('');
  }

  function sharedLead(a, b) {
    var i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
  }

  function shuffle(list) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  function WordTyper(element, options) {
    if (!(this instanceof WordTyper)) return new WordTyper(element, options);

    this.el = typeof element === 'string' ? document.querySelector(element) : element;
    if (!this.el) throw new Error('WordTyper: no element matched "' + element + '"');

    this.options = assign({}, DEFAULTS, options || {});
    this._autoSpeed = this.options.speed == null;
    this._autoDeleteSpeed = this.options.deleteSpeed == null;
    this._char = this.options.mode === 'char';
    this._applyAutoSpeed();
    injectStyles();

    var source = this.options.strings;
    if (!source || !source.length) source = this.el.textContent.split('|');
    this.setStrings(source, true);

    this.el.classList.add('wt');
    this.el.textContent = '';

    this._live = document.createElement('span');
    this._live.className = 'wt-sr';
    this._box = document.createElement('span');
    this._box.setAttribute('aria-hidden', 'true');
    this.el.appendChild(this._live);
    this.el.appendChild(this._box);
    if (this.options.cursor) this._addCursor();

    this._index = 0;
    this._shown = [];
    this._group = null;
    this._keep = 0;
    this._phase = 'idle';
    this._timer = null;
    this._paused = false;
    this._destroyed = false;

    if (this.options.autoStart) this.start();
  }

  WordTyper.prototype = {

    /* ---------- public API ---------- */

    start: function () {
      if (this._destroyed || this._phase !== 'idle') return this;
      this._paused = false;
      this._phase = 'typing';
      this._wait(this.options.startDelay);
      return this;
    },

    pause: function () {
      this._paused = true;
      clearTimeout(this._timer);
      this._setIdleCursor(true);
      return this;
    },

    resume: function () {
      if (this._destroyed || !this._paused || this._phase === 'idle') return this;
      this._paused = false;
      this._setIdleCursor(false);
      this._step();
      return this;
    },

    toggle: function () {
      return this._paused ? this.resume() : this.pause();
    },

    reset: function (restart) {
      clearTimeout(this._timer);
      this._index = 0;
      this._shown = [];
      this._keep = 0;
      this._paused = false;
      this._phase = 'idle';
      this._clearUnits();
      if (restart !== false) this.start();
      return this;
    },

    setStrings: function (strings, silent) {
      var list = Array.isArray(strings) ? strings : [strings];
      this.strings = list.map(function (s) { return String(s).trim(); }).filter(Boolean);
      this._plan = this.options.shuffle ? shuffle(this.strings) : this.strings.slice();
      if (!silent) this.reset(true);
      return this;
    },

    // Switch between typing words and typing characters while running.
    setMode: function (mode) {
      if (mode !== 'char' && mode !== 'word' || mode === this.options.mode) return this;
      this.options.mode = mode;
      this._char = mode === 'char';
      this._applyAutoSpeed();
      return this.reset(true);
    },

    isRunning: function () {
      return this._phase !== 'idle' && !this._paused;
    },

    destroy: function (keepText) {
      clearTimeout(this._timer);
      this._destroyed = true;
      this._phase = 'idle';
      var text = this._text();
      this.el.classList.remove('wt');
      this.el.textContent = keepText ? text : '';
      return this;
    },

    /* ---------- internals ---------- */

    _applyAutoSpeed: function () {
      var auto = AUTO[this._char ? 'char' : 'word'];
      if (this._autoSpeed) this.options.speed = auto.speed;
      if (this._autoDeleteSpeed) this.options.deleteSpeed = auto.deleteSpeed;
    },

    _addCursor: function () {
      this._cursor = document.createElement('span');
      this._cursor.className = 'wt-cursor';
      this._cursor.setAttribute('aria-hidden', 'true');
      this._cursor.textContent = this.options.cursorChar;
      this.el.appendChild(this._cursor);
    },

    _target: function () {
      return split(this._plan[this._index] || '', this.options.mode);
    },

    _text: function () {
      return this._shown.join(this._char ? '' : ' ');
    },

    _wait: function (ms) {
      var self = this;
      clearTimeout(this._timer);
      var jitter = this.options.humanize
        ? ms * this.options.humanize * (Math.random() - 0.5) * 2
        : 0;
      this._timer = setTimeout(function () { self._step(); }, Math.max(0, ms + jitter));
    },

    _step: function () {
      if (this._destroyed || this._paused) return;
      if (this._phase === 'typing') return this._type();
      if (this._phase === 'holding') return this._afterHold();
      if (this._phase === 'deleting') return this._delete();
    },

    _type: function () {
      var target = this._target();

      if (this._shown.length < target.length) {
        var unit = target[this._shown.length];
        this._shown.push(unit);
        this._appendUnit(unit);
        var onUnit = this.options.onUnit || this.options.onWord;
        if (onUnit) onUnit(unit, this._shown.length - 1, this);
        return this._wait(this.options.speed);
      }

      if (this.options.onSentence) {
        this.options.onSentence(this._plan[this._index], this._index, this);
      }

      if (this._index === this._plan.length - 1 && !this.options.loop) {
        this._phase = 'idle';
        this._setIdleCursor(true);
        if (this.options.onComplete) this.options.onComplete(this);
        return;
      }

      this._phase = 'holding';
      this._setIdleCursor(true);
      this._wait(this.options.pause);
    },

    _afterHold: function () {
      var next = split(this._plan[(this._index + 1) % this._plan.length], this.options.mode);
      this._keep = this.options.smartBackspace ? sharedLead(this._shown, next) : 0;
      this._phase = 'deleting';
      this._setIdleCursor(false);
      this._step();
    },

    _delete: function () {
      if (this._shown.length > this._keep) {
        this._shown.pop();
        this._popUnit();
        return this._wait(this.options.deleteSpeed);
      }
      var wrapped = this._index === this._plan.length - 1;
      this._index = wrapped ? 0 : this._index + 1;
      if (wrapped && this.options.shuffle) this._plan = shuffle(this.strings);
      this._phase = 'typing';
      this._wait(wrapped ? this.options.loopDelay : this.options.speed);
    },

    _setIdleCursor: function (idle) {
      if (this._cursor) this._cursor.setAttribute('data-idle', idle ? 'true' : 'false');
    },

    _span: function (className, text) {
      var span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      return span;
    },

    /* Units are added and removed one node at a time. Rebuilding the whole line
       would restart the entry animation on every unit already on screen, which
       reads as the line flickering.
       In char mode the characters of a word live inside a .wt-group wrapper so a
       long line still breaks between words, never in the middle of one. */
    _appendUnit: function (unit) {
      var box = this._box;
      if (!this._char) {
        if (box.firstChild) box.appendChild(document.createTextNode(' '));
        box.appendChild(this._span('wt-unit wt-word', unit));
      } else if (/\s/.test(unit)) {
        box.appendChild(document.createTextNode(unit));
        this._group = null;
      } else {
        if (!this._group) {
          this._group = this._span('wt-group', '');
          box.appendChild(this._group);
        }
        this._group.appendChild(this._span('wt-unit wt-char', unit));
      }
      this._syncLive();
    },

    _popUnit: function () {
      var box = this._box, last = box.lastChild;
      if (!last) return this._syncLive();

      if (!this._char) {
        box.removeChild(last);
        if (box.lastChild && box.lastChild.nodeType === 3) box.removeChild(box.lastChild);
      } else if (last.nodeType === 3) {
        box.removeChild(last);
        this._group = box.lastChild && box.lastChild.nodeType === 1 ? box.lastChild : null;
      } else {
        last.removeChild(last.lastChild);
        if (!last.firstChild) {
          box.removeChild(last);
          this._group = null;
        } else {
          this._group = last;
        }
      }
      this._syncLive();
    },

    _clearUnits: function () {
      this._box.textContent = '';
      this._group = null;
      this._syncLive();
    },

    _syncLive: function () {
      this._live.textContent = this._text();
    }
  };

  /* ---------- markup-driven setup ---------- */

  function readOptions(el) {
    var d = el.dataset, opts = {};
    if (d.strings) {
      try { opts.strings = JSON.parse(d.strings); }
      catch (e) { opts.strings = d.strings.split('|'); }
    }
    ['speed', 'deleteSpeed', 'startDelay', 'pause', 'loopDelay', 'humanize'].forEach(function (k) {
      if (d[k] !== undefined) opts[k] = parseFloat(d[k]);
    });
    ['loop', 'shuffle', 'cursor', 'smartBackspace'].forEach(function (k) {
      if (d[k] !== undefined) opts[k] = d[k] !== 'false';
    });
    if (d.mode) opts.mode = d.mode;
    if (d.cursorChar) opts.cursorChar = d.cursorChar;
    return opts;
  }

  WordTyper.init = function (selector) {
    var nodes = document.querySelectorAll(selector || '[data-word-typer]');
    return Array.prototype.map.call(nodes, function (el) {
      if (el._wordTyper) return el._wordTyper;
      el._wordTyper = new WordTyper(el, readOptions(el));
      return el._wordTyper;
    });
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { WordTyper.init(); });
    } else {
      WordTyper.init();
    }
    if (window.jQuery) {
      window.jQuery.fn.wordTyper = function (options) {
        return this.each(function () { this._wordTyper = new WordTyper(this, options); });
      };
    }
  }

  WordTyper.version = '1.1.0';
  WordTyper.defaults = DEFAULTS;
  return WordTyper;
}));
