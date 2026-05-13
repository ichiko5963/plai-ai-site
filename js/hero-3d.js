/**
 * hero-3d.js — Interlocking translucent torus rings with particle detail
 * Frosted glass aesthetic with purple/orange brand gradient
 * Dependencies: Three.js r128+
 */
(function () {
  'use strict';

  var canvas = document.getElementById('hero3d');
  if (!canvas || typeof THREE === 'undefined') return;

  var wrap = canvas.parentElement;
  var W, H;

  function getSize() {
    W = canvas.clientWidth || wrap.clientWidth;
    H = canvas.clientHeight || wrap.clientHeight;
  }
  getSize();

  // ── Scene ──
  var scene = new THREE.Scene();
  scene.background = null;

  // ── Camera ──
  var camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
  camera.position.set(0, 0.15, 7.4);

  // ── Renderer ──
  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;

  // ── Lighting — stronger, more saturated ──
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  var keyLight = new THREE.DirectionalLight(0xffd4a0, 1.2);
  keyLight.position.set(4, 3, 5);
  scene.add(keyLight);

  var fillLight = new THREE.DirectionalLight(0xb8a0ff, 1.0);
  fillLight.position.set(-4, 2, 3);
  scene.add(fillLight);

  var rimLight = new THREE.DirectionalLight(0xe0d0ff, 0.5);
  rimLight.position.set(0, -2, -4);
  scene.add(rimLight);

  // Extra top light for iridescence
  var topLight = new THREE.PointLight(0xd8b0ff, 0.6, 10);
  topLight.position.set(0, 4, 2);
  scene.add(topLight);

  // ── Group ──
  var group = new THREE.Group();
  scene.add(group);

  // ── Create torus — higher polygon count for finer grain ──
  function createTorus(radius, tube, color, opacity, rotX, rotY, rotZ, emissiveStr) {
    // 96 radial × 200 tubular = fine-grained surface
    var geometry = new THREE.TorusGeometry(radius, tube, 96, 200);
    var material = new THREE.MeshPhysicalMaterial({
      color: color,
      metalness: 0.12,
      roughness: 0.08,
      transparent: true,
      opacity: opacity,
      side: THREE.DoubleSide,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transmission: 0.3,
      thickness: 0.6,
      envMapIntensity: 1.0,
      emissive: color,
      emissiveIntensity: emissiveStr || 0.06
    });

    var mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.set(rotX, rotY, rotZ);
    return mesh;
  }

  // Ring 1 — rich purple torus (bigger)
  var ring1 = createTorus(
    1.55, 0.24,
    0xa090ff, 0.7,
    0.3, 0.1, 0,
    0.08
  );

  // Ring 2 — warm orange/peach torus, interlocking (bigger)
  var ring2 = createTorus(
    1.55, 0.24,
    0xd8a070, 0.65,
    1.2, 0.6, 0.4,
    0.07
  );

  // Ring 3 — inner accent ring (lavender, more visible)
  var ring3 = createTorus(
    1.2, 0.14,
    0xc0b0f0, 0.45,
    0.8, -0.3, 0.6,
    0.05
  );

  group.add(ring1);
  group.add(ring2);
  group.add(ring3);

  // ── Particles — fine glitter dust around the rings ──
  var particleCount = 600;
  var particleGeo = new THREE.BufferGeometry();
  var positions = new Float32Array(particleCount * 3);
  var sizes = new Float32Array(particleCount);

  for (var i = 0; i < particleCount; i++) {
    // Distribute particles in a sphere around the rings
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.acos(2 * Math.random() - 1);
    var r = 1.2 + Math.random() * 1.0;
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = 1.5 + Math.random() * 2.5;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  var particleMat = new THREE.PointsMaterial({
    color: 0xc8b8ff,
    size: 0.018,
    transparent: true,
    opacity: 0.35,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  var particles = new THREE.Points(particleGeo, particleMat);
  group.add(particles);

  // Tilt the whole group
  group.rotation.x = 0.15;
  group.rotation.y = -0.1;

  // ── Mouse interaction ──
  var mouse = { x: 0, y: 0 };

  window.addEventListener('mousemove', function (e) {
    mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // ── Animation ──
  var clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    var elapsed = clock.getElapsedTime();

    // Slow continuous rotation
    var baseRotY = -0.1 + elapsed * 0.06;
    var baseRotX = 0.15 + Math.sin(elapsed * 0.12) * 0.08;

    // Mouse influence
    var targetRotX = baseRotX + mouse.y * 0.08;
    var targetRotY = baseRotY + mouse.x * 0.12;

    group.rotation.x += (targetRotX - group.rotation.x) * 0.03;
    group.rotation.y += (targetRotY - group.rotation.y) * 0.03;

    // Ring breathing
    ring1.scale.setScalar(1 + Math.sin(elapsed * 0.4) * 0.015);
    ring2.scale.setScalar(1 + Math.sin(elapsed * 0.4 + 1.5) * 0.015);
    ring3.scale.setScalar(1 + Math.sin(elapsed * 0.5 + 3) * 0.02);

    // Particles slowly drift
    particles.rotation.y = elapsed * 0.02;
    particles.rotation.x = Math.sin(elapsed * 0.08) * 0.05;

    // Particle shimmer
    particleMat.opacity = 0.3 + Math.sin(elapsed * 0.6) * 0.1;

    renderer.render(scene, camera);
  }

  // ── Resize ──
  window.addEventListener('resize', function () {
    getSize();
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
  });

  animate();
})();
