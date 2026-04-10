//! Sprite atlas: maps `(master_id, emotion)` to file paths.
//!
//! File naming convention: `assets/sprites/{master_id}-{emotion}.png`
//! Fallback chain: requested emotion -> "idle" -> None

use std::path::{Path, PathBuf};

/// Known emotion states for guardian sprites.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Emotion {
    Idle,
    Active,
    Happy,
    Alert,
    Celebrate,
    Worried,
}

impl Emotion {
    /// Returns the string suffix used in sprite filenames.
    pub fn as_str(&self) -> &'static str {
        match self {
            Emotion::Idle => "idle",
            Emotion::Active => "active",
            Emotion::Happy => "happy",
            Emotion::Alert => "alert",
            Emotion::Celebrate => "celebrate",
            Emotion::Worried => "worried",
        }
    }
}

/// Root directory for sprite assets, relative to project root.
const SPRITES_DIR: &str = "assets/sprites";

/// Build the expected filename for a master + emotion combination.
fn sprite_filename(master_id: &str, emotion: &Emotion) -> String {
    format!("{}-{}.png", master_id, emotion.as_str())
}

/// Resolve the sprite path for a given master and emotion.
///
/// Fallback chain:
/// 1. Exact match: `{master_id}-{emotion}.png`
/// 2. Idle fallback: `{master_id}-idle.png`
/// 3. None (no sprite available)
///
/// Returns `None` if the sprites directory does not exist or no matching file is found.
pub fn sprite_path(project_root: &Path, master_id: &str, emotion: Emotion) -> Option<PathBuf> {
    let sprites_dir = project_root.join(SPRITES_DIR);
    if !sprites_dir.is_dir() {
        return None;
    }

    // Try exact emotion match
    let exact = sprites_dir.join(sprite_filename(master_id, &emotion));
    if exact.is_file() {
        return Some(exact);
    }

    // Fallback to idle
    if emotion != Emotion::Idle {
        let idle = sprites_dir.join(sprite_filename(master_id, &Emotion::Idle));
        if idle.is_file() {
            return Some(idle);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn sprite_path_returns_none_for_missing_dir() {
        let tmp = std::env::temp_dir().join("sprite_atlas_test_missing");
        let _ = fs::remove_dir_all(&tmp);
        assert!(sprite_path(&tmp, "warren_buffett", Emotion::Idle).is_none());
    }

    #[test]
    fn sprite_path_returns_exact_match() {
        let tmp = std::env::temp_dir().join("sprite_atlas_test_exact");
        let sprites = tmp.join(SPRITES_DIR);
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&sprites).unwrap();

        let file = sprites.join("warren_buffett-happy.png");
        fs::write(&file, b"fake png").unwrap();

        let result = sprite_path(&tmp, "warren_buffett", Emotion::Happy);
        assert_eq!(result, Some(file));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn sprite_path_falls_back_to_idle() {
        let tmp = std::env::temp_dir().join("sprite_atlas_test_fallback");
        let sprites = tmp.join(SPRITES_DIR);
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&sprites).unwrap();

        let idle_file = sprites.join("warren_buffett-idle.png");
        fs::write(&idle_file, b"fake png").unwrap();

        // Request "celebrate" which doesn't exist, should fall back to idle
        let result = sprite_path(&tmp, "warren_buffett", Emotion::Celebrate);
        assert_eq!(result, Some(idle_file));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn sprite_path_returns_none_when_no_match() {
        let tmp = std::env::temp_dir().join("sprite_atlas_test_nomatch");
        let sprites = tmp.join(SPRITES_DIR);
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&sprites).unwrap();

        // No files for this master at all
        let result = sprite_path(&tmp, "nonexistent_master", Emotion::Idle);
        assert!(result.is_none());

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn emotion_as_str_roundtrip() {
        let emotions = [
            Emotion::Idle,
            Emotion::Active,
            Emotion::Happy,
            Emotion::Alert,
            Emotion::Celebrate,
            Emotion::Worried,
        ];
        let expected = ["idle", "active", "happy", "alert", "celebrate", "worried"];
        for (e, s) in emotions.iter().zip(expected.iter()) {
            assert_eq!(e.as_str(), *s);
        }
    }
}
