use std::collections::HashMap;
use std::time::{Duration, Instant};

use color_eyre::eyre::Result;
use crossterm::event::{self, Event, KeyCode, KeyEventKind, KeyModifiers};
use ratatui::{backend::Backend, Terminal};
use tokio::sync::mpsc;

use crate::chart::ohlcv::{Ohlcv, OhlcvBuffer};
use crate::input::{InputState, VimMode};
use crate::ipc::client::IpcClient;
use crate::ipc::messages::BackendMessage;
use crate::sprites::{AnimationState, EmotionStateMachine};
use crate::sprites::SpriteLoader;
use crate::state::{
    AppState, ChatMessage, MessageStore, PendingTool, Role, Severity,
    SpeechBubble, SpeechBubbleQueue, Timeframe, ToolPermission,
};
use crate::terminal_caps::TerminalGrade;
use crate::ui;

/// Core application state.
pub struct App {
    /// Whether the app is still running.
    pub running: bool,
    /// Target frame duration (16ms ~ 60fps).
    pub tick_rate: Duration,
    /// Detected terminal capability grade (A/B/C) — used for rendering degradation.
    #[allow(dead_code)]
    pub terminal_grade: TerminalGrade,
    /// IPC client handle for sending messages to the Node.js backend.
    #[allow(dead_code)]
    pub ipc: Option<IpcClient>,
    /// Receiver for backend messages from the IPC task.
    pub ipc_rx: Option<mpsc::Receiver<BackendMessage>>,
    /// Status text shown in the UI (reflects IPC connection state).
    pub status: String,
    /// Last stream chunk text received from the backend.
    pub last_stream_text: String,
    /// Trading state populated from IPC messages.
    pub state: AppState,
    /// Chat message store for the chat panel.
    pub messages: MessageStore,
    /// Input bar state (buffer, cursor, history).
    pub input: InputState,
    /// Boot instant for cursor blink timing.
    pub boot: Instant,
    /// Pending tool calls indexed by tool call ID.
    pub pending_tools: HashMap<String, PendingTool>,
    /// Tool permission prompt state (Some when awaiting y/n).
    pub tool_permission_pending: Option<ToolPermission>,
    /// Spinner animation tick counter (incremented each frame).
    pub spinner_tick: usize,
    /// Emotion state machine: maps IPC events to sprite emotions.
    pub emotion: EmotionStateMachine,
    /// Animation state: breathing, blink, crossfade timing.
    pub animation: AnimationState,
/// OHLCV candle buffer for the Braille chart.
    pub ohlcv_buffer: OhlcvBuffer,
/// Speech bubble queue for the companion pane.
    pub speech_bubbles: SpeechBubbleQueue,
    /// Sprite loader with cache (used when master_id is set).
    #[allow(dead_code)]
    pub sprite_loader: SpriteLoader,
}

impl App {
    /// Create a new App, optionally wired to an IPC client.
    pub fn new(
        ipc: Option<IpcClient>,
        ipc_rx: Option<mpsc::Receiver<BackendMessage>>,
        grade: TerminalGrade,
    ) -> Self {
        let connected = ipc.is_some();
        let status = if connected {
            "IPC: connecting...".to_string()
        } else {
            "IPC: no socket (VIBE_SENSEI_SOCK not set)".to_string()
        };

        let state = AppState {
            connected,
            ..AppState::default()
        };

        Self {
            running: true,
            tick_rate: Duration::from_millis(16),
            terminal_grade: grade,
            ipc,
            ipc_rx,
            status,
            last_stream_text: String::new(),
            state,
            messages: MessageStore::default(),
            input: InputState::default(),
            boot: Instant::now(),
            pending_tools: HashMap::new(),
            tool_permission_pending: None,
            spinner_tick: 0,
            emotion: EmotionStateMachine::new(),
            animation: AnimationState::default(),
ohlcv_buffer: OhlcvBuffer::new(500),
speech_bubbles: SpeechBubbleQueue::default(),
            sprite_loader: SpriteLoader::new(
                std::env::current_dir().unwrap_or_default(),
            ),
        }
    }

    /// Run the main event loop: draw, poll events, drain IPC messages.
    pub async fn run<B: Backend>(
        &mut self,
        terminal: &mut Terminal<B>,
    ) -> Result<()> {
        let mut last_tick = Instant::now();

        while self.running {
            terminal.draw(|frame| ui::render(frame, self))?;

            // Drain any pending IPC messages (non-blocking)
            self.drain_ipc_messages();

            let timeout = self.tick_rate.saturating_sub(last_tick.elapsed());

            if event::poll(timeout)? {
                if let Event::Key(key) = event::read()? {
                    if key.kind == KeyEventKind::Press {
                        self.handle_key(key.code, key.modifiers).await;
                    }
                }
            }

            if last_tick.elapsed() >= self.tick_rate {
                let dt = last_tick.elapsed();
                self.spinner_tick = self.spinner_tick.wrapping_add(1);
                self.emotion.tick(dt);
                self.animation.tick(dt);
                self.speech_bubbles.prune_expired();
                last_tick = Instant::now();
            }
        }

        Ok(())
    }

    /// Handle key events: permission prompt takes priority, then vim mode dispatch.
    async fn handle_key(&mut self, code: KeyCode, modifiers: KeyModifiers) {
        // Ctrl+C always quits regardless of mode
        if modifiers.contains(KeyModifiers::CONTROL) && code == KeyCode::Char('c')
        {
            self.running = false;
            return;
        }

        // Permission prompt takes focus when active (highest priority)
        if self.tool_permission_pending.is_some() {
            match code {
                KeyCode::Char('y') | KeyCode::Char('Y') => {
                    self.resolve_permission(true).await;
                }
                KeyCode::Char('n') | KeyCode::Char('N') => {
                    self.resolve_permission(false).await;
                }
                KeyCode::Esc => {
                    self.resolve_permission(false).await;
                }
                _ => {}
            }
            return;
        }

        // Dispatch based on current vim mode
        match self.input.mode {
            VimMode::Normal => self.handle_normal_key(code, modifiers).await,
            VimMode::Insert => self.handle_insert_key(code, modifiers).await,
        }
    }

    /// Handle keys in Normal mode: navigation, scrolling, mode transitions.
    async fn handle_normal_key(
        &mut self,
        code: KeyCode,
        modifiers: KeyModifiers,
    ) {
        // Check for pending chord first
        if self.input.has_active_chord() {
            self.handle_chord_second_key(code);
            return;
        }

        // Clear any expired chord
        if self.input.pending_chord.is_some() {
            self.input.cancel_chord();
        }

        // Ctrl+key combos in Normal mode
        if modifiers.contains(KeyModifiers::CONTROL) {
            match code {
                KeyCode::Char('b') => {
                    // Page up (Ctrl+B)
                    self.messages.scroll_up(10);
                }
                KeyCode::Char('f') => {
                    // Page down (Ctrl+F)
                    self.messages.scroll_down(10);
                }
                KeyCode::Char('w') => {
                    // Cycle panel focus (reserved for future use)
                }
                _ => {}
            }
            return;
        }

        match code {
            // Navigation
            KeyCode::Char('j') => self.messages.scroll_down(1),
            KeyCode::Char('k') => self.messages.scroll_up(1),
            KeyCode::Char('G') => self.scroll_to_bottom(),
            KeyCode::Char('g') => {
                // Start chord: wait for second key
                self.input.start_chord('g');
            }

            // Mode transitions
            KeyCode::Char('i') => self.input.enter_insert_mode(),
            KeyCode::Char('a') => self.input.enter_insert_mode_append(),
            KeyCode::Char('/') => {
                // Enter insert mode with "/" prefilled for search/command
                self.input.enter_insert_mode();
                self.input.insert_char('/');
            }

            // Quit
            KeyCode::Char('q') => {
                self.running = false;
            }

            // Timeframe switching (1-7 in Normal mode)
            KeyCode::Char(c @ '1'..='7') => {
                let key = (c as u8) - b'0';
                if let Some(tf) = Timeframe::from_key(key) {
                    self.state.active_timeframe = tf;
                }
            }

            // Arrow keys still work in Normal mode
            KeyCode::Up => self.messages.scroll_up(1),
            KeyCode::Down => self.messages.scroll_down(1),
            KeyCode::PageUp => self.messages.scroll_up(10),
            KeyCode::PageDown => self.messages.scroll_down(10),

            _ => {}
        }
    }

    /// Handle the second key of a chord sequence (e.g. "gg" for top).
    fn handle_chord_second_key(&mut self, code: KeyCode) {
        let chord_key = self
            .input
            .pending_chord
            .as_ref()
            .map(|c| c.key);
        self.input.cancel_chord();

        if let Some('g') = chord_key {
            if let KeyCode::Char('g') = code {
                // "gg" — scroll to top
                self.scroll_to_top();
            }
            // Any other key after 'g' just cancels the chord
        }
    }

    /// Handle keys in Insert mode: text input, editing, mode transitions.
    async fn handle_insert_key(
        &mut self,
        code: KeyCode,
        modifiers: KeyModifiers,
    ) {
        // Ctrl+key combos in Insert mode
        if modifiers.contains(KeyModifiers::CONTROL) {
            match code {
                KeyCode::Char('b') => self.messages.scroll_up(10),
                KeyCode::Char('f') => self.messages.scroll_down(10),
                _ => {}
            }
            return;
        }

        match code {
            KeyCode::Enter => self.submit_input().await,
            KeyCode::Backspace => self.input.delete_char(),
            KeyCode::Left => self.input.move_cursor_left(),
            KeyCode::Right => self.input.move_cursor_right(),
            KeyCode::Up => self.input.history_up(),
            KeyCode::Down => self.input.history_down(),
            KeyCode::PageUp => self.messages.scroll_up(5),
            KeyCode::PageDown => self.messages.scroll_down(5),
            KeyCode::Esc => self.input.enter_normal_mode(),
            KeyCode::Char(ch) => self.input.insert_char(ch),
            _ => {}
        }
    }

    /// Scroll the chat to the very top (oldest messages).
    fn scroll_to_top(&mut self) {
        let max = self.messages.messages.len().saturating_sub(1);
        self.messages.scroll_offset = max;
        if max > 0 {
            self.messages.auto_scroll = false;
        }
    }

    /// Scroll the chat to the very bottom (latest messages).
    fn scroll_to_bottom(&mut self) {
        self.messages.scroll_offset = 0;
        self.messages.auto_scroll = true;
    }

    /// Submit the current input: send over IPC, add as user message,
    /// push to history.
    async fn submit_input(&mut self) {
        let text = self.input.submit();
        if text.is_empty() {
            return;
        }

        // Add as a user message in the chat panel
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        self.messages
            .push(ChatMessage::new(Role::User, text.clone(), ts));

        // Send over IPC if connected
        if let Some(ipc) = &self.ipc {
            if let Err(e) = ipc.send_user_input(text).await {
                tracing::warn!("Failed to send user input: {e}");
            }
        }
    }

    /// Resolve a tool permission prompt by sending ToolApproval over IPC.
    async fn resolve_permission(&mut self, allow: bool) {
        if let Some(perm) = self.tool_permission_pending.take() {
            if let Some(ipc) = self.ipc.as_ref() {
                let _ = ipc
                    .send_tool_approval(perm.id.clone(), allow)
                    .await;
            }
            let action = if allow { "allowed" } else { "denied" };
            let content = format!("Tool {} {action}", perm.name);
            self.messages.push(ChatMessage::new(
                Role::System,
                content,
                0,
            ));
        }
    }

    /// Drain all pending messages from the IPC receiver without blocking.
    fn drain_ipc_messages(&mut self) {
        // Collect messages first to avoid overlapping borrows.
        let mut messages = Vec::new();
        let mut disconnected = false;

        if let Some(rx) = self.ipc_rx.as_mut() {
            loop {
                match rx.try_recv() {
                    Ok(msg) => messages.push(msg),
                    Err(mpsc::error::TryRecvError::Empty) => break,
                    Err(mpsc::error::TryRecvError::Disconnected) => {
                        disconnected = true;
                        break;
                    }
                }
            }
        }

        for msg in messages {
            self.process_backend_message(msg);
        }

        if disconnected {
            self.status = "IPC: disconnected".to_string();
            self.state.connected = false;
            self.state.last_message_type = "Disconnected".to_string();
            self.ipc_rx = None;
        }
    }

    /// Process a single backend message. Updates app state accordingly.
    fn process_backend_message(&mut self, msg: BackendMessage) {
        // Mark connected on any received message
        self.state.connected = true;

        match msg {
            BackendMessage::StreamChunk {
                ref text,
                timestamp,
            } => {
                self.last_stream_text.push_str(text);
                self.status = "IPC: streaming...".to_string();
                self.state.last_message_type = "StreamChunk".to_string();
                self.accumulate_stream_chunk(text, timestamp);
            }
            BackendMessage::ToolCallStart {
                ref id,
                ref name,
                timestamp,
                ..
            } => {
                self.finalize_streaming();
                self.status = format!("IPC: tool {name}...");
                self.state.last_message_type = "ToolCallStart".to_string();

                // Track the pending tool
                let pending = PendingTool {
                    id: id.clone(),
                    name: name.clone(),
                    input_summary: String::new(),
                    output: None,
                    is_error: false,
                };
                self.pending_tools.insert(id.clone(), pending);

                // Add a tool-call message to the chat stream
                let ts = timestamp as u64;
                self.messages
                    .push(ChatMessage::tool_call(id.clone(), name.clone(), ts));
            }
            BackendMessage::ToolCallEnd {
                ref id,
                ref output,
                is_error,
                timestamp,
            } => {
                self.status = "IPC: connected".to_string();
                self.state.last_message_type = "ToolCallEnd".to_string();

                // Update the pending tool with result
                if let Some(tool) = self.pending_tools.get_mut(id) {
                    tool.output = Some(output.clone());
                    tool.is_error = is_error;
                }

                // Update the corresponding tool-call message in chat
                let ts = timestamp as u64;
                self.update_tool_message(id, output, is_error, ts);

                // Dismiss permission prompt if it was for this tool
                if let Some(ref perm) = self.tool_permission_pending {
                    if perm.id == *id {
                        self.tool_permission_pending = None;
                    }
                }
            }
            BackendMessage::GuardianAlert {
                ref master_name,
                ref severity,
                ref message,
                timestamp,
                ..
            } => {
                self.finalize_streaming();
                self.status =
                    format!("IPC: alert from {master_name} [{severity}]");
                self.state.last_message_type = "GuardianAlert".to_string();

                // Update emotion state machine based on alert severity
                self.emotion.on_guardian_alert(severity);

                let sev = Severity::from_str(severity);
                let ts = timestamp as u64;
                self.messages.push(ChatMessage::guardian_alert(
                    master_name.clone(),
                    String::new(), // archetype not in IPC message
                    message.clone(),
                    ts,
                    sev,
                ));

                // Push to speech bubble queue for companion pane
                self.speech_bubbles.push(
                    SpeechBubble::new(message.clone(), sev),
                );
            }
            BackendMessage::DebateStart { ref topic, .. } => {
                self.finalize_streaming();
                self.status = format!("IPC: debate on {topic}");
                self.state.last_message_type = "DebateStart".to_string();
            }
            BackendMessage::GhostWarning {
                ref ghost_name, ..
            } => {
                self.finalize_streaming();
                self.status = format!("IPC: ghost {ghost_name}");
                self.state.last_message_type = "GhostWarning".to_string();
            }
            BackendMessage::BalanceUpdate {
                ref balances, ..
            } => {
                self.status = "IPC: balance updated".to_string();
                self.state.last_message_type = "BalanceUpdate".to_string();

                // Compute total balance across all currencies and
                // update emotion state machine (profit -> Happy).
                let total: f64 = balances.iter().map(|b| b.total).sum();
                self.emotion.on_balance_update(total);
                self.state.balance_total = total;
            }
            BackendMessage::PriceUpdate {
                ref symbol,
                ref ohlcv,
                timestamp,
            } => {
                self.status = format!("IPC: price {symbol}");
                self.state.last_message_type = "PriceUpdate".to_string();

                // Update chart symbol
                self.state.chart_symbol = symbol.clone();

                // Track previous close for change% calculation
                self.state.prev_close = self.state.last_price;
                self.state.last_price = Some(ohlcv.close);

                // Push candle into ring buffer
                let candle = Ohlcv {
                    time: timestamp as u64,
                    open: ohlcv.open,
                    high: ohlcv.high,
                    low: ohlcv.low,
                    close: ohlcv.close,
                    volume: ohlcv.volume,
                };
                self.ohlcv_buffer.push(candle);
            }
            BackendMessage::StateSync { .. } => {
                // StateSync carries fullState as an opaque HashMap.
                // Future sprints will deserialize specific fields; for now
                // we mark the sync and update the status.
                self.status = "IPC: state synced".to_string();
                self.state.last_message_type = "StateSync".to_string();
            }
            BackendMessage::Heartbeat => {
                // Heartbeats are handled automatically by IpcClient.
                // Should not reach here, but harmless if they do.
            }
        }
    }

    /// Accumulate a StreamChunk into the current assistant message.
    ///
    /// If the last message is a streaming assistant message, append text.
    /// Otherwise, create a new streaming assistant message.
    fn accumulate_stream_chunk(&mut self, text: &str, timestamp: f64) {
        let ts = timestamp as u64;
        if self.messages.is_streaming() {
            if let Some(last) = self.messages.last_mut() {
                last.content.push_str(text);
            }
        } else {
            let mut msg = ChatMessage::new(Role::Assistant, text.to_string(), ts);
            msg.streaming = true;
            self.messages.push(msg);
        }
    }

    /// Update a tool-call message in the chat stream with its result.
    fn update_tool_message(
        &mut self,
        id: &str,
        _output: &str,
        _is_error: bool,
        _timestamp: u64,
    ) {
        // Find the tool-call message by ID and mark it as no longer pending
        // (the actual rendering reads from pending_tools HashMap)
        for msg in self.messages.messages.iter_mut().rev() {
            if msg.role == Role::ToolCall {
                if let Some(ref tc_id) = msg.tool_call_id {
                    if tc_id == id {
                        // Mark done — rendering will pick up output from pending_tools
                        break;
                    }
                }
            }
        }
    }

    /// Finalize any in-progress streaming message (mark streaming = false).
    fn finalize_streaming(&mut self) {
        if self.messages.is_streaming() {
            if let Some(last) = self.messages.last_mut() {
                last.streaming = false;
            }
        }
    }
}
