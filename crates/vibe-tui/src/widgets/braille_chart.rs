use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Style},
    text::{Line, Span},
    widgets::Widget,
};

use crate::chart::braille::BrailleCanvas;
use crate::chart::ohlcv::OhlcvBuffer;

/// Matrix green for bullish candles: #00FF41.
const BULLISH_COLOR: Color = Color::Rgb(0, 255, 65);

/// Dim color for bearish candles.
const BEARISH_COLOR: Color = Color::Rgb(80, 80, 80);

/// Bright color for volume spike bars (>2x average).
const VOLUME_SPIKE_COLOR: Color = Color::Rgb(0, 255, 65);

/// Normal volume bar color.
const VOLUME_COLOR: Color = Color::Rgb(40, 40, 40);

/// Fraction of chart height reserved for volume bars at bottom.
const VOLUME_ZONE_FRACTION: f64 = 0.20;

/// Rendered chart data: Braille characters with per-cell color info.
///
/// This is the output of the chart rendering computation. It can be
/// consumed by a ratatui Widget to draw into a Frame.
pub struct BrailleChartData {
    /// Braille character grid (char_height rows x char_width cols).
    pub chars: Vec<Vec<char>>,
    /// Per-cell color (same dimensions as `chars`).
    pub colors: Vec<Vec<Color>>,
    /// Number of character columns.
    pub char_width: usize,
    /// Number of character rows.
    pub char_height: usize,
}

/// Render OHLCV candles into Braille chart data.
///
/// This is the pure computation function — no terminal dependencies.
/// It produces a `BrailleChartData` that can be rendered by a Widget.
///
/// Parameters:
/// - `buffer`: The OHLCV ring buffer with candle data.
/// - `char_width`: Available character columns for the chart body.
/// - `char_height`: Available character rows for the chart body.
pub fn render_chart(buffer: &OhlcvBuffer, char_width: usize, char_height: usize) -> BrailleChartData {
    let dot_w = char_width * 2;
    let dot_h = char_height * 4;

    if buffer.is_empty() || char_width == 0 || char_height == 0 {
        return BrailleChartData {
            chars: vec![vec!['\u{2800}'; char_width]; char_height],
            colors: vec![vec![Color::DarkGray; char_width]; char_height],
            char_width,
            char_height,
        };
    }

    // Determine how many candles we can fit. Each candle gets ~3 dot columns
    // (2 for body + 1 gap). Minimum 1 dot col for wick.
    let candle_width = 3_usize; // 2 dots body + 1 dot gap
    let max_candles = dot_w / candle_width.max(1);
    let visible = buffer.visible_range(max_candles);
    let num_candles = visible.len();

    if num_candles == 0 {
        return BrailleChartData {
            chars: vec![vec!['\u{2800}'; char_width]; char_height],
            colors: vec![vec![Color::DarkGray; char_width]; char_height],
            char_width,
            char_height,
        };
    }

    // Price range across visible candles
    let (price_lo, price_hi) = {
        let mut lo = f64::MAX;
        let mut hi = f64::MIN;
        for c in &visible {
            if c.low < lo {
                lo = c.low;
            }
            if c.high > hi {
                hi = c.high;
            }
        }
        // Add small padding to avoid dots at exact edges
        let spread = (hi - lo).max(0.01);
        (lo - spread * 0.02, hi + spread * 0.02)
    };

    // Volume zone height in dots
    let vol_dots = ((dot_h as f64) * VOLUME_ZONE_FRACTION) as usize;
    let price_dots = dot_h.saturating_sub(vol_dots);

    // Max volume for scaling
    let max_vol = visible.iter().map(|c| c.volume).fold(0.0_f64, f64::max);
    let avg_vol = {
        let sum: f64 = visible.iter().map(|c| c.volume).sum();
        if num_candles > 0 {
            sum / num_candles as f64
        } else {
            0.0
        }
    };

    // Create canvases: one for candle bodies/wicks, one for volume
    let mut candle_canvas = BrailleCanvas::new(char_width, char_height);

    // Per-candle color tracking: which character columns are bullish vs bearish
    // We'll track the dominant color per char column
    let mut col_bullish = vec![false; char_width];
    let mut col_vol_spike = vec![false; char_width];

    // Render each candle
    for (i, candle) in visible.iter().enumerate() {
        let center_x = i * candle_width + 1; // center dot x of this candle
        if center_x >= dot_w {
            break;
        }

        let bullish = candle.is_bullish();
        let char_col = center_x / 2;
        if char_col < char_width {
            col_bullish[char_col] = bullish;
        }

        // Map prices to dot y (inverted: high price = low y)
        let price_range = price_hi - price_lo;
        let map_price = |p: f64| -> usize {
            if price_range < f64::EPSILON {
                return price_dots / 2;
            }
            let normalized = (price_hi - p) / price_range;
            let y = (normalized * (price_dots.saturating_sub(1)) as f64) as usize;
            y.min(price_dots.saturating_sub(1))
        };

        let y_high = map_price(candle.high);
        let y_low = map_price(candle.low);
        let (body_lo, body_hi) = candle.body_range();
        let y_body_top = map_price(body_hi);
        let y_body_bottom = map_price(body_lo);

        // Draw wick (thin vertical line, 1 dot wide)
        candle_canvas.draw_vertical_line(center_x, y_high, y_low);

        // Draw body (2 dots wide filled rectangle)
        let body_x = center_x.saturating_sub(1);
        if y_body_top <= y_body_bottom {
            candle_canvas.fill_column(body_x, y_body_top, y_body_bottom);
        } else {
            // Doji or single-point body
            candle_canvas.set_dot(body_x, y_body_top);
            if body_x + 1 < dot_w {
                candle_canvas.set_dot(body_x + 1, y_body_top);
            }
        }

        // Draw volume bar at bottom
        if max_vol > 0.0 && vol_dots > 0 {
            let vol_frac = candle.volume / max_vol;
            let bar_height = ((vol_frac * vol_dots as f64) as usize).max(1);
            let vol_y_bottom = dot_h.saturating_sub(1);
            let vol_y_top = vol_y_bottom.saturating_sub(bar_height.saturating_sub(1));

            candle_canvas.fill_column(body_x, vol_y_top, vol_y_bottom);

            // Track spike
            if char_col < char_width && candle.volume > avg_vol * 2.0 {
                col_vol_spike[char_col] = true;
            }
        }
    }

    // Convert canvas to char grid
    let chars = candle_canvas.to_char_grid();

    // Build color grid
    let mut colors = vec![vec![Color::DarkGray; char_width]; char_height];
    let vol_char_row_start = price_dots / 4; // approximate char row where volume starts

    for cy in 0..char_height {
        for cx in 0..char_width {
            if chars[cy][cx] == '\u{2800}' {
                // Empty cell — keep dark gray
                continue;
            }

            if cy >= vol_char_row_start {
                // Could be volume zone — check if this column has a volume spike
                if col_vol_spike.get(cx).copied().unwrap_or(false) {
                    colors[cy][cx] = VOLUME_SPIKE_COLOR;
                } else if cy >= vol_char_row_start {
                    colors[cy][cx] = VOLUME_COLOR;
                }
                // If also in the candle zone, candle color takes precedence
                // (candle wicks/bodies extend downward)
                if cy < vol_char_row_start {
                    if col_bullish.get(cx).copied().unwrap_or(false) {
                        colors[cy][cx] = BULLISH_COLOR;
                    } else {
                        colors[cy][cx] = BEARISH_COLOR;
                    }
                }
            }

            // Price zone: candle color
            if cy < vol_char_row_start {
                if col_bullish.get(cx).copied().unwrap_or(false) {
                    colors[cy][cx] = BULLISH_COLOR;
                } else {
                    colors[cy][cx] = BEARISH_COLOR;
                }
            }
        }
    }

    BrailleChartData {
        chars,
        colors,
        char_width,
        char_height,
    }
}

/// A ratatui Widget that renders a BrailleChartData into a frame.
pub struct BrailleChartWidget<'a> {
    data: &'a BrailleChartData,
}

impl<'a> BrailleChartWidget<'a> {
    pub fn new(data: &'a BrailleChartData) -> Self {
        Self { data }
    }
}

impl Widget for BrailleChartWidget<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let max_rows = (area.height as usize).min(self.data.char_height);
        let max_cols = (area.width as usize).min(self.data.char_width);

        for row in 0..max_rows {
            let y = area.y + row as u16;
            if y >= area.y + area.height {
                break;
            }

            let spans: Vec<Span> = (0..max_cols)
                .map(|col| {
                    let ch = self.data.chars[row][col];
                    let color = self.data.colors[row][col];
                    Span::styled(ch.to_string(), Style::default().fg(color))
                })
                .collect();

            let line = Line::from(spans);
            let x = area.x;
            buf.set_line(x, y, &line, area.width);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chart::ohlcv::{Ohlcv, OhlcvBuffer};

    fn sample_buffer(n: usize) -> OhlcvBuffer {
        let mut buf = OhlcvBuffer::new(500);
        for i in 0..n {
            let base = 100.0 + (i as f64) * 2.0;
            let bullish = i % 2 == 0;
            buf.push(Ohlcv {
                time: 1000 + i as u64 * 60,
                open: if bullish { base } else { base + 5.0 },
                high: base + 10.0,
                low: base - 5.0,
                close: if bullish { base + 5.0 } else { base },
                volume: 100.0 + (i as f64) * 10.0,
            });
        }
        buf
    }

    #[test]
    fn test_render_empty_buffer() {
        let buf = OhlcvBuffer::new(10);
        let data = render_chart(&buf, 40, 20);
        assert_eq!(data.char_width, 40);
        assert_eq!(data.char_height, 20);
        // All chars should be blank braille
        for row in &data.chars {
            for &ch in row {
                assert_eq!(ch, '\u{2800}');
            }
        }
    }

    #[test]
    fn test_render_single_candle() {
        let mut buf = OhlcvBuffer::new(10);
        buf.push(Ohlcv {
            time: 1000,
            open: 100.0,
            high: 110.0,
            low: 90.0,
            close: 105.0,
            volume: 500.0,
        });
        let data = render_chart(&buf, 20, 10);
        // Should have some non-blank chars
        let has_content = data
            .chars
            .iter()
            .any(|row| row.iter().any(|&ch| ch != '\u{2800}'));
        assert!(has_content, "single candle should produce visible output");
    }

    #[test]
    fn test_render_multiple_candles() {
        let buf = sample_buffer(10);
        let data = render_chart(&buf, 40, 20);
        // Count non-blank chars
        let filled: usize = data
            .chars
            .iter()
            .map(|row| row.iter().filter(|&&ch| ch != '\u{2800}').count())
            .sum();
        assert!(filled > 5, "10 candles should produce many dots, got {filled}");
    }

    #[test]
    fn test_render_zero_dimensions() {
        let buf = sample_buffer(5);
        let data = render_chart(&buf, 0, 0);
        assert_eq!(data.char_width, 0);
        assert_eq!(data.char_height, 0);
    }

    #[test]
    fn test_bullish_candle_color() {
        let mut buf = OhlcvBuffer::new(10);
        buf.push(Ohlcv {
            time: 1000,
            open: 100.0,
            high: 110.0,
            low: 90.0,
            close: 105.0, // bullish
            volume: 100.0,
        });
        let data = render_chart(&buf, 20, 10);
        // Find a non-blank cell in the price zone and check it's bullish colored
        let found_bullish = data.colors.iter().flatten().any(|&c| c == BULLISH_COLOR);
        assert!(found_bullish, "bullish candle should have green color");
    }

    #[test]
    fn test_bearish_candle_color() {
        let mut buf = OhlcvBuffer::new(10);
        buf.push(Ohlcv {
            time: 1000,
            open: 105.0,
            high: 110.0,
            low: 90.0,
            close: 100.0, // bearish
            volume: 100.0,
        });
        let data = render_chart(&buf, 20, 10);
        let found_bearish = data.colors.iter().flatten().any(|&c| c == BEARISH_COLOR);
        assert!(found_bearish, "bearish candle should have dim color");
    }

    #[test]
    fn test_volume_spike_highlight() {
        let mut buf = OhlcvBuffer::new(10);
        // Push several low-volume candles, then one spike
        for i in 0..5 {
            buf.push(Ohlcv {
                time: 1000 + i * 60,
                open: 100.0,
                high: 110.0,
                low: 90.0,
                close: 105.0,
                volume: 100.0, // normal volume
            });
        }
        buf.push(Ohlcv {
            time: 1300,
            open: 100.0,
            high: 115.0,
            low: 85.0,
            close: 110.0,
            volume: 1000.0, // 10x average → spike
        });
        let data = render_chart(&buf, 40, 20);
        let found_spike = data.colors.iter().flatten().any(|&c| c == VOLUME_SPIKE_COLOR);
        assert!(found_spike, "volume spike should be highlighted");
    }

    #[test]
    fn test_chart_dimensions_match_input() {
        let buf = sample_buffer(20);
        let data = render_chart(&buf, 50, 25);
        assert_eq!(data.chars.len(), 25);
        assert_eq!(data.chars[0].len(), 50);
        assert_eq!(data.colors.len(), 25);
        assert_eq!(data.colors[0].len(), 50);
    }
}
