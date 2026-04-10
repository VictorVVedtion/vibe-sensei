use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Style},
    text::{Line, Span},
    widgets::Widget,
};

use crate::chart::ohlcv::OhlcvBuffer;

/// Matrix green for the current price line/label.
const MATRIX_GREEN: Color = Color::Rgb(0, 255, 65);

/// Dim color for axis labels and grid lines.
const AXIS_COLOR: Color = Color::DarkGray;

/// Number of price tick marks on the Y axis.
const PRICE_TICKS: usize = 5;

/// Width of the price axis column (chars) including padding.
pub const PRICE_AXIS_WIDTH: u16 = 10;

/// Height of the time axis row.
pub const TIME_AXIS_HEIGHT: u16 = 1;

/// Format a price for display on the axis.
///
/// Adapts decimal places based on magnitude:
/// - >= 1000: no decimals (e.g. "42150")
/// - >= 1: 2 decimals (e.g. "3.14")
/// - < 1: 4 decimals (e.g. "0.0042")
fn format_price(price: f64) -> String {
    if price.abs() >= 1000.0 {
        format!("{:.0}", price)
    } else if price.abs() >= 1.0 {
        format!("{:.2}", price)
    } else {
        format!("{:.4}", price)
    }
}

/// Format a unix timestamp to HH:MM.
fn format_time(timestamp: u64) -> String {
    let secs = timestamp % 86400;
    let hours = secs / 3600;
    let minutes = (secs % 3600) / 60;
    format!("{:02}:{:02}", hours, minutes)
}

/// Price axis widget — renders on the right side of the chart.
///
/// Shows evenly spaced price ticks and highlights the current price.
pub struct PriceAxis {
    /// Minimum price in the visible range.
    price_lo: f64,
    /// Maximum price in the visible range.
    price_hi: f64,
    /// Current (latest) price for the highlight line.
    current_price: Option<f64>,
}

impl PriceAxis {
    /// Create from the visible OHLCV buffer data.
    ///
    /// `n` is the number of visible candles to consider for the price range.
    pub fn from_buffer(buffer: &OhlcvBuffer, n: usize) -> Self {
        let (price_lo, price_hi) = buffer.price_range(n).unwrap_or((0.0, 0.0));
        let current_price = buffer.last().map(|c| c.close);
        Self {
            price_lo,
            price_hi,
            current_price,
        }
    }

    /// Create with explicit price range (useful for testing).
    #[allow(dead_code)]
    pub fn new(price_lo: f64, price_hi: f64, current_price: Option<f64>) -> Self {
        Self {
            price_lo,
            price_hi,
            current_price,
        }
    }

    /// Generate tick values evenly spaced between lo and hi.
    fn tick_values(&self) -> Vec<f64> {
        if (self.price_hi - self.price_lo).abs() < f64::EPSILON {
            return vec![self.price_lo];
        }
        let mut ticks = Vec::with_capacity(PRICE_TICKS);
        for i in 0..PRICE_TICKS {
            let frac = i as f64 / (PRICE_TICKS - 1).max(1) as f64;
            ticks.push(self.price_hi - frac * (self.price_hi - self.price_lo));
        }
        ticks
    }

    /// Map a price to a row position within the given height.
    fn price_to_row(&self, price: f64, height: u16) -> u16 {
        if height == 0 {
            return 0;
        }
        let range = self.price_hi - self.price_lo;
        if range.abs() < f64::EPSILON {
            return height / 2;
        }
        let normalized = (self.price_hi - price) / range;
        let row = (normalized * (height.saturating_sub(1)) as f64) as u16;
        row.min(height.saturating_sub(1))
    }
}

impl Widget for PriceAxis {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width < 4 || area.height < 2 {
            return;
        }

        let label_width = area.width as usize;

        // Draw tick labels
        for tick in self.tick_values() {
            let row = self.price_to_row(tick, area.height);
            let y = area.y + row;
            if y >= area.y + area.height {
                continue;
            }

            let label = format_price(tick);
            let padded = format!("{:>width$}", label, width = label_width);
            let display: String = padded.chars().take(label_width).collect();

            buf.set_line(
                area.x,
                y,
                &Line::from(Span::styled(display, Style::default().fg(AXIS_COLOR))),
                area.width,
            );
        }

        // Highlight current price
        if let Some(current) = self.current_price {
            if current >= self.price_lo && current <= self.price_hi {
                let row = self.price_to_row(current, area.height);
                let y = area.y + row;
                if y < area.y + area.height {
                    let label = format_price(current);
                    let arrow = format!(">{:>width$}", label, width = label_width - 1);
                    let display: String = arrow.chars().take(label_width).collect();

                    buf.set_line(
                        area.x,
                        y,
                        &Line::from(Span::styled(
                            display,
                            Style::default().fg(MATRIX_GREEN),
                        )),
                        area.width,
                    );
                }
            }
        }
    }
}

/// Current price dotted line — renders across the chart body.
///
/// Draws a horizontal dotted line at the current close price level.
pub struct CurrentPriceLine {
    /// Row offset within the chart body (0 = top).
    row: u16,
    /// Whether to render (false when price is outside range).
    visible: bool,
}

impl CurrentPriceLine {
    /// Create from the buffer and chart dimensions.
    pub fn from_buffer(buffer: &OhlcvBuffer, n: usize, chart_height: u16) -> Self {
        let (lo, hi) = buffer.price_range(n).unwrap_or((0.0, 0.0));
        let current = buffer.last().map(|c| c.close).unwrap_or(0.0);
        let range = hi - lo;

        if range.abs() < f64::EPSILON || chart_height == 0 {
            return Self {
                row: 0,
                visible: false,
            };
        }

        let normalized = (hi - current) / range;
        let row = (normalized * (chart_height.saturating_sub(1)) as f64) as u16;
        Self {
            row: row.min(chart_height.saturating_sub(1)),
            visible: true,
        }
    }

    /// Create with explicit row (for testing).
    #[allow(dead_code)]
    pub fn new(row: u16, visible: bool) -> Self {
        Self { row, visible }
    }
}

impl Widget for CurrentPriceLine {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if !self.visible || area.width == 0 || area.height == 0 {
            return;
        }

        let y = area.y + self.row;
        if y >= area.y + area.height {
            return;
        }

        // Draw dotted line pattern: "- - - -"
        for x in area.x..area.x + area.width {
            let offset = (x - area.x) % 3;
            let ch = if offset == 0 { '-' } else { ' ' };
            buf.set_string(
                x,
                y,
                ch.to_string(),
                Style::default().fg(Color::Rgb(0, 180, 40)),
            );
        }
    }
}

/// Time axis widget — renders at the bottom of the chart.
///
/// Shows HH:MM labels spaced evenly across the visible candles.
pub struct TimeAxis<'a> {
    candles: Vec<&'a crate::chart::ohlcv::Ohlcv>,
}

impl<'a> TimeAxis<'a> {
    /// Create from visible candles.
    #[allow(dead_code)]
    pub fn new(candles: Vec<&'a crate::chart::ohlcv::Ohlcv>) -> Self {
        Self { candles }
    }

    /// Create from the buffer with the last `n` candles.
    pub fn from_buffer(buffer: &'a OhlcvBuffer, n: usize) -> Self {
        Self {
            candles: buffer.visible_range(n),
        }
    }
}

impl Widget for TimeAxis<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width < 5 || area.height == 0 || self.candles.is_empty() {
            return;
        }

        let width = area.width as usize;
        let n = self.candles.len();

        // We want ~4-6 labels evenly spaced
        let target_labels = 5_usize.min(n);
        if target_labels == 0 {
            return;
        }

        let step = if target_labels > 1 {
            (n - 1) / (target_labels - 1)
        } else {
            1
        };

        // Calculate horizontal positions: each candle maps to ~3 dot columns
        // but we position labels in char space
        let chars_per_candle = if n > 0 {
            width as f64 / n as f64
        } else {
            1.0
        };

        let mut labels: Vec<(usize, String)> = Vec::new();
        let mut i = 0;
        while i < n {
            let label = format_time(self.candles[i].time);
            let x_pos = (i as f64 * chars_per_candle) as usize;
            // Prevent label overlap — need at least 6 chars between labels
            if labels.last().is_none_or(|(last_x, _): &(usize, String)| {
                x_pos >= last_x + 6
            }) && x_pos + 5 <= width
            {
                labels.push((x_pos, label));
            }
            i += step.max(1);
        }

        // Render labels
        let y = area.y;
        for (x_pos, label) in labels {
            buf.set_line(
                area.x + x_pos as u16,
                y,
                &Line::from(Span::styled(label, Style::default().fg(AXIS_COLOR))),
                area.width.saturating_sub(x_pos as u16),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chart::ohlcv::{Ohlcv, OhlcvBuffer};

    #[test]
    fn test_format_price_large() {
        assert_eq!(format_price(42150.0), "42150");
        assert_eq!(format_price(1000.0), "1000");
    }

    #[test]
    fn test_format_price_medium() {
        assert_eq!(format_price(3.14), "3.14");
        assert_eq!(format_price(99.99), "99.99");
    }

    #[test]
    fn test_format_price_small() {
        assert_eq!(format_price(0.0042), "0.0042");
        assert_eq!(format_price(0.1234), "0.1234");
    }

    #[test]
    fn test_format_time() {
        assert_eq!(format_time(0), "00:00");
        assert_eq!(format_time(3600), "01:00");
        assert_eq!(format_time(3661), "01:01");
        assert_eq!(format_time(86399), "23:59");
        // Wraps around at 86400
        assert_eq!(format_time(86400), "00:00");
    }

    #[test]
    fn test_price_axis_tick_values() {
        let axis = PriceAxis::new(100.0, 200.0, None);
        let ticks = axis.tick_values();
        assert_eq!(ticks.len(), PRICE_TICKS);
        assert!((ticks[0] - 200.0).abs() < f64::EPSILON);
        assert!((ticks[PRICE_TICKS - 1] - 100.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_price_axis_tick_values_equal_range() {
        let axis = PriceAxis::new(100.0, 100.0, None);
        let ticks = axis.tick_values();
        assert_eq!(ticks.len(), 1);
        assert!((ticks[0] - 100.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_price_to_row() {
        let axis = PriceAxis::new(100.0, 200.0, None);
        // Highest price → row 0
        assert_eq!(axis.price_to_row(200.0, 20), 0);
        // Lowest price → row 19
        assert_eq!(axis.price_to_row(100.0, 20), 19);
        // Middle → row ~9
        let mid = axis.price_to_row(150.0, 20);
        assert!(mid >= 9 && mid <= 10);
    }

    #[test]
    fn test_price_axis_from_buffer() {
        let mut buf = OhlcvBuffer::new(10);
        buf.push(Ohlcv {
            time: 1000,
            open: 100.0,
            high: 120.0,
            low: 80.0,
            close: 110.0,
            volume: 100.0,
        });
        let axis = PriceAxis::from_buffer(&buf, 10);
        assert!(axis.price_lo <= 80.0);
        assert!(axis.price_hi >= 120.0);
        assert!((axis.current_price.unwrap() - 110.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_current_price_line_from_buffer() {
        let mut buf = OhlcvBuffer::new(10);
        buf.push(Ohlcv {
            time: 1000,
            open: 100.0,
            high: 200.0,
            low: 100.0,
            close: 150.0, // middle
            volume: 100.0,
        });
        let line = CurrentPriceLine::from_buffer(&buf, 10, 20);
        assert!(line.visible);
        // 150 is in the middle of 100-200 range → row should be ~9-10
        assert!(line.row >= 8 && line.row <= 12, "row was {}", line.row);
    }

    #[test]
    fn test_current_price_line_empty_buffer() {
        let buf = OhlcvBuffer::new(10);
        let line = CurrentPriceLine::from_buffer(&buf, 10, 20);
        assert!(!line.visible);
    }

    #[test]
    fn test_time_axis_from_buffer() {
        let mut buf = OhlcvBuffer::new(100);
        for i in 0..20 {
            buf.push(Ohlcv {
                time: 3600 + i * 60, // 01:00, 01:01, ...
                open: 100.0,
                high: 110.0,
                low: 90.0,
                close: 105.0,
                volume: 100.0,
            });
        }
        let axis = TimeAxis::from_buffer(&buf, 20);
        assert_eq!(axis.candles.len(), 20);
    }
}
