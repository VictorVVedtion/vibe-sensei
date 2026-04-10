use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::Widget,
};

use crate::input::{InputState, VimMode};
use crate::state::AppState;

/// Matrix green: #00FF41 -> Rgb(0, 255, 65)
const MATRIX_GREEN: Color = Color::Rgb(0, 255, 65);

/// Dim green for labels: roughly 40% brightness of MATRIX_GREEN.
const DIM_GREEN: Color = Color::Rgb(0, 153, 39);

/// Amber for Normal mode indicator.
const AMBER: Color = Color::Rgb(255, 191, 0);

/// Separator character between status bar sections.
const SEP: &str = " \u{2502} ";

/// Status bar widget that renders trading state in a single row.
///
/// Format: `VENUES 0/7 | PAPER | REGIME: --- | HEAT: --% | CONC: --% | [INSERT]`
///
/// Labels use dim green, values use bright Matrix green. Separator is dim green.
/// The vim mode indicator is shown at the right end:
/// - `[INSERT]` in green
/// - `[NORMAL]` in amber
/// - When a chord is pending, shows the chord hint (e.g. `[g_]`)
pub struct StatusBar<'a> {
    state: &'a AppState,
    input: &'a InputState,
}

impl<'a> StatusBar<'a> {
    pub fn new(state: &'a AppState, input: &'a InputState) -> Self {
        Self { state, input }
    }

    fn build_line(&self) -> Line<'a> {
        let label = Style::default().fg(DIM_GREEN);
        let value = Style::default().fg(MATRIX_GREEN);
        let sep = Style::default().fg(DIM_GREEN);

        let venues_value = format!(
            "{}/{}",
            self.state.venues_connected, self.state.venues_total
        );

        let regime_value = if self.state.regime.is_empty() {
            "\u{2014}".to_string()
        } else {
            self.state.regime.clone()
        };

        let heat_value = if self.state.heat > 0.0 || self.state.connected {
            format!("{:.0}%", self.state.heat)
        } else {
            "\u{2014}%".to_string()
        };

        let conc_value =
            if self.state.concentration > 0.0 || self.state.connected {
                format!("{:.0}%", self.state.concentration)
            } else {
                "\u{2014}%".to_string()
            };

        // Build mode indicator with chord hint
        let (mode_text, mode_style) = self.build_mode_indicator();

        Line::from(vec![
            Span::styled(" VENUES ", label),
            Span::styled(venues_value, value),
            Span::styled(SEP, sep),
            Span::styled(self.state.mode.clone(), value),
            Span::styled(SEP, sep),
            Span::styled("REGIME: ", label),
            Span::styled(regime_value, value),
            Span::styled(SEP, sep),
            Span::styled("HEAT: ", label),
            Span::styled(heat_value, value),
            Span::styled(SEP, sep),
            Span::styled("CONC: ", label),
            Span::styled(conc_value, value),
            Span::styled(SEP, sep),
            Span::styled(mode_text, mode_style),
        ])
    }

    /// Build the mode indicator text and style.
    ///
    /// Shows `[NORMAL]` / `[INSERT]`, or `[g_]` when a chord is pending.
    fn build_mode_indicator(&self) -> (String, Style) {
        // Check for active chord hint
        if let Some(ref chord) = self.input.pending_chord {
            if !chord.is_expired() {
                let text = format!("[{}]", chord.hint());
                let style = Style::default()
                    .fg(AMBER)
                    .add_modifier(Modifier::BOLD);
                return (text, style);
            }
        }

        match self.input.mode {
            VimMode::Normal => {
                let text = format!("[{}]", self.input.mode.label());
                let style = Style::default()
                    .fg(AMBER)
                    .add_modifier(Modifier::BOLD);
                (text, style)
            }
            VimMode::Insert => {
                let text = format!("[{}]", self.input.mode.label());
                let style = Style::default()
                    .fg(MATRIX_GREEN)
                    .add_modifier(Modifier::BOLD);
                (text, style)
            }
        }
    }
}

impl Widget for StatusBar<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let line = self.build_line();
        // Render the line left-aligned in the given area
        let paragraph = ratatui::widgets::Paragraph::new(line)
            .style(Style::default().bg(Color::Rgb(0, 20, 0)));
        paragraph.render(area, buf);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_bar_default_state() {
        let state = AppState::default();
        let input = InputState::default();
        let bar = StatusBar::new(&state, &input);
        let line = bar.build_line();
        let text: String =
            line.spans.iter().map(|s| s.content.to_string()).collect();
        assert!(text.contains("VENUES"));
        assert!(text.contains("0/7"));
        assert!(text.contains("PAPER"));
        assert!(text.contains("REGIME:"));
        assert!(text.contains("HEAT:"));
        assert!(text.contains("CONC:"));
        // Default mode is Insert
        assert!(text.contains("[INSERT]"));
    }

    #[test]
    fn test_status_bar_with_data() {
        let state = AppState {
            venues_connected: 3,
            venues_total: 7,
            mode: "LIVE".to_string(),
            regime: "TRENDING_UP".to_string(),
            heat: 12.0,
            concentration: 42.0,
            connected: true,
            last_message_type: "StateSync".to_string(),
            ..AppState::default()
        };
        let input = InputState::default();
        let bar = StatusBar::new(&state, &input);
        let line = bar.build_line();
        let text: String =
            line.spans.iter().map(|s| s.content.to_string()).collect();
        assert!(text.contains("3/7"));
        assert!(text.contains("LIVE"));
        assert!(text.contains("TRENDING_UP"));
        assert!(text.contains("12%"));
        assert!(text.contains("42%"));
    }

    #[test]
    fn test_status_bar_normal_mode() {
        let state = AppState::default();
        let mut input = InputState::default();
        input.enter_normal_mode();
        let bar = StatusBar::new(&state, &input);
        let line = bar.build_line();
        let text: String =
            line.spans.iter().map(|s| s.content.to_string()).collect();
        assert!(text.contains("[NORMAL]"));
    }

    #[test]
    fn test_status_bar_chord_hint() {
        let state = AppState::default();
        let mut input = InputState::default();
        input.enter_normal_mode();
        input.start_chord('g');
        let bar = StatusBar::new(&state, &input);
        let line = bar.build_line();
        let text: String =
            line.spans.iter().map(|s| s.content.to_string()).collect();
        assert!(text.contains("[g_]"));
    }

    #[test]
    fn test_status_bar_renders_without_panic() {
        let state = AppState::default();
        let input = InputState::default();
        let bar = StatusBar::new(&state, &input);
        let area = Rect::new(0, 0, 120, 1);
        let mut buf = Buffer::empty(area);
        bar.render(area, &mut buf);
        // Just verify no panic during render
    }
}
