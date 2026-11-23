// Skills as a turning word globe (2026-11-23). Related to the module sphere on
// fersmith.ai but made to look different: the skills are pills sitting on a
// wireframe globe, and the legend works as a filter.
//
// The pills are built from the skill lists in index.html, so the lists stay
// the one place to edit: add a <li> there and it shows up here too. Each frame
// rotates the points of a Fibonacci sphere and projects them, and a canvas
// draws the globe's meridians and parallels with the same rotation (the near
// side darker than the far side). Drag to turn it; hover a pill to stop it and
// light it up; hover or tap a group in the legend to light up that group.
// Below 992px the CSS hides the globe and the lists show as before.
// Reduced motion: no auto-turn, dragging still works.
(function () {
  var wrap = document.querySelector('.skill-sphere');
  if (!wrap) return;
  var section = wrap.parentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // One colour per group, in the order the groups appear.
  var COLORS = ['#0f766e', '#e0784f', '#3b82f6', '#c99a06', '#db2777', '#8b5cf6'];
  function soft(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  var canvas = document.createElement('canvas');
  wrap.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  var pills = [], groupOf = [];
  var legend = document.createElement('ul');
  legend.className = 'ss-legend';
  var buttons = [];
  section.querySelectorAll('.skill-list .skill-group').forEach(function (group, g) {
    var cat = group.querySelector('.subheading').textContent.trim();
    var color = COLORS[g % COLORS.length];
    var li = document.createElement('li');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-pressed', 'false');
    btn.style.setProperty('--c', color);
    btn.style.setProperty('--c-soft', soft(color, 0.1));
    btn.innerHTML = '<i></i>';
    btn.appendChild(document.createTextNode(cat));
    li.appendChild(btn);
    legend.appendChild(li);
    buttons.push(btn);
    group.querySelectorAll('.skill-chips li').forEach(function (item) {
      var el = document.createElement('span');
      el.className = 'ss-pill';
      el.style.setProperty('--c', color);
      el.style.setProperty('--c-soft', soft(color, 0.18));
      el.style.setProperty('--c-line', soft(color, 0.35));
      el.innerHTML = '<i></i>' + item.innerHTML; // the list's own text and <small>
      wrap.appendChild(el);
      pills.push(el);
      groupOf.push(g);
    });
  });
  if (!pills.length) return;
  wrap.insertAdjacentElement('afterend', legend);
  section.classList.add('has-sphere');

  // Even spread over the sphere (Fibonacci lattice).
  var n = pills.length, golden = Math.PI * (3 - Math.sqrt(5));
  var points = pills.map(function (_, i) {
    var y = 1 - ((i + 0.5) / n) * 2, r = Math.sqrt(1 - y * y), a = i * golden;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  });

  var AUTO = 0.16, TILT = 0.32;
  var yaw = 0.6, pitch = TILT, vel = reduce ? 0 : AUTO, drag = null, hover = -1;
  var focusGroup = -1, pinnedGroup = -1;
  wrap.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, t: performance.now() }; wrap.setPointerCapture(e.pointerId); });
  wrap.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var now = performance.now(), dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    yaw += dx * 0.006;
    pitch = Math.min(Math.max(pitch - dy * 0.004, -0.8), 0.8);
    vel = (dx * 0.006) / Math.max((now - drag.t) / 1000, 0.008);
    drag = { x: e.clientX, y: e.clientY, t: now };
  });
  function up() { drag = null; }
  wrap.addEventListener('pointerup', up);
  wrap.addEventListener('pointercancel', up);
  pills.forEach(function (el, i) {
    el.addEventListener('pointerenter', function () { hover = i; el.classList.add('is-lifted'); });
    el.addEventListener('pointerleave', function () { if (hover === i) hover = -1; el.classList.remove('is-lifted'); });
  });
  buttons.forEach(function (btn, g) {
    btn.addEventListener('pointerenter', function () { focusGroup = g; });
    btn.addEventListener('pointerleave', function () { focusGroup = -1; });
    btn.addEventListener('click', function () {
      pinnedGroup = pinnedGroup === g ? -1 : g;
      buttons.forEach(function (b, k) { b.setAttribute('aria-pressed', k === pinnedGroup ? 'true' : 'false'); });
    });
  });

  var visible = false;
  new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(wrap);

  var W = 0, H = 0, dpr = 1;
  function resize() {
    W = wrap.clientWidth; H = wrap.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  new ResizeObserver(resize).observe(wrap);
  resize();

  // Project a unit-sphere point with the current rotation.
  var cy, sy, cp, sp, R;
  function project(x, y, z) {
    var x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    var y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    return [W / 2 + x1 * R, H / 2 + y2 * R, z2];
  }
  function drawGlobe() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // a faint disc so the globe reads as a ball
    var g = ctx.createRadialGradient(W / 2 - R * 0.3, H / 2 - R * 0.35, R * 0.1, W / 2, H / 2, R);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(15,118,110,0.05)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1;
    function line(pts) {
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], d = (a[2] + b[2]) / 2; // -1 far … 1 near
        ctx.strokeStyle = 'rgba(15,118,110,' + (0.05 + (d + 1) / 2 * 0.2).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }
    var STEPS = 48, k, j, t, pts;
    for (k = 0; k < 12; k++) { // meridians
      var lon = (k / 12) * Math.PI;
      pts = [];
      for (j = 0; j <= STEPS; j++) {
        t = (j / STEPS) * Math.PI * 2;
        pts.push(project(Math.cos(lon) * Math.cos(t), Math.sin(t), Math.sin(lon) * Math.cos(t)));
      }
      line(pts);
    }
    for (k = -2; k <= 2; k++) { // parallels
      var lat = k * (Math.PI / 6), r = Math.cos(lat), yy = Math.sin(lat);
      pts = [];
      for (j = 0; j <= STEPS; j++) {
        t = (j / STEPS) * Math.PI * 2;
        pts.push(project(Math.cos(t) * r, yy, Math.sin(t) * r));
      }
      line(pts);
    }
  }

  var last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!visible || document.hidden || !W) return;
    var hovering = hover !== -1;
    if (!drag) {
      var goal = hovering || reduce ? 0 : AUTO;
      vel += (goal - vel) * (1 - Math.exp(-dt * (hovering ? 8 : 1.5)));
      pitch += (TILT - pitch) * (1 - Math.exp(-dt * 0.8));
      yaw += vel * dt;
    }
    R = Math.min(W * 0.36, H * 0.44);
    cy = Math.cos(yaw); sy = Math.sin(yaw); cp = Math.cos(pitch); sp = Math.sin(pitch);
    drawGlobe();
    var lit = focusGroup !== -1 ? focusGroup : pinnedGroup;
    for (var i = 0; i < n; i++) {
      var p = project(points[i][0], points[i][1], points[i][2]);
      var depth = (p[2] + 1) / 2, lifted = hover === i, el = pills[i];
      var dim = lit !== -1 && groupOf[i] !== lit;
      var scale = (0.62 + depth * 0.45) * (lifted ? 1.12 : 1) * (lit !== -1 && !dim ? 1.08 : 1);
      el.style.transform = 'translate(-50%, -50%) translate3d(' + (p[0] - W / 2).toFixed(1) + 'px,' + (p[1] - H / 2).toFixed(1) + 'px,0) scale(' + scale.toFixed(3) + ')';
      var op = lifted ? 1 : 0.15 + depth * depth * 0.85;
      el.style.opacity = (dim ? op * 0.18 : op).toFixed(3);
      el.style.zIndex = lifted ? '200' : String(Math.round(depth * 100));
      el.style.pointerEvents = depth > 0.45 && !dim ? 'auto' : 'none';
    }
  }
  requestAnimationFrame(tick);
})();
