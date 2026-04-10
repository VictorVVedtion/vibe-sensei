//! Companion pane: vertical layout composing sprite + name row + stats + speech bubble.
//!
//! Layout (top to bottom):
//! ```text
//! ┌─[GUARDIAN]────────────────────┐
//! │                               │
//! │       [sprite area]           │
//! │                               │
//! │  ★★★★★ JESSE LIVERMORE        │
//! │  The Speculator               │
//! │                               │
//! │  BAL  [████████░░] $100K      │
//! │  HEAT [██░░░░░░░░] 15%       │
//! │  P&L  [██████████] +3.2%     │
//! │                               │
//! │  ╭───────────────────────╮    │
//! │  │ Position too large!   │    │
//! │  ╰─ ── ── ── ── ── ── ──╯    │
//! └───────────────────────────────┘
//! ```

use image::DynamicImage;
use ratatui::{
    buffer::Buffer,
    layout::{Constraint, Layout, Rect},
    style::{Color, Modifier, Style},
    widgets::{Block, Borders, Widget},
};

use crate::sprites::SpriteWidget;
use crate::state::{AppState, Rarity, SpeechBubbleQueue};
use crate::widgets::speech_bubble::SpeechBubbleWidget;
use crate::widgets::stats_bar::{StatsBar, build_stat_entries, is_night_mode};

/// Matrix green: #00FF41
const MATRIX_GREEN: Color = Color::Rgb(0, 255, 65);

/// The companion pane widget — renders in the GUARDIAN zone.
pub struct CompanionPane<'a> {
    state: &'a AppState,
    speech_queue: &'a SpeechBubbleQueue,
    sprite_image: Option<&'a DynamicImage>,
}

impl<'a> CompanionPane<'a> {
    /// Create a new companion pane.
    pub fn new(
        state: &'a AppState,
        speech_queue: &'a SpeechBubbleQueue,
        sprite_image: Option<&'a DynamicImage>,
    ) -> Self {
        Self {
            state,
            speech_queue,
            sprite_image,
        }
    }
}

impl Widget for CompanionPane<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let night = is_night_mode();
        let border_color = if night {
            Color::Rgb(0, 153, 39) // dimmed matrix green
        } else {
            MATRIX_GREEN
        };

        // Outer border
        let block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(border_color))
            .title("[GUARDIAN]")
            .title_style(Style::default().fg(border_color));

        let inner = block.inner(area);
        block.render(area, buf);

        if inner.width < 4 || inner.height < 6 {
            // Too small — show placeholder
            render_placeholder(inner, buf, night);
            return;
        }

        // Vertical layout: sprite | name row (2) | stats (3) | spacer | speech bubble
        let has_bubble = !self.speech_queue.is_empty();
        let bubble_height = if has_bubble { 5u16 } else { 0 };
        let name_height = 2u16; // name + archetype
        let stats_height = 3u16; // BAL, HEAT, P&L
        let spacer = 1u16;

        let min_sprite = 4u16; // at least 4 rows for sprite
        let non_sprite = name_height + stats_height + spacer + bubble_height + spacer;
        let sprite_height = inner.height.saturating_sub(non_sprite).max(min_sprite);

        let constraints = if has_bubble {
            vec![
                Constraint::Length(sprite_height),  // sprite
                Constraint::Length(spacer),           // spacer
                Constraint::Length(name_height),      // name row
                Constraint::Length(stats_height),     // stats
                Constraint::Length(spacer),           // spacer
                Constraint::Length(bubble_height),    // speech bubble
                Constraint::Min(0),                   // remainder
            ]
        } else {
            vec![
                Constraint::Length(sprite_height),  // sprite
                Constraint::Length(spacer),           // spacer
                Constraint::Length(name_height),      // name row
                Constraint::Length(stats_height),     // stats
                Constraint::Min(0),                   // remainder
            ]
        };

        let areas = Layout::vertical(constraints).split(inner);

        // 1. Sprite area
        render_sprite(areas[0], buf, self.sprite_image, night);

        // 2. Spacer (empty)

        // 3. Name row (index 2 in both layouts)
        render_name_row(areas[2], buf, self.state, night);

        // 4. Stats bars (index 3 in both layouts)
        render_stats(areas[3], buf, self.state, night);

        // 5. Speech bubble (if present, index 5 in bubble layout)
        if has_bubble {
            let widget = SpeechBubbleWidget::new(
                self.speech_queue.current(),
                night,
            );
            widget.render(areas[5], buf);
        }
    }
}

/// Render the sprite image or a text placeholder.
fn render_sprite(
    area: Rect,
    buf: &mut Buffer,
    image: Option<&DynamicImage>,
    night: bool,
) {
    match image {
        Some(img) => {
            let widget = SpriteWidget::new(img);
            widget.render(area, buf);
            // Night mode overlay: darken the sprite area
            if night {
                apply_night_dim(area, buf);
            }
        }
        None => {
            render_sprite_placeholder(area, buf, night);
        }
    }
}

/// Render a text placeholder when no sprite is available.
fn render_sprite_placeholder(area: Rect, buf: &mut Buffer, night: bool) {
    let color = if night { Color::Rgb(40, 40, 40) } else { Color::DarkGray };
    let style = Style::default().fg(color);

    // Center a small ASCII art placeholder
    let lines = [
        "  .--.  ",
        " (o  o) ",
        "  |  |  ",
        "  '--'  ",
    ];

    let start_y = area.y + area.height.saturating_sub(lines.len() as u16) / 2;
    for (i, line) in lines.iter().enumerate() {
        let y = start_y + i as u16;
        if y >= area.y + area.height {
            break;
        }
        let start_x = area.x + area.width.saturating_sub(line.len() as u16) / 2;
        for (j, ch) in line.chars().enumerate() {
            let x = start_x + j as u16;
            if x < area.x + area.width {
                if let Some(cell) = buf.cell_mut((x, y)) {
                    cell.set_char(ch);
                    cell.set_style(style);
                }
            }
        }
    }
}

/// Render the master name row: stars + ALL CAPS name + archetype.
fn render_name_row(area: Rect, buf: &mut Buffer, state: &AppState, night: bool) {
    if area.height == 0 || area.width < 4 {
        return;
    }

    let rarity_color = rarity_color(state.rarity, night);
    let stars: String = "\u{2605}".repeat(state.rarity.stars() as usize); // ★

    // Line 1: ★★★★★ MASTER NAME
    let name_display = if state.master_name.is_empty() {
        "GUARDIAN".to_string()
    } else {
        state.master_name.to_uppercase()
    };

    let star_style = Style::default()
        .fg(rarity_color)
        .add_modifier(Modifier::BOLD);
    let name_style = Style::default()
        .fg(Color::White)
        .add_modifier(Modifier::BOLD);
    let name_style = if night {
        name_style.fg(Color::Gray)
    } else {
        name_style
    };

    // Render stars
    let mut col = area.x + 1; // 1-char left margin
    for ch in stars.chars() {
        if col >= area.x + area.width {
            break;
        }
        if let Some(cell) = buf.cell_mut((col, area.y)) {
            cell.set_char(ch);
            cell.set_style(star_style);
        }
        col += 1;
    }

    // Space after stars
    if col < area.x + area.width {
        col += 1;
    }

    // Render name
    for ch in name_display.chars() {
        if col >= area.x + area.width - 1 {
            break;
        }
        if let Some(cell) = buf.cell_mut((col, area.y)) {
            cell.set_char(ch);
            cell.set_style(name_style);
        }
        col += 1;
    }

    // Line 2: archetype (dim)
    if area.height >= 2 {
        let archetype_display = if state.archetype.is_empty() {
            "Awaiting Assignment"
        } else {
            &state.archetype
        };

        let archetype_style = Style::default().fg(if night {
            Color::Rgb(60, 60, 60)
        } else {
            Color::DarkGray
        });

        let y = area.y + 1;
        let mut col = area.x + 1;
        for ch in archetype_display.chars() {
            if col >= area.x + area.width - 1 {
                break;
            }
            if let Some(cell) = buf.cell_mut((col, y)) {
                cell.set_char(ch);
                cell.set_style(archetype_style);
            }
            col += 1;
        }
    }
}

/// Render the stats bars.
fn render_stats(area: Rect, buf: &mut Buffer, state: &AppState, night: bool) {
    let entries = build_stat_entries(
        state.balance_total,
        state.heat,
        state.pnl_percent,
    );
    // Indent stats by 1 char
    let stats_area = Rect {
        x: area.x + 1,
        y: area.y,
        width: area.width.saturating_sub(2),
        height: area.height,
    };
    let widget = StatsBar::new(&entries, night);
    widget.render(stats_area, buf);
}

/// Apply night-mode dimming to an area (reduce brightness of existing cells).
fn apply_night_dim(area: Rect, buf: &mut Buffer) {
    for y in area.y..area.y + area.height {
        for x in area.x..area.x + area.width {
            if let Some(cell) = buf.cell_mut((x, y)) {
                let fg = cell.fg;
                let bg = cell.bg;
                cell.set_fg(dim_rgb(fg));
                cell.set_bg(dim_rgb(bg));
            }
        }
    }
}

/// Dim an RGB color by reducing brightness.
fn dim_rgb(color: Color) -> Color {
    match color {
        Color::Rgb(r, g, b) => Color::Rgb(
            (r as f32 * 0.5) as u8,
            (g as f32 * 0.5) as u8,
            (b as f32 * 0.5) as u8,
        ),
        other => other,
    }
}

/// Map rarity to a display color.
fn rarity_color(rarity: Rarity, night: bool) -> Color {
    let color = match rarity {
        Rarity::Common => Color::Gray,
        Rarity::Uncommon => Color::Green,
        Rarity::Rare => Color::Cyan,
        Rarity::Epic => Color::Magenta,
        Rarity::Legendary => Color::Yellow,
    };
    if night {
        match color {
            Color::Rgb(r, g, b) => Color::Rgb(
                (r as f32 * 0.6) as u8,
                (g as f32 * 0.6) as u8,
                (b as f32 * 0.6) as u8,
            ),
            // Named colors can't be dimmed directly, leave them
            other => other,
        }
    } else {
        color
    }
}

/// Render a minimal placeholder for tiny areas.
fn render_placeholder(area: Rect, buf: &mut Buffer, night: bool) {
    let color = if night { Color::Rgb(40, 40, 40) } else { Color::DarkGray };
    let label = "[GUARDIAN]";
    let x = area.x + area.width.saturating_sub(label.len() as u16) / 2;
    let y = area.y + area.height / 2;
    if y < area.y + area.height {
        for (i, ch) in label.chars().enumerate() {
            let cx = x + i as u16;
            if cx < area.x + area.width {
                if let Some(cell) = buf.cell_mut((cx, y)) {
                    cell.set_char(ch);
                    cell.set_style(Style::default().fg(color));
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{SpeechBubble, Severity};

    fn test_state() -> AppState {
        AppState {
            master_name: "Jesse Livermore".to_string(),
            archetype: "The Speculator".to_string(),
            rarity: Rarity::Legendary,
            master_id: "jesse_livermore".to_string(),
            balance_total: 100_000.0,
            heat: 25.0,
            pnl_percent: 3.2,
            ..AppState::default()
        }
    }

    #[test]
    fn test_companion_pane_renders() {
        let state = test_state();
        let queue = SpeechBubbleQueue::default();
        let area = Rect::new(0, 0, 30, 20);
        let mut buf = Buffer::empty(area);

        let pane = CompanionPane::new(&state, &queue, None);
        pane.render(area, &mut buf);

        // Check border exists (top-left should be box drawing)
        let tl = buf.cell((0, 0)).unwrap().symbol().to_string();
        assert!(!tl.is_empty());
    }

    #[test]
    fn test_companion_pane_with_bubble() {
        let state = test_state();
        let mut queue = SpeechBubbleQueue::default();
        queue.push(SpeechBubble::new(
            "Watch your position!".into(),
            Severity::Medium,
        ));

        let area = Rect::new(0, 0, 30, 25);
        let mut buf = Buffer::empty(area);
        let pane = CompanionPane::new(&state, &queue, None);
        pane.render(area, &mut buf);
    }

    #[test]
    fn test_companion_pane_minimal_size() {
        let state = test_state();
        let queue = SpeechBubbleQueue::default();
        let area = Rect::new(0, 0, 8, 8);
        let mut buf = Buffer::empty(area);

        let pane = CompanionPane::new(&state, &queue, None);
        // Should not panic
        pane.render(area, &mut buf);
    }

    #[test]
    fn test_companion_pane_empty_master() {
        let state = AppState::default();
        let queue = SpeechBubbleQueue::default();
        let area = Rect::new(0, 0, 30, 20);
        let mut buf = Buffer::empty(area);

        let pane = CompanionPane::new(&state, &queue, None);
        pane.render(area, &mut buf);
    }

    #[test]
    fn test_rarity_colors_distinct() {
        let rarities = [
            Rarity::Common,
            Rarity::Uncommon,
            Rarity::Rare,
            Rarity::Epic,
            Rarity::Legendary,
        ];
        for i in 0..rarities.len() {
            for j in (i + 1)..rarities.len() {
                assert_ne!(
                    rarity_color(rarities[i], false),
                    rarity_color(rarities[j], false),
                );
            }
        }
    }

    #[test]
    fn test_dim_rgb() {
        let c = dim_rgb(Color::Rgb(200, 100, 50));
        assert_eq!(c, Color::Rgb(100, 50, 25));
    }

    #[test]
    fn test_dim_rgb_non_rgb() {
        assert_eq!(dim_rgb(Color::Red), Color::Red);
    }

    #[test]
    fn test_name_row_renders() {
        let state = test_state();
        let area = Rect::new(0, 0, 30, 2);
        let mut buf = Buffer::empty(area);
        render_name_row(area, &mut buf, &state, false);

        // Stars should appear near the start
        let star_cell = buf.cell((1, 0)).unwrap().symbol().to_string();
        assert_eq!(star_cell, "\u{2605}"); // ★
    }

    #[test]
    fn test_sprite_placeholder_renders() {
        let area = Rect::new(0, 0, 20, 6);
        let mut buf = Buffer::empty(area);
        render_sprite_placeholder(area, &mut buf, false);
        // Should contain some non-space characters
        let has_content = (0..area.width).any(|x| {
            let s = buf.cell((x, area.y + 1)).unwrap().symbol().to_string();
            s != " "
        });
        assert!(has_content);
    }
}
