/**
 * bg-canvas-mvv.js — PLai MVV Page Background Animation
 * Brand gradient blobs + floating circles
 */
(function () {
  'use strict';

  var canvas = document.getElementById('bgCanvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var width, height, dpr;
  var time = 0;

  // Floating circles data (persistent across frames)
  var circles = [
    { x: 0.15, y: 0.2,  r: 120, sx: 0.08, sy: 0.06, px: 1.2, py: 0.8, color: [155,140,255], alpha: 0.10 },
    { x: 0.75, y: 0.3,  r: 180, sx: 0.05, sy: 0.07, px: 0.7, py: 1.3, color: [155,140,255], alpha: 0.08 },
    { x: 0.5,  y: 0.6,  r: 150, sx: 0.06, sy: 0.04, px: 1.5, py: 0.6, color: [200,121,65],  alpha: 0.08 },
    { x: 0.85, y: 0.7,  r: 100, sx: 0.07, sy: 0.09, px: 0.9, py: 1.1, color: [200,121,65],  alpha: 0.06 },
    { x: 0.3,  y: 0.8,  r: 200, sx: 0.04, sy: 0.05, px: 1.0, py: 0.9, color: [155,140,255], alpha: 0.07 },
    { x: 0.6,  y: 0.15, r: 90,  sx: 0.09, sy: 0.06, px: 1.4, py: 0.7, color: [200,121,65],  alpha: 0.06 },
    { x: 0.2,  y: 0.5,  r: 130, sx: 0.05, sy: 0.08, px: 0.8, py: 1.2, color: [155,140,255], alpha: 0.07 },
  ];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function animate() {
    time += 1 / 30;
    ctx.clearRect(0, 0, width, height);

    // Background fill
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    var isSP = width <= 768;

    // ── Floating circles (smooth, slow drift) ──
    for (var c = 0; c < circles.length; c++) {
      var ci = circles[c];
      var cx = ci.x * width  + Math.sin(time * ci.sx * 0.8 + ci.px * 3) * width * 0.06;
      var cy = ci.y * height + Math.cos(time * ci.sy * 0.8 + ci.py * 3) * height * 0.06;
      var cr = (isSP ? ci.r * 0.6 : ci.r) + Math.sin(time * 0.15 + c) * 15;

      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
      grad.addColorStop(0, 'rgba(' + ci.color.join(',') + ',' + ci.alpha + ')');
      grad.addColorStop(0.6, 'rgba(' + ci.color.join(',') + ',' + (ci.alpha * 0.4) + ')');
      grad.addColorStop(1, 'rgba(' + ci.color.join(',') + ',0)');

      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // ── Organic blobs ──
    var t1 = time * 0.12;
    var t2 = time * 0.09;
    var t3 = time * 0.06;
    var t4 = time * 0.15;

    // Blob 1: Large purple blob (right-biased)
    var sx1 = (Math.cos(t1 + 1.5) + Math.cos(t2 + 0.9) + Math.sin(t3 * 1.3)) / 3;
    var sy1 = (Math.sin(t1 + 0.7) + Math.cos(t2 + 2.1) + Math.sin(t4 * 0.8)) / 3;
    var b1cx = width * (isSP ? 0.65 : 0.7) + sx1 * width * 0.1;
    var b1cy = height * 0.4 + sy1 * height * 0.12;
    var b1r = (isSP ? 220 : 380) + Math.sin(t3 * 1.5) * 40;
    drawOrganicBlob(b1cx, b1cy, b1r, time * 2.5, [
      { stop: 0, color: 'rgba(123, 108, 224, 0.35)' },
      { stop: 0.4, color: 'rgba(155, 140, 255, 0.22)' },
      { stop: 0.7, color: 'rgba(155, 140, 255, 0.08)' },
      { stop: 1, color: 'rgba(155, 140, 255, 0)' }
    ]);

    // Blob 2: Orange/warm blob (left-lower)
    var sx2 = (Math.cos(t2 + 3.1) + Math.sin(t3 + 1.2) + Math.cos(t4 + 0.5)) / 3;
    var sy2 = (Math.sin(t1 + 2.3) + Math.cos(t3 + 0.4) + Math.sin(t2 + 1.8)) / 3;
    var b2cx = width * (isSP ? 0.35 : 0.3) + sx2 * width * 0.12;
    var b2cy = height * 0.6 + sy2 * height * 0.15;
    var b2r = (isSP ? 180 : 320) + Math.cos(t2 * 1.8) * 35;
    drawOrganicBlob(b2cx, b2cy, b2r, -time * 1.8 + 45, [
      { stop: 0, color: 'rgba(200, 121, 65, 0.30)' },
      { stop: 0.4, color: 'rgba(232, 184, 138, 0.18)' },
      { stop: 0.7, color: 'rgba(232, 184, 138, 0.06)' },
      { stop: 1, color: 'rgba(232, 184, 138, 0)' }
    ]);

    // Blob 3: Small accent purple-pink (top-center)
    var b3cx = width * 0.5 + Math.sin(t1 * 1.7 + 2) * width * 0.08;
    var b3cy = height * 0.25 + Math.cos(t2 * 1.4 + 1) * height * 0.1;
    var b3r = (isSP ? 100 : 180) + Math.sin(t3 * 2.2) * 25;
    drawOrganicBlob(b3cx, b3cy, b3r, time * 3.5, [
      { stop: 0, color: 'rgba(155, 140, 255, 0.20)' },
      { stop: 0.5, color: 'rgba(200, 121, 65, 0.10)' },
      { stop: 1, color: 'rgba(247, 240, 246, 0)' }
    ]);

    requestAnimationFrame(animate);
  }

  function drawOrganicBlob(cx, cy, radius, angle, colorStops) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle * Math.PI / 180);

    var grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    for (var i = 0; i < colorStops.length; i++) {
      grad.addColorStop(colorStops[i].stop, colorStops[i].color);
    }

    ctx.beginPath();
    var points = 72;
    for (var j = 0; j <= points; j++) {
      var a = (j / points) * Math.PI * 2;
      var deform = 1 +
        Math.sin(a * 3 + time * 0.6) * 0.18 +
        Math.sin(a * 5 + time * 0.9) * 0.1 +
        Math.cos(a * 2 + time * 0.4) * 0.14 +
        Math.sin(a * 7 + time * 0.3) * 0.05;
      var r = radius * deform;
      var px = Math.cos(a) * r;
      var py = Math.sin(a) * r;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.filter = 'blur(40px)';
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();
  }

  window.addEventListener('resize', resize);
  resize();
  animate();
})();
