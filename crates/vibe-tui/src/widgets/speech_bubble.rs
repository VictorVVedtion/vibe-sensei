//! Speech bubble widget: bordered text with tail, severity colors, auto-dismiss.
//!
//! Renders as:
//! ```text
//! ╭───────────────────────╮
//! │ Position too large!   │
//! │ Consider reducing...  │
//! ╰─ ── ── ── ── ── ── ──╯
//! ```
//!
//! The tail on the bottom-left (╰─) visually connects the bubble
//! to the guardian sprite above.

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Style},
    widgets::Widget,
};

use crate::state::{Severity, SpeechBubble};
use crate::widgets::stats_bar::dim_color;

/// Speech bubble widget that renders the most recent bubble.
pub struct SpeechBubbleWidget<'a> {
    bubble: Option<&'a SpeechBubble>,
    night_mode: bool,
}

impl<'a> SpeechBubbleWidget<'a> {
    /// Create a new speech bubble widget from an optional bubble.
    pub fn new(bubble: Option<&'a SpeechBubble>, night_mode: bool) -> Self {
        Self { bubble, night_mode }
    }
}

impl Widget for SpeechBubbleWidget<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let bubble = match self.bubble {
            Some(b) => b,
            None => return, // Nothing to render
        };

        if area.width < 4 || area.height < 3 {
            return;
        }

        let border_color = severity_bubble_color(bubble.severity);
        let text_color = severity_text_color(bubble.severity);
        let border_color = if self.night_mode { dim_color(border_color) } else { border_color };
        let text_color = if self.night_mode { dim_color(text_color) } else { text_color };

        let border_style = Style::default().fg(border_color);
        let text_style = Style::default().fg(text_color);

        let inner_w = (area.width as usize).saturating_sub(4); // "│ " + " │"
        if inner_w == 0 {
            return;
        }

        let wrapped = wrap_text(&bubble.text, inner_w);
        let max_body_lines = (area.height as usize).saturating_sub(2); // top + bottom borders
        let body_lines: Vec<&str> = wrapped.iter()
            .take(max_body_lines)
            .map(|s| s.as_str())
            .collect();

        let total_lines = body_lines.len() + 2; // top border + body + bottom border
        let start_y = area.y + area.height.saturating_sub(total_lines as u16);

        // Top border: ╭───╮
        render_top_border(area.x, start_y, area.width, border_style, buf);

        // Body lines: │ text │
        for (i, line_text) in body_lines.iter().enumerate() {
            let y = start_y + 1 + i as u16;
            render_body_line(area.x, y, area.width, line_text, border_style, text_style, buf);
        }

        // Bottom border with tail: ╰─ ── ──╯
        let bottom_y = start_y + 1 + body_lines.len() as u16;
        render_bottom_tail(area.x, bottom_y, area.width, border_style, buf);

        // Dismiss progress indicator (dim dots at bottom-right)
        if let Some(b) = self.bubble {
            let elapsed = b.created_at.elapsed().as_secs_f64();
            let progress = (elapsed / b.dismiss_secs).clamp(0.0, 1.0);
            let dots_total = 3;
            let dots_filled = ((1.0 - progress) * dots_total as f64).ceil() as usize;
            let dot_x = area.x + area.width.saturating_sub(dots_total as u16 + 1);
            let dot_y = bottom_y;
            if dot_y < area.y + area.height {
                for d in 0..dots_total {
                    let dx = dot_x + d as u16;
                    if dx < area.x + area.width {
                        if let Some(cell) = buf.cell_mut((dx, dot_y)) {
                            if d < dots_filled {
                                cell.set_char('\u{25CF}'); // ●
                                cell.set_style(Style::default().fg(border_color));
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Render top border: ╭───────╮
fn render_top_border(x: u16, y: u16, width: u16, style: Style, buf: &mut Buffer) {
    if width < 2 {
        return;
    }
    if let Some(cell) = buf.cell_mut((x, y)) {
        cell.set_char('\u{256D}'); // ╭
        cell.set_style(style);
    }
    for col in 1..(width - 1) {
        if let Some(cell) = buf.cell_mut((x + col, y)) {
            cell.set_char('\u{2500}'); // ─
            cell.set_style(style);
        }
    }
    if let Some(cell) = buf.cell_mut((x + width - 1, y)) {
        cell.set_char('\u{256E}'); // ╮
        cell.set_style(style);
    }
}

/// Render a body line: │ text │
fn render_body_line(
    x: u16,
    y: u16,
    width: u16,
    text: &str,
    border_style: Style,
    text_style: Style,
    buf: &mut Buffer,
) {
    if width < 4 {
        return;
    }

    // "│ "
    if let Some(cell) = buf.cell_mut((x, y)) {
        cell.set_char('\u{2502}'); // │
        cell.set_style(border_style);
    }
    if let Some(cell) = buf.cell_mut((x + 1, y)) {
        cell.set_char(' ');
        cell.set_style(border_style);
    }

    // Text content
    let inner_w = (width as usize).saturating_sub(4);
    let mut col = x + 2;
    for (i, ch) in text.chars().enumerate() {
        if i >= inner_w {
            break;
        }
        if let Some(cell) = buf.cell_mut((col, y)) {
            cell.set_char(ch);
            cell.set_style(text_style);
        }
        col += 1;
    }

    // Pad remaining
    let text_len = text.chars().count().min(inner_w);
    for _ in text_len..inner_w {
        if col < x + width - 2 {
            if let Some(cell) = buf.cell_mut((col, y)) {
                cell.set_char(' ');
            }
            col += 1;
        }
    }

    // " │"
    if let Some(cell) = buf.cell_mut((x + width - 2, y)) {
        cell.set_char(' ');
        cell.set_style(border_style);
    }
    if let Some(cell) = buf.cell_mut((x + width - 1, y)) {
        cell.set_char('\u{2502}'); // │
        cell.set_style(border_style);
    }
}

/// Render bottom border with tail: ╰─ ── ── ──╯
fn render_bottom_tail(x: u16, y: u16, width: u16, style: Style, buf: &mut Buffer) {
    if width < 2 {
        return;
    }

    // ╰
    if let Some(cell) = buf.cell_mut((x, y)) {
        cell.set_char('\u{2570}'); // ╰
        cell.set_style(style);
    }

    // ─ (tail segment)
    if width > 2 {
        if let Some(cell) = buf.cell_mut((x + 1, y)) {
            cell.set_char('\u{2500}'); // ─
            cell.set_style(style);
        }
    }

    // Dashed middle: alternating "─ " pattern
    let mut col = x + 2;
    let end_col = x + width - 1;
    let mut is_dash = true;
    while col < end_col {
        if let Some(cell) = buf.cell_mut((col, y)) {
            if is_dash {
                cell.set_char('\u{2500}'); // ─
                cell.set_style(style);
            } else {
                cell.set_char(' ');
                cell.set_style(Style::default().fg(Color::DarkGray));
            }
        }
        is_dash = !is_dash;
        col += 1;
    }

    // ╯
    if let Some(cell) = buf.cell_mut((x + width - 1, y)) {
        cell.set_char('\u{256F}'); // ╯
        cell.set_style(style);
    }
}

/// Map severity to speech bubble border color.
fn severity_bubble_color(severity: Severity) -> Color {
    match severity {
        Severity::Low => Color::Rgb(0, 255, 65),    // matrix green
        Severity::Medium => Color::Yellow,
        Severity::High => Color::Rgb(255, 165, 0),   // orange
        Severity::Critical => Color::Red,
    }
}

/// Map severity to speech bubble text color.
fn severity_text_color(severity: Severity) -> Color {
    match severity {
        Severity::Low => Color::White,
        Severity::Medium => Color::Rgb(255, 255, 200),  // warm white
        Severity::High => Color::Rgb(255, 200, 100),     // light orange
        Severity::Critical => Color::Rgb(255, 120, 120), // light red
    }
}

/// Simple word-aware text wrapping.
fn wrap_text(text: &str, max_width: usize) -> Vec<String> {
    if max_width == 0 {
        return vec![String::new()];
    }

    let mut result = Vec::new();
    for paragraph in text.split('\n') {
        if paragraph.is_empty() {
            result.push(String::new());
            continue;
        }

        let words: Vec<&str> = paragraph.split_whitespace().collect();
        if words.is_empty() {
            result.push(String::new());
            continue;
        }

        let mut current_line = String::new();
        for word in &words {
            if current_line.is_empty() {
                current_line.push_str(word);
            } else if current_line.len() + 1 + word.len() <= max_width {
                current_line.push(' ');
                current_line.push_str(word);
            } else {
                result.push(current_line);
                current_line = word.to_string();
            }
        }
        if !current_line.is_empty() {
            result.push(current_line);
        }
    }

    if result.is_empty() {
        result.push(String::new());
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_severity_colors_distinct() {
        let severities = [
            Severity::Low,
            Severity::Medium,
            Severity::High,
            Severity::Critical,
        ];
        for i in 0..severities.len() {
            for j in (i + 1)..severities.len() {
                assert_ne!(
                    severity_bubble_color(severities[i]),
                    severity_bubble_color(severities[j]),
                );
            }
        }
    }

    #[test]
    fn test_wrap_text_basic() {
        let lines = wrap_text("hello world foo bar", 10);
        assert_eq!(lines.len(), 3);
        assert_eq!(lines[0], "hello");
        assert_eq!(lines[1], "world foo");
        assert_eq!(lines[2], "bar");
    }

    #[test]
    fn test_wrap_text_empty() {
        let lines = wrap_text("", 10);
        assert_eq!(lines, vec![""]);
    }

    #[test]
    fn test_wrap_text_newlines() {
        let lines = wrap_text("line1\nline2", 20);
        assert_eq!(lines.len(), 2);
    }

    #[test]
    fn test_render_bubble_none() {
        let area = Rect::new(0, 0, 20, 5);
        let mut buf = Buffer::empty(area);
        let widget = SpeechBubbleWidget::new(None, false);
        // Should not panic and not render anything visible
        widget.render(area, &mut buf);
    }

    #[test]
    fn test_render_bubble_basic() {
        let bubble = SpeechBubble::new("Warning!".into(), Severity::Medium);
        let area = Rect::new(0, 0, 20, 5);
        let mut buf = Buffer::empty(area);
        let widget = SpeechBubbleWidget::new(Some(&bubble), false);
        widget.render(area, &mut buf);

        // Check top-left corner has ╭
        let tl = buf.cell((0, 2)).unwrap().symbol().to_string();
        assert_eq!(tl, "\u{256D}");
    }

    #[test]
    fn test_render_bubble_narrow() {
        let bubble = SpeechBubble::new("Tiny".into(), Severity::Low);
        let area = Rect::new(0, 0, 4, 3);
        let mut buf = Buffer::empty(area);
        let widget = SpeechBubbleWidget::new(Some(&bubble), false);
        // Should not panic
        widget.render(area, &mut buf);
    }

    #[test]
    fn test_render_bubble_night_mode() {
        let bubble = SpeechBubble::new("Night msg".into(), Severity::High);
        let area = Rect::new(0, 0, 25, 5);
        let mut buf = Buffer::empty(area);
        let widget = SpeechBubbleWidget::new(Some(&bubble), true);
        // Should not panic
        widget.render(area, &mut buf);
    }

    #[test]
    fn test_speech_bubble_auto_dismiss() {
        let mut bubble = SpeechBubble::new("test".into(), Severity::Low);
        assert!(!bubble.is_expired());
        bubble.dismiss_secs = 0.0;
        assert!(bubble.is_expired());
    }
}
