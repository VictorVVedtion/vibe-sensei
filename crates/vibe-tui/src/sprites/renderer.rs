//! SpriteWidget: renders a `DynamicImage` via unicode half-block characters.
//!
//! Each terminal cell encodes two vertical pixel rows using the `▀` character
//! with foreground (upper pixel) and background (lower pixel) colors.
//! Falls back to an ASCII placeholder when true-color is not available.

use image::DynamicImage;
use image::imageops::FilterType;
use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Style},
    widgets::Widget,
};

/// Upper half-block character: foreground covers the top half of the cell.
const HALF_UPPER: char = '\u{2580}'; // ▀
/// Lower half-block character: foreground covers the bottom half of the cell.
const HALF_LOWER: char = '\u{2584}'; // ▄

/// A standalone widget that renders a `DynamicImage` using half-block pixel art.
///
/// The image is resized to fit the render area at draw time. Each terminal cell
/// represents two vertical pixels via the `▀` or `▄` character with true-color
/// foreground and background.
///
/// When true-color is unavailable (detected via `COLORTERM` env var), a text
/// placeholder is shown instead.
pub struct SpriteWidget<'a> {
    image: &'a DynamicImage,
}

impl<'a> SpriteWidget<'a> {
    /// Create a new sprite widget from an image reference.
    pub fn new(image: &'a DynamicImage) -> Self {
        Self { image }
    }
}

impl Widget for SpriteWidget<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width == 0 || area.height == 0 {
            return;
        }

        if !supports_true_color() {
            render_placeholder(area, buf);
            return;
        }

        render_halfblocks(self.image, area, buf);
    }
}

/// Check if the terminal supports true-color (24-bit) rendering.
///
/// Checks `COLORTERM` for "truecolor" or "24bit". If absent, checks `TERM`
/// for known true-color capable terminal types.
pub fn supports_true_color() -> bool {
    if let Ok(ct) = std::env::var("COLORTERM") {
        let ct_lower = ct.to_lowercase();
        if ct_lower.contains("truecolor") || ct_lower.contains("24bit") {
            return true;
        }
    }

    // Some terminals set TERM to values that imply true-color support
    if let Ok(term) = std::env::var("TERM") {
        let term_lower = term.to_lowercase();
        if term_lower.contains("256color")
            || term_lower.contains("kitty")
            || term_lower.contains("alacritty")
        {
            // 256-color terminals can often handle true-color too, but we
            // conservatively require COLORTERM for certainty. However,
            // kitty and alacritty always support true-color.
            return term_lower.contains("kitty") || term_lower.contains("alacritty");
        }
    }

    false
}

/// Render a text placeholder when true-color is unavailable.
fn render_placeholder(area: Rect, buf: &mut Buffer) {
    let label = "[SPRITE]";
    let x = area.x + area.width.saturating_sub(label.len() as u16) / 2;
    let y = area.y + area.height / 2;
    if y < area.y + area.height && x < area.x + area.width {
        buf.set_string(
            x,
            y,
            label,
            Style::default().fg(Color::DarkGray),
        );
    }
}

/// Render an image to the buffer using half-block characters.
///
/// The image is resized to exactly `(area.width, area.height * 2)` pixels,
/// so each terminal row maps to 2 pixel rows.
fn render_halfblocks(image: &DynamicImage, area: Rect, buf: &mut Buffer) {
    let target_w = area.width as u32;
    let target_h = (area.height as u32) * 2;

    if target_w == 0 || target_h == 0 {
        return;
    }

    let resized = image.resize_exact(target_w, target_h, FilterType::Triangle);
    let rgb = resized.to_rgba8();

    for row in 0..area.height {
        for col in 0..area.width {
            let px = col as u32;
            let upper_py = (row as u32) * 2;
            let lower_py = upper_py + 1;

            let upper_pixel = rgb.get_pixel(px, upper_py);
            let lower_pixel = if lower_py < target_h {
                rgb.get_pixel(px, lower_py)
            } else {
                &image::Rgba([0, 0, 0, 0])
            };

            let upper_color = pixel_to_color(upper_pixel);
            let lower_color = pixel_to_color(lower_pixel);

            let (ch, fg, bg) = pick_halfblock(upper_color, lower_color);

            let cell_x = area.x + col;
            let cell_y = area.y + row;

            if let Some(cell) = buf.cell_mut((cell_x, cell_y)) {
                cell.set_char(ch);
                cell.set_fg(fg);
                cell.set_bg(bg);
            }
        }
    }
}

/// Convert an RGBA pixel to a ratatui Color, handling transparency.
fn pixel_to_color(pixel: &image::Rgba<u8>) -> Color {
    if pixel[3] < 128 {
        // Transparent: use black background
        Color::Rgb(0, 0, 0)
    } else {
        Color::Rgb(pixel[0], pixel[1], pixel[2])
    }
}

/// Choose the best half-block character and colors for a pair of vertical pixels.
///
/// When both colors are equal, use a space with bg = that color.
/// Otherwise, pick `▀` (fg = upper, bg = lower) or `▄` (fg = lower, bg = upper)
/// based on luminance to minimize visual artifacts.
fn pick_halfblock(upper: Color, lower: Color) -> (char, Color, Color) {
    if upper == lower {
        return (' ', upper, lower);
    }

    if luminance(lower) > luminance(upper) {
        // Lower pixel is brighter: use ▄ so fg (brighter) is on bottom
        (HALF_LOWER, lower, upper)
    } else {
        // Upper pixel is brighter or equal: use ▀ so fg (brighter) is on top
        (HALF_UPPER, upper, lower)
    }
}

/// Compute perceptual luminance for a Color value.
fn luminance(color: Color) -> u32 {
    match color {
        Color::Rgb(r, g, b) => 2126 * r as u32 + 7152 * g as u32 + 722 * b as u32,
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};

    #[test]
    fn pick_halfblock_equal_colors() {
        let c = Color::Rgb(100, 100, 100);
        let (ch, fg, bg) = pick_halfblock(c, c);
        assert_eq!(ch, ' ');
        assert_eq!(fg, c);
        assert_eq!(bg, c);
    }

    #[test]
    fn pick_halfblock_upper_brighter() {
        let bright = Color::Rgb(255, 255, 255);
        let dark = Color::Rgb(0, 0, 0);
        let (ch, fg, bg) = pick_halfblock(bright, dark);
        assert_eq!(ch, HALF_UPPER);
        assert_eq!(fg, bright);
        assert_eq!(bg, dark);
    }

    #[test]
    fn pick_halfblock_lower_brighter() {
        let bright = Color::Rgb(255, 255, 255);
        let dark = Color::Rgb(0, 0, 0);
        let (ch, fg, bg) = pick_halfblock(dark, bright);
        assert_eq!(ch, HALF_LOWER);
        assert_eq!(fg, bright);
        assert_eq!(bg, dark);
    }

    #[test]
    fn pixel_to_color_opaque() {
        let p = Rgba([128, 64, 32, 255]);
        assert_eq!(pixel_to_color(&p), Color::Rgb(128, 64, 32));
    }

    #[test]
    fn pixel_to_color_transparent() {
        let p = Rgba([128, 64, 32, 50]);
        assert_eq!(pixel_to_color(&p), Color::Rgb(0, 0, 0));
    }

    #[test]
    fn render_to_small_area() {
        // Create a tiny 2x4 RGBA image (will map to 2 cols x 2 rows)
        let img: DynamicImage = ImageBuffer::from_fn(2, 4, |_x, y| {
            if y < 2 {
                Rgba([255u8, 0, 0, 255]) // red upper
            } else {
                Rgba([0u8, 0, 255, 255]) // blue lower
            }
        })
        .into();

        let area = Rect::new(0, 0, 2, 2);
        let mut buf = Buffer::empty(area);

        // Force true-color path by calling render_halfblocks directly
        render_halfblocks(&img, area, &mut buf);

        // Each cell should have a half-block character with red/blue
        for col in 0..2u16 {
            for row in 0..2u16 {
                let cell = buf.cell((col, row)).unwrap();
                // The cell should have some half-block or space character
                let ch = cell.symbol().chars().next().unwrap();
                assert!(
                    ch == HALF_UPPER || ch == HALF_LOWER || ch == ' ',
                    "unexpected char: {ch}"
                );
            }
        }
    }

    #[test]
    fn placeholder_renders_centered() {
        let area = Rect::new(0, 0, 20, 5);
        let mut buf = Buffer::empty(area);
        render_placeholder(area, &mut buf);

        // "[SPRITE]" should appear somewhere in the buffer
        let content: String = (0..area.width)
            .map(|x| {
                buf.cell((x, area.height / 2))
                    .unwrap()
                    .symbol()
                    .to_string()
            })
            .collect();
        assert!(content.contains("[SPRITE]"));
    }
}
