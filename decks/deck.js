/**
 * PLai Deck Framework — shared navigation
 * - keyboard: ←/→/Space/Home/End
 * - click: previous/next buttons
 * - URL hash sync: #N for slide index
 * - 16:9 canvas scaled to viewport
 */
(function () {
  'use strict';

  const canvas = document.querySelector('.deck-canvas');
  const slides = Array.from(document.querySelectorAll('.slide'));
  if (!canvas || slides.length === 0) return;

  let current = 0;

  function scaleCanvas() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / 1920, vh / 1080);
    canvas.style.transform = `scale(${scale})`;
  }
  scaleCanvas();
  window.addEventListener('resize', scaleCanvas);

  function render() {
    slides.forEach((s, i) => s.classList.toggle('is-active', i === current));
    const countEl = document.querySelector('.deck-nav__count');
    if (countEl) countEl.textContent = `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    const progEl = document.querySelector('.deck-nav__progress span');
    if (progEl) progEl.style.width = `${((current + 1) / slides.length) * 100}%`;
    if (window.location.hash !== `#${current + 1}`) {
      history.replaceState(null, '', `#${current + 1}`);
    }
  }

  function goTo(i) {
    current = Math.max(0, Math.min(slides.length - 1, i));
    render();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      goTo(current + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      goTo(current - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      goTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goTo(slides.length - 1);
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.deck-nav__prev')) goTo(current - 1);
    else if (e.target.closest('.deck-nav__next')) goTo(current + 1);
  });

  // Touch swipe
  let touchStartX = 0;
  document.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 60) {
      if (dx < 0) goTo(current + 1);
      else goTo(current - 1);
    }
  });

  // Initial slide from hash
  const initial = parseInt(window.location.hash.replace('#', ''), 10);
  if (!isNaN(initial) && initial >= 1 && initial <= slides.length) {
    current = initial - 1;
  }
  render();
})();
