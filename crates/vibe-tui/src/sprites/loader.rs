//! Sprite loader with lazy HashMap cache and image resizing.

use std::collections::HashMap;
use std::path::Path;

use image::DynamicImage;
use image::imageops::FilterType;

use super::atlas::{Emotion, sprite_path};

/// Cache key for loaded sprites.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct CacheKey {
    master_id: String,
    emotion: Emotion,
}

/// Lazy-cached sprite loader.
///
/// Loads PNG sprites from disk on first request and caches them in memory.
/// All images are resized to fit the specified pane width while preserving
/// aspect ratio. Missing sprites gracefully return `None`.
pub struct SpriteLoader {
    cache: HashMap<CacheKey, Option<DynamicImage>>,
    project_root: std::path::PathBuf,
}

impl SpriteLoader {
    /// Create a new loader rooted at the given project directory.
    pub fn new(project_root: impl Into<std::path::PathBuf>) -> Self {
        Self {
            cache: HashMap::new(),
            project_root: project_root.into(),
        }
    }

    /// Load a sprite for the given master and emotion.
    ///
    /// Returns a cached image if previously loaded, otherwise attempts to load
    /// from disk via the atlas fallback chain. Returns `None` if the sprite
    /// cannot be found or decoded.
    ///
    /// `pane_width` specifies the terminal column count to resize the image to.
    /// The image is resized proportionally (width = pane_width pixels, assuming
    /// 1 column = 1 pixel width for half-block rendering).
    pub fn load(
        &mut self,
        master_id: &str,
        emotion: Emotion,
        pane_width: u16,
    ) -> Option<&DynamicImage> {
        let key = CacheKey {
            master_id: master_id.to_string(),
            emotion,
        };

        self.cache
            .entry(key)
            .or_insert_with_key(|k| {
                load_and_resize(
                    &self.project_root,
                    &k.master_id,
                    k.emotion,
                    pane_width,
                )
            })
            .as_ref()
    }

    /// Evict all cached sprites, freeing memory.
    pub fn clear_cache(&mut self) {
        self.cache.clear();
    }

    /// Number of entries currently cached.
    pub fn cache_len(&self) -> usize {
        self.cache.len()
    }
}

/// Load a sprite from disk and resize to fit the pane width.
fn load_and_resize(
    project_root: &Path,
    master_id: &str,
    emotion: Emotion,
    pane_width: u16,
) -> Option<DynamicImage> {
    let path = sprite_path(project_root, master_id, emotion)?;
    let img = image::open(&path).ok()?;

    if pane_width == 0 {
        return Some(img);
    }

    let target_w = pane_width as u32;
    // Each terminal row encodes 2 pixel rows via half-blocks, so we keep
    // the aspect ratio based on the pixel dimensions.
    let target_h = proportional_height(img.width(), img.height(), target_w);
    if target_h == 0 {
        return Some(img);
    }

    Some(img.resize_exact(target_w, target_h, FilterType::Triangle))
}

/// Calculate the proportional height for a target width.
fn proportional_height(src_w: u32, src_h: u32, target_w: u32) -> u32 {
    if src_w == 0 {
        return 0;
    }
    ((src_h as f64 / src_w as f64) * target_w as f64).round() as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn loader_returns_none_for_missing_project_root() {
        let tmp = std::env::temp_dir().join("sprite_loader_test_missing");
        let _ = fs::remove_dir_all(&tmp);
        let mut loader = SpriteLoader::new(&tmp);
        assert!(loader.load("warren_buffett", Emotion::Idle, 40).is_none());
    }

    #[test]
    fn loader_caches_results() {
        let tmp = std::env::temp_dir().join("sprite_loader_test_cache");
        let _ = fs::remove_dir_all(&tmp);
        let mut loader = SpriteLoader::new(&tmp);

        // First call: miss (no directory)
        let _ = loader.load("warren_buffett", Emotion::Idle, 40);
        assert_eq!(loader.cache_len(), 1);

        // Second call: still cached (even if None)
        let _ = loader.load("warren_buffett", Emotion::Idle, 40);
        assert_eq!(loader.cache_len(), 1);

        loader.clear_cache();
        assert_eq!(loader.cache_len(), 0);
    }

    #[test]
    fn proportional_height_basic() {
        // 100x200 image, target width 50 -> height 100
        assert_eq!(proportional_height(100, 200, 50), 100);
        // 200x100 image, target width 100 -> height 50
        assert_eq!(proportional_height(200, 100, 100), 50);
        // Zero source width
        assert_eq!(proportional_height(0, 100, 50), 0);
    }
}
