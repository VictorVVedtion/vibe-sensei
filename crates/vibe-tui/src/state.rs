use std::collections::VecDeque;
use std::time::Instant;

/// Guardian rarity tier — determines star count and name color.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub enum Rarity {
    Common,
    Uncommon,
    Rare,
    Epic,
    Legendary,
}

#[allow(dead_code)]
impl Rarity {
    /// Number of stars (★) to display for this rarity.
    pub fn stars(&self) -> u8 {
        match self {
            Rarity::Common => 1,
            Rarity::Uncommon => 2,
            Rarity::Rare => 3,
            Rarity::Epic => 4,
            Rarity::Legendary => 5,
        }
    }

    /// Parse rarity from an IPC string.
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "legendary" => Rarity::Legendary,
            "epic" => Rarity::Epic,
            "rare" => Rarity::Rare,
            "uncommon" => Rarity::Uncommon,
            _ => Rarity::Common,
        }
    }
}

/// A speech bubble queued for display in the companion pane.
#[derive(Debug, Clone)]
pub struct SpeechBubble {
    /// The text content of the bubble.
    pub text: String,
    /// Severity for border/text color.
    pub severity: Severity,
    /// When the bubble was created (for auto-dismiss timing).
    pub created_at: Instant,
    /// Auto-dismiss duration in seconds.
    pub dismiss_secs: f64,
}

impl SpeechBubble {
    /// Create a new speech bubble with default 8s auto-dismiss.
    pub fn new(text: String, severity: Severity) -> Self {
        Self {
            text,
            severity,
            created_at: Instant::now(),
            dismiss_secs: 8.0,
        }
    }

    /// Whether this bubble has expired and should be dismissed.
    pub fn is_expired(&self) -> bool {
        self.created_at.elapsed().as_secs_f64() >= self.dismiss_secs
    }
}

/// FIFO speech bubble queue with max capacity.
#[derive(Debug)]
pub struct SpeechBubbleQueue {
    /// Queued bubbles, front = oldest.
    pub bubbles: VecDeque<SpeechBubble>,
    /// Maximum number of bubbles to keep.
    pub max_size: usize,
}

impl Default for SpeechBubbleQueue {
    fn default() -> Self {
        Self {
            bubbles: VecDeque::new(),
            max_size: 3,
        }
    }
}

impl SpeechBubbleQueue {
    /// Push a new bubble, evicting oldest if at capacity.
    pub fn push(&mut self, bubble: SpeechBubble) {
        if self.bubbles.len() >= self.max_size {
            self.bubbles.pop_front();
        }
        self.bubbles.push_back(bubble);
    }

    /// Remove all expired bubbles.
    pub fn prune_expired(&mut self) {
        self.bubbles.retain(|b| !b.is_expired());
    }

    /// Get the most recent (front-facing) bubble, if any.
    pub fn current(&self) -> Option<&SpeechBubble> {
        self.bubbles.back()
    }

    /// Whether the queue is empty.
    pub fn is_empty(&self) -> bool {
        self.bubbles.is_empty()
    }
}

/// Message role — determines styling and alignment.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub enum Role {
    /// User messages: cyan, right-aligned with ">" prefix.
    User,
    /// Assistant messages: MATRIX_GREEN, left-aligned.
    Assistant,
    /// System messages: dim gray, centered.
    System,
    /// Guardian alerts: severity-colored, left-aligned with master prefix.
    Guardian,
    /// Tool call display — inline tree-connector format.
    ToolCall,
}

/// Guardian alert severity for color coding.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

impl Severity {
    /// Parse severity from the IPC string representation.
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "critical" | "emergency" => Self::Critical,
            "high" | "danger" => Self::High,
            "medium" | "warning" | "warn" => Self::Medium,
            _ => Self::Low,
        }
    }
}

/// A pending tool call being tracked for display.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct PendingTool {
    /// Tool call ID from the backend.
    pub id: String,
    /// Tool name (e.g. "PlaceOrder").
    pub name: String,
    /// Truncated input summary for display.
    pub input_summary: String,
    /// Output text when completed (None while pending).
    pub output: Option<String>,
    /// Whether the tool completed with an error.
    pub is_error: bool,
}

/// Tool permission state — tracks which tool is awaiting y/n approval.
#[derive(Debug, Clone)]
pub struct ToolPermission {
    /// Tool call ID awaiting approval.
    pub id: String,
    /// Tool name for display in the prompt.
    pub name: String,
}

/// A single chat message in the message history.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ChatMessage {
    /// Role determines styling and alignment.
    pub role: Role,
    /// Message text content.
    pub content: String,
    /// Unix timestamp in milliseconds from the backend.
    pub timestamp: u64,
    /// Whether this message is still being streamed (assistant only).
    pub streaming: bool,
    /// Guardian severity (only meaningful for Role::Guardian).
    pub severity: Severity,
    /// Guardian master name (only meaningful for Role::Guardian).
    pub master_name: String,
    /// Guardian archetype (only meaningful for Role::Guardian).
    pub archetype: String,
    /// Tool call ID (only meaningful for Role::ToolCall).
    pub tool_call_id: Option<String>,
}

impl ChatMessage {
    /// Create a new chat message.
    pub fn new(role: Role, content: String, timestamp: u64) -> Self {
        Self {
            role,
            content,
            timestamp,
            streaming: false,
            severity: Severity::Low,
            master_name: String::new(),
            archetype: String::new(),
            tool_call_id: None,
        }
    }

    /// Create a guardian alert message with severity.
    #[allow(dead_code)]
    pub fn guardian(content: String, timestamp: u64, severity: Severity) -> Self {
        Self {
            role: Role::Guardian,
            content,
            timestamp,
            streaming: false,
            severity,
            master_name: String::new(),
            archetype: String::new(),
            tool_call_id: None,
        }
    }

    /// Create a guardian alert message with master info and severity.
    pub fn guardian_alert(
        master_name: String,
        archetype: String,
        message: String,
        timestamp: u64,
        severity: Severity,
    ) -> Self {
        Self {
            role: Role::Guardian,
            content: message,
            timestamp,
            streaming: false,
            severity,
            master_name,
            archetype,
            tool_call_id: None,
        }
    }

    /// Create a tool call message.
    pub fn tool_call(id: String, name: String, timestamp: u64) -> Self {
        Self {
            role: Role::ToolCall,
            content: name,
            timestamp,
            streaming: false,
            severity: Severity::Low,
            master_name: String::new(),
            archetype: String::new(),
            tool_call_id: Some(id),
        }
    }
}

/// Scrollable message store for the chat panel.
#[derive(Debug)]
pub struct MessageStore {
    /// All messages in chronological order.
    pub messages: Vec<ChatMessage>,
    /// Scroll offset from the bottom (0 = at bottom / latest).
    pub scroll_offset: usize,
    /// Whether new messages should auto-scroll to bottom.
    pub auto_scroll: bool,
}

impl Default for MessageStore {
    fn default() -> Self {
        Self {
            messages: Vec::new(),
            scroll_offset: 0,
            auto_scroll: true,
        }
    }
}

impl MessageStore {
    /// Push a new message. If auto_scroll is on, keeps offset at bottom.
    pub fn push(&mut self, msg: ChatMessage) {
        self.messages.push(msg);
        if self.auto_scroll {
            self.scroll_offset = 0;
        }
    }

    /// Returns the number of messages in the store.
    #[allow(dead_code)]
    pub fn len(&self) -> usize {
        self.messages.len()
    }

    /// Returns true if there are no messages.
    pub fn is_empty(&self) -> bool {
        self.messages.is_empty()
    }

    /// Get a mutable reference to the last message, if any.
    pub fn last_mut(&mut self) -> Option<&mut ChatMessage> {
        self.messages.last_mut()
    }

    /// Get the visible slice of messages for a given viewport height.
    ///
    /// Returns (start_index, end_index) into self.messages.
    #[allow(dead_code)]
    pub fn visible_range(&self, viewport_lines: usize) -> (usize, usize) {
        if self.messages.is_empty() || viewport_lines == 0 {
            return (0, 0);
        }

        let total = self.messages.len();
        // scroll_offset is distance from bottom
        let end = total.saturating_sub(self.scroll_offset);
        let start = end.saturating_sub(viewport_lines);
        (start, end)
    }

    /// Scroll up (towards older messages).
    pub fn scroll_up(&mut self, lines: usize) {
        let max_offset = self.messages.len().saturating_sub(1);
        self.scroll_offset = (self.scroll_offset + lines).min(max_offset);
        if self.scroll_offset > 0 {
            self.auto_scroll = false;
        }
    }

    /// Scroll down (towards newer messages).
    pub fn scroll_down(&mut self, lines: usize) {
        self.scroll_offset = self.scroll_offset.saturating_sub(lines);
        if self.scroll_offset == 0 {
            self.auto_scroll = true;
        }
    }

    /// Check if the last message is a streaming assistant message.
    pub fn is_streaming(&self) -> bool {
        self.messages
            .last()
            .is_some_and(|m| m.role == Role::Assistant && m.streaming)
    }
}

/// Available chart timeframes.
///
/// Each variant has a label for display and maps to keys 1-7 in Normal mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Timeframe {
    M1,
    M5,
    M15,
    H1,
    H4,
    D1,
    W1,
}

impl Timeframe {
    /// Display label for the timeframe tab.
    pub fn label(&self) -> &'static str {
        match self {
            Self::M1 => "1m",
            Self::M5 => "5m",
            Self::M15 => "15m",
            Self::H1 => "1h",
            Self::H4 => "4h",
            Self::D1 => "1D",
            Self::W1 => "1W",
        }
    }

    /// All timeframes in order, for tab rendering.
    pub fn all() -> &'static [Timeframe] {
        &[
            Self::M1,
            Self::M5,
            Self::M15,
            Self::H1,
            Self::H4,
            Self::D1,
            Self::W1,
        ]
    }

    /// Map a 1-based key index to a timeframe.
    pub fn from_key(key: u8) -> Option<Self> {
        match key {
            1 => Some(Self::M1),
            2 => Some(Self::M5),
            3 => Some(Self::M15),
            4 => Some(Self::H1),
            5 => Some(Self::H4),
            6 => Some(Self::D1),
            7 => Some(Self::W1),
            _ => None,
        }
    }
}

/// Trading state populated from IPC BackendMessages.
///
/// Fields start with placeholder defaults and are updated as
/// messages arrive from the Node.js backend.
#[derive(Debug, Clone)]
pub struct AppState {
    /// Number of venues currently connected.
    pub venues_connected: u8,
    /// Total number of configured venues.
    pub venues_total: u8,
    /// Trading mode (e.g. "PAPER", "LIVE").
    pub mode: String,
    /// Current market regime (e.g. "TRENDING_UP", "RANGING").
    pub regime: String,
    /// Portfolio heat percentage (0.0 - 100.0).
    pub heat: f64,
    /// Portfolio concentration percentage (0.0 - 100.0).
    pub concentration: f64,
    /// Whether the IPC connection is active.
    pub connected: bool,
    /// The type name of the last received BackendMessage (for debugging).
    pub last_message_type: String,
/// Currently active chart symbol (e.g. "BTC/USDT").
    pub chart_symbol: String,
    /// Currently active chart timeframe.
    pub active_timeframe: Timeframe,
    /// Latest price received from PriceUpdate, for the chart header.
    pub last_price: Option<f64>,
    /// Previous close price for computing change%.
    pub prev_close: Option<f64>,
/// Total portfolio balance in USD.
    pub balance_total: f64,
    /// Unrealized P&L percentage.
    pub pnl_percent: f64,
    /// Assigned master guardian name.
    pub master_name: String,
    /// Master archetype (e.g. "The Speculator").
    pub archetype: String,
    /// Master rarity tier.
    pub rarity: Rarity,
    /// Master ID for sprite loading (used when sprite PNGs are available).
    #[allow(dead_code)]
    pub master_id: String,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            venues_connected: 0,
            venues_total: 7,
            mode: "PAPER".to_string(),
            regime: String::new(),
            heat: 0.0,
            concentration: 0.0,
            connected: false,
            last_message_type: String::new(),
chart_symbol: String::new(),
            active_timeframe: Timeframe::M5,
            last_price: None,
            prev_close: None,
balance_total: 100_000.0,
            pnl_percent: 0.0,
            master_name: String::new(),
            archetype: String::new(),
            rarity: Rarity::Common,
            master_id: String::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_state() {
        let state = AppState::default();
        assert_eq!(state.venues_connected, 0);
        assert_eq!(state.venues_total, 7);
        assert_eq!(state.mode, "PAPER");
        assert!(state.regime.is_empty());
        assert!((state.heat - 0.0).abs() < f64::EPSILON);
        assert!((state.concentration - 0.0).abs() < f64::EPSILON);
        assert!(!state.connected);
        assert!(state.last_message_type.is_empty());
        assert!((state.balance_total - 100_000.0).abs() < f64::EPSILON);
        assert!((state.pnl_percent - 0.0).abs() < f64::EPSILON);
        assert!(state.master_name.is_empty());
        assert!(state.archetype.is_empty());
        assert_eq!(state.rarity, Rarity::Common);
        assert!(state.master_id.is_empty());
    }

    #[test]
    fn test_state_clone() {
        let mut state = AppState::default();
        state.venues_connected = 3;
        state.mode = "LIVE".to_string();
        let cloned = state.clone();
        assert_eq!(cloned.venues_connected, 3);
        assert_eq!(cloned.mode, "LIVE");
    }

    #[test]
    fn test_message_store_push_and_len() {
        let mut store = MessageStore::default();
        assert!(store.is_empty());
        assert_eq!(store.len(), 0);

        store.push(ChatMessage::new(Role::User, "hello".into(), 1000));
        assert_eq!(store.len(), 1);
        assert!(!store.is_empty());

        store.push(ChatMessage::new(Role::Assistant, "hi".into(), 1001));
        assert_eq!(store.len(), 2);
    }

    #[test]
    fn test_message_store_auto_scroll() {
        let mut store = MessageStore::default();
        assert!(store.auto_scroll);
        assert_eq!(store.scroll_offset, 0);

        // Push keeps offset at 0 when auto_scroll is on
        store.push(ChatMessage::new(Role::User, "msg".into(), 1));
        assert_eq!(store.scroll_offset, 0);
        assert!(store.auto_scroll);
    }

    #[test]
    fn test_scroll_up_disables_auto_scroll() {
        let mut store = MessageStore::default();
        for i in 0..10 {
            store.push(ChatMessage::new(Role::User, format!("msg {i}"), i));
        }

        store.scroll_up(3);
        assert_eq!(store.scroll_offset, 3);
        assert!(!store.auto_scroll);
    }

    #[test]
    fn test_scroll_down_re_enables_auto_scroll() {
        let mut store = MessageStore::default();
        for i in 0..10 {
            store.push(ChatMessage::new(Role::User, format!("msg {i}"), i));
        }

        store.scroll_up(5);
        assert!(!store.auto_scroll);

        store.scroll_down(5);
        assert_eq!(store.scroll_offset, 0);
        assert!(store.auto_scroll);
    }

    #[test]
    fn test_scroll_up_clamps_to_max() {
        let mut store = MessageStore::default();
        for i in 0..5 {
            store.push(ChatMessage::new(Role::User, format!("msg {i}"), i));
        }

        // Max offset = len - 1 = 4
        store.scroll_up(100);
        assert_eq!(store.scroll_offset, 4);
    }

    #[test]
    fn test_scroll_down_clamps_to_zero() {
        let mut store = MessageStore::default();
        store.push(ChatMessage::new(Role::User, "msg".into(), 1));
        store.scroll_up(1);

        store.scroll_down(100);
        assert_eq!(store.scroll_offset, 0);
    }

    #[test]
    fn test_visible_range_empty() {
        let store = MessageStore::default();
        assert_eq!(store.visible_range(10), (0, 0));
    }

    #[test]
    fn test_visible_range_at_bottom() {
        let mut store = MessageStore::default();
        for i in 0..20 {
            store.push(ChatMessage::new(Role::User, format!("msg {i}"), i));
        }

        // At bottom (offset 0), viewport 10 → see messages 10..20
        let (start, end) = store.visible_range(10);
        assert_eq!(start, 10);
        assert_eq!(end, 20);
    }

    #[test]
    fn test_visible_range_scrolled_up() {
        let mut store = MessageStore::default();
        for i in 0..20 {
            store.push(ChatMessage::new(Role::User, format!("msg {i}"), i));
        }

        store.scroll_up(5);
        // offset=5, end = 20-5 = 15, start = 15-10 = 5
        let (start, end) = store.visible_range(10);
        assert_eq!(start, 5);
        assert_eq!(end, 15);
    }

    #[test]
    fn test_visible_range_viewport_larger_than_messages() {
        let mut store = MessageStore::default();
        for i in 0..3 {
            store.push(ChatMessage::new(Role::User, format!("msg {i}"), i));
        }

        let (start, end) = store.visible_range(100);
        assert_eq!(start, 0);
        assert_eq!(end, 3);
    }

    #[test]
    fn test_is_streaming() {
        let mut store = MessageStore::default();
        assert!(!store.is_streaming());

        store.push(ChatMessage::new(Role::User, "hi".into(), 1));
        assert!(!store.is_streaming());

        let mut assistant_msg =
            ChatMessage::new(Role::Assistant, String::new(), 2);
        assistant_msg.streaming = true;
        store.push(assistant_msg);
        assert!(store.is_streaming());
    }

    #[test]
    fn test_guardian_message_severity() {
        let msg = ChatMessage::guardian(
            "Position too large!".into(),
            100,
            Severity::High,
        );
        assert_eq!(msg.role, Role::Guardian);
        assert_eq!(msg.severity, Severity::High);
        assert!(!msg.streaming);
    }

    #[test]
    fn test_severity_from_str() {
        assert_eq!(Severity::from_str("critical"), Severity::Critical);
        assert_eq!(Severity::from_str("CRITICAL"), Severity::Critical);
        assert_eq!(Severity::from_str("emergency"), Severity::Critical);
        assert_eq!(Severity::from_str("high"), Severity::High);
        assert_eq!(Severity::from_str("danger"), Severity::High);
        assert_eq!(Severity::from_str("medium"), Severity::Medium);
        assert_eq!(Severity::from_str("warning"), Severity::Medium);
        assert_eq!(Severity::from_str("warn"), Severity::Medium);
        assert_eq!(Severity::from_str("low"), Severity::Low);
        assert_eq!(Severity::from_str("info"), Severity::Low);
        assert_eq!(Severity::from_str("unknown"), Severity::Low);
    }

    #[test]
fn test_timeframe_labels() {
        assert_eq!(Timeframe::M1.label(), "1m");
        assert_eq!(Timeframe::M5.label(), "5m");
        assert_eq!(Timeframe::M15.label(), "15m");
        assert_eq!(Timeframe::H1.label(), "1h");
        assert_eq!(Timeframe::H4.label(), "4h");
        assert_eq!(Timeframe::D1.label(), "1D");
        assert_eq!(Timeframe::W1.label(), "1W");
    }

    #[test]
    fn test_timeframe_all() {
        let all = Timeframe::all();
        assert_eq!(all.len(), 7);
        assert_eq!(all[0], Timeframe::M1);
        assert_eq!(all[6], Timeframe::W1);
    }

    #[test]
    fn test_timeframe_from_key() {
        assert_eq!(Timeframe::from_key(1), Some(Timeframe::M1));
        assert_eq!(Timeframe::from_key(4), Some(Timeframe::H1));
        assert_eq!(Timeframe::from_key(7), Some(Timeframe::W1));
        assert_eq!(Timeframe::from_key(0), None);
        assert_eq!(Timeframe::from_key(8), None);
    }

    #[test]
    fn test_default_state_chart_fields() {
        let state = AppState::default();
        assert!(state.chart_symbol.is_empty());
        assert_eq!(state.active_timeframe, Timeframe::M5);
        assert!(state.last_price.is_none());
        assert!(state.prev_close.is_none());
    }

    #[test]
    fn test_rarity_stars() {
        assert_eq!(Rarity::Common.stars(), 1);
        assert_eq!(Rarity::Uncommon.stars(), 2);
        assert_eq!(Rarity::Rare.stars(), 3);
        assert_eq!(Rarity::Epic.stars(), 4);
        assert_eq!(Rarity::Legendary.stars(), 5);
    }

    #[test]
    fn test_rarity_from_str() {
        assert_eq!(Rarity::from_str("legendary"), Rarity::Legendary);
        assert_eq!(Rarity::from_str("LEGENDARY"), Rarity::Legendary);
        assert_eq!(Rarity::from_str("epic"), Rarity::Epic);
        assert_eq!(Rarity::from_str("rare"), Rarity::Rare);
        assert_eq!(Rarity::from_str("uncommon"), Rarity::Uncommon);
        assert_eq!(Rarity::from_str("common"), Rarity::Common);
        assert_eq!(Rarity::from_str("unknown"), Rarity::Common);
    }

    #[test]
    fn test_speech_bubble_new() {
        let bubble = SpeechBubble::new(
            "Position too large!".into(),
            Severity::High,
        );
        assert_eq!(bubble.text, "Position too large!");
        assert_eq!(bubble.severity, Severity::High);
        assert!((bubble.dismiss_secs - 8.0).abs() < f64::EPSILON);
        assert!(!bubble.is_expired());
    }

    #[test]
    fn test_speech_bubble_queue_push_and_max() {
        let mut queue = SpeechBubbleQueue::default();
        assert!(queue.is_empty());
        assert_eq!(queue.max_size, 3);

        queue.push(SpeechBubble::new("msg1".into(), Severity::Low));
        queue.push(SpeechBubble::new("msg2".into(), Severity::Medium));
        queue.push(SpeechBubble::new("msg3".into(), Severity::High));
        assert_eq!(queue.bubbles.len(), 3);

        // 4th push evicts oldest
        queue.push(SpeechBubble::new("msg4".into(), Severity::Critical));
        assert_eq!(queue.bubbles.len(), 3);
        assert_eq!(queue.current().unwrap().text, "msg4");
        // Oldest should be msg2 now (msg1 was evicted)
        assert_eq!(queue.bubbles.front().unwrap().text, "msg2");
    }

    #[test]
    fn test_speech_bubble_queue_prune_expired() {
        let mut queue = SpeechBubbleQueue::default();
        let mut expired = SpeechBubble::new("old".into(), Severity::Low);
        expired.dismiss_secs = 0.0; // instant expiry
        // Small delay not needed — dismiss_secs=0 means created_at.elapsed() >= 0.0 is always true
        queue.push(expired);
        queue.push(SpeechBubble::new("fresh".into(), Severity::Medium));

        queue.prune_expired();
        assert_eq!(queue.bubbles.len(), 1);
        assert_eq!(queue.current().unwrap().text, "fresh");
    }
}
