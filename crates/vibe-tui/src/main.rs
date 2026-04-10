mod app;
pub mod chart;
mod input;
mod ipc;
mod layout;
pub mod sprites;
mod startup;
mod state;
pub mod terminal_caps;
mod ui;
mod widgets;

use std::io;

use app::App;
use color_eyre::eyre::Result;
use crossterm::{
    event::{DisableMouseCapture, EnableMouseCapture},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};

use crate::ipc::client::IpcClient;
use crate::terminal_caps::TerminalGrade;

#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;

    // Detect terminal capabilities
    let grade = TerminalGrade::detect();

    // Run the CRT boot animation (skippable via any keypress)
    if let Err(e) = startup::run(grade) {
        // Non-fatal — log and continue to the main TUI
        eprintln!("startup animation skipped: {e}");
    }

    // Discover UDS socket path from environment
    let ipc_client = match IpcClient::socket_path_from_env() {
        Some(path) => {
            let (client, rx) = IpcClient::spawn(path);
            Some((client, rx))
        }
        None => None,
    };

    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Build and run the app
    let (ipc, ipc_rx) = match ipc_client {
        Some((client, rx)) => (Some(client), Some(rx)),
        None => (None, None),
    };

    let mut app = App::new(ipc, ipc_rx, grade);
    let result = app.run(&mut terminal).await;

    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    result
}
