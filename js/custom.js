/**
 * custom.js — PLai Corporate Site
 * Opening: logo center → fly to header (GSAP)
 * Dependencies: jQuery 3.7.1, GSAP, Swiper
 */

(function ($) {
  'use strict';

  /* =========================================================
   * OPENING ANIMATION (Logo center → fly to header → fade)
   * ========================================================= */
  function initOpeningAnimation() {
    var $opening = $('#opening');
    var openingLogo = document.getElementById('openingLogo');
    var $header = $('#header');
    var headerLogo = document.getElementById('headerLogo');

    if (!$opening.length || !openingLogo || !$header.length || !headerLogo) {
      document.body.classList.add('is-load-end');
      return;
    }

    // Hide header initially
    gsap.set($header[0], { opacity: 0 });
    gsap.set('.p-header__menu', { opacity: 0, y: -10 });

    // KV elements hidden initially
    if (document.querySelector('.p-kv__text')) {
      gsap.set('.p-kv__text', { opacity: 0, y: 60 });
    }
    if (document.querySelector('.p-kv__visual')) {
      gsap.set('.p-kv__visual', { opacity: 0, scale: 0.95 });
    }

    // Opening logo initial state
    gsap.set(openingLogo, { opacity: 0, scale: 0.85 });

    var tl = gsap.timeline();

    // Phase 1: Logo fades in at center
    tl.to(openingLogo, {
      opacity: 1,
      scale: 1,
      duration: 0.45,
      ease: 'power2.out'
    }, 0.2);

    // Phase 2: Logo flies to header position
    tl.call(function () {
      // Temporarily show header to measure position
      $header[0].style.opacity = '1';
      $header[0].style.visibility = 'visible';

      var headerRect = headerLogo.getBoundingClientRect();
      var openingRect = openingLogo.getBoundingClientRect();

      // Hide again
      $header[0].style.opacity = '0';

      var deltaX = headerRect.left + (headerRect.width / 2) - (openingRect.left + (openingRect.width / 2));
      var deltaY = headerRect.top + (headerRect.height / 2) - (openingRect.top + (openingRect.height / 2));
      var scaleRatio = headerRect.height / openingRect.height;

      gsap.to(openingLogo, {
        x: deltaX,
        y: deltaY,
        scale: scaleRatio,
        duration: 0.55,
        ease: 'power3.inOut'
      });
    }, null, null, 0.8);

    // Phase 3: Overlay fades out, header appears
    tl.to($opening[0], {
      opacity: 0,
      duration: 0.45,
      ease: 'power2.inOut',
      onComplete: function () {
        $opening.css('display', 'none');
        document.body.classList.add('is-load-end');
      }
    }, 1.3);

    tl.to($header[0], {
      opacity: 1,
      duration: 0.4,
      ease: 'power2.out'
    }, 1.3);

    // Phase 4: KV text and visual animate in
    if (document.querySelector('.p-kv__text')) {
      tl.to('.p-kv__text', {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power2.out'
      }, 1.4);
    }
    if (document.querySelector('.p-kv__visual')) {
      tl.to('.p-kv__visual', {
        opacity: 1,
        scale: 1,
        duration: 0.8,
        ease: 'power2.out'
      }, 1.5);
    }

    // Phase 5: MENU button
    tl.to('.p-header__menu', {
      opacity: 1,
      y: 0,
      duration: 0.35,
      ease: 'power2.out'
    }, 1.5);
  }


  /* =========================================================
   * CLOCK (philduct.com style)
   * ========================================================= */
  function initClock() {
    var el = document.querySelector('.js-clock');
    if (!el) return;

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function update() {
      var now = new Date();
      var h = pad(now.getHours());
      var m = pad(now.getMinutes());
      var s = pad(now.getSeconds());
      el.innerHTML =
        '<span>' + h[0] + '</span><span>' + h[1] + '</span>' +
        '<span>:</span>' +
        '<span>' + m[0] + '</span><span>' + m[1] + '</span>' +
        '<span>:</span>' +
        '<span>' + s[0] + '</span><span>' + s[1] + '</span>';
    }

    update();
    setInterval(update, 1000);
  }


  /* =========================================================
   * MENU TOGGLE (fullscreen gradient menu)
   * ========================================================= */
  function initMenuToggle() {
    var $menuOpen = $('.js-menu-open');
    if (!$menuOpen.length) return;

    $menuOpen.on('click', function (e) {
      e.preventDefault();
      var isOpen = document.body.classList.contains('is-menu-open');
      document.body.classList.toggle('is-menu-open', !isOpen);
    });

    $('.p-menu__nav a').not('.js-services-toggle').on('click', function () {
      document.body.classList.remove('is-menu-open');
    });

    // Services dropdown: hover on pointer devices, tap-toggle on touch
    var $servicesToggle = $('.p-menu__services-toggle');
    var $servicesFlyout = $('.p-menu__services');
    var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (canHover) {
      // Hover bridge: keep flyout open while pointer is on toggle OR flyout,
      // with 300ms grace period for the visual gap between them.
      var closeTimer = null;
      function openServices() {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        $servicesToggle.addClass('is-open');
      }
      function closeServicesDelayed() {
        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = setTimeout(function () {
          $servicesToggle.removeClass('is-open');
          closeTimer = null;
        }, 300);
      }
      $servicesToggle.on('mouseenter', openServices);
      $servicesToggle.on('mouseleave', closeServicesDelayed);
      $servicesFlyout.on('mouseenter', openServices);
      $servicesFlyout.on('mouseleave', closeServicesDelayed);
      $('.js-services-toggle').on('click', function (e) {
        e.preventDefault();
      });
    } else {
      $('.js-services-toggle').on('click', function (e) {
        e.preventDefault();
        $(this).closest('.p-menu__services-toggle').toggleClass('is-open');
      });
    }
  }


  /* =========================================================
   * SCROLL STATE (is-scroll class on body)
   * ========================================================= */
  function initScrollState() {
    function onScroll() {
      document.body.classList.toggle('is-scroll', window.scrollY > 10);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }


  /* =========================================================
   * SIDE NAV DOTS
   * ========================================================= */
  function initSideNav() {
    var $items = $('.js-nav-item');
    var $areas = $('.js-area');
    if (!$items.length || !$areas.length) return;

    function updateNav() {
      var scrollTop = window.scrollY + window.innerHeight / 2;

      $areas.each(function (i) {
        if (i >= $items.length) return;
        var $area = $(this);
        var top = $area.offset().top;
        var bottom = top + $area.outerHeight();

        if (scrollTop >= top && scrollTop < bottom) {
          $items.removeClass('is-current');
          $items.eq(i).addClass('is-current');
        }
      });
    }

    window.addEventListener('scroll', updateNav, { passive: true });
    updateNav();
  }


  /* =========================================================
   * SCROLL REVEAL (IntersectionObserver)
   * ========================================================= */
  function initScrollReveal() {
    var revealEls = document.querySelectorAll('[data-reveal], .js-enter');
    if (!revealEls.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  }


  /* =========================================================
   * SMOOTH SCROLL
   * ========================================================= */
  function initSmoothScroll() {
    $(document).on('click', 'a[href^="#"]', function (e) {
      var href = $(this).attr('href');
      if (href === '#' || href.length <= 1) return;

      var $target = $(href);
      if (!$target.length) return;

      e.preventDefault();
      document.body.classList.remove('is-menu-open');

      var targetTop = $target.offset().top;
      $('html, body').animate({ scrollTop: targetTop }, 600, 'swing');
    });
  }


  /* =========================================================
   * FAQ ACCORDION
   * ========================================================= */
  function initFaqAccordion() {
    $(document).on('click', '.faq__q', function () {
      var $item = $(this).closest('.faq__item');
      var $answer = $item.find('.faq__a');
      var isOpen = $item.hasClass('faq__item--open');

      $('.faq__item--open').not($item).each(function () {
        $(this).removeClass('faq__item--open');
        $(this).find('.faq__a').slideUp(300);
      });

      $item.toggleClass('faq__item--open', !isOpen);
      if (isOpen) {
        $answer.slideUp(300);
      } else {
        $answer.slideDown(300);
      }
    });
  }


  /* =========================================================
   * GALLERY SWIPER
   * ========================================================= */
  function initGallerySwiper() {
    var swiperEl = document.querySelector('.gallery__swiper');
    if (!swiperEl) return;

    new Swiper('.gallery__swiper', {
      loop: true,
      speed: 800,
      centeredSlides: true,
      spaceBetween: 20,
      slidesPerView: 1.3,
      breakpoints: {
        768: { slidesPerView: 3, spaceBetween: 20 }
      },
      autoplay: { delay: 3000, disableOnInteraction: false, pauseOnMouseEnter: true },
      navigation: { nextEl: '.gallery__next', prevEl: '.gallery__prev' }
    });
  }


  /* =========================================================
   * COUNTER ANIMATION
   * ========================================================= */
  function initCounterAnimation() {
    var counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;

    var observed = false;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !observed) {
          observed = true;
          counters.forEach(function (el) {
            var target = parseInt(el.getAttribute('data-count'), 10);
            var duration = 2000;
            var startTime = null;

            function step(timestamp) {
              if (!startTime) startTime = timestamp;
              var progress = Math.min((timestamp - startTime) / duration, 1);
              var eased = 1 - Math.pow(1 - progress, 3);
              var current = Math.floor(eased * target);
              el.textContent = current.toLocaleString();
              if (progress < 1) {
                requestAnimationFrame(step);
              } else {
                el.textContent = target.toLocaleString();
              }
            }

            requestAnimationFrame(step);
          });
          observer.disconnect();
        }
      });
    }, { threshold: 0.3 });

    counters.forEach(function (el) {
      observer.observe(el.closest('.stats__item') || el);
    });
  }


  /* =========================================================
   * VH unit fix for mobile
   * ========================================================= */
  function initVH() {
    function setVH() {
      var vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', vh + 'px');
    }
    setVH();
    window.addEventListener('resize', setVH);
  }


  /* =========================================================
   * GROWTH GRAPH — sequential bar animation + counter
   * ========================================================= */
  function initGrowthGraph() {
    var graphs = document.querySelectorAll('.growth-graph, .growth-graph--studio');
    if (!graphs.length) return;

    graphs.forEach(function (graph) {
      var bars = graph.querySelectorAll('.growth-graph__bar');
      var counterEl = graph.querySelector('.growth-graph__current') || graph.querySelector('.growth-graph__counter');
      var animated = false;
      var isStudio = graph.classList.contains('growth-graph--studio');
      var target = isStudio ? 20000 : 25000;
      var finalText = isStudio ? '+20,000' : '+25,000';

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !animated) {
            animated = true;

            // Sequential bar animation
            bars.forEach(function (bar, i) {
              setTimeout(function () {
                bar.classList.add('is-visible');
              }, i * 60);
            });

            // Counter animation
            if (counterEl) {
              var duration = 2400;
              var startTime = null;
              function step(ts) {
                if (!startTime) startTime = ts;
                var p = Math.min((ts - startTime) / duration, 1);
                var eased = 1 - Math.pow(1 - p, 3);
                var val = Math.floor(eased * target);
                counterEl.textContent = '+' + val.toLocaleString();
                if (p < 1) requestAnimationFrame(step);
                else counterEl.textContent = finalText;
              }
              requestAnimationFrame(step);
            }

            observer.disconnect();
          }
        });
      }, { threshold: 0.2 });

      observer.observe(graph);
    });
  }


  /* =========================================================
   * INIT
   * ========================================================= */
  initVH();

  $(function () {
    initOpeningAnimation();
    initClock();
    initMenuToggle();
    initScrollState();
    initSideNav();
    initScrollReveal();
    initSmoothScroll();
    initFaqAccordion();
    initGallerySwiper();
    initCounterAnimation();
    initGrowthGraph();
  });

})(jQuery);
