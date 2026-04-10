//! CRT boot animation — random characters converge to "VIBE SENSEI" then
//! dissolve to a blank screen before the main TUI takes over.
//!
//! Uses crossterm raw-mode rendering directly (not ratatui) because the
//! animation runs *before* the ratatui `Terminal` is constructed.

use std::io::{self, Write};
use std::time::{Duration, Instant};

use crossterm::{
    cursor,
    event::{self, Event, KeyEventKind},
    execute, queue,
    style::{self, Color, SetForegroundColor},
    terminal::{self, ClearType},
};

use crate::terminal_caps::TerminalGrade;

/// Matrix green — the signature CRT color.
const MATRIX_GREEN: Color = Color::Rgb { r: 0, g: 255, b: 65 };
/// Fallback green for 256-color terminals (ANSI 46 ≈ bright green).
const FALLBACK_GREEN: Color = Color::AnsiValue(46);
/// Characters used for the random noise phase.
const NOISE_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-=+[]{}|;:',.<>?/~`";

/// Duration of the convergence phase (random → target text).
const CONVERGE_DURATION: Duration = Duration::from_millis(1500);
/// Duration of the dissolve phase (text → blank).
const DISSOLVE_DURATION: Duration = Duration::from_millis(500);
/// Frame interval (~60 fps).
const FRAME_INTERVAL: Duration = Duration::from_millis(16);

/// The banner text that the noise converges into.
const BANNER: &[&str] = &[
    r"__     _____ ____  _____   ____  _____ _   _ ____  _____ ___ ",
    r"\ \   / /_ _| __ )| ____| / ___|| ____| \ | / ___|| ____|_ _|",
    r" \ \ / / | ||  _ \|  _|   \___ \|  _| |  \| \___ \|  _|  | | ",
    r"  \ V /  | || |_) | |___   ___) | |___| |\  |___) | |___ | | ",
    r"   \_/  |___|____/|_____| |____/|_____|_| \_|____/|_____|___|",
];

/// Simple xorshift32 PRNG — no external dependency needed.
struct Rng(u32);

impl Rng {
    fn new(seed: u32) -> Self {
        Self(if seed == 0 { 1 } else { seed })
    }

    fn next_u32(&mut self) -> u32 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        x
    }

    /// Random index in `0..len`.
    fn usize(&mut self, len: usize) -> usize {
        (self.next_u32() as usize) % len
    }

    /// Random `u8` character from the noise charset.
    fn noise_char(&mut self) -> u8 {
        NOISE_CHARS[self.usize(NOISE_CHARS.len())]
    }
}

/// Run the CRT boot animation. Returns `Ok(())` when done or skipped.
///
/// The caller is expected to have **not** yet entered the alternate screen or
/// enabled raw mode — this function handles that itself and restores state on
/// exit so the main TUI can set up its own terminal context cleanly.
pub fn run(grade: TerminalGrade) -> io::Result<()> {
    let mut stdout = io::stdout();

    // Enter raw mode + alternate screen, hide cursor
    terminal::enable_raw_mode()?;
    execute!(
        stdout,
        terminal::EnterAlternateScreen,
        cursor::Hide,
        terminal::Clear(ClearType::All)
    )?;

    let result = animate(&mut stdout, grade);

    // Leave alternate screen, show cursor, disable raw mode
    // (the main TUI will re-enter its own context)
    execute!(
        stdout,
        terminal::Clear(ClearType::All),
        cursor::Show,
        terminal::LeaveAlternateScreen
    )?;
    terminal::disable_raw_mode()?;

    result
}

/// Core animation loop. Separated so cleanup always runs in `run()`.
fn animate(stdout: &mut io::Stdout, grade: TerminalGrade) -> io::Result<()> {
    let (cols, rows) = terminal::size()?;
    let cols = cols as usize;
    let rows = rows as usize;

    if cols == 0 || rows == 0 {
        return Ok(());
    }

    let green = if grade.has_truecolor() {
        MATRIX_GREEN
    } else {
        FALLBACK_GREEN
    };

    // Pre-compute the banner placement (centered)
    let banner_width = BANNER.iter().map(|l| l.len()).max().unwrap_or(0);
    let banner_height = BANNER.len();
    let start_col = cols.saturating_sub(banner_width) / 2;
    let start_row = rows.saturating_sub(banner_height) / 2;

    // Build target grid: spaces everywhere except where the banner has chars.
    let mut target: Vec<Vec<u8>> = vec![vec![b' '; cols]; rows];
    for (bi, line) in BANNER.iter().enumerate() {
        let row = start_row + bi;
        if row >= rows {
            break;
        }
        for (ci, &ch) in line.as_bytes().iter().enumerate() {
            let col = start_col + ci;
            if col < cols {
                target[row][col] = ch;
            }
        }
    }

    // Pre-compute the "distance" of each banner cell from center (used for
    // convergence order: center cells resolve first).
    let center_col = start_col + banner_width / 2;
    let center_row = start_row + banner_height / 2;
    let mut banner_cells: Vec<(usize, usize, f64)> = Vec::new();
    for (bi, line) in BANNER.iter().enumerate() {
        let row = start_row + bi;
        if row >= rows {
            break;
        }
        for (ci, &ch) in line.as_bytes().iter().enumerate() {
            if ch == b' ' {
                continue;
            }
            let col = start_col + ci;
            if col >= cols {
                continue;
            }
            let dr = (row as f64) - (center_row as f64);
            let dc = (col as f64) - (center_col as f64);
            let dist = (dr * dr + dc * dc).sqrt();
            banner_cells.push((row, col, dist));
        }
    }
    // Sort by distance so center converges first.
    banner_cells.sort_by(|a, b| a.2.partial_cmp(&b.2).unwrap());

    let max_dist = banner_cells
        .last()
        .map(|c| c.2)
        .unwrap_or(1.0)
        .max(1.0);

    let mut rng = Rng::new(0xDEAD_BEEF);

    // Build initial noise screen.
    let mut screen: Vec<Vec<u8>> = (0..rows)
        .map(|_| (0..cols).map(|_| rng.noise_char()).collect())
        .collect();

    // Phase 1: Convergence — noise morphs into the banner from center outward.
    let phase1_start = Instant::now();
    loop {
        if poll_any_key()? {
            return Ok(());
        }

        let elapsed = phase1_start.elapsed();
        let t = (elapsed.as_secs_f64() / CONVERGE_DURATION.as_secs_f64()).min(1.0);

        // Determine which banner cells have "resolved" based on progress `t`.
        // A cell at normalised distance `d` resolves when `t >= d`.
        for &(row, col, dist) in &banner_cells {
            let threshold = dist / max_dist;
            if t >= threshold {
                screen[row][col] = target[row][col];
            } else {
                screen[row][col] = rng.noise_char();
            }
        }

        // Non-banner cells: random noise that fades out over time.
        // At t=0 all cells are noise; at t=1 only banner area has chars.
        for r in 0..rows {
            for c in 0..cols {
                if target[r][c] != b' ' {
                    continue; // banner cell — handled above
                }
                if rng.next_u32() as f64 / u32::MAX as f64 > (1.0 - t * 0.8) {
                    screen[r][c] = b' ';
                } else {
                    screen[r][c] = rng.noise_char();
                }
            }
        }

        draw_screen(stdout, &screen, green)?;

        if elapsed >= CONVERGE_DURATION {
            break;
        }
        std::thread::sleep(FRAME_INTERVAL);
    }

    // Phase 2: Dissolve — replace chars with spaces from edges inward.
    let phase2_start = Instant::now();
    loop {
        if poll_any_key()? {
            return Ok(());
        }

        let elapsed = phase2_start.elapsed();
        let t = (elapsed.as_secs_f64() / DISSOLVE_DURATION.as_secs_f64()).min(1.0);

        // Dissolve from edges inward: cells whose normalised distance from
        // center is high disappear first.
        for &(row, col, dist) in &banner_cells {
            let norm = dist / max_dist;
            // Invert: high-distance cells dissolve at low t values.
            let dissolve_at = 1.0 - norm;
            if t >= dissolve_at {
                screen[row][col] = b' ';
            }
        }

        // Remaining noise also fades.
        for r in 0..rows {
            for c in 0..cols {
                if target[r][c] != b' ' {
                    continue;
                }
                if rng.next_u32() as f64 / u32::MAX as f64 > (1.0 - t) {
                    screen[r][c] = b' ';
                }
            }
        }

        draw_screen(stdout, &screen, green)?;

        if elapsed >= DISSOLVE_DURATION {
            break;
        }
        std::thread::sleep(FRAME_INTERVAL);
    }

    Ok(())
}

/// Render the entire screen buffer at once.
fn draw_screen(
    stdout: &mut io::Stdout,
    screen: &[Vec<u8>],
    color: Color,
) -> io::Result<()> {
    queue!(
        stdout,
        cursor::MoveTo(0, 0),
        SetForegroundColor(color)
    )?;
    for (r, row) in screen.iter().enumerate() {
        queue!(stdout, cursor::MoveTo(0, r as u16))?;
        // Safety: all bytes are valid ASCII.
        let line = std::str::from_utf8(row).unwrap_or("");
        queue!(stdout, style::Print(line))?;
    }
    queue!(stdout, style::ResetColor)?;
    stdout.flush()
}

/// Poll for any keypress with a very short timeout. Returns `true` if a key
/// was pressed (signals "skip animation").
fn poll_any_key() -> io::Result<bool> {
    if event::poll(Duration::from_millis(1))? {
        if let Event::Key(key) = event::read()? {
            if key.kind == KeyEventKind::Press {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rng_produces_varied_output() {
        let mut rng = Rng::new(42);
        let a = rng.next_u32();
        let b = rng.next_u32();
        assert_ne!(a, b);
    }

    #[test]
    fn rng_noise_chars_are_ascii() {
        let mut rng = Rng::new(1234);
        for _ in 0..100 {
            let ch = rng.noise_char();
            assert!(ch.is_ascii(), "Expected ASCII, got {ch}");
        }
    }

    #[test]
    fn banner_lines_are_equal_width_or_shorter() {
        let max = BANNER.iter().map(|l| l.len()).max().unwrap_or(0);
        for line in BANNER {
            assert!(line.len() <= max);
        }
    }

    #[test]
    fn rng_zero_seed_handled() {
        let mut rng = Rng::new(0);
        // Should not panic or loop
        let _ = rng.next_u32();
    }
}
