#!/usr/bin/env python3
"""
Generate social-media-ready backtest card for X/Twitter.

Renders the chart natively via matplotlib (dark theme) + composites
the guardian sprite. No screenshot dependency.

Usage:
  python3 scripts/backtest-card.py <master_key> [output_path]

Example:
  python3 scripts/backtest-card.py cz_zhao
  python3 scripts/backtest-card.py liangxi assets/liangxi-card.png
"""

import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np


# ── Design tokens ───────────────────────────────────────────────────

BG       = '#0a1628'
BG_RGB   = (10, 22, 40)
PANEL    = '#0d1e35'
GREEN    = '#00ff88'
CYAN     = '#00d4ff'
RED      = '#ff6b6b'
DIM      = '#1a3a5c'
DIM_RGB  = (26, 58, 92)
WHITE    = '#e0e0e0'
YELLOW   = '#ffd93d'
ACCENT   = '#00ff88'

CARD_W, CARD_H = 1600, 900


# ── Data extraction from TS (via bun) ──────────────────────────────

def get_strategy_data(master_key: str) -> dict:
    """Run bun to extract strategy data as JSON."""
    script = f'''
    import {{ getStrategy }} from "./src/commands/backtest/strategies.ts";
    const s = getStrategy("{master_key}");
    if (!s) {{ console.log("null"); process.exit(1); }}
    console.log(JSON.stringify({{
      name: s.name,
      quote: s.quote,
      event: s.event,
      subtitle: s.subtitle,
      timeLabels: s.timeLabels,
      rawLabel: s.rawLabel,
      grdLabel: s.grdLabel,
      rawCurve: s.rawCurve,
      grdCurve: s.grdCurve,
      raw: s.raw,
      guardian: s.guardian,
    }}));
    '''
    result = subprocess.run(
        ['bun', '-e', script],
        capture_output=True, text=True, timeout=15,
    )
    if result.returncode != 0:
        print(f"Error getting data for {master_key}: {result.stderr}")
        sys.exit(1)
    return json.loads(result.stdout.strip())


# ── Font loading ────────────────────────────────────────────────────

def load_font(size, bold=False):
    candidates = [
        ('/System/Library/Fonts/SFMono-Bold.otf' if bold
         else '/System/Library/Fonts/SFMono-Regular.otf'),
        '/System/Library/Fonts/Menlo.ttc',
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def load_cjk_font(size):
    candidates = [
        '/System/Library/Fonts/STHeiti Medium.ttc',
        '/System/Library/Fonts/PingFang.ttc',
        '/System/Library/Fonts/Hiragino Sans GB.ttc',
        '/Library/Fonts/Arial Unicode.ttf',
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except (OSError, IOError):
            continue
    return load_font(size)


# ── Chart rendering ─────────────────────────────────────────────────

def render_chart(data: dict, out_path: str, chart_w=1050, chart_h=700):
    """Render equity chart via matplotlib, matching terminal aesthetic."""
    raw = data['rawCurve']
    grd = data['grdCurve']
    n = len(raw)
    x = list(range(n))

    fig, ax = plt.subplots(figsize=(chart_w / 100, chart_h / 100), dpi=100)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)

    # Plot curves with neon glow effect
    def plot_glow(x, y, color, label, z):
        for lw, alpha in [(12, 0.04), (8, 0.08), (5, 0.15), (3, 0.3)]:
            ax.semilogy(x, y, color=color, linewidth=lw, alpha=alpha, zorder=z-0.1)
        ax.semilogy(x, y, color=color, linewidth=2.5, alpha=0.95, label=label, zorder=z)

    plot_glow(x, raw, GREEN, data['rawLabel'], 3)
    plot_glow(x, grd, CYAN, data['grdLabel'], 2)

    # Gradient-like rich fill under curves for depth
    ax.fill_between(x, raw, alpha=0.12, color=GREEN, zorder=1)
    ax.fill_between(x, raw, alpha=0.05, color=GREEN, zorder=1.1, where=[v > raw[0]*1.5 for v in raw])
    ax.fill_between(x, grd, alpha=0.08, color=CYAN, zorder=0)

    # Peak annotation
    peak_val = max(raw)
    peak_idx = raw.index(peak_val)
    if peak_val > raw[0] * 5:
        mult = peak_val / raw[0]
        label = f'  PEAK: ${peak_val:,.0f}\n  ({mult:,.0f}x)'
        ax.annotate(
            label, xy=(peak_idx, peak_val),
            fontsize=11, fontweight='bold', color=YELLOW,
            ha='left', va='bottom',
            arrowprops=dict(arrowstyle='->', color=YELLOW, lw=1.5),
            xytext=(peak_idx - n * 0.15, peak_val * 0.3),
        )

    # If raw ends at 0 or near 0 — REKT annotation
    if data['raw']['liqs'] > 0:
        for j, v in enumerate(raw):
            if v < raw[0] * 0.01 and j > 5:
                ax.annotate(
                    '  LIQUIDATED', xy=(j, max(v, raw[0] * 0.01)),
                    fontsize=12, fontweight='bold', color=RED, ha='left',
                )
                break

    # Guardian survival annotation
    grd_final = grd[-1]
    if grd_final > raw[0] * 2:
        grd_mult = grd_final / grd[0]
        ax.annotate(
            f'  SURVIVED: ${grd_final:,.0f} ({grd_mult:,.0f}x)',
            xy=(len(grd) - 1, grd_final),
            fontsize=10, fontweight='bold', color=CYAN,
            ha='right', va='top',
            xytext=(len(grd) - 1 - n * 0.2, grd_final * 3),
            arrowprops=dict(arrowstyle='->', color=CYAN, lw=1),
        )

    # Start line
    ax.axhline(y=raw[0], color=DIM, linestyle='--', alpha=0.5, linewidth=1)

    # Axis styling
    ax.tick_params(colors=GREEN, labelsize=10, length=4)
    ax.spines['bottom'].set_color(DIM)
    ax.spines['left'].set_color(DIM)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(
        lambda v, _: f'${v / 1e6:.1f}M' if v >= 1e6
        else f'${v / 1e3:.0f}K' if v >= 1e3
        else f'${v:.0f}'
    ))
    ax.set_ylabel('Equity (USDT)', fontsize=11, color=GREEN, labelpad=10)
    ax.grid(True, alpha=0.08, color=DIM)

    # X-axis time labels
    labels = data['timeLabels']
    if labels:
        n_labels = len(labels)
        positions = [int(i * (n - 1) / (n_labels - 1)) for i in range(n_labels)]
        ax.set_xticks(positions)
        ax.set_xticklabels(labels, fontsize=8, color=GREEN, rotation=0)

    # Legend
    legend = ax.legend(
        facecolor=BG, edgecolor=DIM, labelcolor=WHITE,
        fontsize=9, loc='upper left', framealpha=0.9,
    )
    legend.get_frame().set_linewidth(1)

    plt.tight_layout(pad=1.5)
    plt.savefig(out_path, dpi=150, facecolor=BG, bbox_inches='tight')
    plt.close()


# ── Card composition ────────────────────────────────────────────────

def make_card(master_key: str, output_path: str):
    data = get_strategy_data(master_key)

    # ── Render chart to temp file ──
    chart_tmp = '/tmp/vibe_chart_tmp.png'
    render_chart(data, chart_tmp)
    chart_img = Image.open(chart_tmp).convert('RGBA')

    # ── Load sprite ──
    sprite_path = Path(f'assets/sprites/{master_key}-idle.png')
    sprite = None
    if sprite_path.exists():
        sprite = Image.open(sprite_path).convert('RGBA')

    # ── Create canvas ──
    card = Image.new('RGBA', (CARD_W, CARD_H), BG_RGB)
    draw = ImageDraw.Draw(card)

    # ── Place chart (left ~68%) ──
    chart_area_w = int(CARD_W * 0.68)
    chart_area_h = CARD_H - 140
    cw, ch = chart_img.size
    scale = min(chart_area_w / cw, chart_area_h / ch)
    new_w, new_h = int(cw * scale), int(ch * scale)
    chart_resized = chart_img.resize((new_w, new_h), Image.LANCZOS)
    chart_x = 30
    chart_y = 55
    card.paste(chart_resized, (chart_x, chart_y), chart_resized)

    # ── Sprite (right side, large) ──
    if sprite:
        sprite_size = 380
        sprite_resized = sprite.resize((sprite_size, sprite_size), Image.LANCZOS)

        # Subtle glow behind sprite
        glow = Image.new('RGBA', (sprite_size + 80, sprite_size + 80), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        glow_draw.ellipse(
            [(0, 0), (sprite_size + 80, sprite_size + 80)],
            fill=(0, 255, 136, 18),
        )
        glow = glow.filter(ImageFilter.GaussianBlur(radius=30))

        sprite_x = CARD_W - sprite_size - 60
        sprite_y = (CARD_H - 140 - sprite_size) // 2 + 20
        card.paste(glow, (sprite_x - 40, sprite_y - 40), glow)
        card.paste(sprite_resized, (sprite_x, sprite_y), sprite_resized)

    # ── Stats badge (right side, below sprite) ──
    r = data['raw']
    g = data['guardian']
    badge_x = CARD_W - 430
    badge_y = CARD_H - 280 if sprite else CARD_H - 320

    # Glassmorphism panel behind stats
    badge_bg_w = 405
    badge_bg_h = 135
    badge_bg = Image.new('RGBA', (badge_bg_w, badge_bg_h), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(badge_bg)
    bg_draw.rounded_rectangle([(0, 0), (badge_bg_w, badge_bg_h)], radius=16, fill=(255, 255, 255, 9))
    bg_draw.rounded_rectangle([(0, 0), (badge_bg_w, badge_bg_h)], radius=16, outline=(255, 255, 255, 20), width=1)
    card.paste(badge_bg, (badge_x - 15, badge_y - 15), badge_bg)

    font_stat = load_font(15)
    font_stat_b = load_font(15, bold=True)
    font_num = load_font(26, bold=True)

    def fmt(v):
        if v >= 1e6: return f'${v/1e6:.1f}M'
        if v >= 1e3: return f'${v/1e3:.0f}K'
        return f'${v:.0f}'

    # Raw stats
    draw.text((badge_x, badge_y), '▎', fill=GREEN, font=font_num)
    draw.text((badge_x + 20, badge_y), f'Peak {fmt(r["peak"])}', fill=GREEN, font=font_stat_b)
    draw.text((badge_x + 20, badge_y + 22),
              f'Final {"$0 REKT" if r["final"] == 0 else fmt(r["final"])}  ·  {r["trades"]} trades  ·  {r["liqs"]} liqs',
              fill='#88aa88' if r['final'] > 0 else RED, font=font_stat)

    # Guardian stats
    gy = badge_y + 55
    draw.text((badge_x, gy), '▎', fill=CYAN, font=font_num)
    draw.text((badge_x + 20, gy), f'Peak {fmt(g["peak"])}  →  {fmt(g["final"])} SURVIVED', fill=CYAN, font=font_stat_b)
    draw.text((badge_x + 20, gy + 22),
              f'{g["trades"]} trades  ·  {g["wins"]} wins  ·  {g["liqs"]} liquidations',
              fill='#88aacc', font=font_stat)

    # ── Top bar ──
    draw.rectangle([(0, 0), (CARD_W, 48)], fill=(8, 16, 30))
    draw.line([(0, 48), (CARD_W, 48)], fill=DIM_RGB, width=2)

    font_title = load_font(18, bold=True)
    font_sub = load_font(13)
    draw.text((20, 13), f'VIBE SENSEI', fill=GREEN, font=font_title)
    draw.text((175, 15), f'/backtest {master_key}', fill=WHITE, font=font_sub)

    # Event name on right
    event_font = load_font(13)
    draw.text((CARD_W - 20, 15), data['event'], fill=DIM, font=event_font, anchor='ra')

    # ── Bottom bar ──
    bar_y = CARD_H - 75
    draw.rectangle([(0, bar_y), (CARD_W, CARD_H)], fill=(8, 16, 30))
    draw.line([(0, bar_y), (CARD_W, bar_y)], fill=DIM_RGB, width=2)

    # Quote (use CJK font for Chinese characters)
    quote_font = load_cjk_font(19)
    name = data['name']
    quote = data['quote']
    if master_key == 'cz_zhao':
        quote_text = f'"{quote}"  —  {name} (@cz_binance)'
    else:
        quote_text = f'"{quote}"  —  {name}'
    draw.text((25, bar_y + 12), quote_text, fill=WHITE, font=quote_font)

    # Branding
    brand_font = load_font(12)
    draw.text((25, bar_y + 45), 'github.com/VictorVVedtion/vibe-sensei', fill=DIM, font=brand_font)
    draw.text((CARD_W - 25, bar_y + 45), 'bun run dev', fill=GREEN, font=brand_font, anchor='ra')

    # ── Subtitle under top bar ──
    sub_font = load_font(11)
    draw.text((30, 55), data['subtitle'], fill=DIM, font=sub_font)

    # ── Save ──
    card_rgb = Image.new('RGB', card.size, BG_RGB)
    card_rgb.paste(card, mask=card.split()[3])
    card_rgb.save(output_path, quality=95)
    print(f'✅ Card saved: {output_path} ({CARD_W}x{CARD_H})')


# ── Main ────────────────────────────────────────────────────────────

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python3 scripts/backtest-card.py <master_key> [output]')
        print('Example: python3 scripts/backtest-card.py cz_zhao')
        sys.exit(1)

    master = sys.argv[1]
    output = sys.argv[2] if len(sys.argv) > 2 else f'assets/{master}-backtest-card.png'

    make_card(master, output)
