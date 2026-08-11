/* ============================================================
   SmartEdu — WebGL Scene Engine (Three.js r128)
   Fixed full-viewport background canvas.
   Exposes window.Scene3D API for the UI layer (app.js).
   ============================================================ */

(function () {
  'use strict';

  var isMobile = window.matchMedia('(max-width: 860px)').matches;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (typeof THREE === 'undefined') return;
  if (reducedMotion) {
    document.body.classList.add('webgl-ready');
    return;
  }

  var canvas = document.getElementById('webgl-canvas');
  if (!canvas) return;

  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: !isMobile,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x05070D, 1);

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070D, isMobile ? 0.045 : 0.05);

  var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);

  var worldGroup = new THREE.Group();
  scene.add(worldGroup);

  var TIME = new THREE.Clock();

  /* ---------- lights ---------- */
  var hemi = new THREE.HemisphereLight(0x3b82f6, 0x05070d, 0.55);
  scene.add(hemi);

  var dirLight = new THREE.DirectionalLight(0x8b9cff, 0.9);
  dirLight.position.set(4, 8, 6);
  scene.add(dirLight);

  /* ==========================================================
     GRID / ARCHITECTURE
     ========================================================== */
  var gridFloor = new THREE.GridHelper(90, 45, 0x2b4370, 0x131f36);
  gridFloor.position.y = -2.6;
  scene.add(gridFloor);

  var gridFloor2 = new THREE.GridHelper(60, 30, 0x7c3aed, 0x151b30);
  gridFloor2.position.y = -2.62;
  gridFloor2.material.transparent = true;
  gridFloor2.material.opacity = 0.35;
  scene.add(gridFloor2);

  var gridWall = new THREE.GridHelper(200, 60, 0x1d3a63, 0x0d1526);
  gridWall.rotation.x = Math.PI / 2;
  gridWall.position.set(0, 0, -110);
  gridWall.material.transparent = true;
  gridWall.material.opacity = 0.5;
  scene.add(gridWall);

  var wallGlow = makeGlowSprite(0x3b82f6, 1.0, 0.35);
  wallGlow.position.set(0, 0, -108);
  wallGlow.scale.set(140, 60, 1);
  scene.add(wallGlow);

  /* ---------- starfield ---------- */
  var starCount = isMobile ? 320 : 850;
  var starGeo = new THREE.BufferGeometry();
  var starPos = new Float32Array(starCount * 3);
  for (var s = 0; s < starCount; s++) {
    starPos[s * 3] = (Math.random() - 0.5) * 220;
    starPos[s * 3 + 1] = (Math.random() - 0.5) * 110;
    starPos[s * 3 + 2] = -Math.random() * 180 - 8;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  var starMat = new THREE.PointsMaterial({
    color: 0x6ea8ff,
    size: isMobile ? 0.4 : 0.55,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  var stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* ---------- rising data particles (grid ambience) ---------- */
  var riserCount = isMobile ? 60 : 150;
  var riserGeo = new THREE.BufferGeometry();
  var riserPos = new Float32Array(riserCount * 3);
  var riserSpeed = new Float32Array(riserCount);
  for (var r = 0; r < riserCount; r++) {
    riserPos[r * 3] = (Math.random() - 0.5) * 70;
    riserPos[r * 3 + 1] = -2.4 + Math.random() * 16;
    riserPos[r * 3 + 2] = (Math.random() - 0.5) * 90;
    riserSpeed[r] = 0.6 + Math.random() * 1.4;
  }
  riserGeo.setAttribute('position', new THREE.BufferAttribute(riserPos, 3));
  var riserMat = new THREE.PointsMaterial({
    color: 0x38bdf8,
    size: isMobile ? 0.14 : 0.2,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });
  var risers = new THREE.Points(riserGeo, riserMat);
  scene.add(risers);

  /* ==========================================================
     QR / TERMINAL MESH (attendance stream)
     ========================================================== */
  var terminalGroup = new THREE.Group();
  terminalGroup.position.set(0, 0.1, -7);
  terminalGroup.rotation.y = -0.38;
  terminalGroup.rotation.x = 0.1;
  worldGroup.add(terminalGroup);

  var termBody = new THREE.Mesh(
    new THREE.BoxGeometry(5.3, 3.3, 0.5, 4, 4, 1),
    new THREE.MeshPhysicalMaterial({
      color: 0x0b0f19,
      metalness: 0.55,
      roughness: 0.32,
      clearcoat: 0.6,
      clearcoatRoughness: 0.35
    })
  );
  termBody.position.z = 0;
  terminalGroup.add(termBody);

  var termFrame = new THREE.Mesh(
    new THREE.BoxGeometry(5.02, 3.02, 0.05),
    new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  termFrame.position.z = 0.26;
  terminalGroup.add(termFrame);

  var termShadow = makeSoftShadow(0x000000, 1.0);
  termShadow.scale.set(7.4, 3.4, 1);
  termShadow.position.set(0, -2.0, -0.4);
  termShadow.rotation.x = -Math.PI / 2;
  termShadow.material.opacity = 0.4;
  terminalGroup.add(termShadow);

  var termGlow = makeGlowSprite(0x34d399, 1.0, 0.5);
  termGlow.position.set(0, 0, -0.7);
  termGlow.scale.set(10.5, 6.5, 1);
  terminalGroup.add(termGlow);

  var termFlash = makeGlowSprite(0x38bdf8, 1.0, 0.22);
  termFlash.position.set(0, 0, 0.75);
  termFlash.scale.set(12, 7.5, 1);
  terminalGroup.add(termFlash);

  /* ---- terminal screen texture (streaming attendance) ---- */
  var TEX_W = 1024, TEX_H = 620;
  var termCanvas = document.createElement('canvas');
  termCanvas.width = TEX_W;
  termCanvas.height = TEX_H;
  var tctx = termCanvas.getContext('2d');

  var termTex = new THREE.CanvasTexture(termCanvas);
  termTex.minFilter = THREE.LinearFilter;

  var screen = new THREE.Mesh(
    new THREE.PlaneGeometry(4.88, 2.88),
    new THREE.MeshBasicMaterial({
      map: termTex,
      transparent: true,
      opacity: 1.0
    })
  );
  screen.position.z = 0.27;
  terminalGroup.add(screen);

  var termLines = [];
  var palette = {
    prompt: '#22d3ee',
    cmd: '#e5eaf3',
    violet: '#a78bfa',
    cyan: '#22d3ee',
    blue: '#60a5fa',
    green: '#34d399',
    amber: '#fbbf24',
    dim: '#5b6b82'
  };

  var baseScript = [
    ['prompt', 'smartedu', null],
    ['dim', '  → attendance stream · room 204', null],
    ['green', '✓ check-in #142 · Aisha Patel', null],
    ['cyan', '[QR] code rotates every 30s', null],
    ['blue', '[live] 34/48 students checked in', null],
    ['amber', '[free] gap 12:30–14:00 · suggest activity', null],
    ['violet', '[admin] 3,912 scans today', null],
    ['dim', '❯', null]
  ];

  var pool = [
    ['green', '✓ check-in #143 · Marcus Lee', null],
    ['cyan', '[QR] rotated · new code generated', null],
    ['dim', '[live] 35/48 students checked in', null],
    ['blue', '[chart] trend · +4% vs yesterday', null],
    ['amber', '[planner] 3 free periods detected', null],
    ['violet', '[admin] 1,284 students online', null],
    ['green', '✓ CS-301 attendance 87%', null],
    ['dim', '[sync] history updated · 6 records', null],
    ['cyan', '[next] CS-210 session in 12m', null],
    ['green', '✓ export ready · attendance.xlsx', null]
  ];

  function seedTerminal() {
    termLines.length = 0;
    baseScript.forEach(function (l) { termLines.push([l[0], l[1]]); });
  }
  seedTerminal();

  function drawTerminal(time) {
    var y = 78;
    var lineH = 66;
    var x = 62;
    tctx.clearRect(0, 0, TEX_W, TEX_H);
    tctx.fillStyle = 'rgba(4, 8, 16, 0.94)';
    tctx.fillRect(0, 0, TEX_W, TEX_H);

    var grad = tctx.createLinearGradient(0, 0, TEX_W, 0);
    grad.addColorStop(0, 'rgba(52,211,153,0.10)');
    grad.addColorStop(1, 'rgba(167,139,250,0.10)');
    tctx.fillStyle = grad;
    tctx.fillRect(0, 0, TEX_W, 8);

    tctx.font = '600 30px "JetBrains Mono", monospace';
    tctx.textBaseline = 'top';

    for (var i = 0; i < termLines.length; i++) {
      var ln = termLines[i];
      var label = ln[0], text = ln[1];
      tctx.fillStyle = palette[label] || '#94a3b8';
      tctx.fillText(text, x, y);
      if (label === 'prompt') {
        tctx.fillStyle = '#22d3ee';
        tctx.font = '600 30px "JetBrains Mono", monospace';
      } else {
        tctx.font = '500 30px "JetBrains Mono", monospace';
      }
      y += lineH;
    }

    var blink = Math.sin(time * 5) > -0.4;
    tctx.font = '600 30px "JetBrains Mono", monospace';
    if (blink) {
      tctx.fillStyle = '#34d399';
      tctx.fillRect(x, y + 4, 18, 32);
    }

    termTex.needsUpdate = true;
  }

  var termTimer = 0;
  function stepTerminal(dt) {
    termTimer += dt;
    if (termTimer > 2.4) {
      termTimer = 0;
      if (termLines.length > 16) termLines.splice(0, 2);
      var pick = pool[Math.floor(Math.random() * pool.length)];
      termLines.push([pick[0], pick[1]]);
    }
  }

  /* ==========================================================
     MODULE MATRIX / ORBIT RING (Student · Teacher · Admin)
     ========================================================== */
  var ringGroup = new THREE.Group();
  ringGroup.position.set(0, 0.1, -38);
  worldGroup.add(ringGroup);

  var hub = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.72, 1),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  ringGroup.add(hub);

  var hubCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.4, 0),
    new THREE.MeshBasicMaterial({ color: 0xe0f2ff })
  );
  ringGroup.add(hubCore);

  var hubHalo = makeGlowSprite(0x38bdf8, 1.0, 0.85);
  hubHalo.scale.set(5.2, 5.2, 1);
  ringGroup.add(hubHalo);

  var hubGlow2 = makeGlowSprite(0xa78bfa, 1.0, 0.4);
  hubGlow2.scale.set(9, 9, 1);
  ringGroup.add(hubGlow2);

  var hubLight = new THREE.PointLight(0x38bdf8, 1.4, 26, 2);
  hubLight.position.set(0, 0.4, 0);
  ringGroup.add(hubLight);

  var hubShadow = makeSoftShadow(0x38bdf8, 1.0);
  hubShadow.scale.set(4.6, 1.4, 1);
  hubShadow.position.set(0, -2.1, 0);
  hubShadow.rotation.x = -Math.PI / 2;
  ringGroup.add(hubShadow);

  var ringMat1 = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  var ringMat2 = new THREE.MeshBasicMaterial({
    color: 0x8b5cf6,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  var ringMat3 = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  var ringA = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.03, 8, 140), ringMat1);
  ringGroup.add(ringA);

  var ringB = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.018, 8, 140), ringMat2);
  ringB.rotation.x = Math.PI / 2.2;
  ringB.rotation.z = 0.4;
  ringGroup.add(ringB);

  var ringC = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.014, 8, 140), ringMat3);
  ringC.rotation.x = Math.PI / 1.7;
  ringC.rotation.y = 0.6;
  ringGroup.add(ringC);

  /* module nodes */
  var moduleDefs = [
    { name: 'Student', color: 0x34d399 },
    { name: 'Teacher', color: 0x38bdf8 },
    { name: 'Admin', color: 0xa78bfa },
    { name: 'QR Scan', color: 0x22d3ee },
    { name: 'Planner', color: 0xfbbf24 },
    { name: 'Analytics', color: 0xf472b6 }
  ];

  var nodes = [];
  var ORBIT_R = 4.6;

  function makeLabelTexture(text, colorHex) {
    var c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    var g = c.getContext('2d');
    g.clearRect(0, 0, 512, 128);

    var grad = g.createRadialGradient(256, 56, 8, 256, 56, 200);
    grad.addColorStop(0, 'rgba(255,255,255,0.16)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 128);

    g.font = '700 58px Inter, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = colorHex;
    g.shadowBlur = 26;
    g.fillStyle = '#ffffff';
    g.fillText(text, 256, 62);

    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  moduleDefs.forEach(function (def, i) {
    var color = def.color;
    var sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 18, 14),
      new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );

    var nodeGlow = makeGlowSprite(color, 1.0, 0.5);
    nodeGlow.scale.set(1.1, 1.1, 1);
    sphere.add(nodeGlow);

    var label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeLabelTexture(def.name, '#' + color.toString(16).padStart(6, '0')),
        transparent: true,
        depthWrite: false
      })
    );
    label.scale.set(3.2, 0.8, 1);
    label.position.y = 0.55;
    sphere.add(label);

    var angle = (i / moduleDefs.length) * Math.PI * 2;
    var node = {
      mesh: sphere,
      baseColor: color,
      radius: ORBIT_R,
      angle: angle,
      speed: 0.12 + Math.random() * 0.06,
      bob: Math.random() * Math.PI * 2,
      hover: false
    };
    ringGroup.add(sphere);
    nodes.push(node);
  });

  /* electron data points racing around the rings */
  var electronMat = new THREE.MeshBasicMaterial({
    color: 0x9be1ff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  var electrons = [];
  for (var e = 0; e < 14; e++) {
    var el = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), electronMat.clone());
    el.material.color.setHSL((e / 14) * 0.45 + 0.55, 0.9, 0.7);
    ringGroup.add(el);
    electrons.push({ mesh: el, angle: Math.random() * Math.PI * 2, ring: Math.random() * 3 | 0, radius: 4.6, speed: 0.5 + Math.random() * 0.9 });
  }
  electrons.forEach(function (el) {
    if (el.ring === 1) { el.radius = 5.6; }
    else if (el.ring === 2) { el.radius = 3.6; }
  });

  var ringOpacity = 0.0;

  /* ==========================================================
     DECORATIVE FLOATING PANELS (depth HUD)
     ========================================================== */
  function makePanel(w, h, color) {
    var geo = new THREE.PlaneGeometry(w, h);
    var mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    var plane = new THREE.Mesh(geo, mat);
    var edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    plane.add(edges);
    return plane;
  }

  var panels = [];
  var panelDefs = [
    { w: 5.5, h: 3.2, x: -12, y: 1.6, z: -12, ry: 0.4, color: 0x38bdf8 },
    { w: 4.2, h: 2.6, x: 11, y: 0.8, z: -16, ry: -0.5, color: 0x8b5cf6 },
    { w: 6.4, h: 2.2, x: -10, y: 2.4, z: -24, ry: 0.3, color: 0x34d399 },
    { w: 3.8, h: 3.8, x: 10, y: -0.4, z: -28, ry: -0.35, color: 0xa78bfa }
  ];
  panelDefs.forEach(function (p) {
    var panel = makePanel(p.w, p.h, p.color);
    panel.position.set(p.x, p.y, p.z);
    panel.rotation.y = p.ry;
    panel.rotation.x = 0.08;
    worldGroup.add(panel);
    panels.push({ mesh: panel, seed: Math.random() * Math.PI * 2, baseY: p.y });
  });

  /* ==========================================================
     PARTICLE BURSTS (neon data streams)
     ========================================================== */
  var bursts = [];
  var burstGeometryPool = [];
  var tmpVec = new THREE.Vector3();
  var tmpDir = new THREE.Vector3();

  function makeBurstGeo(count) {
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return geo;
  }

  function spawnBurst(worldPos, hexColor, opts) {
    opts = opts || {};
    var count = opts.count || (isMobile ? 40 : 90);
    var geo = burstGeometryPool.pop() || makeBurstGeo(count);

    var pos = geo.attributes.position.array;
    var col = geo.attributes.color.array;
    var vel = new Float32Array(count * 3);
    var color = new THREE.Color(hexColor || 0x34d399);

    for (var i = 0; i < count; i++) {
      pos[i * 3] = worldPos.x + (Math.random() - 0.5) * 0.12;
      pos[i * 3 + 1] = worldPos.y + (Math.random() - 0.5) * 0.12;
      pos[i * 3 + 2] = worldPos.z + (Math.random() - 0.5) * 0.12;

      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      var spd = 1.6 + Math.random() * 3.4;
      vel[i * 3] = Math.sin(phi) * Math.cos(theta) * spd;
      vel[i * 3 + 1] = Math.abs(Math.cos(phi)) * spd * 0.9 + 0.8;
      vel[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * spd;

      var c = color.clone();
      c.offsetHSL((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.3) * 0.25);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;

    var mat = new THREE.PointsMaterial({
      size: isMobile ? 0.14 : 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    var pts = new THREE.Points(geo, mat);
    pts.position.copy(worldPos);
    scene.add(pts);

    bursts.push({ points: pts, vel: vel, geo: geo, mat: mat, life: 0, max: 1.1, count: count });
    if (bursts.length > 7) killBurst(bursts.shift());
  }

  function killBurst(b) {
    scene.remove(b.points);
    b.points.geometry.dispose();
    b.mat.dispose();
    burstGeometryPool.push(b.geo);
  }

  function updateBursts(dt) {
    for (var i = bursts.length - 1; i >= 0; i--) {
      var b = bursts[i];
      b.life += dt;
      if (b.life >= b.max) {
        killBurst(b);
        bursts.splice(i, 1);
        continue;
      }
      var arr = b.geo.attributes.position.array;
      for (var j = 0; j < b.count; j++) {
        arr[j * 3] += b.vel[j * 3] * dt;
        arr[j * 3 + 1] += b.vel[j * 3 + 1] * dt;
        arr[j * 3 + 2] += b.vel[j * 3 + 2] * dt;
        b.vel[j * 3 + 1] -= 0.7 * dt;
        b.vel[j * 3] *= 0.996;
        b.vel[j * 3 + 1] *= 0.996;
        b.vel[j * 3 + 2] *= 0.996;
      }
      b.geo.attributes.position.needsUpdate = true;
      var k = 1 - b.life / b.max;
      b.mat.opacity = k < 0.25 ? k / 0.25 : 1;
      b.points.position.y += dt * 0.2;
    }
  }

  /* ---------- screen-to-world projection (z-plane at y=0) ---------- */
  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector3();

  function screenToWorld(sx, sy, planeY) {
    ndc.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1, 0.5);
    ndc.unproject(camera);
    tmpDir.copy(ndc).sub(camera.position).normalize();
    var py = (planeY === undefined ? 0 : planeY) - camera.position.y;
    var t = py / tmpDir.y;
    if (t <= 0 || t > 120) {
      t = 4;
    }
    tmpVec.copy(camera.position).add(tmpDir.multiplyScalar(t));
    return tmpVec.clone();
  }

  /* ==========================================================
     SCROLL + MOUSE STATE
     ========================================================== */
  var scrollTarget = 0;
  var scroll = 0;
  var mouseX = 0, mouseY = 0;
  var smoothX = 0, smoothY = 0;

  function easeInOut(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
  function damp(a, b, k) { return a + (b - a) * (1 - Math.exp(-k)); }

  var nodeHoverIndex = -1;
  var lastHoverBurst = 0;

  function handleNodeHover(sx, sy) {
    if (scroll < 0.42 || scroll > 0.95) return;
    raycaster.setFromCamera(new THREE.Vector2(
      (sx / window.innerWidth) * 2 - 1,
      -(sy / window.innerHeight) * 2 + 1
    ), camera);
    var meshes = nodes.map(function (n) { return n.mesh; });
    var hits = raycaster.intersectObjects(meshes, false);
    var now = performance.now() / 1000;

    for (var i = 0; i < nodes.length; i++) nodes[i].mesh.scale.setScalar(nodes[i].hover ? 1.45 : 1);

    if (hits.length) {
      var idx = nodes.indexOf(hits[0].object);
      hits[0].object.scale.setScalar(1.45);
      nodes.forEach(function (n) { n.hover = n.mesh === hits[0].object; });
      if (idx !== nodeHoverIndex || now - lastHoverBurst > 1.2) {
        nodeHoverIndex = idx;
        lastHoverBurst = now;
        hits[0].object.getWorldPosition(tmpVec);
        spawnBurst(tmpVec.clone(), nodes[idx].baseColor, { count: isMobile ? 26 : 48 });
      }
      canvas.style.cursor = 'pointer';
    } else {
      nodeHoverIndex = -1;
      canvas.style.cursor = '';
    }
  }

  if (!isMobile && window.matchMedia('(hover: hover)').matches) {
    window.addEventListener('pointermove', function (ev) {
      handleNodeHover(ev.clientX, ev.clientY);
    }, { passive: true });
  }

  /* ==========================================================
     PUBLIC API
     ========================================================== */
  window.Scene3D = {
    setScroll: function (p) { scrollTarget = Math.max(0, Math.min(1, p)); },
    setMouse: function (nx, ny) { mouseX = nx; mouseY = ny; },
    setActive: function (active) { userActive = !!active; if (userActive && pageVisible) TIME.start(); },
    burstAt: function (sx, sy, hex) {
      var world = screenToWorld(sx, sy, 0);
      spawnBurst(world, hex || '#34d399', {});
    },
    resize: function () {
      isMobile = window.innerWidth <= 860;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      scene.fog = new THREE.FogExp2(0x05070D, isMobile ? 0.045 : 0.05);
    }
  };

  document.body.classList.add('webgl-ready');

  /* ==========================================================
     MAIN LOOP
     ========================================================== */
  var userActive = true;   // app views pause the scene via Scene3D.setActive(false)
  var pageVisible = true;  // tab visibility
  document.addEventListener('visibilitychange', function () {
    pageVisible = !document.hidden;
    if (userActive && pageVisible) TIME.start();
  });

  function animate() {
    requestAnimationFrame(animate);
    if (!userActive || !pageVisible) return;

    var dt = Math.min(TIME.getDelta(), 0.05);
    var time = TIME.elapsedTime;

    scroll = damp(scroll, scrollTarget, 6);
    smoothX = damp(smoothX, mouseX, 4.5);
    smoothY = damp(smoothY, mouseY, 4.5);

    var es = easeInOut(scroll);

    camera.position.z = damp(camera.position.z, 9.5 + es * 34, 3.5);
    camera.position.y = damp(camera.position.y, 0.6 + es * 3.1, 3.5);
    camera.position.x = damp(camera.position.x, smoothX * 1.6, 4);

    camera.lookAt(new THREE.Vector3(
      smoothX * 2.4,
      0.7 + es * 2.6 + smoothY * 1.6,
      -22 - es * 14
    ));

    worldGroup.rotation.y = damp(worldGroup.rotation.y, smoothX * 0.05, 4);
    worldGroup.rotation.x = damp(worldGroup.rotation.x, -smoothY * 0.028, 4);

    /* terminal drift + fade */
    var termK = Math.max(0, 1 - Math.pow(Math.max(es * 2.6 - 0.5, 0), 2));
    terminalGroup.position.y = 0.1 + Math.sin(time * 0.8) * 0.08;
    terminalGroup.position.x = damp(terminalGroup.position.x, -smoothX * 1.4, 3);
    terminalGroup.position.z = damp(terminalGroup.position.z, -7 - es * 11, 3);
    terminalGroup.rotation.z = Math.sin(time * 0.5) * 0.012;

    screen.material.opacity = termK;
    termFrame.material.opacity = Math.max(0, Math.sin(time * 2.2) * 0.035 + 0.05 * termK);
    termBody.material.transparent = true;
    termBody.material.opacity = termK;
    termGlow.material.opacity = 0.5 * termK;
    termFlash.material.opacity = 0.22 * termK;
    termShadow.material.opacity = 0.4 * termK;

    stepTerminal(dt);
    drawTerminal(time);

    /* ring approach + reveal */
    ringOpacity = Math.max(ringOpacity, smoothStep(es, 0.32, 0.6));
    ringOpacity = Math.min(ringOpacity, smoothStep(1 - es, 0.1, 0.28));

    ringGroup.position.z = damp(ringGroup.position.z, -38 + es * 26, 3);
    ringGroup.position.y = damp(ringGroup.position.y, 0.1 + es * 0.3, 3);
    ringGroup.rotation.y = time * 0.12;
    ringGroup.rotation.x = -0.12;

    ringMat1.opacity = 0.75 * ringOpacity;
    ringMat2.opacity = 0.6 * ringOpacity;
    ringMat3.opacity = 0.5 * ringOpacity;
    hubHalo.material.opacity = (0.55 + Math.sin(time * 2.4) * 0.25) * ringOpacity;
    hubGlow2.material.opacity = 0.4 * ringOpacity;
    hubLight.intensity = (1.1 + Math.sin(time * 2.4) * 0.5) * ringOpacity;
    hubShadow.material.opacity = 0.45 * ringOpacity;

    var hubPulse = 1 + Math.sin(time * 2.2) * 0.08;
    hub.scale.setScalar(hubPulse);
    hubCore.scale.setScalar(1 + Math.sin(time * 3.1) * 0.12);
    hub.rotation.x = time * 0.4;
    hub.rotation.y = time * 0.6;

    /* nodes orbit */
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      node.angle += node.speed * dt;
      var a = node.angle;
      node.mesh.position.set(
        Math.cos(a) * node.radius,
        Math.sin(a * 2 + node.bob) * 0.35 + 0.15,
        Math.sin(a) * node.radius
      );
    }

    /* electrons race along rings */
    for (var e2 = 0; e2 < electrons.length; e2++) {
      var el = electrons[e2];
      el.angle += el.speed * dt;
      if (el.ring === 0) {
        el.mesh.position.set(Math.cos(el.angle) * 4.6, 0, Math.sin(el.angle) * 4.6);
      } else if (el.ring === 1) {
        el.mesh.position.set(Math.cos(el.angle) * 5.6, Math.sin(el.angle) * 1.8, Math.sin(el.angle) * 2.2);
      } else {
        el.mesh.position.set(Math.cos(el.angle) * 3.6, Math.sin(el.angle) * 1.6, Math.sin(el.angle) * 1.4);
      }
    }

    /* panels bob */
    for (var p = 0; p < panels.length; p++) {
      panels[p].mesh.position.y = panels[p].baseY + Math.sin(time * 0.6 + panels[p].seed) * 0.35;
      panels[p].mesh.rotation.y += dt * 0.06;
    }

    /* risers float upward */
    var rp = riserGeo.attributes.position.array;
    for (var r2 = 0; r2 < riserCount; r2++) {
      rp[r2 * 3 + 1] += riserSpeed[r2] * dt;
      if (rp[r2 * 3 + 1] > 13) {
        rp[r2 * 3 + 1] = -2.4;
        rp[r2 * 3] = (Math.random() - 0.5) * 70;
        rp[r2 * 3 + 2] = (Math.random() - 0.5) * 90;
      }
    }
    riserGeo.attributes.position.needsUpdate = true;

    stars.rotation.y += dt * 0.008;
    gridFloor2.material.opacity = 0.35 + Math.sin(time * 0.5) * 0.05;

    updateBursts(dt);
    renderer.render(scene, camera);
  }

  function smoothStep(edge0, edge1, x) {
    var t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  window.addEventListener('resize', function () {
    window.Scene3D && window.Scene3D.resize();
  }, { passive: true });

  /* ---------- glow / shadow sprite helpers ---------- */
  function makeGlowSprite(color, opacity, sizeRatio) {
    var c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(128, 128, 4, 128, 128, 128);
    var col = new THREE.Color(color);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.35, 'rgba(' + (col.r * 255 | 0) + ',' + (col.g * 255 | 0) + ',' + (col.b * 255 | 0) + ',0.55)');
    grad.addColorStop(1, 'rgba(' + (col.r * 255 | 0) + ',' + (col.g * 255 | 0) + ',' + (col.b * 255 | 0) + ',0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);

    var tex = new THREE.CanvasTexture(c);
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex,
      color: color,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    sprite.scale.set(6 * (sizeRatio || 1), 6 * (sizeRatio || 1), 1);
    return sprite;
  }

  function makeSoftShadow(color, opacity) {
    var c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    grad.addColorStop(0, 'rgba(0,0,0,0.85)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    var tex = new THREE.CanvasTexture(c);
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex,
      color: color,
      transparent: true,
      opacity: opacity,
      depthWrite: false
    }));
    return sprite;
  }

  requestAnimationFrame(animate);
})();
