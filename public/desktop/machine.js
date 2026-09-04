/* machine.js v1 - machine.txt, the site read back to you.
 *
 * MACHINE on the mascot pill opens one more window on the desk. The
 * window is an ordinary node on the ground: no overlay, no scrim, no
 * modal. HUMAN or Escape removes it and the page is exactly as it was.
 *
 * Loaded on demand by desktop.js (dynamic import), so a visitor who
 * never presses MACHINE never downloads it. It injects machine.css
 * itself for the same reason.
 *
 * The answers come from /api/machine, which assembles llms.txt, the
 * works catalogue and the live upcoming rows server side. Poem chips
 * still go to /api/chat so reverse.exe stays reverse.exe. Anything the
 * network refuses falls back to the poem lines the pill already speaks.
 */

/* Rewritten for singulars by scripts/sync-desktop.mjs. This surface is
   served from /singulars on another host, so the stylesheet is the copy
   beside this file and everything else - the endpoints, the site's own
   data files, the links the model writes - is an absolute URL back to
   halimmadi.com. Reached through halimmadi.com/singulars those calls are
   same-origin; reached at singulars.oulipo.xyz they are cross-origin and
   the window falls back to the poem lines until that origin is allowed. */
var SITE = "https://www.halimmadi.com";
var CSS_HREF = "/singulars/desktop/machine.css?v=1";
var ENDPOINT = SITE + "/api/machine";
var POEM_ENDPOINT = SITE + "/api/chat";

/* The FALLBACK_POEMS keys from Assets/js/terminal.js: the eight themes
   that already have a poem on this site. The poem chip draws from here
   so the machine window invents no new material. */
var THEMES = [
  "Liberation",
  "Distance",
  "Threshold",
  "Echo",
  "Salt",
  "Rain",
  "Memory",
  "Border",
];

/* the three themes as /works/ labels them, in the order /works/ shows */
var SECTION_ORDER = ["machine-poetry", "computer-theater", "net-art"];
var SECTION_LABELS = {
  "machine-poetry": "machine poetry",
  "computer-theater": "computer theater",
  "net-art": "net art",
};

var state = {
  win: null,
  host: null,
  log: null,
  meta: null,
  input: null,
  send: null,
  hints: null,
  history: [],
  streaming: false,
  offline: false,
  scrollY: 0,
  onClose: null,
  lines: [],
  lineStep: 0,
  keyHandler: null,
};

/* ── text ───────────────────────────────────────────────────── */
function sanitizeDashes(s) {
  return String(s == null ? "" : s).replace(/\s*[\u2014\u2013]\s*/g, " - ");
}

function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/* Renders one paragraph of model output. Markdown links of the shape
   [label](/path/) become real anchors; every other character is written
   as a text node, so nothing the model returns can inject markup. Only
   same-origin paths and https links are allowed to become anchors. */
var LINK_RE = /\[([^\]\n]{1,120})\]\((\/[^)\s]*|https:\/\/[^)\s]+)\)/g;
function renderInto(p, text) {
  var last = 0;
  var m;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(text))) {
    if (m.index > last) p.appendChild(document.createTextNode(text.slice(last, m.index)));
    var a = el("a", null, m[1]);
    a.setAttribute("href", m[2].charAt(0) === "/" ? SITE + m[2] : m[2]);
    if (m[2].indexOf("https://") === 0) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    }
    p.appendChild(a);
    last = m.index + m[0].length;
  }
  if (last < text.length) p.appendChild(document.createTextNode(text.slice(last)));
}

/* ── the window ─────────────────────────────────────────────── */
function injectCss() {
  if (document.querySelector('link[data-machine-css]')) return;
  var link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS_HREF;
  link.setAttribute("data-machine-css", "");
  document.head.appendChild(link);
}

function turn(who, cls) {
  var row = el("div", "mx__turn mx__turn--" + who);
  row.appendChild(el("span", "k", who === "you" ? "you" : "machine"));
  var body = el("div", "mx__body" + (cls ? " " + cls : ""));
  row.appendChild(body);
  return { row: row, body: body };
}

function build() {
  var win = el("section", "win mx");
  win.setAttribute("data-machine-window", "");
  win.setAttribute("aria-label", "machine");

  var bar = el("div", "win__bar");
  var dots = el("span", "dots");
  dots.appendChild(el("i"));
  dots.appendChild(el("i"));
  dots.appendChild(el("i"));
  bar.appendChild(dots);
  bar.appendChild(el("p", "win__t", "machine.txt"));
  var meta = el("span", "win__meta", "listening");
  meta.setAttribute("data-mx-status", "");
  bar.appendChild(meta);
  win.appendChild(bar);

  var body = el("div", "win__b");
  var log = el("div", "mx__log");
  log.setAttribute("role", "log");
  log.setAttribute("aria-live", "polite");
  log.setAttribute("data-mx-log", "");
  body.appendChild(log);

  var hints = el("div", "mx__hints");
  hints.setAttribute("data-mx-hints", "");
  body.appendChild(hints);

  var form = el("form", "dk-input mx__ask");
  form.setAttribute("data-mx-form", "");
  var label = el("label");
  label.appendChild(el("span", null, "ask the machine"));
  var input = el("input");
  input.type = "text";
  input.name = "q";
  input.autocomplete = "off";
  input.placeholder = "what are you looking for";
  label.appendChild(input);
  form.appendChild(label);
  var send = el("button", "btn", "send");
  send.type = "submit";
  form.appendChild(send);
  body.appendChild(form);

  var foot = el("p", "note mx__foot");
  foot.appendChild(document.createTextNode("context: "));
  var a = el("a", null, "llms.txt");
  a.setAttribute("href", SITE + "/llms.txt");
  foot.appendChild(a);
  foot.appendChild(
    document.createTextNode(", the works file, and what is coming up. nothing is stored."),
  );
  body.appendChild(foot);

  win.appendChild(body);

  state.win = win;
  state.log = log;
  state.meta = meta;
  state.input = input;
  state.send = send;
  state.hints = hints;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    ask(input.value);
  });
  return win;
}

/* Desk pages get the window as the last thing on the ground, in the
   right band. Legacy .page pages get a bare .desk after the page so the
   window still sits on the ground rather than inside the document. */
function mount(win) {
  var desk = document.querySelector("main.desk, .desk");
  if (desk && !desk.classList.contains("mx__desk")) {
    win.classList.add("mx--side");
    desk.appendChild(win);
    state.host = null;
    return;
  }
  var host = el("section", "desk mx__desk");
  host.appendChild(win);
  var page = document.querySelector(".page");
  if (page && page.parentNode) page.parentNode.insertBefore(host, page.nextSibling);
  else {
    var footer = document.querySelector("footer.fb");
    if (footer && footer.parentNode) footer.parentNode.insertBefore(host, footer);
    else document.body.appendChild(host);
  }
  state.host = host;
}

/* ── status ─────────────────────────────────────────────────── */
function status(word, live) {
  if (!state.meta) return;
  state.meta.textContent = word;
  state.meta.classList.toggle("is-live", !!live);
  if (state.win) state.win.classList.toggle("is-offline", word === "offline");
}

function scrollLog() {
  if (state.log) state.log.scrollTop = state.log.scrollHeight;
}

function pushRule() {
  if (state.log && state.log.childNodes.length) state.log.appendChild(el("div", "rule"));
}

/* ── hints, generated from the site's own data ──────────────── */
function chip(text, onPick) {
  var b = el("button", "btn", text);
  b.type = "button";
  b.addEventListener("click", onPick);
  return b;
}

function fillHints() {
  if (!state.hints) return;
  state.hints.textContent = "";
  var add = function (text, fn) {
    state.hints.appendChild(chip(text, fn));
  };
  add("what is coming up", function () {
    ask("what is coming up");
  });
  add("read the cv", function () {
    go(SITE + "/cv/");
  });
  add("book a workshop", function () {
    go(SITE + "/connect/#start");
  });
  var theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  add("write me a poem about " + theme.toLowerCase(), function () {
    poem(theme);
  });

  /* the theme chips come from works.json, so a theme that empties out
     of the catalogue stops being offered. They land after "what is
     coming up", in the order /works/ lists them. */
  fetch(SITE + "/Assets/data/works.json", { cache: "force-cache" })
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(function (doc) {
      if (!doc || !state.hints) return;
      var seen = {};
      (doc.works || []).forEach(function (w) {
        if (w && w.section && SECTION_LABELS[w.section]) seen[w.section] = true;
      });
      var at = state.hints.children[1] || null;
      SECTION_ORDER.forEach(function (key) {
        if (!seen[key]) return;
        var label = SECTION_LABELS[key];
        state.hints.insertBefore(
          chip("which pieces are " + label, function () {
            ask("which pieces are " + label);
          }),
          at,
        );
      });
      reveal();
    })
    .catch(function () {
      /* the four standing chips are enough */
    });
}

function go(href) {
  window.location.href = href;
}

/* ── asking ─────────────────────────────────────────────────── */
function lockInput(locked) {
  state.streaming = locked;
  if (state.input) state.input.disabled = locked;
  if (state.send) state.send.disabled = locked;
}

function addYou(text) {
  pushRule();
  var t = turn("you");
  var p = el("p", "fr__w", text);
  t.body.appendChild(p);
  state.log.appendChild(t.row);
  scrollLog();
}

function addMachine(cls) {
  var t = turn("machine", cls);
  state.log.appendChild(t.row);
  scrollLog();
  return t.body;
}

/* Re-renders a machine turn from the raw text so far. Cheap at this
   size (400 tokens) and it keeps link parsing correct across chunk
   boundaries, which incremental parsing cannot. */
function paint(body, raw, streaming) {
  var text = sanitizeDashes(raw);
  body.textContent = "";
  var paras = text.split(/\n{2,}/);
  var last = null;
  for (var i = 0; i < paras.length; i++) {
    var chunk = paras[i].replace(/\n/g, " ").trim();
    if (!chunk && paras.length > 1) continue;
    var p = el("p", "prose");
    renderInto(p, chunk);
    body.appendChild(p);
    last = p;
  }
  if (!last) {
    last = el("p", "prose");
    body.appendChild(last);
  }
  if (streaming) {
    var dot = el("i", "cdot mx__cdot--live");
    dot.style.setProperty("--c", "var(--acc)");
    last.appendChild(dot);
  }
  scrollLog();
}

function handleSseLine(line, onChunk) {
  var trimmed = line.trim();
  if (!trimmed || trimmed.charAt(0) === ":") return;
  if (trimmed.indexOf("data:") !== 0) return;
  var data = trimmed.slice(5).trim();
  if (!data || data === "[DONE]") return;
  try {
    var jsonFrame = JSON.parse(data);
    var delta = jsonFrame.choices && jsonFrame.choices[0] && jsonFrame.choices[0].delta;
    if (delta && delta.content) onChunk(delta.content);
  } catch (_) {
    /* keepalive or partial frame */
  }
}

function typewriter(text, msPerChar, onChunk) {
  return new Promise(function (resolve) {
    var i = 0;
    var iv = setInterval(function () {
      if (i >= text.length) {
        clearInterval(iv);
        resolve();
        return;
      }
      onChunk(text.charAt(i));
      i++;
    }, msPerChar);
  });
}

/* The offline voice is the voice the pill already has: one of the eight
   poem lines desktop.js cycles, typed out. No new copy. */
function fallback(body) {
  state.offline = true;
  status("offline", false);
  var pool = state.lines && state.lines.length ? state.lines : [];
  var raw = pool.length ? pool[state.lineStep++ % pool.length] : "";
  /* the pill's lines are "<face><two or more spaces><sentence>"; the
     face belongs to the pill, the sentence belongs to the transcript */
  var parts = String(raw).split(/\s{2,}/);
  var line = (parts[parts.length - 1] || "").trim() || String(raw).trim();
  var text = "couldn't load this one. it'll come back.\n\n" + line;
  var acc = "";
  return typewriter(text, 14, function (ch) {
    acc += ch;
    paint(body, acc, true);
  }).then(function () {
    paint(body, acc, false);
    lockInput(false);
    reveal();
  });
}

function stream(url, payload, body, onDone) {
  var acc = "";
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(function (r) {
      if (!r.ok) throw new Error("api " + r.status);
      if (!r.body) throw new Error("no stream");
      var reader = r.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";
      var onChunk = function (ch) {
        /* the meta only goes live once tokens are actually arriving */
        if (!acc) status("thinking", true);
        acc += ch;
        paint(body, acc, true);
      };
      return reader.read().then(function pump(result) {
        if (result.done) {
          if (buffer.trim()) handleSseLine(buffer.trim(), onChunk);
          return;
        }
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (var i = 0; i < lines.length; i++) handleSseLine(lines[i], onChunk);
        return reader.read().then(pump);
      });
    })
    .then(function () {
      if (!acc.trim()) throw new Error("empty");
      paint(body, acc, false);
      state.offline = false;
      status("listening", false);
      lockInput(false);
      reveal();
      if (onDone) onDone(sanitizeDashes(acc));
    })
    .catch(function () {
      return fallback(body);
    });
}

function ask(text) {
  var q = String(text || "").trim();
  if (!q || state.streaming) return;
  if (state.input) state.input.value = "";
  addYou(q);
  state.history.push({ role: "user", content: q });
  lockInput(true);
  status("thinking", true);
  var body = addMachine();
  paint(body, "", true);
  return stream(ENDPOINT, { messages: state.history.slice(-8) }, body, function (answer) {
    state.history.push({ role: "assistant", content: answer });
  });
}

/* Poems keep going to /api/chat, unchanged: that endpoint is
   reverse.exe and its system prompt is the live show's brain. */
function poem(theme) {
  if (state.streaming) return;
  var q = "write me a poem about " + theme.toLowerCase();
  addYou(q);
  lockInput(true);
  status("thinking", true);
  var body = addMachine("mx__body--poem");
  paint(body, "", true);
  return stream(
    POEM_ENDPOINT,
    { messages: [{ role: "user", content: "Write a short poem about " + theme + "." }] },
    body,
    null,
  );
}

/* The mascot pill is fixed to the bottom of the screen, so the ask row
   has to land above it rather than under it. The transcript scrolls
   inside itself, so the window keeps its height and one scroll on open
   holds for the whole session. */
var PILL_CLEARANCE = 96;
function reveal() {
  var win = state.win;
  if (!win || !win.isConnected) return;
  var vh = window.innerHeight || 800;
  var form = win.querySelector("[data-mx-form]");
  var rect = (form || win).getBoundingClientRect();
  /* already in reach and clear of the pill: leave the page alone */
  if (rect.top >= 0 && rect.bottom <= vh - PILL_CLEARANCE) return;
  var top = Math.max(0, (window.scrollY || 0) + rect.bottom - (vh - PILL_CLEARANCE));
  try {
    window.scrollTo({ top: top, behavior: "smooth" });
  } catch (_) {
    window.scrollTo(0, top);
  }
}

/* ── open / close ───────────────────────────────────────────── */
export function open(opts) {
  opts = opts || {};
  state.onClose = opts.onClose || null;
  state.lines = opts.lines || state.lines;
  injectCss();

  if (state.win && state.win.isConnected) {
    if (state.input) state.input.focus();
    return;
  }
  state.scrollY = window.scrollY || 0;
  var win = build();
  mount(win);
  fillHints();

  if (state.history.length) {
    /* the session's transcript survives closing and reopening */
    for (var i = 0; i < state.history.length; i++) {
      var m = state.history[i];
      if (m.role === "user") addYou(m.content);
      else paint(addMachine(), m.content, false);
    }
  } else {
    var first = addMachine();
    paint(first, "read this site the way an agent would: slowly, link by link.", false);
  }
  status(state.offline ? "offline" : "listening", false);

  state.keyHandler = function (e) {
    if (e.key !== "Escape") return;
    if (!state.win || !state.win.isConnected) return;
    close();
    if (state.onClose) state.onClose();
  };
  document.addEventListener("keydown", state.keyHandler);

  /* two frames: the greeting is painted, then the chips arrive from
     works.json and the window settles at its real height */
  requestAnimationFrame(function () {
    requestAnimationFrame(reveal);
  });
  if (state.input) state.input.focus({ preventScroll: true });
}

export function close() {
  if (state.keyHandler) {
    document.removeEventListener("keydown", state.keyHandler);
    state.keyHandler = null;
  }
  var node = state.host || state.win;
  if (node && node.parentNode) node.parentNode.removeChild(node);
  state.win = null;
  state.host = null;
  state.log = null;
  state.meta = null;
  state.input = null;
  state.send = null;
  state.hints = null;
  state.streaming = false;
  window.scrollTo(0, state.scrollY);
}

export default { open: open, close: close };
