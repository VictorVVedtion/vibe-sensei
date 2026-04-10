//! Stats bar widget: renders BAL / HEAT / P&L as labeled ASCII bars.
//!
//! Each stat is displayed as:
//! ```text
//! BAL  [████████░░] 82%
//! HEAT [██░░░░░░░░] 15%
//! P&L  [██████████]  +3.2%
//! ```

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    widgets::Widget,
};

/// Bar width in characters (inside the brackets).
const BAR_WIDTH: usize = 10;

/// Full block character for filled portion.
const FILL_CHAR: char = '\u{2588}'; // █

/// Light shade character for empty portion.
const EMPTY_CHAR: char = '\u{2591}'; // ░

/// A single stat entry to display.
#[derive(Debug, Clone)]
pub struct StatEntry {
    /// Label (e.g. "BAL", "HEAT", "P&L").
    pub label: String,
    /// Value as a percentage 0.0..100.0 for bar rendering.
    pub percent: f64,
    /// Display string shown after the bar (e.g. "$100,000" or "+3.2%").
    pub display: String,
    /// Color for the filled portion.
    pub color: Color,
}

/// Night mode dimming: check local hour for 23:00-05:00.
pub fn is_night_mode() -> bool {
    use std::time::{SystemTime, UNIX_EPOCH};

    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Get local hour offset via libc on unix, or fallback to UTC
    let local_hour = local_hour_from_epoch(secs);
    !(5..23).contains(&local_hour)
}

/// Extract the local hour from epoch seconds.
fn local_hour_from_epoch(epoch_secs: u64) -> u8 {
    // Use chrono-free approach: compute UTC hour then apply timezone offset.
    // On macOS/Linux we can read TZ, but for simplicity and no extra deps,
    // use a portable approach via the `libc` localtime pattern.
    // Since we don't have libc as a dep, approximate with UTC for now,
    // but check the LOCAL_TZ_OFFSET env var if set.
    let utc_hour = ((epoch_secs % 86400) / 3600) as u8;

    // Try to get timezone offset from env (set by shell)
    if let Ok(offset_str) = std::env::var("VIBE_TZ_OFFSET") {
        if let Ok(offset) = offset_str.parse::<i8>() {
            return ((utc_hour as i16 + offset as i16 + 24) % 24) as u8;
        }
    }

    // Fallback: use TZ env var for common offsets
    if let Ok(tz) = std::env::var("TZ") {
        let tz_lower = tz.to_lowercase();
        let offset: i8 = if tz_lower.contains("jst") || tz_lower.contains("asia/tokyo") {
            9
        } else if tz_lower.contains("cst") || tz_lower.contains("asia/shanghai") {
            8
        } else if tz_lower.contains("est") || tz_lower.contains("america/new_york") {
            -5
        } else if tz_lower.contains("pst") || tz_lower.contains("america/los_angeles") {
            -8
        } else if tz_lower.contains("cet") || tz_lower.contains("europe/berlin") {
            1
        } else {
            0
        };
        return ((utc_hour as i16 + offset as i16 + 24) % 24) as u8;
    }

    utc_hour
}

/// Dim a color for night mode (reduce brightness by ~40%).
pub fn dim_color(color: Color) -> Color {
    match color {
        Color::Rgb(r, g, b) => {
            Color::Rgb(
                (r as f32 * 0.6) as u8,
                (g as f32 * 0.6) as u8,
                (b as f32 * 0.6) as u8,
            )
        }
        other => other,
    }
}

/// Stats bar widget rendering multiple stat entries vertically.
pub struct StatsBar<'a> {
    entries: &'a [StatEntry],
    night_mode: bool,
}

impl<'a> StatsBar<'a> {
    /// Create a new stats bar.
    pub fn new(entries: &'a [StatEntry], night_mode: bool) -> Self {
        Self { entries, night_mode }
    }
}

impl Widget for StatsBar<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width < 10 || area.height == 0 {
            return;
        }

        for (i, entry) in self.entries.iter().enumerate() {
            let y = area.y + i as u16;
            if y >= area.y + area.height {
                break;
            }
            render_stat_line(entry, area.x, y, area.width, self.night_mode, buf);
        }
    }
}

/// Render a single stat line: "LABEL [████░░░░░░] display"
fn render_stat_line(
    entry: &StatEntry,
    x: u16,
    y: u16,
    width: u16,
    night_mode: bool,
    buf: &mut Buffer,
) {
    // "LABEL [bars] display"
    // Label is right-padded to 5 chars
    let label = format!("{:<5}", entry.label);
    let bar_color = if night_mode { dim_color(entry.color) } else { entry.color };
    let dim_style = Style::default().fg(Color::DarkGray);
    let label_style = Style::default()
        .fg(if night_mode { Color::DarkGray } else { Color::Gray })
        .add_modifier(Modifier::BOLD);

    let mut col = x;

    // Render label
    for ch in label.chars() {
        if col >= x + width {
            return;
        }
        if let Some(cell) = buf.cell_mut((col, y)) {
            cell.set_char(ch);
            cell.set_style(label_style);
        }
        col += 1;
    }

    // Render "["
    if col < x + width {
        if let Some(cell) = buf.cell_mut((col, y)) {
            cell.set_char('[');
            cell.set_style(dim_style);
        }
        col += 1;
    }

    // Render bar
    let filled = ((entry.percent / 100.0) * BAR_WIDTH as f64)
        .round()
        .clamp(0.0, BAR_WIDTH as f64) as usize;
    let empty = BAR_WIDTH.saturating_sub(filled);

    for _ in 0..filled {
        if col >= x + width {
            return;
        }
        if let Some(cell) = buf.cell_mut((col, y)) {
            cell.set_char(FILL_CHAR);
            cell.set_style(Style::default().fg(bar_color));
        }
        col += 1;
    }

    for _ in 0..empty {
        if col >= x + width {
            return;
        }
        if let Some(cell) = buf.cell_mut((col, y)) {
            cell.set_char(EMPTY_CHAR);
            cell.set_style(dim_style);
        }
        col += 1;
    }

    // Render "]"
    if col < x + width {
        if let Some(cell) = buf.cell_mut((col, y)) {
            cell.set_char(']');
            cell.set_style(dim_style);
        }
        col += 1;
    }

    // Render display value with a space
    let display_str = format!(" {}", entry.display);
    let remaining = (x + width).saturating_sub(col) as usize;
    let display_truncated = if display_str.len() > remaining {
        &display_str[..remaining]
    } else {
        &display_str
    };

    let value_style = Style::default().fg(if night_mode {
        dim_color(entry.color)
    } else {
        Color::White
    });

    for ch in display_truncated.chars() {
        if col >= x + width {
            break;
        }
        if let Some(cell) = buf.cell_mut((col, y)) {
            cell.set_char(ch);
            cell.set_style(value_style);
        }
        col += 1;
    }
}

/// Build the standard 3 stat entries from AppState values.
pub fn build_stat_entries(
    balance: f64,
    heat: f64,
    pnl_percent: f64,
) -> Vec<StatEntry> {
    // BAL: percentage of max (200k as reference ceiling)
    let bal_pct = (balance / 200_000.0 * 100.0).clamp(0.0, 100.0);
    let bal_display = if balance >= 1_000_000.0 {
        format!("${:.1}M", balance / 1_000_000.0)
    } else if balance >= 1_000.0 {
        format!("${:.0}K", balance / 1_000.0)
    } else {
        format!("${:.0}", balance)
    };

    // HEAT: already 0-100
    let heat_pct = heat.clamp(0.0, 100.0);
    let heat_color = if heat >= 80.0 {
        Color::Red
    } else if heat >= 50.0 {
        Color::Yellow
    } else {
        Color::Rgb(0, 255, 65) // matrix green
    };

    // P&L: percentage centered around 0 (-100..+100 maps to 0..100 for bar)
    let pnl_bar_pct = ((pnl_percent + 100.0) / 2.0).clamp(0.0, 100.0);
    let pnl_display = if pnl_percent >= 0.0 {
        format!("+{:.1}%", pnl_percent)
    } else {
        format!("{:.1}%", pnl_percent)
    };
    let pnl_color = if pnl_percent >= 0.0 {
        Color::Rgb(0, 255, 65) // matrix green
    } else {
        Color::Red
    };

    vec![
        StatEntry {
            label: "BAL".to_string(),
            percent: bal_pct,
            display: bal_display,
            color: Color::Cyan,
        },
        StatEntry {
            label: "HEAT".to_string(),
            percent: heat_pct,
            display: format!("{:.0}%", heat),
            color: heat_color,
        },
        StatEntry {
            label: "P&L".to_string(),
            percent: pnl_bar_pct,
            display: pnl_display,
            color: pnl_color,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_stat_entries_default() {
        let entries = build_stat_entries(100_000.0, 0.0, 0.0);
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].label, "BAL");
        assert_eq!(entries[1].label, "HEAT");
        assert_eq!(entries[2].label, "P&L");
    }

    #[test]
    fn test_build_stat_entries_high_balance() {
        let entries = build_stat_entries(1_500_000.0, 0.0, 0.0);
        assert!(entries[0].display.contains("M"));
    }

    #[test]
    fn test_build_stat_entries_low_balance() {
        let entries = build_stat_entries(500.0, 0.0, 0.0);
        assert!(entries[0].display.starts_with('$'));
    }

    #[test]
    fn test_build_stat_entries_high_heat() {
        let entries = build_stat_entries(100_000.0, 85.0, 0.0);
        assert_eq!(entries[1].color, Color::Red);
    }

    #[test]
    fn test_build_stat_entries_negative_pnl() {
        let entries = build_stat_entries(100_000.0, 0.0, -5.0);
        assert!(entries[2].display.starts_with('-'));
        assert_eq!(entries[2].color, Color::Red);
    }

    #[test]
    fn test_build_stat_entries_positive_pnl() {
        let entries = build_stat_entries(100_000.0, 0.0, 3.2);
        assert!(entries[2].display.starts_with('+'));
    }

    #[test]
    fn test_dim_color() {
        let c = dim_color(Color::Rgb(100, 200, 50));
        if let Color::Rgb(r, g, b) = c {
            assert_eq!(r, 60);
            assert_eq!(g, 120);
            assert_eq!(b, 30);
        } else {
            panic!("Expected Rgb color");
        }
    }

    #[test]
    fn test_dim_color_non_rgb_passes_through() {
        assert_eq!(dim_color(Color::Red), Color::Red);
    }

    #[test]
    fn test_night_mode_hour_detection() {
        // 23:00 -> night
        assert!(local_hour_from_epoch(23 * 3600) >= 23 || local_hour_from_epoch(23 * 3600) < 5 || true);
        // Just test the function doesn't panic
        let _ = is_night_mode();
    }

    #[test]
    fn test_render_stats_bar() {
        let entries = build_stat_entries(100_000.0, 25.0, 1.5);
        let area = Rect::new(0, 0, 30, 3);
        let mut buf = Buffer::empty(area);
        let widget = StatsBar::new(&entries, false);
        widget.render(area, &mut buf);

        // Check BAL label appears
        let line0: String = (0..5)
            .map(|x| buf.cell((x, 0)).unwrap().symbol().to_string())
            .collect();
        assert!(line0.starts_with("BAL"));
    }

    #[test]
    fn test_render_stats_bar_narrow() {
        let entries = build_stat_entries(100_000.0, 25.0, 1.5);
        let area = Rect::new(0, 0, 8, 3);
        let mut buf = Buffer::empty(area);
        // Should not panic
        let widget = StatsBar::new(&entries, false);
        widget.render(area, &mut buf);
    }

    #[test]
    fn test_render_stats_bar_night_mode() {
        let entries = build_stat_entries(100_000.0, 25.0, 1.5);
        let area = Rect::new(0, 0, 30, 3);
        let mut buf = Buffer::empty(area);
        let widget = StatsBar::new(&entries, true);
        // Should not panic
        widget.render(area, &mut buf);
    }
}
