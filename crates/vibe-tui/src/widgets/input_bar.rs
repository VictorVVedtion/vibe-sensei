use std::time::Instant;

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::Widget,
};

use crate::input::InputState;

/// Matrix green: #00FF41 -> Rgb(0, 255, 65)
const MATRIX_GREEN: Color = Color::Rgb(0, 255, 65);

/// Cursor blink half-period in milliseconds.
const CURSOR_BLINK_MS: u128 = 500;

/// Prompt string rendered before the input buffer.
const PROMPT: &str = "\u{224B} ";

/// Prompt display width (the wave char + space).
const PROMPT_WIDTH: u16 = 3;

/// Command hint shown when buffer starts with "/".
const COMMAND_HINT: &str = "[/buy /sell /swap /analyze /positions /balance]";

/// Input bar widget — renders the "≋ " prompt + buffer text + blinking cursor.
///
/// Occupies a single row at the bottom of the chat zone.
pub struct InputBar<'a> {
    state: &'a InputState,
    /// Boot instant used for cursor blink timing.
    boot: Instant,
    /// Whether to render the command hint line above the bar.
    show_hint: bool,
}

impl<'a> InputBar<'a> {
    /// Create a new InputBar.
    ///
    /// `boot` should be a fixed `Instant` created at app start so the blink
    /// phase is stable across frames.
    pub fn new(state: &'a InputState, boot: Instant) -> Self {
        Self {
            state,
            boot,
            show_hint: state.is_command(),
        }
    }

    /// Returns whether the cursor block should be visible right now.
    fn cursor_visible(&self) -> bool {
        let elapsed = self.boot.elapsed().as_millis();
        (elapsed / CURSOR_BLINK_MS).is_multiple_of(2)
    }
}

impl Widget for InputBar<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.height == 0 || area.width == 0 {
            return;
        }

        // If we have 2+ rows and hint should show, render hint on the first row
        if self.show_hint && area.height >= 2 {
            let hint_area = Rect::new(area.x, area.y, area.width, 1);
            render_hint(hint_area, buf);
        }

        // Input bar is always the last row of the given area
        let bar_y = area.y + area.height - 1;
        let bar_area = Rect::new(area.x, bar_y, area.width, 1);
        self.render_bar(bar_area, buf);
    }
}

impl InputBar<'_> {
    /// Render the actual input bar (prompt + text + cursor) in a 1-row area.
    fn render_bar(&self, area: Rect, buf: &mut Buffer) {
        let available = area.width.saturating_sub(PROMPT_WIDTH);
        if available == 0 {
            return;
        }

        // Build the line: prompt + visible buffer text + cursor
        let mut spans = Vec::new();

        // Prompt
        spans.push(Span::styled(
            PROMPT,
            Style::default().fg(MATRIX_GREEN),
        ));

        let buffer = &self.state.buffer;
        let cursor_pos = self.state.cursor_pos;

        // We need to figure out which portion of the buffer to show
        // when it's longer than `available`. Keep cursor in view.
        let (visible_text, cursor_col) =
            compute_visible_window(buffer, cursor_pos, available as usize);

        // Text before cursor
        let before = &visible_text[..cursor_col];
        if !before.is_empty() {
            spans.push(Span::styled(
                before.to_string(),
                Style::default().fg(MATRIX_GREEN),
            ));
        }

        // Cursor character (or space if at end)
        let cursor_char = if cursor_col < visible_text.len() {
            // Char under cursor
            let ch_end = next_char_end(&visible_text, cursor_col);
            visible_text[cursor_col..ch_end].to_string()
        } else {
            " ".to_string()
        };

        let cursor_style = if self.cursor_visible() {
            Style::default()
                .fg(Color::Black)
                .bg(MATRIX_GREEN)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(MATRIX_GREEN)
        };
        spans.push(Span::styled(cursor_char.clone(), cursor_style));

        // Text after cursor
        if cursor_col < visible_text.len() {
            let ch_end = next_char_end(&visible_text, cursor_col);
            let after = &visible_text[ch_end..];
            if !after.is_empty() {
                spans.push(Span::styled(
                    after.to_string(),
                    Style::default().fg(MATRIX_GREEN),
                ));
            }
        }

        let line = Line::from(spans);
        buf.set_line(area.x, area.y, &line, area.width);
    }
}

/// Render the dim command hint line.
fn render_hint(area: Rect, buf: &mut Buffer) {
    let hint_line = Line::from(Span::styled(
        COMMAND_HINT,
        Style::default().fg(Color::DarkGray),
    ));
    buf.set_line(area.x, area.y, &hint_line, area.width);
}

/// Compute the visible window of the buffer and the cursor column within it.
///
/// Returns `(visible_text_slice, cursor_byte_offset_in_slice)`.
///
/// When the buffer is longer than `width` characters, scrolls the view
/// horizontally to keep the cursor visible.
fn compute_visible_window(
    buffer: &str,
    cursor_pos: usize,
    width: usize,
) -> (String, usize) {
    // Collect char indices for width calculation
    let chars: Vec<(usize, char)> = buffer.char_indices().collect();
    let total_chars = chars.len();

    if total_chars <= width {
        // Everything fits
        return (buffer.to_string(), cursor_pos);
    }

    // Find the char index of the cursor position
    let cursor_char_idx = chars
        .iter()
        .position(|(byte_idx, _)| *byte_idx >= cursor_pos)
        .unwrap_or(total_chars);

    // Determine window start (in char indices)
    let half = width / 2;
    let start_char = if cursor_char_idx <= half {
        0
    } else if cursor_char_idx + half >= total_chars {
        total_chars.saturating_sub(width)
    } else {
        cursor_char_idx - half
    };
    let end_char = (start_char + width).min(total_chars);

    // Build the visible string
    let start_byte = chars[start_char].0;
    let end_byte = if end_char < chars.len() {
        chars[end_char].0
    } else {
        buffer.len()
    };

    let visible = buffer[start_byte..end_byte].to_string();
    let cursor_in_visible = cursor_pos.saturating_sub(start_byte);

    (visible, cursor_in_visible)
}

/// Find the end byte of the character starting at `pos` in `s`.
fn next_char_end(s: &str, pos: usize) -> usize {
    let mut end = pos + 1;
    while end < s.len() && !s.is_char_boundary(end) {
        end += 1;
    }
    end
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_visible_window_short() {
        let (vis, cur) = compute_visible_window("hello", 5, 20);
        assert_eq!(vis, "hello");
        assert_eq!(cur, 5);
    }

    #[test]
    fn test_compute_visible_window_exact_fit() {
        let (vis, cur) = compute_visible_window("abcde", 3, 5);
        assert_eq!(vis, "abcde");
        assert_eq!(cur, 3);
    }

    #[test]
    fn test_compute_visible_window_scroll_right() {
        let text = "abcdefghijklmnop"; // 16 chars
        let (vis, _cur) = compute_visible_window(text, 15, 10);
        assert_eq!(vis.len(), 10);
        // cursor near end, window should include last chars
    }

    #[test]
    fn test_compute_visible_window_cursor_at_start() {
        let text = "abcdefghijklmnop";
        let (vis, cur) = compute_visible_window(text, 0, 10);
        assert_eq!(vis, "abcdefghij");
        assert_eq!(cur, 0);
    }

    #[test]
    fn test_next_char_end_ascii() {
        assert_eq!(next_char_end("abc", 0), 1);
        assert_eq!(next_char_end("abc", 1), 2);
    }

    #[test]
    fn test_next_char_end_multibyte() {
        let s = "\u{00E9}x"; // e-acute (2 bytes) + x
        assert_eq!(next_char_end(s, 0), 2);
        assert_eq!(next_char_end(s, 2), 3);
    }

    #[test]
    fn test_prompt_constant() {
        // Verify the prompt is the wave symbol + space
        assert!(PROMPT.starts_with('\u{224B}'));
    }
}
