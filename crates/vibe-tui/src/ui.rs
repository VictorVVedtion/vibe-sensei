use ratatui::{
    layout::{Alignment, Constraint, Flex, Layout, Rect},
    style::{Color, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Paragraph},
    Frame,
};

use crate::app::App;
use crate::layout::{compute_layout_mode, LayoutMode};
use crate::widgets::braille_chart::{render_chart, BrailleChartWidget};
use crate::widgets::chart_axis::{CurrentPriceLine, PriceAxis, TimeAxis, PRICE_AXIS_WIDTH, TIME_AXIS_HEIGHT};
use crate::widgets::chart_header::{ChartHeader, TimeframeTabs};
use crate::widgets::chat_panel::ChatPanel;
use crate::widgets::companion_pane::CompanionPane;
use crate::widgets::input_bar::InputBar;
use crate::widgets::permission_prompt::PermissionPrompt;
use crate::widgets::status_bar::StatusBar;

/// Matrix green: #00FF41 -> Rgb(0, 255, 65)
const MATRIX_GREEN: Color = Color::Rgb(0, 255, 65);

/// Minimum terminal columns required.
const MIN_COLS: u16 = 100;

/// Minimum terminal rows required.
const MIN_ROWS: u16 = 24;

/// Render the main UI frame.
///
/// Layout: vertical split into main area (top, fills) + status bar (bottom, 1 row).
/// Main area uses an adaptive horizontal split based on terminal width:
/// - Full3Panel (>=120): market 40% | chat 35% | companion 25%
/// - Compact2Panel (100-119): market 50% | chat 50%
/// - MinimalChat (<100): chat 100%
///
/// If terminal is too small (<100x24), shows a centered "Terminal too small" message.
pub fn render(frame: &mut Frame, app: &App) {
    let area = frame.area();

    // Terminal size guard
    if area.width < MIN_COLS || area.height < MIN_ROWS {
        render_too_small(frame, area);
        return;
    }

    // Split into main area + 1-row status bar
    let [main_area, status_area] = Layout::vertical([
        Constraint::Fill(1),
        Constraint::Length(1),
    ])
    .areas(area);

    // Determine layout mode from current terminal width
    let mode = compute_layout_mode(area.width);

    // Render panels based on layout mode
    render_panels(frame, mode, main_area, app);

    // Render status bar (always at bottom, includes vim mode indicator)
    let status_bar = StatusBar::new(&app.state, &app.input);
    frame.render_widget(status_bar, status_area);

    // Render permission prompt overlay when a tool is awaiting approval
    if let Some(ref perm) = app.tool_permission_pending {
        let prompt = PermissionPrompt::new(
            perm.name.clone(),
            perm.id.clone(),
        );
        frame.render_widget(prompt, area);
    }
}

/// Render the "Terminal too small" fallback message.
fn render_too_small(frame: &mut Frame, area: Rect) {
    let [_, center, _] = Layout::vertical([
        Constraint::Fill(1),
        Constraint::Length(1),
        Constraint::Fill(1),
    ])
    .flex(Flex::Center)
    .areas(area);

    let msg = Text::from(Line::from(vec![
        Span::styled(
            "Terminal too small",
            Style::default().fg(Color::Red),
        ),
        Span::raw(" "),
        Span::styled(
            format!(
                "(need {}x{}, have {}x{})",
                MIN_COLS, MIN_ROWS, area.width, area.height
            ),
            Style::default().fg(Color::DarkGray),
        ),
    ]));

    let paragraph = Paragraph::new(msg).alignment(Alignment::Center);
    frame.render_widget(paragraph, center);
}

/// Render the adaptive panel layout in the main area.
fn render_panels(frame: &mut Frame, mode: LayoutMode, area: Rect, app: &App) {
    match mode {
        LayoutMode::Full3Panel => {
            let [market, chat, companion] = Layout::horizontal([
                Constraint::Percentage(40),
                Constraint::Percentage(35),
                Constraint::Percentage(25),
            ])
            .areas(area);

            render_market(frame, market, app);
            render_chat(frame, chat, app);
render_companion(frame, companion, app);
render_companion(frame, companion, app);
        }
        LayoutMode::Compact2Panel => {
            let [market, chat] = Layout::horizontal([
                Constraint::Percentage(50),
                Constraint::Percentage(50),
            ])
            .areas(area);

            render_market(frame, market, app);
            render_chat(frame, chat, app);
        }
        LayoutMode::MinimalChat => {
            render_chat(frame, area, app);
        }
    }
}

/// Render the chat zone: messages area (fill) + input bar (1-2 rows at bottom).
///
/// When the input buffer starts with "/", a command hint line appears above
/// the input bar, consuming 2 rows total. Otherwise the input bar is 1 row.
fn render_chat(frame: &mut Frame, area: Rect, app: &App) {
    let input_rows = if app.input.is_command() { 2 } else { 1 };
    let [messages_area, input_area] = Layout::vertical([
        Constraint::Fill(1),
        Constraint::Length(input_rows),
    ])
    .areas(area);

    // Chat messages panel (with tool call state for inline rendering)
    let chat_panel = ChatPanel::new(
        &app.messages,
        &app.pending_tools,
        app.spinner_tick,
    );
    frame.render_widget(chat_panel, messages_area);

    // Input bar
    let input_bar = InputBar::new(&app.input, app.boot);
    frame.render_widget(input_bar, input_area);

    // Permission prompt overlay (renders on top when active)
    if let Some(ref perm) = app.tool_permission_pending {
        let prompt = PermissionPrompt::new(perm.name.clone(), perm.id.clone());
        frame.render_widget(prompt, area);
    }
}

/// Render the MARKET zone: chart header + Braille chart + timeframe tabs.
///
/// Layout within the market area (top to bottom):
/// - 1 row: chart header (symbol + price + change% + regime)
/// - fill: chart body (Braille candlesticks + price axis)
/// - 1 row: time axis
/// - 1 row: timeframe tabs
fn render_market(frame: &mut Frame, area: Rect, app: &App) {
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(MATRIX_GREEN))
        .title("[MARKET]")
        .title_style(Style::default().fg(MATRIX_GREEN));

    let inner = block.inner(area);
    frame.render_widget(block, area);

    if inner.width < 10 || inner.height < 6 {
        return;
    }

    // Vertical split: header (1) | chart body (fill) | time axis (1) | tabs (1)
    let [header_area, chart_body, time_area, tabs_area] = Layout::vertical([
        Constraint::Length(1),
        Constraint::Fill(1),
        Constraint::Length(TIME_AXIS_HEIGHT),
        Constraint::Length(1),
    ])
    .areas(inner);

    // Chart header
    let header = ChartHeader::new(
        &app.state.chart_symbol,
        app.state.last_price,
        app.state.prev_close,
        &app.state.regime,
        app.state.active_timeframe,
    );
    frame.render_widget(header, header_area);

    // Chart body: braille chart (fill) | price axis (PRICE_AXIS_WIDTH)
    let axis_w = PRICE_AXIS_WIDTH.min(chart_body.width / 3);
    let [braille_area, price_axis_area] = Layout::horizontal([
        Constraint::Fill(1),
        Constraint::Length(axis_w),
    ])
    .areas(chart_body);

    if !app.ohlcv_buffer.is_empty() {
        let chart_w = braille_area.width as usize;
        let chart_h = braille_area.height as usize;

        // Render Braille candlestick chart
        let chart_data = render_chart(&app.ohlcv_buffer, chart_w, chart_h);
        let chart_widget = BrailleChartWidget::new(&chart_data);
        frame.render_widget(chart_widget, braille_area);

        // Current price dotted line overlay
        let price_line = CurrentPriceLine::from_buffer(
            &app.ohlcv_buffer,
            chart_w,
            braille_area.height,
        );
        frame.render_widget(price_line, braille_area);

        // Price axis
        let price_axis = PriceAxis::from_buffer(&app.ohlcv_buffer, chart_w);
        frame.render_widget(price_axis, price_axis_area);

        // Time axis
        let time_axis = TimeAxis::from_buffer(&app.ohlcv_buffer, chart_w);
        frame.render_widget(time_axis, time_area);
    } else {
        // Empty state: show placeholder
        let placeholder = Paragraph::new(Text::from(Line::from(Span::styled(
            "Waiting for price data...",
            Style::default().fg(Color::DarkGray),
        ))))
        .alignment(Alignment::Center);
        frame.render_widget(placeholder, braille_area);
    }

    // Timeframe tabs
    let tabs = TimeframeTabs::new(app.state.active_timeframe);
    frame.render_widget(tabs, tabs_area);
}

/// Render the companion pane in the GUARDIAN zone.
///
/// Composes the CompanionPane widget with sprite, stats, and speech bubble.
/// Sprite loading from disk is deferred to a future sprint — for now the
/// ASCII placeholder is shown when no sprite image is available.
fn render_companion(frame: &mut Frame, area: Rect, app: &App) {
    // Sprite image loading requires mutable access to the sprite_loader cache.
    // Since we only have an immutable borrow of `app` during rendering,
    // sprite pre-loading should happen in the tick loop (future sprint).
    // For now, pass None and the CompanionPane renders a placeholder.
    let pane = CompanionPane::new(
        &app.state,
        &app.speech_bubbles,
        None,
    );
    frame.render_widget(pane, area);
}

/// Render a single zone with a bordered block and centered placeholder text.
#[allow(dead_code)]
fn render_zone(frame: &mut Frame, area: Rect, title: &str) {
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(MATRIX_GREEN))
        .title(format!("[{title}]"))
        .title_style(Style::default().fg(MATRIX_GREEN));

    let placeholder = Paragraph::new(Text::from(Line::from(Span::styled(
        format!("{title} placeholder"),
        Style::default().fg(Color::DarkGray),
    ))))
    .alignment(Alignment::Center)
    .block(block);

    frame.render_widget(placeholder, area);
}
