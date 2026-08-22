/* =========================================================================
   SIMBIOZ EMS MILTECH — landing behaviour
   Прокрутка відстежується виключно через IntersectionObserver.
   Слухачів window 'scroll' немає навмисно: вони дають джанк на мобільних.
   ========================================================================= */
(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     НАЛАШТУВАННЯ: куди відправляти форму.
     Поки рядок порожній, форма нікуди не надсилається і показує це відкрито.
     Вкажіть URL свого обробника (POST, JSON) — і форма запрацює.
     ----------------------------------------------------------------------- */
  var FORM_ENDPOINT = '';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ------------------------------ Рік у футері ------------------------------ */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ------------------------------ Тінь у шапки ------------------------------ */
  (function stickyHeader() {
    var header = document.getElementById('site-header');
    if (!header || !('IntersectionObserver' in window)) return;

    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
    document.body.insertBefore(sentinel, document.body.firstChild);

    new IntersectionObserver(function (entries) {
      header.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(sentinel);
  })();

  /* ------------------------------ Мобільне меню ------------------------------ */
  (function mobileNav() {
    var toggle = document.getElementById('nav-toggle');
    var nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;

    var close = function () {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      nav.classList.toggle('is-open', !open);
      toggle.setAttribute('aria-expanded', String(!open));
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        close();
        toggle.focus();
      }
    });
  })();

  /* ------------------------------ Активний пункт меню ------------------------------ */
  (function activeNav() {
    if (!('IntersectionObserver' in window)) return;

    var links = $$('.site-nav__list a');
    var map = {};
    var targets = [];

    links.forEach(function (link) {
      var id = link.getAttribute('href').slice(1);
      var section = document.getElementById(id);
      if (!section) return;
      map[id] = link;
      targets.push(section);
    });
    if (!targets.length) return;

    var visible = {};

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible[entry.target.id] = entry.isIntersecting ? entry.intersectionRatio : 0;
      });
      var bestId = null, bestRatio = 0;
      Object.keys(visible).forEach(function (id) {
        if (visible[id] > bestRatio) { bestRatio = visible[id]; bestId = id; }
      });
      links.forEach(function (l) { l.classList.remove('is-active'); });
      if (bestId && map[bestId]) map[bestId].classList.add('is-active');
    }, { rootMargin: '-80px 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });

    targets.forEach(function (t) { io.observe(t); });
  })();

  /* ------------------------------ Поява блоків при скролі ------------------------------ */
  (function reveal() {
    var items = $$('.reveal');
    if (!items.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var group = el.closest('.reveal-group');
        var index = group ? $$('.reveal', group).indexOf(el) : 0;
        el.style.transitionDelay = Math.min(index, 6) * 60 + 'ms';
        el.classList.add('is-in');
        obs.unobserve(el);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    items.forEach(function (el) { io.observe(el); });
  })();

  /* ------------------------------ Таби (сценарії, ролі) ------------------------------ */
  $$('[data-tabs]').forEach(function (root) {
    var tabs = $$('[role="tab"]', root);
    if (!tabs.length) return;

    var panelFor = function (tab) {
      return document.getElementById(tab.getAttribute('aria-controls'));
    };

    var select = function (tab, focus) {
      tabs.forEach(function (t) {
        var isTarget = t === tab;
        t.setAttribute('aria-selected', String(isTarget));
        t.setAttribute('tabindex', isTarget ? '0' : '-1');
        var panel = panelFor(t);
        if (panel) panel.hidden = !isTarget;
      });
      if (focus) tab.focus();
    };

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { select(tab, false); });

      tab.addEventListener('keydown', function (e) {
        var i = tabs.indexOf(tab);
        var next = null;

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];

        if (next) { e.preventDefault(); select(next, true); }
      });
    });
  });

  /* ------------------------------ Форма ------------------------------ */
  (function contactForm() {
    var form = document.getElementById('request-form');
    if (!form) return;

    var button = $('[data-submit]', form);
    var label = $('[data-label]', button);
    var status = $('[data-status]', form);
    var labelIdle = label.textContent;

    var rules = {
      name: function (v) { return v.trim().length >= 2; },
      phone: function (v) { return v.replace(/\D/g, '').length >= 9; },
      email: function (v) { return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v.trim()); },
      topic: function (v) { return v !== ''; }
    };

    var fieldOf = function (name) { return form.elements[name]; };

    var setError = function (name, hasError) {
      var input = fieldOf(name);
      var msg = document.getElementById('e-' + name);
      if (!input) return;
      input.setAttribute('aria-invalid', String(hasError));
      if (msg) msg.hidden = !hasError;
    };

    var validate = function () {
      var firstBad = null;
      Object.keys(rules).forEach(function (name) {
        var input = fieldOf(name);
        if (!input) return;
        var ok = rules[name](input.value);
        setError(name, !ok);
        if (!ok && !firstBad) firstBad = input;
      });
      return firstBad;
    };

    // Прибираємо помилку, щойно користувач виправляє поле
    Object.keys(rules).forEach(function (name) {
      var input = fieldOf(name);
      if (!input) return;
      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid') === 'true' && rules[name](input.value)) setError(name, false);
      });
      input.addEventListener('change', function () {
        if (rules[name](input.value)) setError(name, false);
      });
    });

    var say = function (text, state) {
      status.textContent = text;
      status.hidden = false;
      if (state) status.setAttribute('data-state', state);
      else status.removeAttribute('data-state');
    };

    var setBusy = function (busy) {
      button.setAttribute('aria-busy', String(busy));
      label.textContent = busy ? 'Надсилаємо…' : labelIdle;
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var firstBad = validate();
      if (firstBad) {
        say('Перевірте виділені поля.', 'error');
        firstBad.focus();
        return;
      }

      var payload = {
        name: fieldOf('name').value.trim(),
        phone: fieldOf('phone').value.trim(),
        email: fieldOf('email').value.trim(),
        company: fieldOf('company') ? fieldOf('company').value.trim() : '',
        topic: fieldOf('topic').value,
        page: window.location.href
      };

      if (!FORM_ENDPOINT) {
        console.warn('[Simbioz] FORM_ENDPOINT не заданий у js/main.js. Заявка не надіслана.', payload);
        say('Форму ще не підключено до обробника. Вкажіть FORM_ENDPOINT у js/main.js.', 'error');
        return;
      }

      setBusy(true);
      say('Надсилаємо заявку…');

      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          form.reset();
          say('Дякуємо. Ми зв\'яжемося протягом одного робочого дня.');
        })
        .catch(function (err) {
          console.error('[Simbioz] Не вдалося надіслати форму:', err);
          say('Не вдалося надіслати заявку. Спробуйте ще раз або напишіть на info@simbioz.com.', 'error');
        })
        .then(function () { setBusy(false); });
    });
  })();
})();
