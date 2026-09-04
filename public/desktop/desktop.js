/* desktop.js v1 - shared behaviors for the desktop language.
   1. Mascot: the HUMAN / MACHINE toggle. MACHINE opens machine.txt,
      one more window on the desk, and keeps cycling the lines drawn
      from the reverse.exe poetry material (no invented copy). HUMAN
      closes the window and the page is as it was.
   2. Rotator: any .rot element cycles its child images every 5s.
   Progressive: with JS off the mascot sits quiet and the rotator
   shows its first image (mark it .is-on in markup). The machine
   window is a dynamic import, so nobody who stays HUMAN pays for it. */
(function () {
  // ── mascot ────────────────────────────────────────────────
  var LINES = [
    "( •_• )⌨   the door was never the door.",
    "( ◉_◉ )    same kettle, different country.",
    "[ ::|:: ]  whatever you forget to bring becomes a country.",
    "( •‿• )    the stairwell returns my name half a second late.",
    "( -_- )    the sea keeps a ledger of everyone who crossed it.",
    "(◑_◑)      every city i love has a smell it only confesses when wet.",
    "( •_• )⌨   the hallway still runs through me at night.",
    "( °o° )    the birds overhead practice a citizenship no office will print.",
  ];
  var mascot = document.querySelector("[data-mascot-root]");
  if (mascot) {
    var line = mascot.querySelector(".mascot__line");
    var humanBtn = mascot.querySelector("[data-mascot-human]");
    var machineBtn = mascot.querySelector("[data-mascot-machine]");
    var timer = null;
    var step = 0;
    function setMode(machine) {
      mascot.classList.toggle("is-machine", machine);
      if (humanBtn) humanBtn.setAttribute("aria-pressed", String(!machine));
      if (machineBtn) machineBtn.setAttribute("aria-pressed", String(machine));
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (machine && line) {
        line.textContent = LINES[step % LINES.length];
        timer = setInterval(function () {
          step++;
          line.textContent = LINES[step % LINES.length];
        }, 3600);
      }
    }

    /* machine.txt lives in its own module and its own stylesheet; both
       arrive only on the first MACHINE press. If the import fails the
       pill still speaks, which is exactly what it did before. */
    var machineMod = null;
    var loading = false;
    function openMachine() {
      if (machineMod) {
        machineMod.open({ lines: LINES, onClose: closeMachine });
        return;
      }
      if (loading) return;
      loading = true;
      import("/singulars/desktop/machine.js?v=1")
        .then(function (mod) {
          machineMod = mod;
          loading = false;
          if (mascot.classList.contains("is-machine")) {
            mod.open({ lines: LINES, onClose: closeMachine });
          }
        })
        .catch(function () {
          loading = false;
        });
    }
    function closeMachine() {
      if (machineMod) machineMod.close();
      setMode(false);
    }

    if (humanBtn)
      humanBtn.addEventListener("click", function () {
        closeMachine();
      });
    if (machineBtn)
      machineBtn.addEventListener("click", function () {
        setMode(true);
        openMachine();
      });
    setMode(false);
  }

  // ── app menu (the site map behind the wordmark) ───────────
  var more = document.querySelector("[data-menu-toggle]");
  var drop = document.querySelector("[data-menu-drop]");
  if (more && drop) {
    function closeMenu() {
      drop.hidden = true;
      more.setAttribute("aria-expanded", "false");
    }
    more.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = drop.hidden;
      drop.hidden = !open;
      more.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", function (e) {
      if (!drop.hidden && !drop.contains(e.target)) closeMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  // ── draggable windows (desktop only: fine pointer, wide) ──
  var canDrag =
    window.matchMedia &&
    window.matchMedia("(pointer: fine) and (min-width: 760px)").matches;
  if (canDrag) {
    var zTop = 10;
    document.querySelectorAll(".win > .win__bar").forEach(function (bar) {
      var win = bar.parentElement;
      var dx = 0, dy = 0, sx = 0, sy = 0, ox = 0, oy = 0, active = false;
      bar.addEventListener("pointerdown", function (e) {
        if (e.button !== 0) return;
        if (e.target.closest("a, button, input, select, textarea")) return;
        active = true;
        sx = e.clientX; sy = e.clientY; ox = dx; oy = dy;
        win.classList.add("is-dragging", "is-moved");
        win.style.zIndex = String(++zTop);
        bar.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      bar.addEventListener("pointermove", function (e) {
        if (!active) return;
        dx = ox + (e.clientX - sx);
        dy = oy + (e.clientY - sy);
        win.style.transform = "translate(" + dx + "px," + dy + "px)";
      });
      function stop() {
        if (!active) return;
        active = false;
        win.classList.remove("is-dragging");
      }
      bar.addEventListener("pointerup", stop);
      bar.addEventListener("pointercancel", stop);
      bar.addEventListener("dblclick", function () {
        dx = dy = 0;
        win.style.transform = "";
        win.classList.remove("is-moved");
      });
    });
  }

  // ── rotator ───────────────────────────────────────────────
  document.querySelectorAll(".rot").forEach(function (rot) {
    var imgs = rot.querySelectorAll("img");
    if (imgs.length < 2) return;
    var i = 0;
    imgs.forEach(function (im, n) {
      im.classList.toggle("is-on", n === 0);
    });
    setInterval(function () {
      imgs[i].classList.remove("is-on");
      i = (i + 1) % imgs.length;
      imgs[i].classList.add("is-on");
      var cap = rot.querySelector(".rot__cap");
      if (cap && imgs[i].dataset.cap) cap.textContent = imgs[i].dataset.cap;
    }, 5000);
  });
})();
