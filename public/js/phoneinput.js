/**
 * PhoneInput — a small, self-contained international phone country-code picker.
 *
 * Written to REPLACE the third-party intl-tel-input library, which double-
 * initialised under React StrictMode and left stacked flag dropdowns and a
 * bumped `data-intl-tel-input-id` on the same input. This plugin owns no global
 * counter, is idempotent, and cleans up after itself.
 *
 * What it does, matching the old behaviour the forms rely on:
 *   - shows a flag button on the left of `#phone` with a searchable country list
 *   - keeps the hidden `#fullphone` field = "+" + dialCode + digits(phone)
 *   - keeps the hidden `#country_code` field = selected iso2
 *
 * It auto-initialises every `form.enrol #phone, form.contact #phone,
 * form.decidecareer #phone` on load and watches the DOM for late-mounted ones
 * (e.g. the career modal), so no per-page wiring is needed. Calling init twice
 * on the same input is a no-op.
 *
 * Public API:  PhoneInput.init(inputEl, opts) | PhoneInput.initAll()
 */
(function (global) {
  "use strict";

  if (global.PhoneInput) return; // already loaded once

  /* iso2, country name, dial code */
  var COUNTRIES = [
    ["af", "Afghanistan", "93"], ["al", "Albania", "355"], ["dz", "Algeria", "213"], ["ad", "Andorra", "376"],
    ["ao", "Angola", "244"], ["ag", "Antigua and Barbuda", "1268"], ["ar", "Argentina", "54"], ["am", "Armenia", "374"],
    ["aw", "Aruba", "297"], ["au", "Australia", "61"], ["at", "Austria", "43"], ["az", "Azerbaijan", "994"],
    ["bs", "Bahamas", "1242"], ["bh", "Bahrain", "973"], ["bd", "Bangladesh", "880"], ["bb", "Barbados", "1246"],
    ["by", "Belarus", "375"], ["be", "Belgium", "32"], ["bz", "Belize", "501"], ["bj", "Benin", "229"],
    ["bt", "Bhutan", "975"], ["bo", "Bolivia", "591"], ["ba", "Bosnia and Herzegovina", "387"], ["bw", "Botswana", "267"],
    ["br", "Brazil", "55"], ["bn", "Brunei", "673"], ["bg", "Bulgaria", "359"], ["bf", "Burkina Faso", "226"],
    ["bi", "Burundi", "257"], ["kh", "Cambodia", "855"], ["cm", "Cameroon", "237"], ["ca", "Canada", "1"],
    ["cv", "Cape Verde", "238"], ["cf", "Central African Republic", "236"], ["td", "Chad", "235"], ["cl", "Chile", "56"],
    ["cn", "China", "86"], ["co", "Colombia", "57"], ["km", "Comoros", "269"], ["cd", "Congo (DRC)", "243"],
    ["cg", "Congo (Republic)", "242"], ["cr", "Costa Rica", "506"], ["ci", "Côte d’Ivoire", "225"], ["hr", "Croatia", "385"],
    ["cu", "Cuba", "53"], ["cy", "Cyprus", "357"], ["cz", "Czech Republic", "420"], ["dk", "Denmark", "45"],
    ["dj", "Djibouti", "253"], ["dm", "Dominica", "1767"], ["do", "Dominican Republic", "1809"], ["ec", "Ecuador", "593"],
    ["eg", "Egypt", "20"], ["sv", "El Salvador", "503"], ["gq", "Equatorial Guinea", "240"], ["er", "Eritrea", "291"],
    ["ee", "Estonia", "372"], ["sz", "Eswatini", "268"], ["et", "Ethiopia", "251"], ["fj", "Fiji", "679"],
    ["fi", "Finland", "358"], ["fr", "France", "33"], ["ga", "Gabon", "241"], ["gm", "Gambia", "220"],
    ["ge", "Georgia", "995"], ["de", "Germany", "49"], ["gh", "Ghana", "233"], ["gr", "Greece", "30"],
    ["gd", "Grenada", "1473"], ["gt", "Guatemala", "502"], ["gn", "Guinea", "224"], ["gw", "Guinea-Bissau", "245"],
    ["gy", "Guyana", "592"], ["ht", "Haiti", "509"], ["hn", "Honduras", "504"], ["hk", "Hong Kong", "852"],
    ["hu", "Hungary", "36"], ["is", "Iceland", "354"], ["in", "India", "91"], ["id", "Indonesia", "62"],
    ["ir", "Iran", "98"], ["iq", "Iraq", "964"], ["ie", "Ireland", "353"], ["il", "Israel", "972"],
    ["it", "Italy", "39"], ["jm", "Jamaica", "1876"], ["jp", "Japan", "81"], ["jo", "Jordan", "962"],
    ["kz", "Kazakhstan", "7"], ["ke", "Kenya", "254"], ["ki", "Kiribati", "686"], ["kw", "Kuwait", "965"],
    ["kg", "Kyrgyzstan", "996"], ["la", "Laos", "856"], ["lv", "Latvia", "371"], ["lb", "Lebanon", "961"],
    ["ls", "Lesotho", "266"], ["lr", "Liberia", "231"], ["ly", "Libya", "218"], ["li", "Liechtenstein", "423"],
    ["lt", "Lithuania", "370"], ["lu", "Luxembourg", "352"], ["mo", "Macau", "853"], ["mg", "Madagascar", "261"],
    ["mw", "Malawi", "265"], ["my", "Malaysia", "60"], ["mv", "Maldives", "960"], ["ml", "Mali", "223"],
    ["mt", "Malta", "356"], ["mh", "Marshall Islands", "692"], ["mr", "Mauritania", "222"], ["mu", "Mauritius", "230"],
    ["mx", "Mexico", "52"], ["fm", "Micronesia", "691"], ["md", "Moldova", "373"], ["mc", "Monaco", "377"],
    ["mn", "Mongolia", "976"], ["me", "Montenegro", "382"], ["ma", "Morocco", "212"], ["mz", "Mozambique", "258"],
    ["mm", "Myanmar", "95"], ["na", "Namibia", "264"], ["nr", "Nauru", "674"], ["np", "Nepal", "977"],
    ["nl", "Netherlands", "31"], ["nz", "New Zealand", "64"], ["ni", "Nicaragua", "505"], ["ne", "Niger", "227"],
    ["ng", "Nigeria", "234"], ["kp", "North Korea", "850"], ["mk", "North Macedonia", "389"], ["no", "Norway", "47"],
    ["om", "Oman", "968"], ["pk", "Pakistan", "92"], ["pw", "Palau", "680"], ["ps", "Palestine", "970"],
    ["pa", "Panama", "507"], ["pg", "Papua New Guinea", "675"], ["py", "Paraguay", "595"], ["pe", "Peru", "51"],
    ["ph", "Philippines", "63"], ["pl", "Poland", "48"], ["pt", "Portugal", "351"], ["qa", "Qatar", "974"],
    ["ro", "Romania", "40"], ["ru", "Russia", "7"], ["rw", "Rwanda", "250"], ["kn", "Saint Kitts and Nevis", "1869"],
    ["lc", "Saint Lucia", "1758"], ["vc", "Saint Vincent and the Grenadines", "1784"], ["ws", "Samoa", "685"], ["sm", "San Marino", "378"],
    ["sa", "Saudi Arabia", "966"], ["sn", "Senegal", "221"], ["rs", "Serbia", "381"], ["sc", "Seychelles", "248"],
    ["sl", "Sierra Leone", "232"], ["sg", "Singapore", "65"], ["sk", "Slovakia", "421"], ["si", "Slovenia", "386"],
    ["sb", "Solomon Islands", "677"], ["so", "Somalia", "252"], ["za", "South Africa", "27"], ["kr", "South Korea", "82"],
    ["ss", "South Sudan", "211"], ["es", "Spain", "34"], ["lk", "Sri Lanka", "94"], ["sd", "Sudan", "249"],
    ["sr", "Suriname", "597"], ["se", "Sweden", "46"], ["ch", "Switzerland", "41"], ["sy", "Syria", "963"],
    ["tw", "Taiwan", "886"], ["tj", "Tajikistan", "992"], ["tz", "Tanzania", "255"], ["th", "Thailand", "66"],
    ["tl", "Timor-Leste", "670"], ["tg", "Togo", "228"], ["to", "Tonga", "676"], ["tt", "Trinidad and Tobago", "1868"],
    ["tn", "Tunisia", "216"], ["tr", "Turkey", "90"], ["tm", "Turkmenistan", "993"], ["tv", "Tuvalu", "688"],
    ["ug", "Uganda", "256"], ["ua", "Ukraine", "380"], ["ae", "United Arab Emirates", "971"], ["gb", "United Kingdom", "44"],
    ["us", "United States", "1"], ["uy", "Uruguay", "598"], ["uz", "Uzbekistan", "998"], ["vu", "Vanuatu", "678"],
    ["va", "Vatican City", "379"], ["ve", "Venezuela", "58"], ["vn", "Vietnam", "84"], ["ye", "Yemen", "967"],
    ["zm", "Zambia", "260"], ["zw", "Zimbabwe", "263"]
  ];

  var PREFERRED_DEFAULT = ["us", "gb", "in"];
  var SELECTOR = "form.enrol #phone, form.contact #phone, form.decidecareer #phone, form.wkform #phone, form.adminphone #phone, form.certreq #phone, form.careerapply #phone";

  function flagUrl(iso2) {
    return "https://flagcdn.com/40x30/" + iso2 + ".png";
  }

  function byIso(iso2) {
    iso2 = (iso2 || "").toLowerCase();
    if (iso2 === "uk") iso2 = "gb";
    for (var i = 0; i < COUNTRIES.length; i++) {
      if (COUNTRIES[i][0] === iso2) return COUNTRIES[i];
    }
    return null;
  }

  function digits(s) { return (s || "").replace(/\D/g, ""); }

  // Set a value on a (possibly React-controlled) input and fire "input" so
  // frameworks that track the value through a property setter update state.
  function setNativeValue(el, value) {
    try {
      var proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
      var desc = proto && Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && desc.set) desc.set.call(el, value);
      else el.value = value;
    } catch (e) { el.value = value; }
    var ev;
    try { ev = new Event("input", { bubbles: true }); }
    catch (e2) { ev = document.createEvent("Event"); ev.initEvent("input", true, false); }
    el.dispatchEvent(ev);
  }

  function matchCountry(c, q) {
    if (!q) return true;
    var name = c[1].toLowerCase();
    var dial = c[2];
    var qd = q.replace(/\D/g, "");
    if (name.indexOf(q) > -1) return true;
    if (qd && dial.indexOf(qd) === 0) return true;
    if (q.charAt(0) === "+" && ("+" + dial).indexOf(q) === 0) return true;
    return false;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  /* ---------------------------------------------------------------- instance */
  function PhoneInput(input, opts) {
    this.input = input;
    this.opts = opts || {};
    this.preferred = (this.opts.preferredCountries || PREFERRED_DEFAULT).map(function (c) {
      return c === "uk" ? "gb" : String(c).toLowerCase();
    });
    this.current = byIso(this.opts.initialCountry || "us") || byIso("us");
    this._build();
    this.select(this.current[0], true); // silent — sets flag + hidden fields
    this._hydrate(); // parse any pre-filled international number (edit forms)
  }

  // If the field already holds an international number (e.g. editing a saved
  // record: "+918555925111"), detect the country from its dial code, select
  // that country, and strip the code so the input shows only the national part
  // (8555925111). Dispatches a native "input" event so a React-controlled
  // <input value={...}> updates its state to match.
  PhoneInput.prototype._hydrate = function () {
    var raw = (this.input.value || "").trim();
    if (raw.charAt(0) !== "+") return; // nothing to parse for national/empty
    var d = raw.replace(/\D/g, "");
    var best = null;
    for (var i = 0; i < COUNTRIES.length; i++) {
      var dc = String(COUNTRIES[i][2]);
      if (dc && d.indexOf(dc) === 0 &&
        (!best || dc.length > String(best[2]).length)) best = COUNTRIES[i];
    }
    if (!best) return;
    var national = d.slice(String(best[2]).length);
    setNativeValue(this.input, national);
    this.select(best[0], true); // sets flag + resyncs hidden fields to national
  };

  PhoneInput.prototype._build = function () {
    var self = this, input = this.input, doc = document;

    var wrap = doc.createElement("div");
    wrap.className = "pi-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    this.wrap = wrap;

    var btn = doc.createElement("div");
    btn.className = "pi-selected";
    btn.setAttribute("tabindex", "0");
    btn.setAttribute("role", "button");
    btn.setAttribute("aria-label", "Select country");
    var flag = doc.createElement("img");
    flag.className = "pi-flag-img";
    flag.alt = "";
    flag.onerror = function () { this.style.visibility = "hidden"; };
    var caret = doc.createElement("span");
    caret.className = "pi-caret";
    btn.appendChild(flag);
    btn.appendChild(caret);
    wrap.insertBefore(btn, input);
    this.btn = btn;
    this.flag = flag;

    var dd = doc.createElement("div");
    dd.className = "pi-dropdown";
    var search = doc.createElement("input");
    search.type = "text";
    search.className = "pi-search";
    search.placeholder = "Search country";
    search.setAttribute("autocomplete", "off");
    var list = doc.createElement("ul");
    list.className = "pi-list";
    dd.appendChild(search);
    dd.appendChild(list);
    wrap.appendChild(dd);
    this.dd = dd;
    this.search = search;
    this.list = list;
    this._renderList("");

    btn.addEventListener("click", function (e) { e.stopPropagation(); self.toggle(); });
    btn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.toggle(); }
      else if (e.key === "Escape") self.close();
    });
    search.addEventListener("click", function (e) { e.stopPropagation(); });
    search.addEventListener("input", function () { self._renderList(search.value); });
    list.addEventListener("click", function (e) {
      var li = e.target.closest ? e.target.closest("li[data-iso2]") : null;
      if (!li) return;
      self.select(li.getAttribute("data-iso2"));
      self.close();
      input.focus();
    });
    this._onDocClick = function (e) { if (!wrap.contains(e.target)) self.close(); };
    document.addEventListener("click", this._onDocClick);

    // Keep #fullphone live as the user types the number.
    this._onInput = function () { self.sync(); };
    input.addEventListener("input", this._onInput);

    // Scope the hidden-field lookup to THIS widget's own form (or nearest
    // [data-phone-scope] container). Several phone widgets can coexist on one
    // page (e.g. the global career modal plus a page's own form). A document-wide
    // getElementById("fullphone") returns only the FIRST match, so every widget
    // would write into the same form and corrupt the other forms' leads.
    // Resolving by name WITHIN the form binds each widget to its own fields.
    // A [data-phone-scope] box around the input comes first: a form with several
    // phone fields (e.g. the website's custom forms) gives each its own box with
    // its own hidden fields.
    var form = input.closest ? input.closest("form") : null;
    var scope = (input.closest ? input.closest("[data-phone-scope]") : null) || form;
    this.form = form;
    this.fullEl = scope ? scope.querySelector('[name="fullphone"]') : null;
    this.ccEl = scope ? scope.querySelector('[name="country_code"]') : null;

    // Authoritative resync in the capture phase so it runs BEFORE React's own
    // submit handler reads the hidden field.
    if (form) {
      this._onSubmit = function () { self.sync(); };
      form.addEventListener("submit", this._onSubmit, true);
    }
  };

  PhoneInput.prototype._renderList = function (q) {
    q = (q || "").trim().toLowerCase();
    var self = this, list = this.list, count = 0;
    list.innerHTML = "";

    function row(c, pref) {
      var li = document.createElement("li");
      li.setAttribute("data-iso2", c[0]);
      li.className = "pi-item" + (pref ? " pi-pref" : "") + (c[0] === self.current[0] ? " pi-active" : "");
      li.innerHTML =
        '<img class="pi-flag-img" src="' + flagUrl(c[0]) + '" alt="" ' +
        'onerror="this.style.visibility=\'hidden\'">' +
        '<span class="pi-name">' + escapeHtml(c[1]) + '</span>' +
        '<span class="pi-dial-code">+' + c[2] + '</span>';
      list.appendChild(li);
      count++;
    }

    if (!q) {
      this.preferred.forEach(function (iso) { var c = byIso(iso); if (c) row(c, true); });
      var div = document.createElement("li");
      div.className = "pi-divider";
      list.appendChild(div);
    }

    COUNTRIES.forEach(function (c) { if (matchCountry(c, q)) row(c, false); });

    if (count === 0) {
      var empty = document.createElement("li");
      empty.className = "pi-empty";
      empty.textContent = "No countries found";
      list.appendChild(empty);
    }
  };

  PhoneInput.prototype.select = function (iso2, silent) {
    var c = byIso(iso2);
    if (!c) return;
    this.current = c;
    this.flag.src = flagUrl(c[0]);
    this.flag.style.visibility = "";
    this.btn.title = c[1] + " (+" + c[2] + ")";
    this.sync();
    if (!silent) {
      this._renderList(this.search ? this.search.value : "");
      if (typeof this.opts.onChange === "function") this.opts.onChange(this.info());
    }
  };

  // Write into THIS widget's own hidden fields (resolved per-form at init) so
  // two phone widgets on the same page never clobber each other's values.
  // Falls back to a document-wide lookup only if no scoped field was found.
  PhoneInput.prototype.sync = function () {
    var num = digits(this.input.value);
    var full = this.fullEl || document.getElementById("fullphone");
    var cc = this.ccEl || document.getElementById("country_code");
    if (full) full.value = "+" + this.current[2] + num;
    if (cc) cc.value = this.current[0];
  };

  PhoneInput.prototype.info = function () {
    var num = digits(this.input.value);
    return { iso2: this.current[0], dial: this.current[2], number: num, fullNumber: "+" + this.current[2] + num };
  };

  PhoneInput.prototype.toggle = function () {
    this.wrap.classList.contains("pi-open") ? this.close() : this.open();
  };

  PhoneInput.prototype.open = function () {
    var self = this;
    document.querySelectorAll(".pi-wrap.pi-open").forEach(function (w) {
      if (w !== self.wrap) w.classList.remove("pi-open");
    });
    this.wrap.classList.add("pi-open");
    this.search.value = "";
    this._renderList("");
    // Open upward when the list would run off the bottom of the screen (e.g. a
    // phone field near the foot of a popup) and there is more room above.
    this.wrap.classList.remove("pi-up");
    var rect = this.wrap.getBoundingClientRect();
    var need = this.dd.offsetHeight + 12;
    var below = window.innerHeight - rect.bottom, above = rect.top;
    if (below < need && above > below) this.wrap.classList.add("pi-up");
    setTimeout(function () { self.search.focus(); }, 0);
    var active = this.list.querySelector(".pi-active");
    if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
  };

  PhoneInput.prototype.close = function () {
    this.wrap.classList.remove("pi-open");
  };

  /* ---------------------------------------------------------------- bootstrap */
  function initOne(input, opts) {
    if (!input || input._phoneInput) return input && input._phoneInput;
    input.dataset.piInit = "1";
    try {
      input._phoneInput = new PhoneInput(input, opts || {
        initialCountry: "us",
        preferredCountries: PREFERRED_DEFAULT,
      });
    } catch (e) {
      input.dataset.piInit = "";       // allow a later retry
      if (global.console) console.error("PhoneInput init error:", e);
    }
    return input._phoneInput;
  }

  function initAll() {
    var nodes = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < nodes.length; i++) initOne(nodes[i]);
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () { scheduled = false; initAll(); }, 50);
  }

  function start() {
    initAll();
    // The career modal (and React remounts) inject the phone field after load —
    // watch for it and initialise on the fly. Idempotent, so this is safe.
    if (global.MutationObserver) {
      new MutationObserver(schedule).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  global.PhoneInput = { init: initOne, initAll: initAll, countries: COUNTRIES };
})(window);
