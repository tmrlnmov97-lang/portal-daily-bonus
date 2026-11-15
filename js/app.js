/*
 * Ежедневный бонус Portal Games — экран «награда доступна, мало времени» (Figma 95:738).
 * Без сборки: обычный скрипт, открывается и по file://, и внутри Telegram.
 */
(function () {
  'use strict';

  var A = 'assets/';

  /*
   * Арт наград. Картинка обрезана квадратной рамкой: w/h/l/t — размер и сдвиг в % от рамки (как в Figma).
   * Свечение лежит под картинкой в рамке с отступом 15.63%; glowInset — насколько svg свечения шире этой рамки.
   */
  var ART = {
    coins:     { img: 'art-coins-stack.webp',      w: 104.4,  h: 69.6,   l: -2.2,   t: 15.06 },
    common:    { img: 'art-common-lootbox.webp',   w: 140.01, h: 121.89, l: -20.01, t: -13.68 },
    diamond:   { img: 'art-diamond.webp',          w: 164.9,  h: 109.93, l: -32.45, t: -6.92 },
    rare:      { img: 'art-rare-lootbox.webp',     w: 138.8,  h: 120.83, l: -19.82, t: -13.13 },
    epic:      { img: 'art-epic-lootbox.webp',     w: 139.4,  h: 121.35, l: -19.91, t: -13.41 },
    legendary: { img: 'art-legendary-lootbox.webp', w: 137.78, h: 119.94, l: -18.89, t: -12.05 },
    coin:      { img: 'art-coin.webp',             w: 197.25, h: 131.5,  l: -45.24, t: -17.31 },
    usdt:      { img: 'art-usdt.webp',             w: 164.54, h: 143.24, l: -31.77, t: -26.33 }
  };
  var GLOW_INSET = { 'glow-coin.svg': 45.45, 'glow-common.svg': 45.45, 'glow-legendary.svg': 45.45, 'glow-usdt.svg': 45.45,
                     'glow-blue.svg': 51.95, 'glow-coins-locked.svg': 51.95, 'glow-epic.svg': 51.95 };

  // Состояние экрана: день 1 получен, день 2 доступен, остальные впереди.
  var DAYS = [
    { day: 1, state: 'claimed', art: 'coins',   glow: 'glow-coin.svg',         value: '200',       unit: 'монет' },
    { day: 2, state: 'today',   art: 'common',  glow: 'glow-common.svg',       value: 'Обычный',   unit: 'лутбокс' },
    { day: 3, state: 'locked',  art: 'diamond', glow: 'glow-blue.svg',         value: '5',         unit: 'алмазов' },
    { day: 4, state: 'locked',  art: 'rare',    glow: 'glow-blue.svg',         value: 'Редкий',    unit: 'лутбокс' },
    { day: 5, state: 'locked',  art: 'coins',   glow: 'glow-coins-locked.svg', value: '500',       unit: 'монет' },
    { day: 6, state: 'locked',  art: 'epic',    glow: 'glow-epic.svg',         value: 'Эпический', unit: 'лутбокс' }
  ];
  var TODAY = 2;
  var TIME_LEFT_MIN = 2 * 60 + 15; // «сгорит через 02:15»

  var NB = ' ';

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
    var top, extra = '', label = 'День ' + d.day;
    if (d.state === 'claimed') {
      top = '<div class="day__status"><img alt="" src="' + A + 'icon-check.svg">Получено</div>';
    } else {
      top = '<div class="day__label">' + label + '</div>';
    }
    if (d.state === 'today') {
      extra =
        '<div class="day__halo"><img alt="" src="' + A + 'glow-today.svg"></div>' +
        '<div class="day__rays"><img alt="" src="' + A + 'rays-today.svg"></div>';
    }
    var after = '';
    if (d.state === 'today') {
      after = '<img class="day__spark day__spark--big" alt="" src="' + A + 'spark.svg">' +
              '<img class="day__spark day__spark--small" alt="" src="' + A + 'spark-small.svg">';
    }
    if (d.state === 'locked') {
      after = '<div class="day__lock"><img alt="" src="' + A + 'icon-lock.svg"></div>';
    }
    var aria = label + ', ' + d.value + ' ' + d.unit + ', ' +
      (d.state === 'claimed' ? 'получено' : d.state === 'today' ? 'доступно сегодня' : 'закрыто');
    return '<li class="day day--' + d.state + '" aria-label="' + aria + '">' + extra +
      '<div class="day__top">' + top + art(d.art, d.glow, 'day__art') + '</div>' +
      '<div class="day__reward"><div class="day__value">' + d.value + '</div><div class="day__unit">' + d.unit + '</div></div>' +
      after + '</li>';
  }

  function fmt(min) {
    var m = Math.max(0, Math.floor(min));
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  function render() {
    var rows = [DAYS.slice(0, 3), DAYS.slice(3, 6)].map(function (r) {
      return '<ul class="days__row">' + r.map(dayCard).join('') + '</ul>';
    });
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
        '<div class="sheet__content">' +
          '<div class="sheet-head">' +
            '<div class="sheet-head__row">' +
              '<h1 class="sheet-head__title" id="sheet-title">Ежедневный бонус</h1>' +
              '<button class="close-btn" data-action="close" aria-label="Закрыть"><img alt="" src="' + A + 'icon-close.svg"></button>' +
            '</div>' +
            '<p class="streak"><img alt="" src="' + A + 'icon-clock.svg">' +
              'Награда дня ' + TODAY + ' сгорит через<span class="streak__time" id="timer">' + fmt(TIME_LEFT_MIN) + '</span></p>' +
          '</div>' +
          '<div class="days-block">' +
            '<div class="days">' + rows[0] +
              '<div class="days__lower">' + rows[1] +
                '<div class="d7">' +
                  '<div class="d7__texts">' +
                    '<div><div class="d7__label">Награда за' + NB + '7 дней подряд</div><div class="d7__title">Легендарный лутбокс</div></div>' +
                    '<div class="d7__chips">' +
                      '<span class="chip">' + art('coin', 'glow-coin.svg') + '1' + NB + '000</span>' +
                      '<span class="chip chip--usdt">' + art('usdt', 'glow-usdt.svg') + 'шанс до' + NB + '5' + NB + 'USDT</span>' +
                    '</div>' +
                  '</div>' +
                  '<div class="d7__art"><div class="d7__art-glow"><img alt="" src="' + A + 'glow-day7.svg"></div>' + art('legendary', 'glow-legendary.svg') + '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<p class="rule"><img alt="" src="' + A + 'icon-info.svg">Если пропустишь день, серию можно вернуть до' + NB + 'конца следующего дня</p>' +
          '</div>' +
        '</div>' +
        '<div class="actions">' +
          '<button class="btn btn--primary" data-action="ad">Редкий лутбокс за' + NB + 'рекламу</button>' +
          '<button class="btn btn--secondary" data-action="free">Обычный лутбокс бесплатно</button>' +
        '</div>' +
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

  var root = document.getElementById('app');
  root.innerHTML = render();

  // Живой таймер: считает минуты до смены дня.
  var deadline = Date.now() + TIME_LEFT_MIN * 60 * 1000;
  var timerEl = document.getElementById('timer');
  setInterval(function () { timerEl.textContent = fmt((deadline - Date.now()) / 60000); }, 1000);

  // Telegram: внутри клиента прячем нарисованную шапку, разворачиваем окно, даём вибро-отклик на кнопки.
  var tg = window.Telegram && window.Telegram.WebApp;
  var inTelegram = !!(tg && tg.initData);
  if (inTelegram) {
    document.documentElement.classList.add('in-telegram');
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor) tg.setHeaderColor('#000000');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#0b0f1a');
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
  }

  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action]');
    if (!b) return;
    if (inTelegram && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    var act = b.getAttribute('data-action');
    if (act === 'tg-close' && inTelegram) tg.close();
    // «ad», «free», «close» — следующие экраны (открытие лутбокса) подключим отдельным шагом.
  });
})();
