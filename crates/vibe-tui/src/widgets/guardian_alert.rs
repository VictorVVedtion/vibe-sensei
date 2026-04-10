use ratatui::{
    layout::Alignment,
    style::{Color, Modifier, Style},
    text::{Line, Span},
};

use crate::state::Severity;

/// Render a guardian alert card inline in the chat stream.
///
/// Layout:
/// ```text
/// ┌─ 🛡 Jesse Livermore (The Speculator) ─────┐
/// │ ⚠ Position too large! Consider reducing   │
/// │   exposure before market close.            │
/// └───────────────────────────────────────────┘
/// ```
///
/// Border color matches severity:
/// - Low (info) → green
/// - Medium (warning) → yellow
/// - High (danger) → orange
/// - Critical (emergency) → red
///
/// Returns `(lines, Alignment::Left)`.
pub fn render_guardian_alert(
    master_name: &str,
    archetype: &str,
    message: &str,
    severity: Severity,
    width: u16,
) -> (Vec<Line<'static>>, Alignment) {
    let max_w = width as usize;
    let border_color = severity_border_color(severity);
    let icon = severity_icon(severity);
    let border_style = Style::default().fg(border_color);

    let mut lines = Vec::new();

    // Top border with master name
    let top = build_top_border(master_name, archetype, icon, border_style, max_w);
    lines.push(top);

    // Body lines (word-wrapped message)
    let body_lines = build_body(message, border_style, severity, max_w);
    lines.extend(body_lines);

    // Bottom border
    let bottom = build_bottom_border(border_style, max_w);
    lines.push(bottom);

    (lines, Alignment::Left)
}

/// Build the top border: "┌─ {icon} {master_name} ({archetype}) ─…─┐"
fn build_top_border(
    master_name: &str,
    archetype: &str,
    icon: &str,
    border_style: Style,
    max_w: usize,
) -> Line<'static> {
    if max_w < 6 {
        return Line::from(Span::styled("┌──┐", border_style));
    }

    let header_text = if archetype.is_empty() {
        format!(" {icon} {master_name} ")
    } else {
        format!(" {icon} {master_name} ({archetype}) ")
    };

    // "┌─" + header + "─…─┐"
    let overhead = 4; // "┌─" + "─┐"
    let available = max_w.saturating_sub(overhead);
    let display_header = if header_text.len() > available {
        format!("{}…", &header_text[..available.saturating_sub(1)])
    } else {
        header_text.clone()
    };

    let remaining = max_w
        .saturating_sub(2)  // "┌" + "┐"
        .saturating_sub(display_header.len());
    let left_dash = "\u{2500}"; // ─
    // Put 1 dash on left, rest on right
    let right_dashes: String = left_dash.repeat(remaining.saturating_sub(1));

    let top = format!("\u{250C}{left_dash}{display_header}{right_dashes}\u{2510}");

    Line::from(Span::styled(top, border_style))
}

/// Build body lines: "│ {icon} {text}  │" with word wrapping.
fn build_body(
    message: &str,
    border_style: Style,
    severity: Severity,
    max_w: usize,
) -> Vec<Line<'static>> {
    let text_color = severity_text_color(severity);
    let text_style = Style::default().fg(text_color);
    let icon = severity_icon(severity);
    let icon_style = Style::default()
        .fg(severity_border_color(severity))
        .add_modifier(Modifier::BOLD);

    // "│ " + "{icon} " + text + " │" → overhead = 4 + icon_len + 1
    let icon_prefix_len = icon.chars().count() + 1; // icon + space
    let overhead = 4 + icon_prefix_len; // "│ " + icon + " " + text + " │"
    let content_w = max_w.saturating_sub(overhead);

    let wrapped = wrap_text(message, content_w);
    let mut lines = Vec::new();

    for (i, line_text) in wrapped.iter().enumerate() {
        let padding = content_w.saturating_sub(line_text.len());
        let pad_str: String = " ".repeat(padding);

        if i == 0 {
            // First line has icon
            let line = Line::from(vec![
                Span::styled("\u{2502} ", border_style),     // │
                Span::styled(format!("{icon} "), icon_style),
                Span::styled(line_text.clone(), text_style),
                Span::raw(pad_str),
                Span::styled(" \u{2502}", border_style),     // │
            ]);
            lines.push(line);
        } else {
            // Continuation lines: indent to align with text after icon
            let indent: String = " ".repeat(icon_prefix_len);
            let line = Line::from(vec![
                Span::styled("\u{2502} ", border_style),
                Span::raw(indent),
                Span::styled(line_text.clone(), text_style),
                Span::raw(pad_str),
                Span::styled(" \u{2502}", border_style),
            ]);
            lines.push(line);
        }
    }

    lines
}

/// Build the bottom border: "└─…─┘"
fn build_bottom_border(border_style: Style, max_w: usize) -> Line<'static> {
    if max_w < 2 {
        return Line::from(Span::styled("└┘", border_style));
    }
    let dashes: String = "\u{2500}".repeat(max_w.saturating_sub(2));
    Line::from(Span::styled(
        format!("\u{2514}{dashes}\u{2518}"),
        border_style,
    ))
}

/// Map severity to border color.
fn severity_border_color(severity: Severity) -> Color {
    match severity {
        Severity::Low => Color::Green,
        Severity::Medium => Color::Yellow,
        Severity::High => Color::Rgb(255, 165, 0), // orange
        Severity::Critical => Color::Red,
    }
}

/// Map severity to text color inside the card.
fn severity_text_color(severity: Severity) -> Color {
    match severity {
        Severity::Low => Color::White,
        Severity::Medium => Color::Yellow,
        Severity::High => Color::Rgb(255, 200, 100), // light orange
        Severity::Critical => Color::Rgb(255, 100, 100), // light red
    }
}

/// Map severity to an icon string.
fn severity_icon(severity: Severity) -> &'static str {
    match severity {
        Severity::Low => "\u{2139}",    // ℹ
        Severity::Medium => "\u{26a0}", // ⚠
        Severity::High => "\u{1f6a8}",  // 🚨
        Severity::Critical => "\u{1f6d1}", // 🛑
    }
}

/// Simple word-aware text wrapping (same algorithm as message.rs).
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
    fn test_severity_border_colors_distinct() {
        let colors: Vec<Color> = [
            Severity::Low,
            Severity::Medium,
            Severity::High,
            Severity::Critical,
        ]
        .iter()
        .map(|s| severity_border_color(*s))
        .collect();

        // All distinct
        for (i, c1) in colors.iter().enumerate() {
            for (j, c2) in colors.iter().enumerate() {
                if i != j {
                    assert_ne!(c1, c2, "Severities {i} and {j} should differ");
                }
            }
        }
    }

    #[test]
    fn test_render_low_severity() {
        let (lines, align) = render_guardian_alert(
            "Jesse Livermore",
            "The Speculator",
            "Position within limits.",
            Severity::Low,
            60,
        );
        assert_eq!(align, Alignment::Left);
        // At least 3 lines: top border, 1 body, bottom border
        assert!(lines.len() >= 3);
    }

    #[test]
    fn test_render_critical_severity() {
        let (lines, _) = render_guardian_alert(
            "Sun Tzu",
            "The Strategist",
            "EMERGENCY: Portfolio at maximum risk!",
            Severity::Critical,
            60,
        );
        assert!(lines.len() >= 3);
    }

    #[test]
    fn test_render_long_message_wraps() {
        let long_msg = "This is a very long message that should be wrapped \
                        across multiple lines because it exceeds the available \
                        content width inside the bordered card.";
        let (lines, _) = render_guardian_alert(
            "Buffett",
            "The Oracle",
            long_msg,
            Severity::Medium,
            40,
        );
        // top + multiple body lines + bottom
        assert!(lines.len() > 3);
    }

    #[test]
    fn test_render_empty_archetype() {
        let (lines, _) = render_guardian_alert(
            "Unknown Master",
            "",
            "Alert message",
            Severity::Low,
            60,
        );
        assert!(lines.len() >= 3);
    }

    #[test]
    fn test_render_narrow_width() {
        let (lines, _) = render_guardian_alert(
            "Master",
            "Type",
            "Short",
            Severity::High,
            15,
        );
        // Should not panic even at narrow widths
        assert!(!lines.is_empty());
    }
}
