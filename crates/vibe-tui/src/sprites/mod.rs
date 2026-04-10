//! Sprite loading, caching, atlas mapping, and HalfBlock rendering for guardian portraits.
//!
//! This module provides:
//! - [`atlas`]: Maps `(master_id, emotion)` to sprite file paths with fallback chain.
//! - [`loader`]: Lazy-cached sprite loading with resize support.
//! - [`renderer`]: `SpriteWidget` for ratatui rendering via unicode half-block characters.
//! - [`emotion`]: Emotion state machine mapping IPC events to sprite emotions.
//! - [`animation`]: Animation state (breathing, blink, crossfade timing).

pub mod animation;
pub mod atlas;
pub mod emotion;
pub mod loader;
pub mod renderer;

pub use animation::AnimationState;
pub use emotion::EmotionStateMachine;
pub use loader::SpriteLoader;
pub use renderer::SpriteWidget;
