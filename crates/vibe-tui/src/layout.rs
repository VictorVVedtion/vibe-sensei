/// Adaptive layout modes based on terminal width.
///
/// The TUI adjusts its panel arrangement depending on how many columns
/// are available:
///
/// - `Full3Panel` (>=120 cols): market 40% | chat 35% | companion 25%
/// - `Compact2Panel` (100-119 cols): market 50% | chat 50%
/// - `MinimalChat` (<100 cols): chat 100%
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LayoutMode {
    /// 3-panel layout: market | chat | companion (>=120 cols).
    Full3Panel,
    /// 2-panel layout: market | chat (100-119 cols).
    Compact2Panel,
    /// Single chat panel (<100 cols).
    MinimalChat,
}

/// Determine the layout mode from the terminal width.
pub fn compute_layout_mode(width: u16) -> LayoutMode {
    if width >= 120 {
        LayoutMode::Full3Panel
    } else if width >= 100 {
        LayoutMode::Compact2Panel
    } else {
        LayoutMode::MinimalChat
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_minimal_chat_below_100() {
        assert_eq!(compute_layout_mode(99), LayoutMode::MinimalChat);
        assert_eq!(compute_layout_mode(80), LayoutMode::MinimalChat);
        assert_eq!(compute_layout_mode(0), LayoutMode::MinimalChat);
    }

    #[test]
    fn test_compact_2panel_at_boundary() {
        assert_eq!(compute_layout_mode(100), LayoutMode::Compact2Panel);
    }

    #[test]
    fn test_compact_2panel_in_range() {
        assert_eq!(compute_layout_mode(110), LayoutMode::Compact2Panel);
        assert_eq!(compute_layout_mode(119), LayoutMode::Compact2Panel);
    }

    #[test]
    fn test_full_3panel_at_boundary() {
        assert_eq!(compute_layout_mode(120), LayoutMode::Full3Panel);
    }

    #[test]
    fn test_full_3panel_above_boundary() {
        assert_eq!(compute_layout_mode(200), LayoutMode::Full3Panel);
        assert_eq!(compute_layout_mode(u16::MAX), LayoutMode::Full3Panel);
    }

    #[test]
    fn test_all_boundary_values() {
        // 99 -> Minimal
        assert_eq!(compute_layout_mode(99), LayoutMode::MinimalChat);
        // 100 -> Compact
        assert_eq!(compute_layout_mode(100), LayoutMode::Compact2Panel);
        // 119 -> Compact
        assert_eq!(compute_layout_mode(119), LayoutMode::Compact2Panel);
        // 120 -> Full
        assert_eq!(compute_layout_mode(120), LayoutMode::Full3Panel);
    }
}
