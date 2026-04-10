use ratatui::{
    layout::Alignment,
    style::{Color, Modifier, Style},
    text::{Line, Span},
};

use crate::state::{ChatMessage, Role, Severity};

/// Matrix green: #00FF41 -> Rgb(0, 255, 65)
const MATRIX_GREEN: Color = Color::Rgb(0, 255, 65);

/// Render a single ChatMessage into styled Lines for display in the chat panel.
///
/// Returns (lines, alignment) — the caller places them in the viewport.
pub fn render_message(msg: &ChatMessage, width: u16) -> (Vec<Line<'static>>, Alignment) {
    match msg.role {
        Role::User => render_user(msg, width),
        Role::Assistant => render_assistant(msg, width),
        Role::System => render_system(msg, width),
        Role::Guardian => render_guardian(msg, width),
        // ToolCall messages are rendered by the chat_panel using the
        // tool_call widget directly; this branch is a fallback.
        Role::ToolCall => render_system(msg, width),
    }
}

/// User messages: cyan, right-aligned, ">" prefix.
fn render_user(msg: &ChatMessage, width: u16) -> (Vec<Line<'static>>, Alignment) {
    let style = Style::default().fg(Color::Cyan);
    let prefix = "> ";
    let max_content_width = (width as usize).saturating_sub(prefix.len());
    let lines = wrap_text(&msg.content, max_content_width)
        .into_iter()
        .enumerate()
        .map(|(i, line_text)| {
            let p = if i == 0 { prefix } else { "  " };
            Line::from(Span::styled(format!("{p}{line_text}"), style))
        })
        .collect();
    (lines, Alignment::Right)
}

/// Assistant messages: MATRIX_GREEN, left-aligned.
fn render_assistant(msg: &ChatMessage, width: u16) -> (Vec<Line<'static>>, Alignment) {
    let style = Style::default().fg(MATRIX_GREEN);
    let max_width = width as usize;
    let mut lines: Vec<Line<'static>> = wrap_text(&msg.content, max_width)
        .into_iter()
        .map(|line_text| Line::from(Span::styled(line_text, style)))
        .collect();

    // Show a blinking cursor while streaming
    if msg.streaming {
        if let Some(last) = lines.last_mut() {
            last.spans.push(Span::styled(
                "\u{2588}",
                Style::default()
                    .fg(MATRIX_GREEN)
                    .add_modifier(Modifier::SLOW_BLINK),
            ));
        } else {
            lines.push(Line::from(Span::styled(
                "\u{2588}",
                Style::default()
                    .fg(MATRIX_GREEN)
                    .add_modifier(Modifier::SLOW_BLINK),
            )));
        }
    }

    (lines, Alignment::Left)
}

/// System messages: dim gray, centered.
fn render_system(msg: &ChatMessage, width: u16) -> (Vec<Line<'static>>, Alignment) {
    let style = Style::default().fg(Color::DarkGray);
    let max_width = width as usize;
    let lines = wrap_text(&msg.content, max_width)
        .into_iter()
        .map(|line_text| Line::from(Span::styled(line_text, style)))
        .collect();
    (lines, Alignment::Center)
}

/// Guardian messages: severity-colored, left-aligned.
fn render_guardian(msg: &ChatMessage, width: u16) -> (Vec<Line<'static>>, Alignment) {
    let color = severity_color(msg.severity);
    let style = Style::default().fg(color);
    let icon = severity_icon(msg.severity);
    let prefix = format!("{icon} ");
    let max_content_width = (width as usize).saturating_sub(prefix.len());
    let lines = wrap_text(&msg.content, max_content_width)
        .into_iter()
        .enumerate()
        .map(|(i, line_text)| {
            let p = if i == 0 {
                prefix.clone()
            } else {
                " ".repeat(prefix.len())
            };
            Line::from(Span::styled(format!("{p}{line_text}"), style))
        })
        .collect();
    (lines, Alignment::Left)
}

/// Map guardian severity to a display color.
fn severity_color(severity: Severity) -> Color {
    match severity {
        Severity::Low => Color::Green,
        Severity::Medium => Color::Yellow,
        Severity::High => Color::Rgb(255, 165, 0), // orange
        Severity::Critical => Color::Red,
    }
}

/// Map guardian severity to a prefix icon.
fn severity_icon(severity: Severity) -> &'static str {
    match severity {
        Severity::Low => "\u{26a0}",    // warning sign
        Severity::Medium => "\u{26a0}", // warning sign
        Severity::High => "\u{1f6a8}",  // rotating light
        Severity::Critical => "\u{1f6d1}", // stop sign
    }
}

/// Simple word-aware text wrapping.
///
/// Splits text into lines that fit within `max_width` characters.
/// Respects existing newlines in the content.
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
                // First word on line — always add even if longer than width
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
    fn test_wrap_text_basic() {
        let lines = wrap_text("hello world", 20);
        assert_eq!(lines, vec!["hello world"]);
    }

    #[test]
    fn test_wrap_text_wraps() {
        let lines = wrap_text("hello world foo bar", 11);
        assert_eq!(lines, vec!["hello world", "foo bar"]);
    }

    #[test]
    fn test_wrap_text_newlines() {
        let lines = wrap_text("line one\nline two", 50);
        assert_eq!(lines, vec!["line one", "line two"]);
    }

    #[test]
    fn test_wrap_text_empty() {
        let lines = wrap_text("", 50);
        assert_eq!(lines, vec![""]);
    }

    #[test]
    fn test_render_user_alignment() {
        let msg = ChatMessage::new(Role::User, "hello".into(), 100);
        let (lines, align) = render_message(&msg, 80);
        assert_eq!(align, Alignment::Right);
        assert!(!lines.is_empty());
    }

    #[test]
    fn test_render_assistant_alignment() {
        let msg = ChatMessage::new(Role::Assistant, "world".into(), 100);
        let (lines, align) = render_message(&msg, 80);
        assert_eq!(align, Alignment::Left);
        assert!(!lines.is_empty());
    }

    #[test]
    fn test_render_system_alignment() {
        let msg = ChatMessage::new(Role::System, "connected".into(), 100);
        let (_, align) = render_message(&msg, 80);
        assert_eq!(align, Alignment::Center);
    }

    #[test]
    fn test_render_guardian_alignment() {
        let msg = ChatMessage::guardian(
            "Position too large!".into(),
            100,
            Severity::High,
        );
        let (_, align) = render_message(&msg, 80);
        assert_eq!(align, Alignment::Left);
    }

    #[test]
    fn test_streaming_cursor_shown() {
        let mut msg = ChatMessage::new(Role::Assistant, "typing".into(), 100);
        msg.streaming = true;
        let (lines, _) = render_message(&msg, 80);
        let last = lines.last().unwrap();
        // Should have 2 spans: text + blinking cursor
        assert!(last.spans.len() >= 2);
    }

    #[test]
    fn test_severity_colors_distinct() {
        assert_ne!(severity_color(Severity::Low), severity_color(Severity::Critical));
        assert_ne!(severity_color(Severity::Medium), severity_color(Severity::High));
    }
}
