//! Braille dot-matrix canvas for high-resolution terminal rendering.
//!
//! Each terminal character cell maps to a 2x4 grid of dots using
//! Unicode Braille patterns (U+2800..U+28FF). This gives 2x horizontal
//! and 4x vertical resolution compared to normal text.
//!
//! Dot bit layout per character cell:
//! ```text
//!   col0 col1    bit
//!   ---- ----    ---
//!   row0 row0    0, 3
//!   row1 row1    1, 4
//!   row2 row2    2, 5
//!   row3 row3    6, 7
//! ```
//!
//! Character code = U+2800 + sum of set bit values.

use std::fmt;

/// The base Unicode code point for Braille patterns.
const BRAILLE_BASE: u32 = 0x2800;

/// Bit offsets for each dot position in a 2x4 Braille cell.
///
/// Index by `[row][col]` where row is 0..4 and col is 0..2.
const DOT_BITS: [[u8; 2]; 4] = [
    [0, 3], // row 0
    [1, 4], // row 1
    [2, 5], // row 2
    [6, 7], // row 3
];

/// A 2D boolean grid that renders to Braille Unicode characters.
///
/// The canvas dimensions are in *dots* (not character cells).
/// - Dot width = char_width * 2
/// - Dot height = char_height * 4
pub struct BrailleCanvas {
    /// Width in dots.
    dot_width: usize,
    /// Height in dots.
    dot_height: usize,
    /// Width in character cells.
    char_width: usize,
    /// Height in character cells.
    char_height: usize,
    /// Dot grid stored row-major: grid[y * dot_width + x].
    grid: Vec<bool>,
}

impl BrailleCanvas {
    /// Create a new canvas with the given character cell dimensions.
    ///
    /// The dot resolution is `(char_width * 2, char_height * 4)`.
    pub fn new(char_width: usize, char_height: usize) -> Self {
        let dot_width = char_width * 2;
        let dot_height = char_height * 4;
        Self {
            dot_width,
            dot_height,
            char_width,
            char_height,
            grid: vec![false; dot_width * dot_height],
        }
    }

    /// Width in dots.
    pub fn dot_width(&self) -> usize {
        self.dot_width
    }

    /// Height in dots.
    pub fn dot_height(&self) -> usize {
        self.dot_height
    }

    /// Width in character cells.
    pub fn char_width(&self) -> usize {
        self.char_width
    }

    /// Height in character cells.
    pub fn char_height(&self) -> usize {
        self.char_height
    }

    /// Clear the entire canvas.
    pub fn clear(&mut self) {
        self.grid.fill(false);
    }

    /// Set a single dot at (x, y) in dot coordinates.
    ///
    /// Out-of-bounds coordinates are silently ignored.
    pub fn set_dot(&mut self, x: usize, y: usize) {
        if x < self.dot_width && y < self.dot_height {
            self.grid[y * self.dot_width + x] = true;
        }
    }

    /// Unset a single dot at (x, y) in dot coordinates.
    ///
    /// Out-of-bounds coordinates are silently ignored.
    #[allow(dead_code)]
    pub fn unset_dot(&mut self, x: usize, y: usize) {
        if x < self.dot_width && y < self.dot_height {
            self.grid[y * self.dot_width + x] = false;
        }
    }

    /// Get the dot value at (x, y). Returns false for out-of-bounds.
    pub fn get_dot(&self, x: usize, y: usize) -> bool {
        if x < self.dot_width && y < self.dot_height {
            self.grid[y * self.dot_width + x]
        } else {
            false
        }
    }

    /// Draw a line from (x0, y0) to (x1, y1) using Bresenham's algorithm.
    ///
    /// All coordinates are in dot space.
    pub fn draw_line(&mut self, x0: i32, y0: i32, x1: i32, y1: i32) {
        let dx = (x1 - x0).abs();
        let dy = -(y1 - y0).abs();
        let sx: i32 = if x0 < x1 { 1 } else { -1 };
        let sy: i32 = if y0 < y1 { 1 } else { -1 };
        let mut err = dx + dy;
        let mut cx = x0;
        let mut cy = y0;

        loop {
            if cx >= 0 && cy >= 0 {
                self.set_dot(cx as usize, cy as usize);
            }
            if cx == x1 && cy == y1 {
                break;
            }
            let e2 = 2 * err;
            if e2 >= dy {
                if cx == x1 {
                    break;
                }
                err += dy;
                cx += sx;
            }
            if e2 <= dx {
                if cy == y1 {
                    break;
                }
                err += dx;
                cy += sy;
            }
        }
    }

    /// Draw a vertical line from (x, y0) to (x, y1).
    ///
    /// Handles y0 > y1 correctly.
    pub fn draw_vertical_line(&mut self, x: usize, y0: usize, y1: usize) {
        let (start, end) = if y0 <= y1 { (y0, y1) } else { (y1, y0) };
        for y in start..=end {
            self.set_dot(x, y);
        }
    }

    /// Draw a horizontal line from (x0, y) to (x1, y).
    ///
    /// Handles x0 > x1 correctly.
    pub fn draw_horizontal_line(&mut self, y: usize, x0: usize, x1: usize) {
        let (start, end) = if x0 <= x1 { (x0, x1) } else { (x1, x0) };
        for x in start..=end {
            self.set_dot(x, y);
        }
    }

    /// Fill a vertical rectangle of dots from (x, y_top) to (x, y_bottom),
    /// width 2 dots (one char cell wide).
    pub fn fill_column(&mut self, x: usize, y_top: usize, y_bottom: usize) {
        let (start, end) = if y_top <= y_bottom {
            (y_top, y_bottom)
        } else {
            (y_bottom, y_top)
        };
        for y in start..=end {
            self.set_dot(x, y);
            if x + 1 < self.dot_width {
                self.set_dot(x + 1, y);
            }
        }
    }

    /// Render the canvas to a 2D grid of Braille characters.
    ///
    /// Returns `char_height` rows, each containing `char_width` Braille chars.
    pub fn to_char_grid(&self) -> Vec<Vec<char>> {
        let mut rows = Vec::with_capacity(self.char_height);
        for cy in 0..self.char_height {
            let mut row = Vec::with_capacity(self.char_width);
            for cx in 0..self.char_width {
                row.push(self.char_at(cx, cy));
            }
            rows.push(row);
        }
        rows
    }

    /// Compute the Braille character for the character cell at (cx, cy).
    fn char_at(&self, cx: usize, cy: usize) -> char {
        let base_x = cx * 2;
        let base_y = cy * 4;
        let mut code: u8 = 0;

        for (row, bit_row) in DOT_BITS.iter().enumerate() {
            for (col, &bit) in bit_row.iter().enumerate() {
                let dx = base_x + col;
                let dy = base_y + row;
                if self.get_dot(dx, dy) {
                    code |= 1 << bit;
                }
            }
        }

        char::from_u32(BRAILLE_BASE + u32::from(code)).unwrap_or(' ')
    }
}

impl fmt::Display for BrailleCanvas {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let grid = self.to_char_grid();
        for (i, row) in grid.iter().enumerate() {
            if i > 0 {
                f.write_str("\n")?;
            }
            for &ch in row {
                write!(f, "{ch}")?;
            }
        }
        Ok(())
    }
}

/// Convert a single dot pattern byte to a Braille character.
///
/// Useful for testing: pass the raw bit pattern and get the Unicode char.
pub fn braille_char(pattern: u8) -> char {
    char::from_u32(BRAILLE_BASE + u32::from(pattern)).unwrap_or(' ')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_canvas_all_blank() {
        let canvas = BrailleCanvas::new(3, 2);
        assert_eq!(canvas.dot_width(), 6);
        assert_eq!(canvas.dot_height(), 8);
        assert_eq!(canvas.char_width(), 3);
        assert_eq!(canvas.char_height(), 2);

        let grid = canvas.to_char_grid();
        for row in &grid {
            for &ch in row {
                assert_eq!(ch, '\u{2800}'); // empty Braille
            }
        }
    }

    #[test]
    fn test_single_dot_top_left() {
        // Setting dot (0,0) should set bit 0 in char cell (0,0)
        let mut canvas = BrailleCanvas::new(1, 1);
        canvas.set_dot(0, 0);
        let ch = canvas.to_char_grid()[0][0];
        assert_eq!(ch, braille_char(0b0000_0001)); // bit 0
    }

    #[test]
    fn test_single_dot_top_right_of_cell() {
        // Dot (1, 0) → col 1, row 0 → bit 3
        let mut canvas = BrailleCanvas::new(1, 1);
        canvas.set_dot(1, 0);
        let ch = canvas.to_char_grid()[0][0];
        assert_eq!(ch, braille_char(0b0000_1000)); // bit 3
    }

    #[test]
    fn test_all_dots_set() {
        // All 8 dots set → 0xFF → U+28FF = ⣿
        let mut canvas = BrailleCanvas::new(1, 1);
        for y in 0..4 {
            for x in 0..2 {
                canvas.set_dot(x, y);
            }
        }
        let ch = canvas.to_char_grid()[0][0];
        assert_eq!(ch, '\u{28FF}');
    }

    #[test]
    fn test_dot_bit_mapping() {
        // Verify each individual dot maps to the correct bit
        let expected_bits: [(usize, usize, u8); 8] = [
            (0, 0, 0), // col0 row0 → bit 0
            (0, 1, 1), // col0 row1 → bit 1
            (0, 2, 2), // col0 row2 → bit 2
            (1, 0, 3), // col1 row0 → bit 3
            (1, 1, 4), // col1 row1 → bit 4
            (1, 2, 5), // col1 row2 → bit 5
            (0, 3, 6), // col0 row3 → bit 6
            (1, 3, 7), // col1 row3 → bit 7
        ];

        for (x, y, bit) in expected_bits {
            let mut canvas = BrailleCanvas::new(1, 1);
            canvas.set_dot(x, y);
            let ch = canvas.to_char_grid()[0][0];
            let expected = braille_char(1 << bit);
            assert_eq!(
                ch, expected,
                "dot({x},{y}) should be bit {bit}: expected U+{:04X}, got U+{:04X}",
                expected as u32, ch as u32
            );
        }
    }

    #[test]
    fn test_vertical_line() {
        let mut canvas = BrailleCanvas::new(1, 2); // 2 dots wide, 8 dots tall
        canvas.draw_vertical_line(0, 0, 7);

        // All left-column dots set in both char rows
        let grid = canvas.to_char_grid();
        // Row 0: col0 rows 0-3 → bits 0,1,2,6 = 0b0100_0111 = 0x47
        assert_eq!(grid[0][0], braille_char(0b0100_0111));
        // Row 1: same pattern
        assert_eq!(grid[1][0], braille_char(0b0100_0111));
    }

    #[test]
    fn test_horizontal_line() {
        let mut canvas = BrailleCanvas::new(3, 1); // 6 dots wide, 4 dots tall
        canvas.draw_horizontal_line(0, 0, 5);

        // Row 0, all 6 dots at y=0 are set
        let grid = canvas.to_char_grid();
        // Each cell at row 0: both col0 and col1 at row 0 → bits 0,3 = 0x09
        for cx in 0..3 {
            assert_eq!(
                grid[0][cx],
                braille_char(0b0000_1001),
                "cell {cx} mismatch"
            );
        }
    }

    #[test]
    fn test_bresenham_line_horizontal() {
        let mut canvas = BrailleCanvas::new(3, 1);
        canvas.draw_line(0, 0, 5, 0);
        // Same as horizontal line test
        let grid = canvas.to_char_grid();
        for cx in 0..3 {
            assert_eq!(grid[0][cx], braille_char(0b0000_1001));
        }
    }

    #[test]
    fn test_bresenham_line_vertical() {
        let mut canvas = BrailleCanvas::new(1, 2);
        canvas.draw_line(0, 0, 0, 7);
        let grid = canvas.to_char_grid();
        assert_eq!(grid[0][0], braille_char(0b0100_0111));
        assert_eq!(grid[1][0], braille_char(0b0100_0111));
    }

    #[test]
    fn test_bresenham_line_diagonal() {
        let mut canvas = BrailleCanvas::new(4, 4);
        canvas.draw_line(0, 0, 7, 15);
        // The line should set roughly one dot per step
        // Just check that some dots are set along the diagonal
        assert!(canvas.get_dot(0, 0));
        assert!(canvas.get_dot(7, 15));
    }

    #[test]
    fn test_out_of_bounds_ignored() {
        let mut canvas = BrailleCanvas::new(1, 1);
        // These should not panic
        canvas.set_dot(100, 100);
        canvas.set_dot(2, 0); // just past dot_width
        canvas.set_dot(0, 4); // just past dot_height
        assert!(!canvas.get_dot(100, 100));
    }

    #[test]
    fn test_clear() {
        let mut canvas = BrailleCanvas::new(2, 2);
        canvas.set_dot(0, 0);
        canvas.set_dot(3, 7);
        canvas.clear();
        assert!(!canvas.get_dot(0, 0));
        assert!(!canvas.get_dot(3, 7));
    }

    #[test]
    fn test_to_string_format() {
        let canvas = BrailleCanvas::new(2, 2);
        let s = canvas.to_string();
        let lines: Vec<&str> = s.split('\n').collect();
        assert_eq!(lines.len(), 2);
        // Each line should be 2 chars (2 blank braille)
        for line in &lines {
            assert_eq!(line.chars().count(), 2);
        }
    }

    #[test]
    fn test_fill_column() {
        let mut canvas = BrailleCanvas::new(1, 1);
        canvas.fill_column(0, 0, 3);
        // Both col0 and col1 filled for rows 0-3 → all 8 dots
        let ch = canvas.to_char_grid()[0][0];
        assert_eq!(ch, '\u{28FF}');
    }

    #[test]
    fn test_braille_char_helper() {
        assert_eq!(braille_char(0), '\u{2800}');
        assert_eq!(braille_char(0xFF), '\u{28FF}');
        assert_eq!(braille_char(1), '\u{2801}');
    }

    #[test]
    fn test_second_char_cell() {
        // Dot (2, 0) falls in char cell (1, 0), position col0 row0 → bit 0
        let mut canvas = BrailleCanvas::new(2, 1);
        canvas.set_dot(2, 0);
        let grid = canvas.to_char_grid();
        assert_eq!(grid[0][0], braille_char(0)); // first cell empty
        assert_eq!(grid[0][1], braille_char(1)); // second cell bit 0
    }

    #[test]
    fn test_unset_dot() {
        let mut canvas = BrailleCanvas::new(1, 1);
        canvas.set_dot(0, 0);
        assert!(canvas.get_dot(0, 0));
        canvas.unset_dot(0, 0);
        assert!(!canvas.get_dot(0, 0));
    }
}
