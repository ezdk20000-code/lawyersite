/* ==========================================================
   Сайт юриста — логика: UTM-метки, цели Метрики, формы, квиз
   ========================================================== */
(function () {
  'use strict';

  var CFG = window.SITE_CONFIG || {};
  var params = new URLSearchParams(location.search);

  /* ---------- Яндекс Метрика ---------- */
  if (CFG.metrikaId) {
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
    window.ym(CFG.metrikaId, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  }

  function goal(name) {
    if (CFG.metrikaId && window.ym) window.ym(CFG.metrikaId, 'reachGoal', name);
  }

  /* ---------- UTM-метки: сохраняем первое касание на 30 дней ---------- */
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 's', 'yclid'];

  function storage(fn) { try { return fn(window.localStorage); } catch (e) { return null; } }

  (function saveUtm() {
    var found = {};
    UTM_KEYS.forEach(function (k) { if (params.get(k)) found[k] = params.get(k); });
    if (Object.keys(found).length) {
      found.landing = location.pathname + location.search;
      found.ts = Date.now();
      storage(function (ls) { ls.setItem('utm', JSON.stringify(found)); });
    }
  })();

  function getUtm() {
    var raw = storage(function (ls) { return ls.getItem('utm'); });
    if (!raw) return {};
    try {
      var data = JSON.parse(raw);
      if (Date.now() - data.ts > 30 * 864e5) return {};
      return data;
    } catch (e) { return {}; }
  }

  /* ---------- Подмена оффера под объявление (?s=...) ---------- */
  var offerKey = params.get('s') || getUtm().s;
  var offer = offerKey && CFG.offers && CFG.offers[offerKey];
  if (offer) {
    var t = document.getElementById('heroTitle');
    var l = document.getElementById('heroLead');
    if (t) t.textContent = offer.title;
    if (l) l.textContent = offer.lead;
    document.querySelectorAll('.hero .js-open-form').forEach(function (b) { b.dataset.topic = offer.topic; });
  }

  /* ---------- Цели на клики по контактам ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    if (a.classList.contains('js-phone')) goal('click_phone');
    else if (a.classList.contains('js-wa')) goal('click_whatsapp');
    else if (a.classList.contains('js-tg')) goal('click_telegram');
  });

  /* ---------- Мобильное меню ---------- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open);
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* ---------- Маска телефона +7 (___) ___-__-__ ---------- */
  function formatPhone(value) {
    var d = value.replace(/\D/g, '');
    if (!d) return '';
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);
    var out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length > 4) out += ') ' + d.slice(4, 7);
    if (d.length > 7) out += '-' + d.slice(7, 9);
    if (d.length > 9) out += '-' + d.slice(9, 11);
    return out;
  }
  function phoneValid(value) { return value.replace(/\D/g, '').length === 11; }

  document.querySelectorAll('.js-tel').forEach(function (input) {
    input.addEventListener('input', function () { input.value = formatPhone(input.value); });
    input.addEventListener('focus', function () {
      if (input.value) return;
      input.value = '+7 (';
      // без этого при фокусе с клавиатуры курсор остаётся в начале и цифры уходят перед «+7»
      var end = input.value.length;
      input.setSelectionRange(end, end);
      setTimeout(function () { input.setSelectionRange(end, end); }, 0);
    });
    input.addEventListener('blur', function () { if (input.value.replace(/\D/g, '').length <= 1) input.value = ''; });
  });

  /* ---------- Отправка заявки ---------- */
  function validate(form) {
    var ok = true;
    var phone = form.querySelector('[name="phone"]');
    var consent = form.querySelector('[name="consent"]');
    if (phone) {
      var bad = !phoneValid(phone.value);
      phone.classList.toggle('is-error', bad);
      if (bad) { ok = false; phone.focus(); }
    }
    if (consent) {
      var label = consent.closest('.check');
      label.classList.toggle('is-error', !consent.checked);
      if (!consent.checked) ok = false;
    }
    return ok;
  }

  function showMsg(form, text) {
    var msg = form.querySelector('.form-msg');
    if (!msg) { msg = document.createElement('p'); msg.className = 'form-msg'; form.appendChild(msg); }
    msg.textContent = text;
  }

  function send(form, extra, goalName) {
    if (!validate(form)) return;
    var btn = form.querySelector('[type="submit"]');
    var data = new FormData(form);
    var utm = getUtm();
    Object.keys(utm).forEach(function (k) { if (k !== 'ts') data.append(k, utm[k]); });
    Object.keys(extra || {}).forEach(function (k) { data.append(k, extra[k]); });
    data.append('page', location.href);
    data.append('js', '1'); // простая защита от ботов: send.php принимает заявки только с этим полем

    btn.disabled = true;
    var oldText = btn.textContent;
    btn.textContent = 'Отправляем…';

    fetch(CFG.formEndpoint || 'send.php', { method: 'POST', body: data })
      .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.error || 'send failed');
        goal('lead');
        if (goalName) goal(goalName);
        location.href = CFG.thanksPage || 'thanks.html';
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = oldText;
        showMsg(form, 'Не удалось отправить заявку. Позвоните нам или напишите в мессенджер — ответим сразу.');
      });
  }

  document.querySelectorAll('.js-lead-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      send(form, null, 'lead_form');
    });
  });

  /* ---------- Модальное окно ---------- */
  var modal = document.getElementById('modal');
  var lastFocus = null;

  function openModal(topic) {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.querySelector('[name="topic"]').value = topic || 'Консультация';
    document.getElementById('modalTopic').textContent = topic || 'Консультация';
    modal.hidden = false;
    document.body.classList.add('modal-open');
    setTimeout(function () { modal.querySelector('[name="name"]').focus(); }, 50);
    goal('open_form');
  }
  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastFocus) lastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('.js-open-form');
    if (opener) { e.preventDefault(); openModal(opener.dataset.topic); return; }
    if (e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  /* ---------- Квиз ---------- */
  var quiz = document.getElementById('quiz-form');
  if (quiz) {
    var steps = quiz.querySelectorAll('.quiz__step');
    var bar = document.getElementById('quizBar');
    var count = document.getElementById('quizCount');
    var prev = document.getElementById('quizPrev');
    var current = 0;
    var started = false;

    function show(i) {
      steps[current].classList.remove('is-active');
      current = i;
      steps[current].classList.add('is-active');
      bar.style.width = ((current + 1) / steps.length * 100) + '%';
      count.textContent = 'Шаг ' + (current + 1) + ' из ' + steps.length;
      prev.hidden = current === 0;
    }

    quiz.addEventListener('change', function (e) {
      if (e.target.type !== 'radio') return;
      if (!started) { started = true; goal('quiz_start'); }
      setTimeout(function () { if (current < steps.length - 1) show(current + 1); }, 220);
    });
    prev.addEventListener('click', function () { if (current > 0) show(current - 1); });

    quiz.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(quiz);
      var answers = ['q_topic', 'q_stage', 'q_urgency'].map(function (k) { return fd.get(k) || '—'; });
      // ответы квиза уже входят в FormData; topic и message дублируем для читаемости заявки
      send(quiz, {
        topic: 'Квиз: ' + answers[0],
        message: 'Стадия: ' + answers[1] + '; срочность: ' + answers[2]
      }, 'quiz_lead');
    });
  }

  /* ---------- Слайдер отзывов ---------- */
  document.querySelectorAll('[data-slider]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var track = document.getElementById('slider-' + btn.dataset.slider);
      var card = track && track.firstElementChild;
      if (!card) return;
      var step = card.getBoundingClientRect().width + 24;
      track.scrollBy({ left: step * Number(btn.dataset.dir), behavior: 'smooth' });
    });
  });

  /* ---------- Появление блоков и счётчики ---------- */
  var revealEls = document.querySelectorAll('.section .h2, .list-links li, .step, .stat, .review, .quiz, .faq__list details');
  revealEls.forEach(function (el) { el.classList.add('reveal'); });

  function countUp(el) {
    var target = Number(el.dataset.count);
    var suffix = el.textContent.replace(/[\d\s]/g, '');
    var start = performance.now();
    function tick(now) {
      var p = Math.min((now - start) / 1200, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-visible');
        var num = en.target.querySelector('[data-count]');
        if (num) countUp(num);
        io.unobserve(en.target);
      });
    }, { threshold: 0.15 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
