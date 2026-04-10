//! Emotion state machine: maps IPC events to sprite emotions with crossfade transitions.
//!
//! The state machine tracks `current_emotion` and `target_emotion`. When a new
//! event arrives, `target_emotion` is updated. Each `tick()` call advances
//! `transition_progress` linearly from 0.0 to 1.0 over `CROSSFADE_DURATION_MS`.
//! When progress reaches 1.0, `current_emotion` snaps to `target_emotion`.
//!
//! Idle timeout: if no event arrives within `IDLE_TIMEOUT_SECS`, the target
//! emotion transitions to `Idle`.

use std::time::{Duration, Instant};

use super::atlas::Emotion;

/// Duration of the crossfade transition in milliseconds.
const CROSSFADE_DURATION_MS: f64 = 500.0;

/// Seconds of inactivity before returning to Idle.
const IDLE_TIMEOUT_SECS: u64 = 30;

/// Manages emotion state transitions driven by IPC events.
#[derive(Debug)]
pub struct EmotionStateMachine {
    /// The emotion currently being displayed (source of crossfade).
    current_emotion: Emotion,
    /// The target emotion being transitioned to.
    target_emotion: Emotion,
    /// Crossfade progress from 0.0 (fully current) to 1.0 (fully target).
    transition_progress: f64,
    /// Timestamp of the last event that changed the target emotion.
    last_event_time: Instant,
    /// Previous total balance for BalanceUpdate comparison.
    previous_total_balance: f64,
    /// Whether the idle timeout has already fired (prevents re-triggering).
    idle_triggered: bool,
}

impl EmotionStateMachine {
    /// Create a new state machine starting at Idle.
    pub fn new() -> Self {
        Self {
            current_emotion: Emotion::Idle,
            target_emotion: Emotion::Idle,
            transition_progress: 1.0,
            last_event_time: Instant::now(),
            previous_total_balance: 0.0,
            idle_triggered: false,
        }
    }

    /// The emotion currently being displayed.
    pub fn current_emotion(&self) -> Emotion {
        self.current_emotion
    }

    /// The emotion being transitioned to.
    pub fn target_emotion(&self) -> Emotion {
        self.target_emotion
    }

    /// Crossfade progress: 0.0 = fully current, 1.0 = fully target.
    pub fn transition_progress(&self) -> f64 {
        self.transition_progress
    }

    /// Whether a crossfade transition is currently in progress.
    pub fn is_transitioning(&self) -> bool {
        self.transition_progress < 1.0
    }

    /// The instant of the last emotion-changing event.
    pub fn last_event_time(&self) -> Instant {
        self.last_event_time
    }

    /// Advance the state machine by `dt` (frame delta time).
    ///
    /// This handles:
    /// 1. Crossfade progress advancement
    /// 2. Idle timeout detection
    pub fn tick(&mut self, dt: Duration) {
        // Advance crossfade
        if self.transition_progress < 1.0 {
            let dt_ms = dt.as_secs_f64() * 1000.0;
            self.transition_progress =
                (self.transition_progress + dt_ms / CROSSFADE_DURATION_MS).min(1.0);

            if self.transition_progress >= 1.0 {
                self.current_emotion = self.target_emotion;
            }
        }

        // Check idle timeout
        if !self.idle_triggered
            && self.target_emotion != Emotion::Idle
            && self.last_event_time.elapsed()
                >= Duration::from_secs(IDLE_TIMEOUT_SECS)
        {
            self.idle_triggered = true;
            self.set_target(Emotion::Idle);
        }
    }

    /// Process a GuardianAlert severity string and update the emotion.
    ///
    /// Mapping:
    /// - "info" | "low" -> Active
    /// - "warning" | "medium" -> Alert
    /// - "critical" | "high" -> Worried
    /// - "emergency" -> Worried
    pub fn on_guardian_alert(&mut self, severity: &str) {
        let emotion = match severity.to_lowercase().as_str() {
            "info" | "low" => Emotion::Active,
            "warning" | "medium" | "warn" => Emotion::Alert,
            "critical" | "high" | "danger" => Emotion::Worried,
            "emergency" => Emotion::Worried,
            _ => Emotion::Active,
        };
        self.set_target(emotion);
    }

    /// Process a BalanceUpdate: compare total with previous balance.
    ///
    /// If total > previous_total -> Happy.
    /// The previous total is updated on every call.
    pub fn on_balance_update(&mut self, total: f64) {
        if self.previous_total_balance > 0.0 && total > self.previous_total_balance {
            self.set_target(Emotion::Happy);
        }
        self.previous_total_balance = total;
    }

    /// Set the target emotion and reset transition progress.
    fn set_target(&mut self, emotion: Emotion) {
        if emotion != self.target_emotion || self.transition_progress >= 1.0 {
            // Only reset crossfade if target actually changed,
            // or if the previous transition finished.
            if emotion != self.current_emotion {
                self.transition_progress = 0.0;
            }
            self.target_emotion = emotion;
        }
        self.last_event_time = Instant::now();
        self.idle_triggered = false;
    }
}

impl Default for EmotionStateMachine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starts_at_idle() {
        let sm = EmotionStateMachine::new();
        assert_eq!(sm.current_emotion(), Emotion::Idle);
        assert_eq!(sm.target_emotion(), Emotion::Idle);
        assert!(!sm.is_transitioning());
    }

    #[test]
    fn guardian_alert_info_sets_active() {
        let mut sm = EmotionStateMachine::new();
        sm.on_guardian_alert("info");
        assert_eq!(sm.target_emotion(), Emotion::Active);
        assert!(sm.is_transitioning());
    }

    #[test]
    fn guardian_alert_low_sets_active() {
        let mut sm = EmotionStateMachine::new();
        sm.on_guardian_alert("low");
        assert_eq!(sm.target_emotion(), Emotion::Active);
    }

    #[test]
    fn guardian_alert_warning_sets_alert() {
        let mut sm = EmotionStateMachine::new();
        sm.on_guardian_alert("warning");
        assert_eq!(sm.target_emotion(), Emotion::Alert);
    }

    #[test]
    fn guardian_alert_medium_sets_alert() {
        let mut sm = EmotionStateMachine::new();
        sm.on_guardian_alert("medium");
        assert_eq!(sm.target_emotion(), Emotion::Alert);
    }

    #[test]
    fn guardian_alert_critical_sets_worried() {
        let mut sm = EmotionStateMachine::new();
        sm.on_guardian_alert("critical");
        assert_eq!(sm.target_emotion(), Emotion::Worried);
    }

    #[test]
    fn guardian_alert_high_sets_worried() {
        let mut sm = EmotionStateMachine::new();
        sm.on_guardian_alert("high");
        assert_eq!(sm.target_emotion(), Emotion::Worried);
    }

    #[test]
    fn guardian_alert_emergency_sets_worried() {
        let mut sm = EmotionStateMachine::new();
        sm.on_guardian_alert("emergency");
        assert_eq!(sm.target_emotion(), Emotion::Worried);
    }

    #[test]
    fn guardian_alert_unknown_defaults_to_active() {
        let mut sm = EmotionStateMachine::new();
        sm.on_guardian_alert("something_unknown");
        assert_eq!(sm.target_emotion(), Emotion::Active);
    }

    #[test]
    fn balance_update_profit_sets_happy() {
        let mut sm = EmotionStateMachine::new();
        // First call sets the baseline (no previous)
        sm.on_balance_update(100_000.0);
        assert_eq!(sm.target_emotion(), Emotion::Idle);

        // Second call with higher total -> Happy
        sm.on_balance_update(101_000.0);
        assert_eq!(sm.target_emotion(), Emotion::Happy);
    }

    #[test]
    fn balance_update_loss_does_not_change_emotion() {
        let mut sm = EmotionStateMachine::new();
        sm.on_balance_update(100_000.0);
        sm.on_balance_update(99_000.0);
        // Should remain Idle (no profit)
        assert_eq!(sm.target_emotion(), Emotion::Idle);
    }

    #[test]
    fn crossfade_advances_with_tick() {
        let mut sm = EmotionStateMachine::new();
        sm.on_guardian_alert("warning");
        assert!(sm.is_transitioning());
        assert!((sm.transition_progress() - 0.0).abs() < f64::EPSILON);

        // Tick half the crossfade duration
        sm.tick(Duration::from_millis(250));
        assert!(sm.is_transitioning());
        assert!((sm.transition_progress() - 0.5).abs() < 0.01);

        // Tick the other half
        sm.tick(Duration::from_millis(250));
        assert!(!sm.is_transitioning());
        assert_eq!(sm.current_emotion(), Emotion::Alert);
    }

    #[test]
    fn crossfade_completes_and_snaps_current() {
        let mut sm = EmotionStateMachine::new();
        sm.on_guardian_alert("critical");

        // Tick well past the crossfade duration
        sm.tick(Duration::from_millis(600));
        assert!(!sm.is_transitioning());
        assert_eq!(sm.current_emotion(), Emotion::Worried);
        assert_eq!(sm.target_emotion(), Emotion::Worried);
    }

    #[test]
    fn idle_timeout_triggers_after_30s() {
        let mut sm = EmotionStateMachine::new();
        sm.on_guardian_alert("warning");

        // Complete the transition
        sm.tick(Duration::from_millis(600));
        assert_eq!(sm.current_emotion(), Emotion::Alert);

        // Simulate 30s of inactivity by manipulating last_event_time
        sm.last_event_time = Instant::now() - Duration::from_secs(31);

        sm.tick(Duration::from_millis(16));
        assert_eq!(sm.target_emotion(), Emotion::Idle);
        assert!(sm.is_transitioning());
    }

    #[test]
    fn event_resets_idle_timeout() {
        let mut sm = EmotionStateMachine::new();
        sm.on_guardian_alert("warning");
        sm.tick(Duration::from_millis(600));

        // Move last_event_time back
        sm.last_event_time = Instant::now() - Duration::from_secs(25);

        // New event resets the timer
        sm.on_guardian_alert("info");
        assert_eq!(sm.target_emotion(), Emotion::Active);

        // Should not go idle now
        sm.tick(Duration::from_millis(16));
        assert_eq!(sm.target_emotion(), Emotion::Active);
    }

    #[test]
    fn same_target_does_not_restart_crossfade() {
        let mut sm = EmotionStateMachine::new();
        sm.on_guardian_alert("warning");
        sm.tick(Duration::from_millis(300));
        let progress_before = sm.transition_progress();

        // Same target emotion again — should not reset progress
        sm.on_guardian_alert("medium");
        assert!((sm.transition_progress() - progress_before).abs() < f64::EPSILON);
    }

    #[test]
    fn severity_case_insensitive() {
        let mut sm = EmotionStateMachine::new();
        sm.on_guardian_alert("WARNING");
        assert_eq!(sm.target_emotion(), Emotion::Alert);

        sm.on_guardian_alert("CRITICAL");
        assert_eq!(sm.target_emotion(), Emotion::Worried);

        sm.on_guardian_alert("Info");
        assert_eq!(sm.target_emotion(), Emotion::Active);
    }
}
