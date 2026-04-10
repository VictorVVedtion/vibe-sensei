use std::collections::HashMap;

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Style},
    text::Text,
    widgets::{Block, Borders, Paragraph, Widget},
};

use crate::state::{MessageStore, PendingTool, Role};
use crate::widgets::guardian_alert::render_guardian_alert;
use crate::widgets::message::render_message;
use crate::widgets::tool_call::{render_tool_call, ToolDisplayStatus};

/// Matrix green: #00FF41 -> Rgb(0, 255, 65)
const MATRIX_GREEN: Color = Color::Rgb(0, 255, 65);

/// Chat panel widget — renders scrollable message history.
///
/// Displays messages from a `MessageStore` inside a bordered block.
/// Messages are rendered bottom-up: newest at the bottom, oldest at the top.
/// The viewport respects the store's `scroll_offset`.
///
/// Tool call messages are rendered with tree-connector display and spinners.
/// Guardian alert messages are rendered as bordered severity-colored cards.
pub struct ChatPanel<'a> {
    store: &'a MessageStore,
    pending_tools: &'a HashMap<String, PendingTool>,
    spinner_tick: usize,
}

impl<'a> ChatPanel<'a> {
    /// Create a new ChatPanel referencing the message store and tool state.
    pub fn new(
        store: &'a MessageStore,
        pending_tools: &'a HashMap<String, PendingTool>,
        spinner_tick: usize,
    ) -> Self {
        Self {
            store,
            pending_tools,
            spinner_tick,
        }
    }
}

impl Widget for ChatPanel<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        // Draw the outer block with border
        let block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(MATRIX_GREEN))
            .title("[CHAT]")
            .title_style(Style::default().fg(MATRIX_GREEN));

        let inner = block.inner(area);
        block.render(area, buf);

        if inner.width == 0 || inner.height == 0 {
            return;
        }

        if self.store.is_empty() {
            render_empty(inner, buf);
            return;
        }

        render_messages(
            self.store,
            self.pending_tools,
            self.spinner_tick,
            inner,
            buf,
        );
    }
}

/// Render a placeholder when there are no messages.
fn render_empty(area: Rect, buf: &mut Buffer) {
    let text = Text::styled(
        "No messages yet...",
        Style::default().fg(Color::DarkGray),
    );
    let paragraph = Paragraph::new(text)
        .alignment(ratatui::layout::Alignment::Center);
    paragraph.render(area, buf);
}

/// Render messages from the store into the viewport area.
///
/// Strategy: collect rendered lines from messages in reverse order
/// (bottom-up), filling the viewport from the bottom. This naturally
/// handles scroll_offset — we skip `scroll_offset` lines from the
/// bottom before filling.
fn render_messages(
    store: &MessageStore,
    pending_tools: &HashMap<String, PendingTool>,
    spinner_tick: usize,
    area: Rect,
    buf: &mut Buffer,
) {
    let viewport_height = area.height as usize;
    let content_width = area.width;

    // Collect all rendered lines from all messages, each with its alignment
    let mut all_lines: Vec<(ratatui::text::Line<'static>, ratatui::layout::Alignment)> =
        Vec::new();

    for msg in &store.messages {
        let (lines, alignment) = match msg.role {
            Role::ToolCall => render_tool_call_message(
                msg,
                pending_tools,
                spinner_tick,
                content_width,
            ),
            Role::Guardian if !msg.master_name.is_empty() => {
                render_guardian_alert(
                    &msg.master_name,
                    &msg.archetype,
                    &msg.content,
                    msg.severity,
                    content_width,
                )
            }
            _ => render_message(msg, content_width),
        };
        for line in lines {
            all_lines.push((line, alignment));
        }
        // Add a blank separator between messages
        all_lines.push((
            ratatui::text::Line::from(""),
            ratatui::layout::Alignment::Left,
        ));
    }

    // Remove trailing separator
    if !all_lines.is_empty() {
        all_lines.pop();
    }

    let total_lines = all_lines.len();
    if total_lines == 0 {
        return;
    }

    // Apply scroll offset (from bottom)
    let visible_end = total_lines.saturating_sub(store.scroll_offset);
    let visible_start = visible_end.saturating_sub(viewport_height);

    // Render visible lines into the buffer, bottom-aligned
    let visible_slice = &all_lines[visible_start..visible_end];
    let start_row = if visible_slice.len() < viewport_height {
        // Fewer lines than viewport — align to bottom
        viewport_height - visible_slice.len()
    } else {
        0
    };

    for (i, (line, alignment)) in visible_slice.iter().enumerate() {
        let y = area.y + (start_row + i) as u16;
        if y >= area.y + area.height {
            break;
        }
        let row_area = Rect::new(area.x, y, area.width, 1);
        let text = Text::from(line.clone());
        let paragraph = Paragraph::new(text).alignment(*alignment);
        paragraph.render(row_area, buf);
    }

    // Render scroll indicator when not at bottom
    if store.scroll_offset > 0 {
        render_scroll_indicator(area, store, buf);
    }
}

/// Render a tool call message using the tree-connector widget.
fn render_tool_call_message(
    msg: &crate::state::ChatMessage,
    pending_tools: &HashMap<String, PendingTool>,
    spinner_tick: usize,
    width: u16,
) -> (Vec<ratatui::text::Line<'static>>, ratatui::layout::Alignment) {
    let tool_id = msg.tool_call_id.as_deref().unwrap_or("");
    let tool = pending_tools.get(tool_id);

    let name = tool.map(|t| t.name.as_str()).unwrap_or(&msg.content);
    let input_summary = tool.map(|t| t.input_summary.as_str()).unwrap_or("");
    let output = tool.and_then(|t| t.output.as_deref());
    let status = match tool {
        Some(t) if t.output.is_some() && t.is_error => ToolDisplayStatus::Error,
        Some(t) if t.output.is_some() => ToolDisplayStatus::Done,
        _ => ToolDisplayStatus::Pending,
    };

    render_tool_call(name, input_summary, output, status, spinner_tick, width)
}

/// Show a small scroll indicator at the bottom-right when scrolled up.
fn render_scroll_indicator(area: Rect, store: &MessageStore, buf: &mut Buffer) {
    let indicator = format!(" +{} ", store.scroll_offset);
    let indicator_len = indicator.len() as u16;
    if indicator_len > area.width {
        return;
    }
    let x = area.x + area.width - indicator_len;
    let y = area.y + area.height - 1;

    buf.set_string(
        x,
        y,
        &indicator,
        Style::default().fg(Color::DarkGray),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{ChatMessage, Role, Severity};
    use ratatui::buffer::Buffer;
    use ratatui::layout::Rect;

    fn render_panel(store: &MessageStore, width: u16, height: u16) -> Buffer {
        let area = Rect::new(0, 0, width, height);
        let mut buf = Buffer::empty(area);
        let pending = HashMap::new();
        let panel = ChatPanel::new(store, &pending, 0);
        panel.render(area, &mut buf);
        buf
    }

    #[test]
    fn test_empty_store_renders() {
        let store = MessageStore::default();
        let buf = render_panel(&store, 40, 10);
        // Should not panic, buffer should contain something
        assert!(buf.area().width > 0);
    }

    #[test]
    fn test_single_message_renders() {
        let mut store = MessageStore::default();
        store.push(ChatMessage::new(Role::User, "hello".into(), 1));
        let buf = render_panel(&store, 40, 10);
        assert!(buf.area().width > 0);
    }

    #[test]
    fn test_multiple_roles_render() {
        let mut store = MessageStore::default();
        store.push(ChatMessage::new(Role::User, "hello".into(), 1));
        store.push(ChatMessage::new(Role::Assistant, "hi there".into(), 2));
        store.push(ChatMessage::new(Role::System, "connected".into(), 3));
        store.push(ChatMessage::guardian(
            "watch out!".into(),
            4,
            Severity::High,
        ));
        let buf = render_panel(&store, 60, 20);
        assert!(buf.area().width > 0);
    }

    #[test]
    fn test_scroll_indicator_shown_when_scrolled() {
        let mut store = MessageStore::default();
        for i in 0..30 {
            store.push(ChatMessage::new(
                Role::User,
                format!("message {i}"),
                i,
            ));
        }
        store.scroll_up(5);
        let buf = render_panel(&store, 40, 10);
        // Buffer should contain scroll indicator text
        let content = buffer_to_string(&buf);
        assert!(content.contains("+5"));
    }

    /// Helper to convert a buffer to a string for content assertions.
    fn buffer_to_string(buf: &Buffer) -> String {
        let area = buf.area();
        let mut result = String::new();
        for y in area.y..area.y + area.height {
            for x in area.x..area.x + area.width {
                result.push(buf[(x, y)].symbol().chars().next().unwrap_or(' '));
            }
            result.push('\n');
        }
        result
    }
}
