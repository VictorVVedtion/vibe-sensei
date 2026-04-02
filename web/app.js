/**
 * Vibe Sensei -- Chart Terminal
 * Vanilla JS frontend for TradingView Lightweight Charts + UDF server.
 * Includes WebSocket client for real-time market data push.
 */

(function () {
  'use strict';

  var UDF_BASE = window.location.origin;

  // --- State ---
  var currentSymbol = 'BTCUSDT';
  var currentResolution = '60';
  var chart = null;
  var candleSeries = null;
  var volumeSeries = null;
  var lastCandleData = null;

  // --- WebSocket state ---
  var ws = null;
  var wsReconnectTimer = null;
  var WS_RECONNECT_DELAY = 3000;

  // --- DOM refs ---
  var chartContainer = document.getElementById('chartContainer');
  var symbolSelect = document.getElementById('symbolSelect');
  var tfGroup = document.getElementById('tfGroup');
  var loadingIndicator = document.getElementById('loadingIndicator');
  var lastPriceEl = document.getElementById('lastPrice');
  var symbolLabel = document.getElementById('symbolLabel');
  var ohlcBar = document.getElementById('ohlcBar');

  // --- Helpers ---

  function showLoading() {
    loadingIndicator.classList.add('visible');
  }

  function hideLoading() {
    loadingIndicator.classList.remove('visible');
  }

  function formatPrice(price) {
    if (price >= 1000) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  }

  function showError(title, message) {
    var existing = chartContainer.querySelector('.error-overlay');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.className = 'error-overlay';
    overlay.innerHTML = '<h3>' + title + '</h3><p>' + message + '</p>';
    chartContainer.appendChild(overlay);
  }

  function clearError() {
    var existing = chartContainer.querySelector('.error-overlay');
    if (existing) existing.remove();
  }

  // --- UDF Data Fetching ---

  function fetchJSON(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + res.statusText);
      return res.json();
    });
  }

  function fetchSymbols() {
    return fetchJSON(UDF_BASE + '/search?query=&limit=20');
  }

  function fetchSymbolInfo(symbol) {
    return fetchJSON(UDF_BASE + '/symbols?symbol=' + encodeURIComponent(symbol));
  }

  function fetchHistory(symbol, resolution, fromTs, toTs) {
    return fetchJSON(
      UDF_BASE + '/history?symbol=' + encodeURIComponent(symbol) +
      '&resolution=' + encodeURIComponent(resolution) +
      '&from=' + fromTs +
      '&to=' + toTs
    );
  }

  // --- Map UDF arrays to Lightweight Charts format ---

  function mapCandleData(udf) {
    if (!udf || udf.s !== 'ok' || !udf.t || udf.t.length === 0) return [];
    var result = [];
    for (var i = 0; i < udf.t.length; i++) {
      result.push({
        time: udf.t[i],
        open: udf.o[i],
        high: udf.h[i],
        low: udf.l[i],
        close: udf.c[i],
      });
    }
    return result;
  }

  function mapVolumeData(udf) {
    if (!udf || udf.s !== 'ok' || !udf.t || udf.t.length === 0) return [];
    var result = [];
    for (var i = 0; i < udf.t.length; i++) {
      var isUp = udf.c[i] >= udf.o[i];
      result.push({
        time: udf.t[i],
        value: udf.v[i],
        color: isUp ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)',
      });
    }
    return result;
  }

  // --- Chart Initialization ---

  function initChart() {
    chart = LightweightCharts.createChart(chartContainer, {
      width: chartContainer.clientWidth,
      height: chartContainer.clientHeight,
      layout: {
        background: { type: 'solid', color: '#1a1a2e' },
        textColor: '#e0e0e0',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: '#2a2a4a' },
        horzLines: { color: '#2a2a4a' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: '#4a4a7a', width: 1, style: LightweightCharts.LineStyle.Dashed },
        horzLine: { color: '#4a4a7a', width: 1, style: LightweightCharts.LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: '#2a2a4a',
      },
      timeScale: {
        borderColor: '#2a2a4a',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Crosshair move: update OHLC bar
    chart.subscribeCrosshairMove(function (param) {
      if (!param || !param.time) {
        updateOhlcBar(lastCandleData);
        return;
      }
      var data = param.seriesData.get(candleSeries);
      if (data) {
        updateOhlcBar(data);
      }
    });

    // Resize handler
    window.addEventListener('resize', function () {
      if (chart) {
        chart.resize(chartContainer.clientWidth, chartContainer.clientHeight);
      }
    });
  }

  // --- OHLC Bar ---

  function updateOhlcBar(candle) {
    if (!candle) {
      ohlcBar.innerHTML = '';
      return;
    }
    var isUp = candle.close >= candle.open;
    var color = isUp ? '#22c55e' : '#ef4444';
    ohlcBar.innerHTML =
      '<span><span class="label">O</span> <span style="color:' + color + '">' + formatPrice(candle.open) + '</span></span>' +
      '<span><span class="label">H</span> <span style="color:' + color + '">' + formatPrice(candle.high) + '</span></span>' +
      '<span><span class="label">L</span> <span style="color:' + color + '">' + formatPrice(candle.low) + '</span></span>' +
      '<span><span class="label">C</span> <span style="color:' + color + '">' + formatPrice(candle.close) + '</span></span>';
  }

  // --- Data Loading ---

  function loadData() {
    showLoading();
    clearError();

    var now = Math.floor(Date.now() / 1000);
    var thirtyDaysAgo = now - (30 * 24 * 60 * 60);

    Promise.all([
      fetchSymbolInfo(currentSymbol),
      fetchHistory(currentSymbol, currentResolution, thirtyDaysAgo, now),
    ]).then(function (results) {
      var candles = mapCandleData(results[1]);
      var volumes = mapVolumeData(results[1]);

      if (candles.length === 0) {
        showError('No Data', 'No candle data returned for ' + currentSymbol + '. Is the UDF server running?');
        hideLoading();
        return;
      }

      candleSeries.setData(candles);
      volumeSeries.setData(volumes);
      chart.timeScale().fitContent();

      // Update info panel
      var lastCandle = candles[candles.length - 1];
      lastCandleData = lastCandle;
      var prevCandle = candles.length > 1 ? candles[candles.length - 2] : lastCandle;
      var isUp = lastCandle.close >= prevCandle.close;

      lastPriceEl.textContent = formatPrice(lastCandle.close);
      lastPriceEl.className = 'last-price ' + (isUp ? 'up' : 'down');
      symbolLabel.textContent = currentSymbol;
      updateOhlcBar(lastCandle);

      hideLoading();
    }).catch(function (err) {
      hideLoading();
      showError(
        'Connection Error',
        'Could not load data from UDF server at ' + UDF_BASE + '.<br>' +
        'Make sure the server is running on port 3456.<br><br>' +
        '<code>' + err.message + '</code>'
      );
      console.error('[Vibe Sensei] Data load failed:', err);
    });
  }

  // --- Symbol Selector ---

  function populateSymbolSelector() {
    // Provide default options in case search fails
    var defaults = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

    fetchSymbols().then(function (symbols) {
      var pairs = symbols.map(function (s) { return s.symbol; });
      if (pairs.length === 0) pairs = defaults;
      renderSymbolOptions(pairs);
    }).catch(function () {
      renderSymbolOptions(defaults);
    });
  }

  function renderSymbolOptions(pairs) {
    symbolSelect.innerHTML = '';
    pairs.forEach(function (pair) {
      var opt = document.createElement('option');
      opt.value = pair;
      opt.textContent = pair.replace('USDT', '/USDT');
      if (pair === currentSymbol) opt.selected = true;
      symbolSelect.appendChild(opt);
    });
  }

  // --- Event Bindings ---

  function bindEvents() {
    symbolSelect.addEventListener('change', function () {
      currentSymbol = symbolSelect.value;
      loadData();
    });

    tfGroup.addEventListener('click', function (e) {
      var btn = e.target.closest('.tf-btn');
      if (!btn) return;
      var resolution = btn.getAttribute('data-resolution');
      if (resolution === currentResolution) return;

      currentResolution = resolution;

      // Update active state
      var buttons = tfGroup.querySelectorAll('.tf-btn');
      buttons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      loadData();
    });
  }

  // --- WebSocket Live Price Feed ---

  /**
   * Convert a CCXT-style symbol (BTC/USDT) to the chart symbol format (BTCUSDT).
   */
  function tickerSymbolToChart(symbol) {
    return symbol.replace('/', '');
  }

  /**
   * Handle an incoming ticker update from the WebSocket feed.
   * Updates the info panel price display for the currently selected symbol.
   */
  function handleTickerUpdate(data) {
    var chartSymbol = tickerSymbolToChart(data.symbol);

    // Only update the display if this ticker matches the currently viewed symbol.
    if (chartSymbol !== currentSymbol) return;

    // Update last price with direction coloring.
    var prevPrice = parseFloat(lastPriceEl.textContent) || 0;
    var isUp = data.last >= prevPrice;

    lastPriceEl.textContent = formatPrice(data.last);
    lastPriceEl.className = 'last-price ' + (isUp ? 'up' : 'down');

    // Update bid/ask spread display in the info panel.
    updateBidAskDisplay(data);
  }

  /**
   * Show live bid/ask spread below the price info.
   * Creates or updates the bid-ask element in the info panel.
   */
  function updateBidAskDisplay(data) {
    var infoPanel = document.querySelector('.price-info');
    if (!infoPanel) return;

    var bidAskEl = document.getElementById('bidAskSpread');
    if (!bidAskEl) {
      bidAskEl = document.createElement('span');
      bidAskEl.id = 'bidAskSpread';
      bidAskEl.style.cssText = 'font-size:11px; color:#888; margin-left:8px;';
      infoPanel.appendChild(bidAskEl);
    }

    var spread = data.ask - data.bid;
    bidAskEl.textContent =
      'B: ' + formatPrice(data.bid) +
      ' / A: ' + formatPrice(data.ask) +
      ' (spread: ' + formatPrice(spread) + ')';
  }

  /**
   * Connect to the WebSocket server for live price updates.
   * Falls back gracefully if WebSocket is not available or the server
   * does not support it -- existing HTTP behavior is unaffected.
   */
  function connectWebSocket() {
    if (typeof WebSocket === 'undefined') {
      console.log('[Vibe Sensei] WebSocket not supported, using HTTP only');
      return;
    }

    // Build the ws:// URL from the page origin.
    var wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var wsUrl = wsProtocol + '//' + window.location.host;

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.warn('[Vibe Sensei] WebSocket connection failed:', err);
      scheduleReconnect();
      return;
    }

    ws.onopen = function () {
      console.log('[Vibe Sensei] WebSocket connected');
      // Clear any pending reconnect.
      if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
      }
    };

    ws.onmessage = function (event) {
      try {
        var msg = JSON.parse(event.data);
        if (msg.type === 'ticker' && msg.data) {
          handleTickerUpdate(msg.data);
        }
      } catch (err) {
        console.warn('[Vibe Sensei] Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = function () {
      console.log('[Vibe Sensei] WebSocket disconnected');
      ws = null;
      scheduleReconnect();
    };

    ws.onerror = function () {
      // onclose will fire after onerror, so reconnect is handled there.
      // Avoid duplicate logging -- onclose covers it.
    };
  }

  /**
   * Schedule a WebSocket reconnection attempt after a delay.
   */
  function scheduleReconnect() {
    if (wsReconnectTimer) return;
    wsReconnectTimer = setTimeout(function () {
      wsReconnectTimer = null;
      connectWebSocket();
    }, WS_RECONNECT_DELAY);
  }

  // --- Trade Markers (public API for future WebSocket integration) ---

  /**
   * Add a trade marker on the candlestick chart.
   * @param {number} time - Unix timestamp in seconds
   * @param {'buy'|'sell'} side - Trade direction
   * @param {number} price - Execution price
   * @param {string} text - Marker label text
   */
  function addTradeMarker(time, side, price, text) {
    if (!candleSeries) {
      console.error('[Vibe Sensei] Chart not initialized, cannot add marker');
      return;
    }

    var existingMarkers = candleSeries.markers() || [];
    var isBuy = side === 'buy';

    var marker = {
      time: time,
      position: isBuy ? 'belowBar' : 'aboveBar',
      color: isBuy ? '#22c55e' : '#ef4444',
      shape: isBuy ? 'arrowUp' : 'arrowDown',
      text: text || (isBuy ? 'BUY' : 'SELL') + ' @ ' + formatPrice(price),
    };

    // Insert in sorted order by time
    var inserted = false;
    var newMarkers = [];
    for (var i = 0; i < existingMarkers.length; i++) {
      if (!inserted && time < existingMarkers[i].time) {
        newMarkers.push(marker);
        inserted = true;
      }
      newMarkers.push(existingMarkers[i]);
    }
    if (!inserted) newMarkers.push(marker);

    candleSeries.setMarkers(newMarkers);
  }

  // Expose public API
  window.VibeSensei = {
    addTradeMarker: addTradeMarker,
    reload: loadData,
  };

  // --- Bootstrap ---

  function init() {
    initChart();
    populateSymbolSelector();
    bindEvents();
    loadData();
    connectWebSocket();
  }

  // Wait for DOM if needed (script is at bottom, so usually ready)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
