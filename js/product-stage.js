// First screen: FersmithAI's real screens floating in depth (2026-11-23).
//
// The screens sit at an angle, like a product shot. On load the floating
// panels rise out of the main window into depth. The pointer tilts the whole
// rig a few degrees and a glass sheen slides across it; with no pointer (phones,
// or the cursor elsewhere) it sways slowly on its own. Scrolling away turns it
// to face you and pulls the panels further apart.
//
// Reduced motion: the resting composition, nothing moves.
(function () {
  var stage = document.querySelector('[data-stage]');
  if (!stage) return;
  var rig = stage.querySelector('.stage-rig');
  var section = stage.closest('section') || stage;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var BASE_RX = 8, BASE_RY = -13;
  function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
  function set(rx, ry, spread, gx) {
    rig.style.setProperty('--rx', rx.toFixed(2));
    rig.style.setProperty('--ry', ry.toFixed(2));
    rig.style.setProperty('--spread', spread.toFixed(3));
    rig.style.setProperty('--gx', gx.toFixed(1));
    stage.style.setProperty('--ry', ry.toFixed(2));
    stage.style.setProperty('--spread', spread.toFixed(3));
  }

  if (reduce) {
    set(BASE_RX, BASE_RY, 1, 50);
    stage.classList.add('is-in');
    return;
  }

  // Start flat (panels inside the main window), then open up.
  set(BASE_RX, BASE_RY, 0, 30);
  requestAnimationFrame(function () { requestAnimationFrame(function () { stage.classList.add('is-in'); }); });
  var born = performance.now();

  // Pointer: where it is relative to the stage, -1…1. Any movement on the page counts.
  var px = 0, py = 0, lastMove = -1e9;
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var r = stage.getBoundingClientRect();
    px = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2), -1, 1);
    py = clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2), -1, 1);
    lastMove = performance.now();
  }, { passive: true });
  document.addEventListener('pointerleave', function () { lastMove = -1e9; });

  var visible = true;
  new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(stage);

  var rx = BASE_RX, ry = BASE_RY, spread = 0, last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!visible || document.hidden) return;

    // Scroll: 0 while the first screen is in place, 1 once it has scrolled a full height away.
    var r = section.getBoundingClientRect();
    var p = clamp(-r.top / Math.max(r.height, 1), 0, 1);
    var ep = p * p * (3 - 2 * p);

    // Opening: eased from 0 to 1 over the first 1.6 s.
    var t = clamp((now - born - 250) / 1600, 0, 1);
    var open = 1 - Math.pow(1 - t, 3);

    // Pointer if it moved in the last 4 s, otherwise a slow sway.
    var idle = now - lastMove > 4000;
    var s = now / 1000;
    var tx = idle ? Math.sin(s * 0.45) * 0.55 : px;
    var ty = idle ? Math.sin(s * 0.33 + 1.2) * 0.35 : py;

    var goalRy = BASE_RY * (1 - ep) + tx * 9;
    var goalRx = BASE_RX * (1 - ep * 0.7) - ty * 6;
    var goalSpread = open * (1 + ep * 0.9);

    var k = 1 - Math.exp(-dt * (idle ? 1.6 : 4));
    rx += (goalRx - rx) * k;
    ry += (goalRy - ry) * k;
    spread += (goalSpread - spread) * (1 - Math.exp(-dt * 6));
    set(rx, ry, spread, 35 - (ry - BASE_RY) * 4.5 + (rx - BASE_RX) * 3);
  }
  requestAnimationFrame(frame);
})();

// What happens inside the windows. Each loop: the check-in picks 30 minutes,
// the plan builds, the first task gets ticked. Meanwhile the podcast plays,
// the flashcard turns over, and the code example types itself out.
// Reduced motion: the finished state of each, still.
(function () {
  var main = document.querySelector('[data-ui-main]');
  if (!main) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var flash = document.querySelector('.pane-flash');
  var done = main.querySelector('.ui-done');
  var wave = document.querySelector('[data-ui-wave]');
  var timeEl = document.querySelector('[data-ui-time]');
  var codeEl = document.querySelector('[data-ui-code]');
  var lines = document.querySelector('.ui-lines');

  // From lib/lessons.ts, LLM Fundamentals & Prompt Engineering, "In Practice".
  var CODE = [
    ['from ', 'k'], ['anthropic ', ''], ['import ', 'k'], ['Anthropic\n\n', ''],
    ['client = ', ''], ['Anthropic', 'f'], ['()\n\n', ''],
    ['# System + user prompt structure\n', 'c'],
    ['response = client.messages.', ''], ['create', 'f'], ['(\n', ''],
    ['    model=', ''], ['"claude-sonnet-4-6"', 's'], [',\n', ''],
    ['    max_tokens=', ''], ['1024', 'n'], [',\n', ''],
    ['    system=', ''], ['"""You are a senior ML engineer.\n    Answer concisely and technically.\n    Format code in Python with comments."""', 's'], [',\n', ''],
    ['    messages=[...]\n)', '']
  ];
  var TOTAL = CODE.reduce(function (n, s) { return n + s[0].length; }, 0);
  function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function renderCode(n, caret) {
    var out = '', left = n;
    for (var i = 0; i < CODE.length && left > 0; i++) {
      var t = CODE[i][0].slice(0, left);
      left -= t.length;
      out += CODE[i][1] ? '<span class="' + CODE[i][1] + '">' + esc(t) + '</span>' : esc(t);
    }
    codeEl.innerHTML = out + (caret ? '<span class="ui-caret"></span>' : '');
  }

  // Waveform bars
  var BARS = 34, bars = [];
  for (var b = 0; b < BARS; b++) {
    var i = document.createElement('i');
    var amp = 0.25 + 0.75 * Math.abs(Math.sin(b * 1.7) * Math.cos(b * 0.45));
    i.style.setProperty('--lo', (0.15 + amp * 0.2).toFixed(2));
    i.style.setProperty('--hi', (0.3 + amp * 0.7).toFixed(2));
    i.style.animationDelay = (-(b * 0.13) % 1.1).toFixed(2) + 's';
    wave.appendChild(i);
    bars.push(i);
  }
  // Seamless transcript loop: the lines twice over, scrolled by half.
  lines.innerHTML += lines.innerHTML;

  if (reduce) {
    main.className += ' s-pick s-plan s-t1 s-t2 s-done1';
    done.textContent = '1';
    renderCode(TOTAL, false);
    bars.forEach(function (el, k) { if (k < BARS * 0.3) el.classList.add('past'); });
    return;
  }

  var timers = [];
  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function setState(list) { main.className = 'pane-screen ui ' + list; }

  function runMain() {
    setState('');
    done.textContent = '0';
    at(1400, function () { setState('s-pick'); });
    at(2600, function () { setState('s-pick s-build'); });
    at(3700, function () { setState('s-pick s-build s-plan'); });
    at(4300, function () { setState('s-pick s-build s-plan s-t1'); });
    at(4900, function () { setState('s-pick s-build s-plan s-t1 s-t2'); });
    at(7000, function () { setState('s-pick s-build s-plan s-t1 s-t2 s-done1'); done.textContent = '1'; });
    at(11500, runMain);
  }

  // Podcast clock, 0:13 onwards; the played part of the wave follows it.
  var sec = 13;
  setInterval(function () {
    if (document.hidden) return;
    sec++;
    timeEl.textContent = Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
    var played = Math.min(BARS, Math.round(BARS * (0.25 + (sec - 13) / 160)));
    bars.forEach(function (el, k) { el.classList.toggle('past', k < played); });
    if (sec > 120) sec = 13;
  }, 1000);

  // Flashcard turns every few seconds.
  setInterval(function () { if (!document.hidden) flash.classList.toggle('flipped'); }, 3800);

  // Code: type, hold, start again.
  var typed = 0;
  function typeStep() {
    if (document.hidden) { setTimeout(typeStep, 500); return; }
    typed += 1 + (Math.random() < 0.3 ? 1 : 0);
    if (typed >= TOTAL) { renderCode(TOTAL, true); setTimeout(function () { typed = 0; typeStep(); }, 4500); return; }
    renderCode(typed, true);
    setTimeout(typeStep, 28 + Math.random() * 40);
  }

  renderCode(0, true);
  setTimeout(function () { runMain(); typeStep(); }, 900);
})();
