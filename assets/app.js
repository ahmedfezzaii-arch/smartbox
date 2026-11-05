(() => {
  'use strict';

  /* ---------- Navigation ---------- */
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav-links');
  if (menuButton && nav) {
    menuButton.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        nav.classList.remove('open');
        menuButton.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- TradingView widgets (live data) ---------- */
  const forexSymbols = [
    ['FX:EURUSD', 'EUR/USD'], ['FX:GBPUSD', 'GBP/USD'], ['FX:USDJPY', 'USD/JPY'], ['FX:USDCHF', 'USD/CHF'],
    ['FX:AUDUSD', 'AUD/USD'], ['FX:USDCAD', 'USD/CAD'], ['FX:NZDUSD', 'NZD/USD'], ['FX:EURJPY', 'EUR/JPY'],
    ['FX:GBPJPY', 'GBP/JPY'], ['FX:EURGBP', 'EUR/GBP'],
  ];
  const commoditySymbols = [
    ['OANDA:XAUUSD', 'Gold'], ['OANDA:XAGUSD', 'Silver'], ['TVC:USOIL', 'WTI crude'], ['CAPITALCOM:DXY', 'US Dollar Index'],
  ];
  const stockSymbols = [
    ['NASDAQ:AAPL', 'Apple'], ['NASDAQ:MSFT', 'Microsoft'], ['NASDAQ:NVDA', 'NVIDIA'], ['NASDAQ:AMZN', 'Amazon'],
    ['NASDAQ:GOOGL', 'Alphabet'], ['NASDAQ:META', 'Meta'], ['NASDAQ:TSLA', 'Tesla'], ['NYSE:JPM', 'JPMorgan'],
  ];
  const quoteGroup = (name, symbols) => ({
    name,
    symbols: symbols.map(([symbol, displayName]) => ({ name: symbol, displayName })),
  });
  const base = { colorTheme: 'dark', isTransparent: true, locale: 'en' };

  const widgets = {
    ticker: ['ticker-tape', {
      ...base,
      displayMode: 'adaptive',
      showSymbolLogo: false,
      symbols: [
        ['FX:EURUSD', 'EUR/USD'], ['FX:GBPUSD', 'GBP/USD'], ['FX:USDJPY', 'USD/JPY'], ['OANDA:XAUUSD', 'Gold'],
        ['TVC:USOIL', 'WTI'], ['FOREXCOM:SPXUSD', 'S&P 500'], ['FOREXCOM:NSXUSD', 'Nasdaq 100'],
        ['CAPITALCOM:DXY', 'DXY'], ['BITSTAMP:BTCUSD', 'BTC/USD'],
      ].map(([proName, title]) => ({ proName, title })),
    }],
    forex: ['market-quotes', {
      ...base, width: '100%', height: '100%', showSymbolLogo: false,
      symbolsGroups: [quoteGroup('Forex pairs', forexSymbols), quoteGroup('Metals & oil', commoditySymbols)],
    }],
    stocks: ['market-quotes', {
      ...base, width: '100%', height: '100%', showSymbolLogo: true,
      symbolsGroups: [quoteGroup('US large caps', stockSymbols)],
    }],
    movers: ['hotlists', {
      ...base, dateRange: '1D', exchange: 'US', showChart: false, showSymbolLogo: true,
      showFloatingTooltip: false, width: '100%', height: '100%',
    }],
    calendar: ['events', {
      ...base, width: '100%', height: '100%', importanceFilter: '0,1',
      countryFilter: 'us,eu,gb,jp,ch,au,ca,nz,cn',
    }],
    crossRates: ['forex-cross-rates', {
      ...base, width: '100%', height: '100%',
      currencies: ['EUR', 'USD', 'JPY', 'GBP', 'CHF', 'AUD', 'CAD', 'NZD'],
    }],
    heatmap: ['stock-heatmap', {
      ...base, dataSource: 'SPX500', grouping: 'sector', blockSize: 'market_cap_basic', blockColor: 'change',
      hasTopBar: false, isZoomEnabled: true, hasSymbolTooltip: true, isMonoSize: false, width: '100%', height: '100%',
    }],
  };

  const chartConfig = (symbol) => ['advanced-chart', {
    autosize: true, symbol, interval: '60', timezone: 'Etc/UTC', theme: 'dark', style: '1', locale: 'en',
    allow_symbol_change: false, hide_side_toolbar: true, calendar: false,
    backgroundColor: 'rgba(11,18,15,1)', gridColor: 'rgba(255,255,255,0.04)',
    support_host: 'https://www.tradingview.com',
  }];

  function mountWidget(host, [name, config]) {
    host.replaceChildren();
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    container.style.height = '100%';
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = '100%';
    const script = document.createElement('script');
    script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${name}.js`;
    script.async = true;
    script.textContent = JSON.stringify(config);
    container.append(inner, script);
    host.append(container);

    window.setTimeout(() => {
      if (host.contains(container) && !container.querySelector('iframe')) {
        const message = document.createElement('p');
        message.className = 'widget-fallback';
        message.append('Live data could not load. A browser extension may be blocking it. ');
        const link = document.createElement('a');
        link.href = 'https://www.tradingview.com/markets/';
        link.rel = 'noopener';
        link.target = '_blank';
        link.textContent = 'Open markets on TradingView';
        message.append(link);
        host.replaceChildren(message);
      }
    }, 12000);
  }

  // Heavy widgets load as they approach the viewport.
  const pending = [...document.querySelectorAll('[data-widget]')];
  const loadOne = (host) => mountWidget(host, widgets[host.dataset.widget]);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          loadOne(entry.target);
        }
      });
    }, { rootMargin: '400px' });
    pending.forEach((host) => observer.observe(host));
  } else {
    pending.forEach(loadOne);
  }

  const chartHost = document.querySelector('[data-chart]');
  if (chartHost) {
    mountWidget(chartHost, chartConfig(chartHost.dataset.chart));
    document.querySelectorAll('[data-symbol]').forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelectorAll('[data-symbol]').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
        mountWidget(chartHost, chartConfig(button.dataset.symbol));
      });
    });
  }

  /* ---------- Trading sessions ---------- */
  const sessions = [
    { name: 'Sydney', zone: 'Australia/Sydney', open: 8, close: 17 },
    { name: 'Tokyo', zone: 'Asia/Tokyo', open: 9, close: 18 },
    { name: 'London', zone: 'Europe/London', open: 8, close: 17 },
    { name: 'New York', zone: 'America/New_York', open: 8, close: 17 },
  ];

  function zonedParts(date, zone) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type).value;
    return { weekday: get('weekday'), hour: Number(get('hour')), minute: Number(get('minute')), label: `${get('hour')}:${get('minute')}` };
  }

  // Spot FX runs from Sunday 17:00 to Friday 17:00, New York time.
  function fxMarketClosed(date) {
    const { weekday, hour } = zonedParts(date, 'America/New_York');
    return weekday === 'Sat' || (weekday === 'Sun' && hour < 17) || (weekday === 'Fri' && hour >= 17);
  }

  const sessionsHost = document.querySelector('[data-sessions]');
  function renderSessions() {
    const now = new Date();
    const closed = fxMarketClosed(now);
    sessionsHost.replaceChildren(...sessions.map((session) => {
      const local = zonedParts(now, session.zone);
      const isOpen = !closed && local.hour >= session.open && local.hour < session.close;
      const card = document.createElement('div');
      card.className = `session${isOpen ? ' is-open' : ''}`;
      const name = document.createElement('strong');
      name.textContent = session.name;
      const time = document.createElement('span');
      time.className = 'mono';
      time.textContent = local.label;
      const status = document.createElement('span');
      status.className = 'session-status';
      status.textContent = isOpen ? 'Open' : 'Closed';
      card.append(name, time, status);
      return card;
    }));
  }
  if (sessionsHost) {
    renderSessions();
    window.setInterval(renderSessions, 30000);
  }

  /* ---------- News desk ---------- */
  const newsHosts = [...document.querySelectorAll('[data-news]')];

  const dayLabel = (date) => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 864e5);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  function renderNews(host, items, category) {
    const limit = Number(host.dataset.news) || items.length;
    const shown = items.filter((item) => category === 'All' || item.category === category).slice(0, limit);
    const nodes = [];
    let currentDay = '';
    shown.forEach((item) => {
      const date = new Date(item.published);
      const label = dayLabel(date);
      if (label !== currentDay) {
        currentDay = label;
        const heading = document.createElement('li');
        heading.className = 'news-day';
        heading.textContent = label;
        nodes.push(heading);
      }
      const row = document.createElement('li');
      row.className = 'news-row';
      const time = document.createElement('time');
      time.className = 'mono';
      time.dateTime = item.published;
      time.textContent = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.dataset.category = item.category;
      tag.textContent = item.category;
      const link = document.createElement('a');
      link.href = /^https?:\/\//.test(item.link) ? item.link : '#';
      link.target = '_blank';
      link.rel = 'noopener nofollow';
      link.textContent = item.title;
      const source = document.createElement('span');
      source.className = 'news-source';
      source.textContent = item.source;
      row.append(time, tag, link, source);
      nodes.push(row);
    });
    if (!nodes.length) {
      const empty = document.createElement('li');
      empty.className = 'news-empty';
      empty.textContent = 'No headlines in this category right now.';
      nodes.push(empty);
    }
    host.replaceChildren(...nodes);
  }

  if (newsHosts.length) {
    fetch('data/news.json', { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then(({ updated, items }) => {
        newsHosts.forEach((host) => renderNews(host, items, 'All'));
        const updatedAt = new Date(updated);
        const stale = Date.now() - updatedAt.getTime() > 36 * 3600e3;
        document.querySelectorAll('[data-news-updated]').forEach((node) => {
          const stamp = updatedAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
          node.textContent = `${stale ? 'Feed delayed. Last update' : 'Updated'} ${stamp}`;
          node.classList.toggle('is-stale', stale);
        });
        document.querySelectorAll('[data-filter]').forEach((button) => {
          button.addEventListener('click', () => {
            document.querySelectorAll('[data-filter]').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
            newsHosts.forEach((host) => renderNews(host, items, button.dataset.filter));
          });
        });
      })
      .catch(() => {
        newsHosts.forEach((host) => {
          const failed = document.createElement('li');
          failed.className = 'news-empty';
          failed.textContent = 'Headlines are temporarily unavailable. Please try again shortly.';
          host.replaceChildren(failed);
        });
      });
  }

  /* ---------- Enquiry builder (runs only in the visitor's browser) ---------- */
  const form = document.querySelector('[data-enquiry]');
  if (form) {
    const status = form.querySelector('[data-enquiry-status]');
    const output = form.querySelector('[data-enquiry-output]');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = new FormData(form);
      const text = [
        'Hello Smartbox,',
        `Service: ${values.get('service')}`,
        `Package: ${values.get('package')}`,
        `Platform: ${values.get('platform')}`,
        `Details: ${values.get('details')}`,
      ].join('\n');
      output.value = text;
      output.hidden = false;
      try {
        await navigator.clipboard.writeText(text);
        status.textContent = 'Copied. Paste it into your MQL5 message to Smartbox.';
      } catch {
        output.select();
        status.textContent = 'Copy the text above, then paste it into your MQL5 message to Smartbox.';
      }
    });
    document.querySelectorAll('[data-package]').forEach((link) => {
      link.addEventListener('click', () => {
        form.elements.package.value = link.dataset.package;
      });
    });
  }

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
