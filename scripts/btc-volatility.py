#!/usr/bin/env python3
"""
BTC Volatility Detection Strategy
Detects volatility spikes, squeeze breakouts, and regime changes.
Compatible with Vibe Sensei RunStrategy tool.

Usage:
  python3 scripts/btc-volatility.py
  python3 scripts/btc-volatility.py --timeframe 1h
  python3 scripts/btc-volatility.py --lookback 50
"""

import argparse
import json
import math
import sys
import urllib.request
from datetime import datetime, timezone

# ─── Config ───────────────────────────────────────────────────
EXCHANGE_API = "https://www.okx.com/api/v5/market/candles"
SYMBOL = "BTC-USDT"
BOLLINGER_PERIOD = 20
BOLLINGER_STD = 2.0
ATR_PERIOD = 14
SQUEEZE_THRESHOLD = 0.03  # BB width < 3% = squeeze
SPIKE_MULTIPLIER = 1.5    # vol > 1.5x avg = spike


def fetch_candles(timeframe="4h", limit=100):
    """Fetch OHLCV candles from OKX public API."""
    # OKX bar format: 1m, 5m, 15m, 1H, 4H, 1D
    tf_okx = {"1m": "1m", "5m": "5m", "15m": "15m", "1h": "1H", "4h": "4H", "1d": "1D"}
    bar = tf_okx.get(timeframe, "4H")
    url = f"{EXCHANGE_API}?instId={SYMBOL}&bar={bar}&limit={limit}"
    req = urllib.request.Request(url, headers={"User-Agent": "vibe-sensei/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        raw = json.loads(resp.read())
    data = raw.get("data", [])
    candles = []
    for k in data:
        # OKX format: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
        candles.append({
            "time": int(k[0]),
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5]),
        })
    # OKX returns newest first, reverse to chronological order
    candles.reverse()
    return candles


def sma(values, period):
    """Simple Moving Average."""
    if len(values) < period:
        return None
    return sum(values[-period:]) / period


def std_dev(values, period):
    """Standard deviation over period."""
    if len(values) < period:
        return None
    window = values[-period:]
    avg = sum(window) / len(window)
    variance = sum((x - avg) ** 2 for x in window) / len(window)
    return math.sqrt(variance)


def calc_atr(candles, period=14):
    """Average True Range."""
    trs = []
    for i in range(1, len(candles)):
        c = candles[i]
        prev_close = candles[i - 1]["close"]
        tr = max(
            c["high"] - c["low"],
            abs(c["high"] - prev_close),
            abs(c["low"] - prev_close),
        )
        trs.append(tr)
    if len(trs) < period:
        return None, trs
    atr = sum(trs[-period:]) / period
    return atr, trs


def calc_bollinger(closes, period=20, num_std=2.0):
    """Bollinger Bands: middle, upper, lower, width%."""
    mid = sma(closes, period)
    sd = std_dev(closes, period)
    if mid is None or sd is None:
        return None
    upper = mid + num_std * sd
    lower = mid - num_std * sd
    width_pct = (upper - lower) / mid * 100
    return {
        "upper": upper,
        "middle": mid,
        "lower": lower,
        "width_pct": width_pct,
        "std": sd,
    }


def calc_historical_vol(closes, period=20):
    """Annualized historical volatility from log returns."""
    if len(closes) < period + 1:
        return None
    returns = []
    for i in range(-period, 0):
        r = math.log(closes[i] / closes[i - 1])
        returns.append(r)
    avg = sum(returns) / len(returns)
    var = sum((r - avg) ** 2 for r in returns) / len(returns)
    daily_vol = math.sqrt(var)
    return {"vol": daily_vol, "returns": returns}


def detect_regime(bb_widths, window=5):
    """Detect volatility regime: SQUEEZE / EXPANSION / NORMAL."""
    if len(bb_widths) < window:
        return "UNKNOWN"
    recent = bb_widths[-window:]
    avg_width = sum(recent) / len(recent)
    trend = recent[-1] - recent[0]

    if avg_width < SQUEEZE_THRESHOLD * 100:
        return "SQUEEZE"
    elif trend > 0.5 and recent[-1] > avg_width * 1.2:
        return "EXPANSION"
    else:
        return "NORMAL"


def detect_spike(trs, atr, threshold=SPIKE_MULTIPLIER):
    """Check if latest true range is a volatility spike."""
    if atr is None or not trs:
        return False, 0
    ratio = trs[-1] / atr
    return ratio > threshold, ratio


def format_usd(value):
    return f"${value:,.2f}"


def format_pct(value):
    return f"{value:.2f}%"


def main():
    parser = argparse.ArgumentParser(description="BTC Volatility Detector")
    parser.add_argument("--symbol", default="BTC/USDT", help="Trading pair")
    parser.add_argument("--timeframe", default="4h", help="Candle timeframe")
    parser.add_argument("--lookback", type=int, default=100, help="Number of candles")
    args = parser.parse_args()

    # Map timeframe format
    tf_map = {"1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "4h": "4h", "1d": "1d"}
    tf = tf_map.get(args.timeframe, "4h")

    # ─── Fetch Data ───
    try:
        candles = fetch_candles(timeframe=tf, limit=args.lookback)
    except Exception as e:
        print(f"SIGNAL: UNKNOWN")
        print(f"REASON: Failed to fetch data: {e}")
        sys.exit(1)

    if len(candles) < BOLLINGER_PERIOD + 5:
        print("SIGNAL: UNKNOWN")
        print("REASON: Not enough candle data")
        sys.exit(1)

    closes = [c["close"] for c in candles]
    price = closes[-1]

    # ─── Calculations ───
    bb = calc_bollinger(closes, BOLLINGER_PERIOD, BOLLINGER_STD)
    atr, trs = calc_atr(candles, ATR_PERIOD)
    hist_vol_result = calc_historical_vol(closes, 20)
    hist_vol = hist_vol_result["vol"] if hist_vol_result else None
    is_spike, spike_ratio = detect_spike(trs, atr)

    # BB width history for regime detection
    bb_widths = []
    for i in range(BOLLINGER_PERIOD, len(closes)):
        window = closes[i - BOLLINGER_PERIOD : i]
        mid = sum(window) / len(window)
        sd = math.sqrt(sum((x - mid) ** 2 for x in window) / len(window))
        upper = mid + BOLLINGER_STD * sd
        lower = mid - BOLLINGER_STD * sd
        bb_widths.append((upper - lower) / mid * 100)

    regime = detect_regime(bb_widths)

    # Volume analysis
    vols = [c["volume"] for c in candles]
    vol_avg_20 = sma(vols, 20)
    vol_ratio = vols[-1] / vol_avg_20 if vol_avg_20 else 0

    # ─── Signal Logic ───
    reasons = []
    confidence = 50

    # Squeeze breakout = high-conviction BUY signal
    if regime == "SQUEEZE":
        reasons.append(f"BB squeeze detected (width {format_pct(bb_widths[-1])})")
        confidence += 15
        if price > bb["upper"]:
            reasons.append("price breaking above upper BB — bullish breakout")
            confidence += 10
            signal = "BUY"
        elif price < bb["lower"]:
            reasons.append("price breaking below lower BB — bearish breakout")
            confidence += 10
            signal = "SELL"
        else:
            reasons.append("squeeze in progress — breakout imminent, wait for direction")
            signal = "HOLD"

    elif regime == "EXPANSION":
        reasons.append(f"volatility expanding (BB width {format_pct(bb_widths[-1])})")
        if price > bb["middle"]:
            reasons.append("expansion to upside — trend momentum")
            signal = "BUY"
            confidence += 5
        else:
            reasons.append("expansion to downside — bearish momentum")
            signal = "SELL"
            confidence += 5

    else:
        reasons.append(f"normal volatility regime (BB width {format_pct(bb_widths[-1])})")
        signal = "HOLD"

    # Spike detection overlay
    if is_spike:
        reasons.append(f"volatility SPIKE: TR/ATR = {spike_ratio:.2f}x (>{SPIKE_MULTIPLIER}x)")
        confidence += 10

    # Volume confirmation
    if vol_ratio > 1.5:
        reasons.append(f"volume surge {vol_ratio:.1f}x average")
        confidence += 5
    elif vol_ratio < 0.5:
        reasons.append(f"volume dry up {vol_ratio:.1f}x average — low conviction")
        confidence -= 10

    confidence = max(10, min(95, confidence))

    # ─── Output (RunStrategy compatible) ───
    print(f"SIGNAL: {signal}")
    print(f"CONFIDENCE: {confidence}")
    print(f"PRICE: {price}")
    print(f"REASON: {'; '.join(reasons)}")
    print()
    print("=" * 56)
    print(f"  BTC Volatility Report — {tf} candles")
    print("=" * 56)
    print(f"  Price:           {format_usd(price)}")
    print(f"  ATR({ATR_PERIOD}):          {format_usd(atr) if atr else 'N/A'}")
    print(f"  ATR %:           {format_pct(atr / price * 100) if atr else 'N/A'}")
    print(f"  Hist Vol (20):   {format_pct(hist_vol * 100) if hist_vol else 'N/A'}")
    print("-" * 56)
    print(f"  Bollinger Bands:")
    if bb:
        print(f"    Upper:         {format_usd(bb['upper'])}")
        print(f"    Middle:        {format_usd(bb['middle'])}")
        print(f"    Lower:         {format_usd(bb['lower'])}")
        print(f"    Width:         {format_pct(bb['width_pct'])}")
        pos_in_bb = (price - bb["lower"]) / (bb["upper"] - bb["lower"]) * 100
        print(f"    Price Position: {format_pct(pos_in_bb)} (0%=lower, 100%=upper)")
    print("-" * 56)
    print(f"  Regime:          {regime}")
    print(f"  Spike:           {'YES' if is_spike else 'NO'} (TR/ATR: {spike_ratio:.2f}x)")
    print(f"  Volume Ratio:    {vol_ratio:.2f}x avg")
    print("=" * 56)

    # Actionable summary
    if regime == "SQUEEZE":
        print("\n  [!] SQUEEZE ALERT: Bollinger Band compression detected.")
        print("      Historically, squeezes precede large moves.")
        print("      Watch for breakout direction with volume confirmation.")
    if is_spike:
        print("\n  [!] SPIKE ALERT: Abnormal volatility detected.")
        print("      Consider tightening stops or reducing position size.")


if __name__ == "__main__":
    main()
