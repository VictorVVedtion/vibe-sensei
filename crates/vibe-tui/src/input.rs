use std::collections::VecDeque;
use std::time::Instant;

/// Maximum number of history entries retained.
const MAX_HISTORY: usize = 50;

/// Timeout for key chord sequences (e.g. "gg" for scroll to top).
const CHORD_TIMEOUT_MS: u128 = 1000;

/// Vim-style input mode.
///
/// Defaults to `Insert` — more intuitive for a chat app where typing is primary.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub enum VimMode {
    /// Normal mode: navigation keys, no text input.
    Normal,
    /// Insert mode: text input, printable chars go into buffer.
    #[default]
    Insert,
}

impl VimMode {
    /// Display label for the status bar.
    pub fn label(&self) -> &'static str {
        match self {
            VimMode::Normal => "NORMAL",
            VimMode::Insert => "INSERT",
        }
    }
}

/// Pending key chord state for Normal mode multi-key sequences.
#[derive(Debug, Clone)]
pub struct PendingChord {
    /// The first key of the chord (e.g. 'g').
    pub key: char,
    /// When the first key was pressed.
    pub timestamp: Instant,
}

impl PendingChord {
    /// Create a new pending chord starting now.
    pub fn new(key: char) -> Self {
        Self {
            key,
            timestamp: Instant::now(),
        }
    }

    /// Check if the chord has expired.
    pub fn is_expired(&self) -> bool {
        self.timestamp.elapsed().as_millis() > CHORD_TIMEOUT_MS
    }

    /// Returns the display hint (e.g. "g_") for the status bar.
    pub fn hint(&self) -> String {
        format!("{}_", self.key)
    }
}

/// Input state for the bottom input bar.
///
/// Manages the text buffer, cursor position, command history, and vim mode.
/// History navigation uses Up/Down arrows and caps at [`MAX_HISTORY`] entries.
#[derive(Debug, Default)]
pub struct InputState {
    /// Current text buffer.
    pub buffer: String,
    /// Cursor byte-position within `buffer` (always on a char boundary).
    pub cursor_pos: usize,
    /// Command history (oldest at front, newest at back).
    history: VecDeque<String>,
    /// Index into history during navigation. `None` = not browsing history.
    history_index: Option<usize>,
    /// Saved buffer text while browsing history (restored on Down past end).
    draft: String,
    /// Current vim mode (Normal or Insert).
    pub mode: VimMode,
    /// Pending key chord in Normal mode (e.g. waiting for second 'g').
    pub pending_chord: Option<PendingChord>,
}

impl InputState {
    /// Insert a character at the current cursor position.
    pub fn insert_char(&mut self, ch: char) {
        self.buffer.insert(self.cursor_pos, ch);
        self.cursor_pos += ch.len_utf8();
        // Any edit resets history browsing
        self.history_index = None;
    }

    /// Delete the character before the cursor (Backspace).
    pub fn delete_char(&mut self) {
        if self.cursor_pos == 0 {
            return;
        }
        // Find the previous char boundary
        let prev = self.prev_char_boundary();
        self.buffer.drain(prev..self.cursor_pos);
        self.cursor_pos = prev;
        self.history_index = None;
    }

    /// Move the cursor one character to the left.
    pub fn move_cursor_left(&mut self) {
        if self.cursor_pos > 0 {
            self.cursor_pos = self.prev_char_boundary();
        }
    }

    /// Move the cursor one character to the right.
    pub fn move_cursor_right(&mut self) {
        if self.cursor_pos < self.buffer.len() {
            self.cursor_pos = self.next_char_boundary();
        }
    }

    /// Navigate to the previous (older) history entry.
    pub fn history_up(&mut self) {
        if self.history.is_empty() {
            return;
        }
        match self.history_index {
            None => {
                // Save current buffer as draft before entering history
                self.draft = self.buffer.clone();
                let idx = self.history.len() - 1;
                self.history_index = Some(idx);
                self.load_history_entry(idx);
            }
            Some(idx) if idx > 0 => {
                let new_idx = idx - 1;
                self.history_index = Some(new_idx);
                self.load_history_entry(new_idx);
            }
            _ => {
                // Already at oldest entry, do nothing
            }
        }
    }

    /// Navigate to the next (newer) history entry.
    pub fn history_down(&mut self) {
        match self.history_index {
            Some(idx) => {
                if idx + 1 < self.history.len() {
                    let new_idx = idx + 1;
                    self.history_index = Some(new_idx);
                    self.load_history_entry(new_idx);
                } else {
                    // Past the newest entry — restore draft
                    self.history_index = None;
                    self.buffer = self.draft.clone();
                    self.cursor_pos = self.buffer.len();
                }
            }
            None => {
                // Not browsing history, do nothing
            }
        }
    }

    /// Clear the input buffer and reset cursor.
    pub fn clear(&mut self) {
        self.buffer.clear();
        self.cursor_pos = 0;
        self.history_index = None;
        self.draft.clear();
    }

    /// Submit the current buffer: returns the text and resets state.
    ///
    /// Pushes the submitted text into the history (if non-empty) and clears
    /// the buffer. Returns the submitted text.
    pub fn submit(&mut self) -> String {
        let text = self.buffer.clone();
        if !text.is_empty() {
            self.push_history(text.clone());
        }
        self.clear();
        text
    }

    /// Returns the number of history entries.
    #[allow(dead_code)]
    pub fn history_len(&self) -> usize {
        self.history.len()
    }

    /// Returns whether the buffer starts with "/".
    pub fn is_command(&self) -> bool {
        self.buffer.starts_with('/')
    }

    /// Switch to Normal mode.
    pub fn enter_normal_mode(&mut self) {
        self.mode = VimMode::Normal;
        self.pending_chord = None;
    }

    /// Switch to Insert mode.
    pub fn enter_insert_mode(&mut self) {
        self.mode = VimMode::Insert;
        self.pending_chord = None;
    }

    /// Switch to Insert mode with the cursor moved to end of buffer (like vim 'a').
    pub fn enter_insert_mode_append(&mut self) {
        self.mode = VimMode::Insert;
        self.pending_chord = None;
        self.cursor_pos = self.buffer.len();
    }

    /// Start a key chord sequence in Normal mode.
    pub fn start_chord(&mut self, key: char) {
        self.pending_chord = Some(PendingChord::new(key));
    }

    /// Cancel any pending chord (on timeout or unrecognized second key).
    pub fn cancel_chord(&mut self) {
        self.pending_chord = None;
    }

    /// Check if there is a pending chord that has not expired.
    pub fn has_active_chord(&self) -> bool {
        self.pending_chord
            .as_ref()
            .is_some_and(|c| !c.is_expired())
    }

    /// Push a command into history, evicting the oldest if at capacity.
    fn push_history(&mut self, entry: String) {
        // Deduplicate: remove if already the last entry
        if self.history.back() == Some(&entry) {
            return;
        }
        if self.history.len() >= MAX_HISTORY {
            self.history.pop_front();
        }
        self.history.push_back(entry);
    }

    /// Load a history entry into the buffer by index.
    fn load_history_entry(&mut self, idx: usize) {
        if let Some(entry) = self.history.get(idx) {
            self.buffer = entry.clone();
            self.cursor_pos = self.buffer.len();
        }
    }

    /// Find the byte offset of the previous character boundary.
    fn prev_char_boundary(&self) -> usize {
        let mut pos = self.cursor_pos;
        if pos > 0 {
            pos -= 1;
            while pos > 0 && !self.buffer.is_char_boundary(pos) {
                pos -= 1;
            }
        }
        pos
    }

    /// Find the byte offset of the next character boundary.
    fn next_char_boundary(&self) -> usize {
        let mut pos = self.cursor_pos;
        if pos < self.buffer.len() {
            pos += 1;
            while pos < self.buffer.len() && !self.buffer.is_char_boundary(pos) {
                pos += 1;
            }
        }
        pos
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_state() {
        let state = InputState::default();
        assert!(state.buffer.is_empty());
        assert_eq!(state.cursor_pos, 0);
        assert_eq!(state.history_len(), 0);
    }

    #[test]
    fn test_insert_char() {
        let mut state = InputState::default();
        state.insert_char('h');
        state.insert_char('i');
        assert_eq!(state.buffer, "hi");
        assert_eq!(state.cursor_pos, 2);
    }

    #[test]
    fn test_insert_multibyte_char() {
        let mut state = InputState::default();
        state.insert_char('a');
        state.insert_char('\u{00E9}'); // e-acute, 2 bytes in UTF-8
        state.insert_char('b');
        assert_eq!(state.buffer, "a\u{00E9}b");
        assert_eq!(state.cursor_pos, 4); // 1 + 2 + 1
    }

    #[test]
    fn test_delete_char() {
        let mut state = InputState::default();
        state.insert_char('a');
        state.insert_char('b');
        state.insert_char('c');
        state.delete_char();
        assert_eq!(state.buffer, "ab");
        assert_eq!(state.cursor_pos, 2);
    }

    #[test]
    fn test_delete_char_at_start() {
        let mut state = InputState::default();
        state.delete_char(); // should be no-op
        assert!(state.buffer.is_empty());
        assert_eq!(state.cursor_pos, 0);
    }

    #[test]
    fn test_delete_multibyte_char() {
        let mut state = InputState::default();
        state.insert_char('\u{00E9}');
        assert_eq!(state.cursor_pos, 2);
        state.delete_char();
        assert!(state.buffer.is_empty());
        assert_eq!(state.cursor_pos, 0);
    }

    #[test]
    fn test_move_cursor_left_right() {
        let mut state = InputState::default();
        state.insert_char('a');
        state.insert_char('b');
        state.insert_char('c');
        assert_eq!(state.cursor_pos, 3);

        state.move_cursor_left();
        assert_eq!(state.cursor_pos, 2);

        state.move_cursor_left();
        assert_eq!(state.cursor_pos, 1);

        state.move_cursor_right();
        assert_eq!(state.cursor_pos, 2);
    }

    #[test]
    fn test_cursor_clamps_at_boundaries() {
        let mut state = InputState::default();
        state.insert_char('x');

        state.move_cursor_left();
        assert_eq!(state.cursor_pos, 0);
        state.move_cursor_left(); // should not go below 0
        assert_eq!(state.cursor_pos, 0);

        state.move_cursor_right();
        assert_eq!(state.cursor_pos, 1);
        state.move_cursor_right(); // should not go past end
        assert_eq!(state.cursor_pos, 1);
    }

    #[test]
    fn test_insert_at_middle() {
        let mut state = InputState::default();
        state.insert_char('a');
        state.insert_char('c');
        state.move_cursor_left(); // cursor before 'c'
        state.insert_char('b');
        assert_eq!(state.buffer, "abc");
    }

    #[test]
    fn test_delete_at_middle() {
        let mut state = InputState::default();
        state.insert_char('a');
        state.insert_char('b');
        state.insert_char('c');
        state.move_cursor_left(); // cursor before 'c'
        state.delete_char(); // delete 'b'
        assert_eq!(state.buffer, "ac");
        assert_eq!(state.cursor_pos, 1);
    }

    #[test]
    fn test_clear() {
        let mut state = InputState::default();
        state.insert_char('h');
        state.insert_char('i');
        state.clear();
        assert!(state.buffer.is_empty());
        assert_eq!(state.cursor_pos, 0);
    }

    #[test]
    fn test_submit_returns_text_and_clears() {
        let mut state = InputState::default();
        state.insert_char('g');
        state.insert_char('o');
        let submitted = state.submit();
        assert_eq!(submitted, "go");
        assert!(state.buffer.is_empty());
        assert_eq!(state.cursor_pos, 0);
    }

    #[test]
    fn test_submit_empty_does_not_add_history() {
        let mut state = InputState::default();
        let submitted = state.submit();
        assert!(submitted.is_empty());
        assert_eq!(state.history_len(), 0);
    }

    #[test]
    fn test_submit_adds_to_history() {
        let mut state = InputState::default();
        state.insert_char('a');
        state.submit();
        assert_eq!(state.history_len(), 1);

        state.insert_char('b');
        state.submit();
        assert_eq!(state.history_len(), 2);
    }

    #[test]
    fn test_history_dedup_consecutive() {
        let mut state = InputState::default();
        state.insert_char('a');
        state.submit();
        state.insert_char('a');
        state.submit();
        // Consecutive duplicate should not create a second entry
        assert_eq!(state.history_len(), 1);
    }

    #[test]
    fn test_history_max_capacity() {
        let mut state = InputState::default();
        for i in 0..60 {
            state.buffer = format!("cmd{i}");
            state.cursor_pos = state.buffer.len();
            state.submit();
        }
        assert_eq!(state.history_len(), MAX_HISTORY);
    }

    #[test]
    fn test_history_up_down() {
        let mut state = InputState::default();
        state.insert_char('a');
        state.submit();
        state.insert_char('b');
        state.submit();
        state.insert_char('c');
        state.submit();

        // Type something new, then navigate up
        state.insert_char('d');
        state.history_up();
        assert_eq!(state.buffer, "c");
        state.history_up();
        assert_eq!(state.buffer, "b");
        state.history_up();
        assert_eq!(state.buffer, "a");
        state.history_up(); // at oldest, should stay
        assert_eq!(state.buffer, "a");

        // Navigate back down
        state.history_down();
        assert_eq!(state.buffer, "b");
        state.history_down();
        assert_eq!(state.buffer, "c");
        state.history_down(); // past newest → restore draft
        assert_eq!(state.buffer, "d");
        state.history_down(); // not browsing, no-op
        assert_eq!(state.buffer, "d");
    }

    #[test]
    fn test_history_up_empty() {
        let mut state = InputState::default();
        state.history_up(); // no history, should be no-op
        assert!(state.buffer.is_empty());
    }

    #[test]
    fn test_is_command() {
        let mut state = InputState::default();
        assert!(!state.is_command());

        state.insert_char('/');
        assert!(state.is_command());

        state.insert_char('b');
        assert!(state.is_command());

        state.clear();
        state.insert_char('h');
        assert!(!state.is_command());
    }

    #[test]
    fn test_default_mode_is_insert() {
        let state = InputState::default();
        assert_eq!(state.mode, VimMode::Insert);
    }

    #[test]
    fn test_enter_normal_mode() {
        let mut state = InputState::default();
        assert_eq!(state.mode, VimMode::Insert);
        state.enter_normal_mode();
        assert_eq!(state.mode, VimMode::Normal);
    }

    #[test]
    fn test_enter_insert_mode() {
        let mut state = InputState::default();
        state.enter_normal_mode();
        state.enter_insert_mode();
        assert_eq!(state.mode, VimMode::Insert);
    }

    #[test]
    fn test_enter_insert_mode_append() {
        let mut state = InputState::default();
        state.insert_char('a');
        state.insert_char('b');
        state.move_cursor_left(); // cursor before 'b'
        state.enter_normal_mode();
        state.enter_insert_mode_append();
        assert_eq!(state.mode, VimMode::Insert);
        assert_eq!(state.cursor_pos, state.buffer.len());
    }

    #[test]
    fn test_mode_label() {
        assert_eq!(VimMode::Normal.label(), "NORMAL");
        assert_eq!(VimMode::Insert.label(), "INSERT");
    }

    #[test]
    fn test_chord_lifecycle() {
        let mut state = InputState::default();
        state.enter_normal_mode();

        // No active chord initially
        assert!(!state.has_active_chord());

        // Start chord
        state.start_chord('g');
        assert!(state.has_active_chord());
        assert_eq!(
            state.pending_chord.as_ref().unwrap().hint(),
            "g_"
        );

        // Cancel chord
        state.cancel_chord();
        assert!(!state.has_active_chord());
    }

    #[test]
    fn test_enter_mode_cancels_chord() {
        let mut state = InputState::default();
        state.enter_normal_mode();
        state.start_chord('g');
        assert!(state.has_active_chord());

        state.enter_insert_mode();
        assert!(state.pending_chord.is_none());
    }

    #[test]
    fn test_vim_mode_default_impl() {
        let mode = VimMode::default();
        assert_eq!(mode, VimMode::Insert);
    }
}
