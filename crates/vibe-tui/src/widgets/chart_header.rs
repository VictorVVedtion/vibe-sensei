use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::Widget,
};

use crate::state::Timeframe;

/// Matrix green: #00FF41.
const MATRIX_GREEN: Color = Color::Rgb(0, 255, 65);

/// Bearish red for negative price changes.
const BEARISH_RED: Color = Color::Rgb(255, 60, 60);

/// Dim color for separators and inactive text.
const DIM: Color = Color::DarkGray;

/// Chart header widget: symbol name + price + change% + regime badge.
///
/// Renders a single line at the top of the MARKET zone showing:
/// `BTC/USDT  60,500.00  +2.3%  [TRENDING_UP]`
pub struct ChartHeader<'a> {
    symbol: &'a str,
    price: Option<f64>,
    prev_close: Option<f64>,
    regime: &'a str,
    timeframe: Timeframe,
}

impl<'a> ChartHeader<'a> {
    /// Create a new chart header from app state fields.
    pub fn new(
        symbol: &'a str,
        price: Option<f64>,
        prev_close: Option<f64>,
        regime: &'a str,
        timeframe: Timeframe,
    ) -> Self {
        Self {
            symbol,
            price,
            prev_close,
            regime,
            timeframe,
        }
    }
}

/// Format a price with appropriate decimal places.
fn format_price(price: f64) -> String {
    if price.abs() >= 1000.0 {
        // Add comma separators for large numbers
        let whole = price as u64;
        let frac = ((price - whole as f64) * 100.0).round() as u64;
        let s = whole.to_string();
        let mut result = String::new();
        for (i, ch) in s.chars().rev().enumerate() {
            if i > 0 && i % 3 == 0 {
                result.push(',');
            }
            result.push(ch);
        }
        let formatted: String = result.chars().rev().collect();
        if frac > 0 {
            format!("{formatted}.{frac:02}")
        } else {
            formatted
        }
    } else if price.abs() >= 1.0 {
        format!("{price:.2}")
    } else {
        format!("{price:.4}")
    }
}

/// Compute the change percentage between two prices.
fn change_pct(current: f64, previous: f64) -> f64 {
    if previous.abs() < f64::EPSILON {
        return 0.0;
    }
    ((current - previous) / previous) * 100.0
}

/// Map a regime string to a display color.
fn regime_color(regime: &str) -> Color {
    let upper = regime.to_uppercase();
    if upper.contains("UP") || upper.contains("BULL") {
        MATRIX_GREEN
    } else if upper.contains("DOWN") || upper.contains("BEAR") {
        BEARISH_RED
    } else if upper.contains("RANG") || upper.contains("CONSOLIDAT") {
        Color::Yellow
    } else {
        DIM
    }
}

impl Widget for ChartHeader<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width < 10 || area.height == 0 {
            return;
        }

        let mut spans = Vec::new();

        // Symbol name
        let sym_display = if self.symbol.is_empty() {
            "---/---"
        } else {
            self.symbol
        };
        spans.push(Span::styled(
            format!(" {sym_display}"),
            Style::default()
                .fg(Color::White)
                .add_modifier(Modifier::BOLD),
        ));

        // Timeframe badge
        spans.push(Span::styled(
            format!(" {}", self.timeframe.label()),
            Style::default().fg(DIM),
        ));

        // Price
        if let Some(price) = self.price {
            let formatted = format_price(price);
            let bullish = self
                .prev_close
                .map(|pc| price >= pc)
                .unwrap_or(true);
            let color = if bullish { MATRIX_GREEN } else { BEARISH_RED };

            spans.push(Span::styled("  ", Style::default()));
            spans.push(Span::styled(
                formatted,
                Style::default()
                    .fg(color)
                    .add_modifier(Modifier::BOLD),
            ));

            // Change %
            if let Some(prev) = self.prev_close {
                let pct = change_pct(price, prev);
                let sign = if pct >= 0.0 { "+" } else { "" };
                let pct_str = format!("  {sign}{pct:.1}%");
                spans.push(Span::styled(pct_str, Style::default().fg(color)));
            }
        } else {
            spans.push(Span::styled(
                "  ---",
                Style::default().fg(DIM),
            ));
        }

        // Regime badge
        if !self.regime.is_empty() {
            let color = regime_color(self.regime);
            spans.push(Span::styled("  ", Style::default()));
            spans.push(Span::styled(
                format!("[{}]", self.regime),
                Style::default().fg(color),
            ));
        }

        let line = Line::from(spans);
        buf.set_line(area.x, area.y, &line, area.width);
    }
}

/// Timeframe tab bar widget.
///
/// Renders a row of timeframe labels: `[1m] [5m] [15m] [1h] [4h] [1D] [1W]`
/// with the active timeframe highlighted in matrix green.
pub struct TimeframeTabs {
    active: Timeframe,
}

impl TimeframeTabs {
    pub fn new(active: Timeframe) -> Self {
        Self { active }
    }
}

impl Widget for TimeframeTabs {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width < 20 || area.height == 0 {
            return;
        }

        let mut spans = Vec::new();
        spans.push(Span::styled(" ", Style::default()));

        for (i, tf) in Timeframe::all().iter().enumerate() {
            if i > 0 {
                spans.push(Span::styled(" ", Style::default().fg(DIM)));
            }

            let label = tf.label();
            if *tf == self.active {
                // Active tab: bold green with brackets
                spans.push(Span::styled(
                    format!("[{label}]"),
                    Style::default()
                        .fg(MATRIX_GREEN)
                        .add_modifier(Modifier::BOLD),
                ));
            } else {
                // Inactive tab: dim with brackets
                spans.push(Span::styled(
                    format!(" {label} "),
                    Style::default().fg(DIM),
                ));
            }
        }

        let line = Line::from(spans);
        buf.set_line(area.x, area.y, &line, area.width);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_price_large() {
        let s = format_price(60500.0);
        assert!(s.contains("60,500"), "got: {s}");
    }

    #[test]
    fn test_format_price_medium() {
        assert_eq!(format_price(3.14), "3.14");
    }

    #[test]
    fn test_format_price_small() {
        assert_eq!(format_price(0.0042), "0.0042");
    }

    #[test]
    fn test_change_pct_positive() {
        let pct = change_pct(105.0, 100.0);
        assert!((pct - 5.0).abs() < 0.01);
    }

    #[test]
    fn test_change_pct_negative() {
        let pct = change_pct(95.0, 100.0);
        assert!((pct - (-5.0)).abs() < 0.01);
    }

    #[test]
    fn test_change_pct_zero_prev() {
        let pct = change_pct(100.0, 0.0);
        assert!((pct - 0.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_regime_color_bullish() {
        assert_eq!(regime_color("TRENDING_UP"), MATRIX_GREEN);
        assert_eq!(regime_color("BULLISH"), MATRIX_GREEN);
    }

    #[test]
    fn test_regime_color_bearish() {
        assert_eq!(regime_color("TRENDING_DOWN"), BEARISH_RED);
        assert_eq!(regime_color("BEAR"), BEARISH_RED);
    }

    #[test]
    fn test_regime_color_ranging() {
        assert_eq!(regime_color("RANGING"), Color::Yellow);
        assert_eq!(regime_color("CONSOLIDATING"), Color::Yellow);
    }

    #[test]
    fn test_regime_color_unknown() {
        assert_eq!(regime_color("UNKNOWN"), DIM);
        assert_eq!(regime_color(""), DIM);
    }

    #[test]
    fn test_chart_header_renders_without_panic() {
        let area = Rect::new(0, 0, 80, 1);
        let mut buf = Buffer::empty(area);
        let widget = ChartHeader::new(
            "BTC/USDT",
            Some(60500.0),
            Some(59000.0),
            "TRENDING_UP",
            Timeframe::M5,
        );
        widget.render(area, &mut buf);
        // Verify some content was rendered
        let content: String = (0..area.width)
            .map(|x| buf.cell((x, 0)).unwrap().symbol().chars().next().unwrap_or(' '))
            .collect();
        assert!(content.contains("BTC/USDT"), "got: {content}");
    }

    #[test]
    fn test_chart_header_no_price() {
        let area = Rect::new(0, 0, 80, 1);
        let mut buf = Buffer::empty(area);
        let widget = ChartHeader::new("", None, None, "", Timeframe::M1);
        widget.render(area, &mut buf);
        let content: String = (0..area.width)
            .map(|x| buf.cell((x, 0)).unwrap().symbol().chars().next().unwrap_or(' '))
            .collect();
        assert!(content.contains("---/---"), "got: {content}");
    }

    #[test]
    fn test_timeframe_tabs_renders_without_panic() {
        let area = Rect::new(0, 0, 60, 1);
        let mut buf = Buffer::empty(area);
        let widget = TimeframeTabs::new(Timeframe::H1);
        widget.render(area, &mut buf);
        let content: String = (0..area.width)
            .map(|x| buf.cell((x, 0)).unwrap().symbol().chars().next().unwrap_or(' '))
            .collect();
        assert!(content.contains("[1h]"), "got: {content}");
    }

    #[test]
    fn test_timeframe_tabs_small_area_no_panic() {
        let area = Rect::new(0, 0, 5, 1);
        let mut buf = Buffer::empty(area);
        let widget = TimeframeTabs::new(Timeframe::M5);
        widget.render(area, &mut buf);
        // Should not panic, just render nothing
    }
}
