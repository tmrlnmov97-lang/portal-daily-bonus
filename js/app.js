/*
 * Ежедневный бонус Portal Games.
 * Экраны (Figma, файл CoevBlmheFoPU63iWHtwXw):
 *   bonus  — «2б · Мало времени», награда дня доступна (95:738);
 *   reveal — «3 · Открытие лутбокса», после «Обычный лутбокс бесплатно» (97:1095);
 *   claimed — «Напоминание · 1», награда дня забрана, после «Готово» (112:1734);
 *   поверх claimed — диалог Telegram «Разрешить писать», после «Напомнить» (112:1761);
 *   claimed с напоминанием — тост и вторичная кнопка, после «Разрешить» (112:1800);
 *   week — «11 · День 7 доступен», сразу после того как тост ушёл (153:2409).
 * Шапка Telegram и шторка рисуются один раз, внутри шторки меняется только содержимое.
 * Без сборки: обычный скрипт, открывается и по file://, и внутри Telegram.
 */
(function () {
  'use strict';

  var A = 'assets/';
  var NB = ' ';

  /*
   * Арт наград. Картинка обрезана квадратной рамкой: w/h/l/t — размер и сдвиг в % от рамки (как в Figma).
   * Свечение лежит под картинкой в рамке с отступом 15.63%; GLOW_INSET — насколько svg свечения шире этой рамки.
   */
  var ART = {
    coins:      { img: 'art-coins-stack.webp',        w: 104.4,  h: 69.6,   l: -2.2,   t: 15.06 },
    common:     { img: 'art-common-lootbox.webp',     w: 140.01, h: 121.89, l: -20.01, t: -13.68 },
    commonLg:   { img: 'art-common-lootbox-lg.webp',  w: 140.01, h: 121.89, l: -20.01, t: -13.68 }, // тот же арт крупнее — для раскрытия
    commonOpen: { img: 'art-common-lootbox-open.webp', w: 137.93, h: 125.94, l: -13.93, t: -14.61 },
    diamond:    { img: 'art-diamond.webp',            w: 164.9,  h: 109.93, l: -32.45, t: -6.92 },
    rare:       { img: 'art-rare-lootbox.webp',       w: 138.8,  h: 120.83, l: -19.82, t: -13.13 },
    epic:       { img: 'art-epic-lootbox.webp',       w: 139.4,  h: 121.35, l: -19.91, t: -13.41 },
    legendary:  { img: 'art-legendary-lootbox.webp',  w: 137.78, h: 119.94, l: -18.89, t: -12.05 },
    coin:       { img: 'art-coin.webp',               w: 197.25, h: 131.5,  l: -45.24, t: -17.31 },
    usdt:       { img: 'art-usdt.webp',               w: 164.54, h: 143.24, l: -31.77, t: -26.33 }
  };
  var GLOW_INSET = { 'glow-coin.svg': 45.45, 'glow-common.svg': 45.45, 'glow-legendary.svg': 45.45, 'glow-usdt.svg': 45.45,
                     'glow-blue.svg': 51.95, 'glow-coins-locked.svg': 51.95, 'glow-epic.svg': 51.95,
                     'glow-common-sm.svg': 51.95 };

  // Состояние серии: день 1 получен, день 2 доступен, остальные впереди.
  var DAYS = [
    { day: 1, state: 'claimed', art: 'coins',   glow: 'glow-coin.svg',         value: '200',       unit: 'монет' },
    { day: 2, state: 'today',   art: 'common',  glow: 'glow-common.svg',       value: 'Обычный',   unit: 'лутбокс' },
    { day: 3, state: 'locked',  art: 'diamond', glow: 'glow-blue.svg',         value: '5',         unit: 'алмазов' },
    { day: 4, state: 'locked',  art: 'rare',    glow: 'glow-blue.svg',         value: 'Редкий',    unit: 'лутбокс' },
    { day: 5, state: 'locked',  art: 'coins',   glow: 'glow-coins-locked.svg', value: '500',       unit: 'монет' },
    { day: 6, state: 'locked',  art: 'epic',    glow: 'glow-epic.svg',         value: 'Эпический', unit: 'лутбокс' }
  ];
  var TODAY = 2;
  // После «Готово» (112:1734): день 2 получен, день 3 следующий — откроется со сменой дня.
  var DAYS_AFTER = DAYS.map(function (d) {
    if (d.day === TODAY) return Object.assign({}, d, { state: 'claimed', glow: 'glow-common-sm.svg' });
    if (d.day === TODAY + 1) return Object.assign({}, d, { state: 'next' });
    return d;
  });
  // Экран дня 7 (153:2409): шесть дней получены, легендарный лутбокс доступен
  var DAYS_WEEK = DAYS.map(function (d) { return Object.assign({}, d, { state: 'claimed' }); });
  var TIME_LEFT_MIN = 2 * 60 + 15; // «сгорит через 02:15»
  var REWARD = '120 монет';        // что выпало из обычного лутбокса (экран 97:1095)
  var DAYS_TO_LEGENDARY = 5;
  var reminderOn = false;          // «Разрешить» в диалоге Telegram включает напоминание
  var toastPending = false;        // тост показываем один раз, сразу после «Разрешить»
  var TOAST_MS = 2500;             // через столько тост исчезает и открывается экран дня 7

  /* ---------- Кусочки разметки ---------- */

  function art(kind, glow, cls) {
    var a = ART[kind];
    var g = GLOW_INSET[glow];
    var size = 100 + 2 * g;
    return '<div class="art ' + (cls || '') + '">' +
      '<div class="art__glow"><img alt="" src="' + A + glow + '" style="left:-' + g + '%;top:-' + g + '%;width:' + size + '%;height:' + size + '%"></div>' +
      '<div class="art__clip"><img alt="" src="' + A + a.img + '" style="left:' + a.l + '%;top:' + a.t + '%;width:' + a.w + '%;height:' + a.h + '%"></div>' +
      '</div>';
  }

  function dayCard(d) {
    var top, extra = '', after = '', label = 'День ' + d.day;
    if (d.state === 'claimed') top = '<div class="day__status"><img alt="" src="' + A + 'icon-check.svg">Получено</div>';
    // Следующий день: вместо номера — сколько осталось до открытия (тот же отсчёт, что «сгорит через»)
    else if (d.state === 'next') top = '<div class="day__status day__status--next">через<span class="day__time js-timer">' + fmt(minutesLeft()) + '</span></div>';
    else top = '<div class="day__label">' + label + '</div>';
    if (d.state === 'today') {
      extra = '<div class="day__halo"><img alt="" src="' + A + 'glow-today.svg"></div>' +
              '<div class="day__rays"><img alt="" src="' + A + 'rays-today.svg"></div>';
      after = '<img class="day__spark day__spark--big" alt="" src="' + A + 'spark.svg">' +
              '<img class="day__spark day__spark--small" alt="" src="' + A + 'spark-small.svg">';
    }
    if (d.state === 'locked') after = '<div class="day__lock"><img alt="" src="' + A + 'icon-lock.svg"></div>';
    var aria = label + ', ' + d.value + ' ' + d.unit + ', ' +
      (d.state === 'claimed' ? 'получено' : d.state === 'today' ? 'доступно сегодня' :
       d.state === 'next' ? 'откроется через ' + fmt(minutesLeft()) : 'закрыто');
    return '<li class="day day--' + d.state + '" aria-label="' + aria + '">' + extra +
      '<div class="day__top">' + top + art(d.art, d.glow, 'day__art') + '</div>' +
      '<div class="day__reward"><div class="day__value">' + d.value + '</div><div class="day__unit">' + d.unit + '</div></div>' +
      after + '</li>';
  }

  function head(title, subtitleHtml) {
    return '<div class="sheet-head">' +
      '<div class="sheet-head__row">' +
        '<h1 class="sheet-head__title" id="sheet-title" tabindex="-1">' + title + '</h1>' +
        '<button class="close-btn" data-action="close" aria-label="Закрыть"><img alt="" src="' + A + 'icon-close.svg"></button>' +
      '</div>' + subtitleHtml + '</div>';
  }

  // Ч:ММ:СС — с секундами, чтобы отсчёт было видно сразу; без ведущего нуля, иначе не влезает в карточку дня
  function fmt(min) {
    var s = Math.max(0, Math.floor(min * 60));
    function p(n) { return String(n).padStart(2, '0'); }
    return Math.floor(s / 3600) + ':' + p(Math.floor(s / 60) % 60) + ':' + p(s % 60);
  }

  /* ---------- Экраны ---------- */

  // Сетка 3 × 2 и карточка дня 7 — общие для экрана бонуса и экрана «забрано»
  // d7Today — день 7 доступен: золотая обводка, золотая подпись, лучи за артом
  function daysGrid(days, d7Today) {
    var rows = [days.slice(0, 3), days.slice(3, 6)].map(function (r) {
      return '<ul class="days__row">' + r.map(dayCard).join('') + '</ul>';
    });
    return '' +
      '<div class="days">' + rows[0] +
        '<div class="days__lower">' + rows[1] +
          '<div class="d7' + (d7Today ? ' d7--today' : '') + '">' +
            '<div class="d7__texts">' +
              '<div><div class="d7__label">Награда за' + NB + '7 дней подряд</div><div class="d7__title">Легендарный лутбокс</div></div>' +
              '<div class="d7__chips">' +
                '<span class="chip">' + art('coin', 'glow-coin.svg') + '1' + NB + '000</span>' +
                '<span class="chip chip--usdt">' + art('usdt', 'glow-usdt.svg') + 'шанс до' + NB + '5' + NB + 'USDT</span>' +
              '</div>' +
            '</div>' +
            '<div class="d7__art">' +
              (d7Today ? '<div class="d7__rays"><img alt="" src="' + A + 'rays-day7.svg"></div>' : '') +
              '<div class="d7__art-glow"><img alt="" src="' + A + (d7Today ? 'glow-day7-today.svg' : 'glow-day7.svg') + '"></div>' +
              art('legendary', 'glow-legendary.svg') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  var RULE = '<p class="rule"><img alt="" src="' + A + 'icon-info.svg">Если пропустишь день, серию можно вернуть до' + NB + 'конца следующего дня</p>';

  function bonusScreen() {
    return '' +
      '<div class="sheet__content">' +
        head('Ежедневный бонус',
          '<p class="streak"><img alt="" src="' + A + 'icon-clock.svg">' +
          'Награда дня ' + TODAY + ' сгорит через<span class="streak__time js-timer">' + fmt(minutesLeft()) + '</span></p>') +
        '<div class="days-block">' +
          daysGrid(DAYS) +
          RULE +
        '</div>' +
      '</div>' +
      '<div class="actions">' +
        '<button class="btn btn--primary" data-action="ad">Редкий лутбокс за' + NB + 'рекламу</button>' +
        '<button class="btn btn--secondary" data-action="free">Обычный лутбокс бесплатно</button>' +
      '</div>';
  }

  function revealScreen() {
    return '' +
      '<div class="sheet__content sheet__content--reveal">' +
        head('Награда дня ' + TODAY,
          '<p class="streak"><img alt="" src="' + A + 'icon-fire.svg">До легендарного лутбокса ' + DAYS_TO_LEGENDARY + NB + 'дней</p>') +
        '<div class="reveal">' +
          '<div class="reveal__reward" role="status">' +
            // Раскрытие: закрытый лутбокс трясётся → вспышка → открытый (тайминги в app.css, «Раскрытие лутбокса»)
            '<div class="reveal__art" aria-hidden="true"><div class="reveal__mirror">' +
              '<div class="reveal__rays"><img alt="" src="' + A + 'rays-reveal.svg"></div>' +
              '<div class="reveal__glow"><img alt="" src="' + A + 'glow-reveal.svg"></div>' +
              art('commonLg', 'glow-common.svg', 'reveal__closed') +
              art('commonOpen', 'glow-common.svg', 'reveal__box') +
              '<div class="reveal__flash"></div>' +
            '</div></div>' +
            '<p class="reveal__label">Выпало</p>' +
            '<div class="reveal__sum">' + art('coin', 'glow-coin.svg', 'reveal__coin') + '<span>' + REWARD.replace(' ', NB) + '</span></div>' +
            '<p class="reveal__note">Уже на' + NB + 'балансе</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="actions">' +
        '<button class="btn btn--primary" data-action="done">Готово</button>' +
      '</div>';
  }

  function claimedScreen() {
    return '' +
      '<div class="sheet__content">' +
        head('Ежедневный бонус',
          '<p class="streak streak--done"><img alt="" src="' + A + 'icon-fire.svg">Сегодня забрано, серия ' + TODAY + ' из' + NB + '7</p>') +
        '<div class="days-block">' + daysGrid(DAYS_AFTER) + '</div>' +
      '</div>' +
      '<div class="actions">' + (reminderOn
        ? (toastPending ? '<p class="toast" role="status"><img alt="" src="' + A + 'icon-check-20.svg">Напишем в' + NB + 'Telegram, когда откроется день' + NB + (TODAY + 1) + '</p>' : '') +
          '<button class="btn btn--secondary" disabled>Напомним, когда откроется день' + NB + (TODAY + 1) + '</button>'
        : '<button class="btn btn--primary" data-action="remind">Напомнить, когда откроется день' + NB + (TODAY + 1) + '</button>') +
      '</div>';
  }

  function weekScreen() {
    return '' +
      '<div class="sheet__content">' +
        head('Ежедневный бонус',
          '<p class="streak"><img alt="" src="' + A + 'icon-fire.svg">Забери день 7 и' + NB + 'неделя пройдена</p>') +
        '<div class="days-block">' + daysGrid(DAYS_WEEK, true) + RULE + '</div>' +
      '</div>' +
      '<div class="actions">' +
        '<button class="btn btn--primary" data-action="legendary">Забрать легендарный лутбокс</button>' +
      '</div>';
  }

  var SCREENS = { bonus: bonusScreen, reveal: revealScreen, claimed: claimedScreen, week: weekScreen };

  // Системный диалог Telegram: бот просит разрешения написать, когда откроется следующий день
  function writeAccessDialog() {
    return '' +
      '<div class="overlay" id="overlay">' +
        '<div class="tg-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-text">' +
          '<div class="tg-dialog__text">' +
            '<p class="tg-dialog__title" id="dlg-title">Разрешить Portal Games писать' + NB + 'вам?</p>' +
            '<p class="tg-dialog__sub" id="dlg-text">Бот пришлёт сообщение, когда откроется день' + NB + (TODAY + 1) + '</p>' +
          '</div>' +
          '<div class="tg-dialog__buttons">' +
            '<button class="tg-dialog__btn" data-action="dlg-cancel">Отмена</button>' +
            '<button class="tg-dialog__btn tg-dialog__btn--main" data-action="dlg-allow">Разрешить</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ---------- Каркас и навигация ---------- */

  function shell() {
    return '' +
      '<header class="tg-header" aria-hidden="true">' +
        '<div class="tg-header__status">9:41</div>' +
        '<div class="tg-header__nav">' +
          '<button class="tg-header__btn" data-action="tg-close" tabindex="-1"><img alt="" src="' + A + 'icon-close.svg"></button>' +
          '<div class="tg-header__title"><span class="tg-header__name">Portal Games</span><span class="tg-header__sub">мини-приложение</span></div>' +
          '<button class="tg-header__btn" data-action="tg-more" tabindex="-1"><img alt="" src="' + A + 'icon-more.svg"></button>' +
        '</div>' +
      '</header>' +
      '<main class="sheet" aria-labelledby="sheet-title">' +
        '<div class="sheet__glow" aria-hidden="true"><img alt="" src="' + A + 'glow-sheet.svg"></div>' +
        '<div class="sheet__grabber" aria-hidden="true"></div>' +
        '<div class="sheet__screen" id="screen"></div>' +
      '</main>';
  }

  // SF Pro с системным трекингом (Mac, iOS): эта строка в макете 174 px, с трекингом ~185 px.
  // Тогда включаем компенсацию из tokens.css; на других шрифтах ничего не трогаем.
  (function detectSfTracking() {
    var stack = getComputedStyle(document.documentElement).getPropertyValue('--font');
    var ctx = document.createElement('canvas').getContext('2d');
    ctx.font = '400 14px ' + stack;
    var w = ctx.measureText('Награда дня 2 сгорит через').width;
    if (w > 181 && w < 190) document.documentElement.classList.add('sf-tracking');
  })();

  var deadline = Date.now() + TIME_LEFT_MIN * 60 * 1000;
  function minutesLeft() { return (deadline - Date.now()) / 60000; }

  var root = document.getElementById('app');
  root.innerHTML = shell();
  var screenEl = document.getElementById('screen');
  var current = null;

  var tg = window.Telegram && window.Telegram.WebApp;
  var inTelegram = !!(tg && tg.initData);

  function go(name, opts) {
    current = name;
    screenEl.className = 'sheet__screen sheet__screen--' + name + (opts && opts.animate ? ' is-entering' : '');
    screenEl.innerHTML = SCREENS[name]();
    if (opts && opts.animate) {
      var title = document.getElementById('sheet-title');
      if (title) title.focus({ preventScroll: true });
    }
    // Системная кнопка «Назад» Telegram на экране награды
    if (inTelegram && tg.BackButton) { if (name === 'reveal') tg.BackButton.show(); else tg.BackButton.hide(); }
    // Сильный вибро-отклик в момент открытия (80 % от 1,25 с анимации)
    if (name === 'reveal' && opts && opts.animate && inTelegram && tg.HapticFeedback) {
      setTimeout(function () { if (current === 'reveal') tg.HapticFeedback.impactOccurred('heavy'); }, 1000);
    }
  }

  // Диалог лежит поверх экрана; всё под ним недоступно, пока он открыт
  var focusBack = null;
  function openDialog() {
    if (document.getElementById('overlay')) return;
    focusBack = document.activeElement;
    root.insertAdjacentHTML('beforeend', writeAccessDialog());
    Array.prototype.forEach.call(root.querySelectorAll('.tg-header, .sheet'), function (el) { el.setAttribute('inert', ''); });
    root.querySelector('.tg-dialog__btn--main').focus({ preventScroll: true });
  }
  function closeDialog(allowed) {
    var o = document.getElementById('overlay');
    if (!o) return;
    o.remove();
    Array.prototype.forEach.call(root.querySelectorAll('[inert]'), function (el) { el.removeAttribute('inert'); });
    if (allowed) {
      // Напоминание включено: тот же экран, но тост и вторичная кнопка (112:1800)
      reminderOn = true;
      toastPending = true;
      go('claimed');
      toastPending = false;
      document.getElementById('sheet-title').focus({ preventScroll: true });
      hideToastLater();
    } else if (focusBack && focusBack.focus) focusBack.focus({ preventScroll: true });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDialog(); });

  // Тост уходит через TOAST_MS (анимация 0,25 с), сразу за ним — экран дня 7
  function hideToastLater() {
    var t = root.querySelector('.toast');
    if (!t) return;
    setTimeout(function () {
      if (!t.isConnected) return;
      t.classList.add('is-leaving');
      setTimeout(function () {
        t.remove();
        if (current === 'claimed') go('week', { animate: true });
      }, 260);
    }, TOAST_MS);
  }

  go('bonus');

  // Живой таймер до смены дня — «сгорит через» на бонусе и «через» у дня 3 после получения.
  // Опрос 4 раза в секунду, а текст меняется только при смене секунды — так секунды не перескакивают.
  setInterval(function () {
    var t = fmt(minutesLeft());
    Array.prototype.forEach.call(document.querySelectorAll('.js-timer'), function (el) {
      if (el.textContent !== t) el.textContent = t;
    });
  }, 250);

  // Telegram: внутри клиента прячем нарисованную шапку, разворачиваем окно, даём вибро-отклик на кнопки.
  if (inTelegram) {
    document.documentElement.classList.add('in-telegram');
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor) tg.setHeaderColor('#000000');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#0b0f1a');
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    if (tg.BackButton) tg.BackButton.onClick(function () { go('claimed', { animate: true }); });
  }

  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action]');
    if (!b) return;
    var act = b.getAttribute('data-action');
    if (inTelegram && tg.HapticFeedback) {
      if (act === 'free') tg.HapticFeedback.notificationOccurred('success');
      else tg.HapticFeedback.impactOccurred('light');
    }
    if (act === 'free') go('reveal', { animate: true });
    // Награда уже на балансе — дальше экран «Сегодня забрано», к выбору награды не возвращаемся
    else if (act === 'done' || (act === 'close' && current === 'reveal')) go('claimed', { animate: true });
    else if (act === 'remind') openDialog();
    else if (act === 'dlg-allow') closeDialog(true);
    else if (act === 'dlg-cancel') closeDialog(false);
    else if ((act === 'tg-close' || act === 'close') && inTelegram) tg.close();
    // «ad» и «legendary» — экраны рекламы и легендарного лутбокса подключим отдельным шагом.
  });
})();
