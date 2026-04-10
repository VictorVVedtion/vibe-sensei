//! Terminal capability detection and graceful degradation.
//!
//! Inspects `COLORTERM`, `TERM_PROGRAM`, and `TERM` environment variables to
//! determine what the host terminal can render. Produces a [`TerminalGrade`]
//! that the rest of the TUI uses for degradation decisions.

use std::env;
use std::fmt;

/// Terminal rendering capability tier.
///
/// * **A** — True-color + HalfBlock + Braille + known image protocol support.
/// * **B** — True-color detected but no known image-protocol terminal.
/// * **C** — 256-color only (safe fallback).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TerminalGrade {
    /// Full fidelity: true-color, half-block, braille, image protocols.
    A,
    /// True-color available, but no known image protocol support.
    B,
    /// 256-color fallback.
    C,
}

impl fmt::Display for TerminalGrade {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::A => write!(f, "A"),
            Self::B => write!(f, "B"),
            Self::C => write!(f, "C"),
        }
    }
}

/// Terminals known to support image protocols (Sixel, iTerm inline images, Kitty).
const GRADE_A_PROGRAMS: &[&str] = &[
    "iterm.app",
    "iterm2",
    "wezterm",
    "kitty",
    "ghostty",
];

impl TerminalGrade {
    /// Detect the terminal grade from environment variables.
    ///
    /// Priority chain:
    /// 1. `COLORTERM` = `truecolor` | `24bit` → true-color confirmed.
    /// 2. `TERM_PROGRAM` in known list → Grade A.
    /// 3. `TERM` contains `256color` → Grade C.
    /// 4. Default → Grade C (safe fallback).
    pub fn detect() -> Self {
        Self::detect_from(
            env::var("COLORTERM").ok().as_deref(),
            env::var("TERM_PROGRAM").ok().as_deref(),
            env::var("TERM").ok().as_deref(),
        )
    }

    /// Testable inner detection — takes pre-read env values.
    fn detect_from(
        colorterm: Option<&str>,
        term_program: Option<&str>,
        term: Option<&str>,
    ) -> Self {
        let has_truecolor = matches!(
            colorterm.map(|s| s.to_ascii_lowercase()).as_deref(),
            Some("truecolor") | Some("24bit")
        );

        let is_known_program = term_program
            .map(|p| {
                let lower = p.to_ascii_lowercase();
                GRADE_A_PROGRAMS.iter().any(|&known| lower == known)
            })
            .unwrap_or(false);

        if has_truecolor && is_known_program {
            return Self::A;
        }
        if has_truecolor {
            return Self::B;
        }
        if is_known_program {
            // Known program but COLORTERM not set — still likely true-color.
            return Self::B;
        }

        // Check for 256-color fallback hint
        if let Some(t) = term {
            if t.contains("256color") {
                return Self::C;
            }
        }

        // Default safe fallback
        Self::C
    }

    /// Whether this grade supports true-color (24-bit) rendering.
    pub fn has_truecolor(self) -> bool {
        matches!(self, Self::A | Self::B)
    }

    /// Whether this grade supports image protocols (Sixel, Kitty, iTerm).
    pub fn has_image_protocol(self) -> bool {
        matches!(self, Self::A)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truecolor_with_known_program_is_grade_a() {
        let grade = TerminalGrade::detect_from(
            Some("truecolor"),
            Some("iTerm.app"),
            Some("xterm-256color"),
        );
        assert_eq!(grade, TerminalGrade::A);
    }

    #[test]
    fn twenty_four_bit_with_kitty_is_grade_a() {
        let grade = TerminalGrade::detect_from(
            Some("24bit"),
            Some("kitty"),
            None,
        );
        assert_eq!(grade, TerminalGrade::A);
    }

    #[test]
    fn truecolor_without_known_program_is_grade_b() {
        let grade = TerminalGrade::detect_from(
            Some("truecolor"),
            Some("Hyper"),
            Some("xterm-256color"),
        );
        assert_eq!(grade, TerminalGrade::B);
    }

    #[test]
    fn truecolor_no_program_is_grade_b() {
        let grade = TerminalGrade::detect_from(
            Some("truecolor"),
            None,
            None,
        );
        assert_eq!(grade, TerminalGrade::B);
    }

    #[test]
    fn known_program_without_colorterm_is_grade_b() {
        let grade = TerminalGrade::detect_from(
            None,
            Some("WezTerm"),
            Some("xterm-256color"),
        );
        assert_eq!(grade, TerminalGrade::B);
    }

    #[test]
    fn term_256color_only_is_grade_c() {
        let grade = TerminalGrade::detect_from(
            None,
            None,
            Some("xterm-256color"),
        );
        assert_eq!(grade, TerminalGrade::C);
    }

    #[test]
    fn no_env_vars_is_grade_c() {
        let grade = TerminalGrade::detect_from(None, None, None);
        assert_eq!(grade, TerminalGrade::C);
    }

    #[test]
    fn plain_term_is_grade_c() {
        let grade = TerminalGrade::detect_from(
            None,
            None,
            Some("xterm"),
        );
        assert_eq!(grade, TerminalGrade::C);
    }

    #[test]
    fn ghostty_truecolor_is_grade_a() {
        let grade = TerminalGrade::detect_from(
            Some("truecolor"),
            Some("ghostty"),
            None,
        );
        assert_eq!(grade, TerminalGrade::A);
    }

    #[test]
    fn has_truecolor_grades() {
        assert!(TerminalGrade::A.has_truecolor());
        assert!(TerminalGrade::B.has_truecolor());
        assert!(!TerminalGrade::C.has_truecolor());
    }

    #[test]
    fn has_image_protocol_grades() {
        assert!(TerminalGrade::A.has_image_protocol());
        assert!(!TerminalGrade::B.has_image_protocol());
        assert!(!TerminalGrade::C.has_image_protocol());
    }

    #[test]
    fn display_impl() {
        assert_eq!(format!("{}", TerminalGrade::A), "A");
        assert_eq!(format!("{}", TerminalGrade::B), "B");
        assert_eq!(format!("{}", TerminalGrade::C), "C");
    }

    #[test]
    fn case_insensitive_colorterm() {
        let grade = TerminalGrade::detect_from(
            Some("TRUECOLOR"),
            Some("kitty"),
            None,
        );
        assert_eq!(grade, TerminalGrade::A);
    }
}
