use ratatui::{
    layout::Alignment,
    style::{Color, Modifier, Style},
    text::{Line, Span},
};

/// Braille spinner frames, cycled on each tick.
const SPINNER_FRAMES: &[char] = &[
    '\u{280B}', // ⠋
    '\u{2819}', // ⠙
    '\u{2839}', // ⠹
    '\u{2838}', // ⠸
    '\u{283C}', // ⠼
    '\u{2834}', // ⠴
    '\u{2826}', // ⠦
    '\u{2827}', // ⠧
];

/// Dim cyan used for tool call tree connectors and header.
const DIM_CYAN: Color = Color::Rgb(100, 180, 200);

/// Status of a tool call for display purposes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolDisplayStatus {
    /// Tool is running — show spinner.
    Pending,
    /// Tool completed successfully.
    Done,
    /// Tool completed with an error.
    Error,
}

/// Render a tool call inline in the chat stream.
///
/// Layout:
/// ```text
/// ┃ ⠋ PlaceOrder          (pending)
/// ┃   {"symbol":"BTC/U…"
/// ┗━ ✓ Order placed        (done)
/// ```
///
/// Returns `(lines, Alignment::Left)`.
pub fn render_tool_call(
    name: &str,
    input_summary: &str,
    output: Option<&str>,
    status: ToolDisplayStatus,
    spinner_tick: usize,
    width: u16,
) -> (Vec<Line<'static>>, Alignment) {
    let max_w = width as usize;
    let mut lines = Vec::new();

    // Line 1: header — "┃ {spinner/icon} {tool_name}"
    let header = build_header(name, status, spinner_tick, max_w);
    lines.push(header);

    // Line 2: input summary (truncated to 1 line) — "┃   {input_summary}"
    if !input_summary.is_empty() {
        let input_line = build_input_line(input_summary, max_w);
        lines.push(input_line);
    }

    // Line 3: result (only when done/error) — "┗━ {icon} {output}"
    if let Some(out) = output {
        let result_line = build_result_line(out, status, max_w);
        lines.push(result_line);
    }

    (lines, Alignment::Left)
}

/// Build the header line: "┃ {spinner/icon} {tool_name}"
fn build_header(
    name: &str,
    status: ToolDisplayStatus,
    spinner_tick: usize,
    max_w: usize,
) -> Line<'static> {
    let connector = Span::styled("┃ ", Style::default().fg(DIM_CYAN));

    let icon = match status {
        ToolDisplayStatus::Pending => {
            let frame = SPINNER_FRAMES[spinner_tick % SPINNER_FRAMES.len()];
            Span::styled(
                format!("{frame} "),
                Style::default()
                    .fg(Color::Cyan)
                    .add_modifier(Modifier::BOLD),
            )
        }
        ToolDisplayStatus::Done => Span::styled(
            "\u{2713} ", // ✓
            Style::default().fg(Color::Green),
        ),
        ToolDisplayStatus::Error => Span::styled(
            "\u{2717} ", // ✗
            Style::default().fg(Color::Red),
        ),
    };

    // Truncate name if needed (connector=2, icon=2, so 4 chars overhead)
    let available = max_w.saturating_sub(4);
    let display_name = if name.len() > available {
        format!("{}…", &name[..available.saturating_sub(1)])
    } else {
        name.to_string()
    };

    let name_span = Span::styled(
        display_name,
        Style::default()
            .fg(DIM_CYAN)
            .add_modifier(Modifier::DIM),
    );

    Line::from(vec![connector, icon, name_span])
}

/// Build the input summary line: "┃   {input_summary}" (truncated to 1 line).
fn build_input_line(input_summary: &str, max_w: usize) -> Line<'static> {
    let connector = Span::styled("┃   ", Style::default().fg(DIM_CYAN));
    // overhead: "┃   " = 4 chars
    let available = max_w.saturating_sub(4);
    let truncated = if input_summary.len() > available {
        format!("{}…", &input_summary[..available.saturating_sub(1)])
    } else {
        input_summary.to_string()
    };

    let text_span = Span::styled(
        truncated,
        Style::default()
            .fg(Color::DarkGray)
            .add_modifier(Modifier::DIM),
    );

    Line::from(vec![connector, text_span])
}

/// Build the result line: "┗━ {icon} {output}".
fn build_result_line(
    output: &str,
    status: ToolDisplayStatus,
    max_w: usize,
) -> Line<'static> {
    let connector = Span::styled("┗━ ", Style::default().fg(DIM_CYAN));

    let (icon_str, icon_color) = match status {
        ToolDisplayStatus::Error => ("\u{2717} ", Color::Red),     // ✗
        _ => ("\u{2713} ", Color::Green),                           // ✓
    };
    let icon = Span::styled(icon_str, Style::default().fg(icon_color));

    // overhead: "┗━ " (3) + icon (2) = 5
    let available = max_w.saturating_sub(5);
    // Take only first line of output
    let first_line = output.lines().next().unwrap_or("");
    let truncated = if first_line.len() > available {
        format!("{}…", &first_line[..available.saturating_sub(1)])
    } else {
        first_line.to_string()
    };

    let output_color = if status == ToolDisplayStatus::Error {
        Color::Red
    } else {
        Color::DarkGray
    };
    let text_span = Span::styled(truncated, Style::default().fg(output_color));

    Line::from(vec![connector, icon, text_span])
}

/// Get the current spinner character for a given tick.
#[allow(dead_code)]
pub fn spinner_char(tick: usize) -> char {
    SPINNER_FRAMES[tick % SPINNER_FRAMES.len()]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spinner_cycles() {
        assert_eq!(spinner_char(0), '\u{280B}');
        assert_eq!(spinner_char(1), '\u{2819}');
        assert_eq!(spinner_char(8), '\u{280B}'); // wraps around
    }

    #[test]
    fn test_render_pending_tool() {
        let (lines, align) = render_tool_call(
            "PlaceOrder",
            r#"{"symbol":"BTC/USDT"}"#,
            None,
            ToolDisplayStatus::Pending,
            0,
            80,
        );
        assert_eq!(align, Alignment::Left);
        assert_eq!(lines.len(), 2); // header + input, no result yet
    }

    #[test]
    fn test_render_completed_tool() {
        let (lines, align) = render_tool_call(
            "PlaceOrder",
            r#"{"symbol":"BTC/USDT"}"#,
            Some("Order placed successfully"),
            ToolDisplayStatus::Done,
            0,
            80,
        );
        assert_eq!(align, Alignment::Left);
        assert_eq!(lines.len(), 3); // header + input + result
    }

    #[test]
    fn test_render_error_tool() {
        let (lines, _) = render_tool_call(
            "PlaceOrder",
            r#"{"symbol":"BTC/USDT"}"#,
            Some("Insufficient balance"),
            ToolDisplayStatus::Error,
            0,
            80,
        );
        assert_eq!(lines.len(), 3);
    }

    #[test]
    fn test_render_empty_input() {
        let (lines, _) = render_tool_call(
            "GetBalance",
            "",
            None,
            ToolDisplayStatus::Pending,
            3,
            80,
        );
        assert_eq!(lines.len(), 1); // header only, no input line
    }

    #[test]
    fn test_truncation_narrow_width() {
        let (lines, _) = render_tool_call(
            "VeryLongToolNameThatExceedsWidth",
            "some input that is also very long and should be truncated",
            Some("very long output text that should also be truncated at the width boundary"),
            ToolDisplayStatus::Done,
            0,
            20,
        );
        assert_eq!(lines.len(), 3);
        // Each line should have spans — just verify no panic
    }

    #[test]
    fn test_spinner_frames_count() {
        assert_eq!(SPINNER_FRAMES.len(), 8);
    }
}
