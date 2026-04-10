use ratatui::{
    buffer::Buffer,
    layout::{Alignment, Constraint, Flex, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, Paragraph, Widget},
};

/// Matrix green: #00FF41 -> Rgb(0, 255, 65)
const MATRIX_GREEN: Color = Color::Rgb(0, 255, 65);

/// Permission prompt overlay widget.
///
/// Displayed as a centered modal when a tool requires user approval.
/// Captures a single keypress: `y` sends `ToolApproval(allow=true)`,
/// `n` sends `ToolApproval(allow=false)`.
#[allow(dead_code)]
pub struct PermissionPrompt {
    /// The tool name requesting permission.
    tool_name: String,
    /// The tool call ID for the approval response.
    tool_id: String,
}

impl PermissionPrompt {
    /// Create a new permission prompt for the given tool.
    pub fn new(tool_name: String, tool_id: String) -> Self {
        Self { tool_name, tool_id }
    }

    /// Get the tool call ID.
    #[allow(dead_code)]
    pub fn tool_id(&self) -> &str {
        &self.tool_id
    }
}

impl Widget for PermissionPrompt {
    fn render(self, area: Rect, buf: &mut Buffer) {
        // Calculate centered overlay dimensions
        let prompt_width = 50u16.min(area.width.saturating_sub(4));
        let prompt_height = 5u16.min(area.height.saturating_sub(2));

        if prompt_width < 10 || prompt_height < 3 {
            return;
        }

        // Center the prompt
        let [_, center_v, _] = Layout::vertical([
            Constraint::Fill(1),
            Constraint::Length(prompt_height),
            Constraint::Fill(1),
        ])
        .flex(Flex::Center)
        .areas(area);

        let [_, center_h, _] = Layout::horizontal([
            Constraint::Fill(1),
            Constraint::Length(prompt_width),
            Constraint::Fill(1),
        ])
        .flex(Flex::Center)
        .areas(center_v);

        // Clear the area behind the overlay
        Clear.render(center_h, buf);

        // Draw bordered block
        let block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::Yellow))
            .title("[PERMISSION]")
            .title_style(
                Style::default()
                    .fg(Color::Yellow)
                    .add_modifier(Modifier::BOLD),
            );

        let inner = block.inner(center_h);
        block.render(center_h, buf);

        if inner.width == 0 || inner.height == 0 {
            return;
        }

        // Truncate tool name if needed
        let max_name_len = (inner.width as usize).saturating_sub(10);
        let display_name = if self.tool_name.len() > max_name_len {
            format!(
                "{}…",
                &self.tool_name[..max_name_len.saturating_sub(1)]
            )
        } else {
            self.tool_name.clone()
        };

        // Build prompt text
        let lines = vec![
            Line::from(vec![
                Span::styled("Allow ", Style::default().fg(Color::White)),
                Span::styled(
                    display_name,
                    Style::default()
                        .fg(MATRIX_GREEN)
                        .add_modifier(Modifier::BOLD),
                ),
                Span::styled("?", Style::default().fg(Color::White)),
            ]),
            Line::from(""),
            Line::from(vec![
                Span::styled(
                    " [y] ",
                    Style::default()
                        .fg(Color::Green)
                        .add_modifier(Modifier::BOLD),
                ),
                Span::styled("allow  ", Style::default().fg(Color::DarkGray)),
                Span::styled(
                    " [n] ",
                    Style::default()
                        .fg(Color::Red)
                        .add_modifier(Modifier::BOLD),
                ),
                Span::styled("deny", Style::default().fg(Color::DarkGray)),
            ]),
        ];

        let text = Text::from(lines);
        let paragraph = Paragraph::new(text).alignment(Alignment::Center);
        paragraph.render(inner, buf);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn render_prompt(
        tool_name: &str,
        tool_id: &str,
        width: u16,
        height: u16,
    ) -> Buffer {
        let area = Rect::new(0, 0, width, height);
        let mut buf = Buffer::empty(area);
        let prompt =
            PermissionPrompt::new(tool_name.to_string(), tool_id.to_string());
        prompt.render(area, &mut buf);
        buf
    }

    #[test]
    fn test_prompt_renders_without_panic() {
        let buf = render_prompt("PlaceOrder", "tc-1", 60, 20);
        assert!(buf.area().width > 0);
    }

    #[test]
    fn test_prompt_tool_id() {
        let prompt =
            PermissionPrompt::new("PlaceOrder".to_string(), "tc-42".to_string());
        assert_eq!(prompt.tool_id(), "tc-42");
    }

    #[test]
    fn test_prompt_narrow_terminal() {
        // Should not panic even with very small terminal
        let buf = render_prompt("Tool", "tc-1", 12, 5);
        assert!(buf.area().width > 0);
    }

    #[test]
    fn test_prompt_very_small_terminal() {
        // Too small to render — should not panic
        let buf = render_prompt("Tool", "tc-1", 8, 3);
        assert!(buf.area().width > 0);
    }

    #[test]
    fn test_prompt_long_tool_name() {
        let buf = render_prompt(
            "VeryLongToolNameThatShouldBeTruncated",
            "tc-1",
            40,
            10,
        );
        assert!(buf.area().width > 0);
    }
}
