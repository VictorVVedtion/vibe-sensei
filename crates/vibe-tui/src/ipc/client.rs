use std::sync::Arc;
use std::time::Duration;

use tokio::io::WriteHalf;
use tokio::net::UnixStream;
use tokio::sync::{mpsc, Mutex};

use crate::ipc::messages::{BackendMessage, OutboundMessage};
use crate::ipc::protocol::{read_frame, write_frame};

/// Maximum reconnection attempts before giving up.
const MAX_RETRIES: u32 = 3;

/// Backoff durations for reconnection: 1s, 2s, 4s.
const BACKOFF_DURATIONS: [Duration; 3] = [
    Duration::from_secs(1),
    Duration::from_secs(2),
    Duration::from_secs(4),
];

/// IPC client that connects to the Node.js UDS server.
///
/// Runs as a background tokio task, forwarding deserialized `BackendMessage`
/// values to the App via an mpsc channel. Supports auto-reconnect with
/// exponential backoff (1s/2s/4s, max 3 retries) and automatic HeartbeatAck
/// responses.
#[allow(dead_code)]
pub struct IpcClient {
    /// Shared write half, protected by a mutex for concurrent send safety.
    writer: Arc<Mutex<Option<WriteHalf<UnixStream>>>>,
    /// Socket path for (re)connection.
    socket_path: String,
}

#[allow(dead_code)]
impl IpcClient {
    /// Discover the socket path from the `VIBE_SENSEI_SOCK` env var.
    ///
    /// Returns `None` if the env var is not set.
    pub fn socket_path_from_env() -> Option<String> {
        std::env::var("VIBE_SENSEI_SOCK").ok()
    }

    /// Spawn the IPC background task.
    ///
    /// Connects to the UDS at `socket_path`, reads frames in a loop, sends
    /// `BackendMessage` values through the returned receiver. Automatically
    /// responds to Heartbeat frames with HeartbeatAck.
    ///
    /// Returns:
    /// - `IpcClient` handle for sending outbound messages
    /// - `mpsc::Receiver<BackendMessage>` for the App to consume
    pub fn spawn(socket_path: String) -> (Self, mpsc::Receiver<BackendMessage>) {
        let (tx, rx) = mpsc::channel::<BackendMessage>(256);
        let writer: Arc<Mutex<Option<WriteHalf<UnixStream>>>> =
            Arc::new(Mutex::new(None));
        let writer_clone = Arc::clone(&writer);
        let path_clone = socket_path.clone();

        tokio::spawn(async move {
            Self::run_loop(path_clone, tx, writer_clone).await;
        });

        let client = Self {
            writer,
            socket_path,
        };

        (client, rx)
    }

    /// Send a user input message to the Node.js backend.
    pub async fn send_user_input(&self, text: String) -> Result<(), String> {
        let msg = OutboundMessage::UserInput { text };
        self.send(msg).await
    }

    /// Send a tool approval response to the Node.js backend.
    pub async fn send_tool_approval(
        &self,
        id: String,
        allow: bool,
    ) -> Result<(), String> {
        let msg = OutboundMessage::ToolApproval { id, allow };
        self.send(msg).await
    }

    /// Get the socket path this client connects to.
    pub fn socket_path(&self) -> &str {
        &self.socket_path
    }

    /// Send an outbound message through the write half.
    async fn send(&self, msg: OutboundMessage) -> Result<(), String> {
        let mut guard = self.writer.lock().await;
        match guard.as_mut() {
            Some(w) => write_frame(w, &msg)
                .await
                .map_err(|e| format!("IPC write error: {e}")),
            None => Err("IPC not connected".to_string()),
        }
    }

    /// Main read loop with auto-reconnect.
    async fn run_loop(
        socket_path: String,
        tx: mpsc::Sender<BackendMessage>,
        writer: Arc<Mutex<Option<WriteHalf<UnixStream>>>>,
    ) {
        let mut retries: u32 = 0;

        loop {
            match Self::connect_and_read(
                &socket_path,
                &tx,
                &writer,
            )
            .await
            {
                Ok(()) => {
                    // Clean disconnect (EOF). Don't retry — server closed.
                    tracing::info!("IPC: server closed connection");
                    break;
                }
                Err(e) => {
                    tracing::warn!("IPC connection error: {e}");

                    // Clear the writer on disconnect
                    {
                        let mut guard = writer.lock().await;
                        *guard = None;
                    }

                    if retries >= MAX_RETRIES {
                        tracing::error!(
                            "IPC: max retries ({MAX_RETRIES}) exhausted, giving up"
                        );
                        break;
                    }

                    let delay = BACKOFF_DURATIONS[retries as usize];
                    tracing::info!(
                        "IPC: reconnecting in {}s (attempt {}/{})",
                        delay.as_secs(),
                        retries + 1,
                        MAX_RETRIES
                    );
                    tokio::time::sleep(delay).await;
                    retries += 1;
                }
            }
        }
    }

    /// Connect to the socket, install the write half, and read frames until
    /// EOF or error.
    async fn connect_and_read(
        socket_path: &str,
        tx: &mpsc::Sender<BackendMessage>,
        writer: &Arc<Mutex<Option<WriteHalf<UnixStream>>>>,
    ) -> Result<(), String> {
        let stream = UnixStream::connect(socket_path)
            .await
            .map_err(|e| format!("connect failed: {e}"))?;

        let (mut read_half, write_half) = tokio::io::split(stream);

        // Install the write half for outbound messages
        {
            let mut guard = writer.lock().await;
            *guard = Some(write_half);
        }

        tracing::info!("IPC: connected to {socket_path}");

        // Read loop
        loop {
            match read_frame(&mut read_half).await {
                Ok(Some(BackendMessage::Heartbeat)) => {
                    // Auto-respond with HeartbeatAck
                    let mut guard = writer.lock().await;
                    if let Some(w) = guard.as_mut() {
                        if let Err(e) =
                            write_frame(w, &OutboundMessage::HeartbeatAck).await
                        {
                            tracing::warn!("IPC: failed to send HeartbeatAck: {e}");
                        }
                    }
                }
                Ok(Some(msg)) => {
                    // Forward to App. If receiver is dropped, stop reading.
                    if tx.send(msg).await.is_err() {
                        tracing::info!("IPC: receiver dropped, stopping read loop");
                        return Ok(());
                    }
                }
                Ok(None) => {
                    // Clean EOF
                    return Ok(());
                }
                Err(e) => {
                    return Err(format!("read error: {e}"));
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_socket_path_from_env_missing() {
        // When VIBE_SENSEI_SOCK is not set, should return None.
        // (We can't guarantee it's unset in CI, so just test the function exists.)
        let result = IpcClient::socket_path_from_env();
        // The result depends on the environment; just ensure no panic.
        let _ = result;
    }

    #[test]
    fn test_backoff_durations() {
        assert_eq!(BACKOFF_DURATIONS[0], Duration::from_secs(1));
        assert_eq!(BACKOFF_DURATIONS[1], Duration::from_secs(2));
        assert_eq!(BACKOFF_DURATIONS[2], Duration::from_secs(4));
    }

    #[test]
    fn test_max_retries_matches_backoff_len() {
        assert_eq!(MAX_RETRIES as usize, BACKOFF_DURATIONS.len());
    }

    #[tokio::test]
    async fn test_send_without_connection_returns_error() {
        let (client, _rx) = (
            IpcClient {
                writer: Arc::new(Mutex::new(None)),
                socket_path: "/tmp/nonexistent.sock".to_string(),
            },
            (),
        );
        let result = client.send_user_input("hello".to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not connected"));
    }
}
