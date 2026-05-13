/**
 * bg-canvas.js — PLai Background Animation
 * Organic blob animation — large, right-aligned, wiggly fan shapes
 * Uses brand gradient: #7b6ce0 → #9b8cff → #c87941 → #e8b88a → #f7f0f6
 */
(function () {
  'use strict';

  var canvas = document.getElementById('bgCanvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var width, height, dpr;
  var time = 0;
  var blobs = [];
  var imagesLoaded = 0;
  var totalImages = 2;

  var img1 = new Image();
  var img2 = new Image();
  img1.src = 'assets/img/kv-3.png';
  img2.src = 'assets/img/kv-2.png';

  function onImageLoad() {
    imagesLoaded++;
    if (imagesLoaded >= totalImages) {
      resize();
      animate();
    }
  }

  img1.onload = onImageLoad;
  img2.onload = onImageLoad;

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
    ctx.fillStyle = '#f7f7f7';
    ctx.fillRect(0, 0, width, height);

    if (imagesLoaded < totalImages) {
      requestAnimationFrame(animate);
      return;
    }

    var isSP = width <= 768;

    // --- Movement math (more exaggerated than philduct) ---
    // Multiple sine/cosine waves for organic "wiggly" motion
    var t1 = time * 0.15;
    var t2 = time * 0.11;
    var t3 = time * 0.07;
    var t4 = time * 0.19;

    var sx = (Math.cos(t1 + 1.5) + Math.cos(t2 + 0.9) + Math.sin(t3 * 1.3)) / 3;
    var sy = (Math.sin(t1 + 0.7) + Math.cos(t2 + 2.1) + Math.sin(t4 * 0.8)) / 3;
    var sx2 = (Math.cos(t2 + 3.1) + Math.sin(t3 + 1.2) + Math.cos(t4 + 0.5)) / 3;
    var sy2 = (Math.sin(t1 + 2.3) + Math.cos(t3 + 0.4) + Math.sin(t2 + 1.8)) / 3;

    // --- Blob 0: Background blob (large, right-biased) ---
    var b0cx = width * (isSP ? 0.65 : 0.72) + sx * width * 0.08;
    var b0cy = height * 0.45 + sy * height * 0.1;
    var b0scale = isSP ? 0.9 : 1.15;
    var b0sx = b0scale + sx * 0.06;
    var b0sy = b0scale + sy * 0.05;
    var b0angle = time * 3.5;

    drawBlob(img1, b0cx, b0cy, b0sx, b0sy, b0angle, 0.85);

    // --- Blob 1: Foreground blob (moves more, wiggly, fan-shaped spread) ---
    var b1cx = width * (isSP ? 0.55 : 0.65) + sx2 * width * 0.18;
    var b1cy = height * 0.5 + sy2 * height * 0.2;
    var b1scale = isSP ? 0.7 : 0.95;
    var b1sx = b1scale + sx2 * 0.1;
    var b1sy = b1scale + sy2 * 0.08;
    var b1angle = -time * 2.8 + Math.sin(time * 0.2) * 15;

    drawBlob(img2, b1cx, b1cy, b1sx, b1sy, b1angle, 0.9);

    // --- Blob 2: Small accent blob (gradient colored, extra wiggly) ---
    var b2cx = width * (isSP ? 0.75 : 0.82) + Math.sin(t1 * 1.7 + 2) * width * 0.06;
    var b2cy = height * 0.35 + Math.cos(t2 * 1.4 + 1) * height * 0.12;
    var b2r = (isSP ? 80 : 160) + Math.sin(t3 * 2) * 30;
    drawGradientBlob(b2cx, b2cy, b2r, time * 4);

    requestAnimationFrame(animate);
  }

  function drawBlob(img, cx, cy, sx, sy, angle, alpha) {
    var w = img.naturalWidth;
    var h = img.naturalHeight;
    var baseW = width * 1.3;
    var baseH = baseW * (h / w);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(angle * Math.PI / 180);
    ctx.scale(sx, sy);
    ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);
    ctx.restore();
  }

  function drawGradientBlob(cx, cy, radius, angle) {
    // Organic wiggly shape using sine-deformed circle
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle * Math.PI / 180);

    // Create gradient matching brand colors
    var grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    grad.addColorStop(0, 'rgba(155, 140, 255, 0.25)');
    grad.addColorStop(0.4, 'rgba(123, 108, 224, 0.15)');
    grad.addColorStop(0.7, 'rgba(200, 121, 65, 0.08)');
    grad.addColorStop(1, 'rgba(232, 184, 138, 0)');

    ctx.beginPath();
    var points = 64;
    for (var i = 0; i <= points; i++) {
      var a = (i / points) * Math.PI * 2;
      // Deform the circle with multiple sine waves for organic shape
      var deform = 1 +
        Math.sin(a * 3 + time * 0.8) * 0.15 +
        Math.sin(a * 5 + time * 1.2) * 0.08 +
        Math.cos(a * 2 + time * 0.5) * 0.12;
      var r = radius * deform;
      var px = Math.cos(a) * r;
      var py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.filter = 'blur(20px)';
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();
  }

  window.addEventListener('resize', resize);
})();
