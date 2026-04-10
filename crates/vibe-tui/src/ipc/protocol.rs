use std::io;

use tokio::io::{AsyncReadExt, AsyncWriteExt};

use crate::ipc::messages::{BackendMessage, OutboundMessage};

/// Length prefix size in bytes (u32 big-endian), matching the Node.js side.
const FRAME_HEADER_SIZE: usize = 4;

/// Maximum payload size: 16 MB. Prevents accidental memory exhaustion.
const MAX_PAYLOAD_SIZE: u32 = 16 * 1024 * 1024;

/// Read a single length-prefixed MessagePack frame and deserialize it.
///
/// Wire format: `[u32 BE length][N bytes msgpack payload]`
///
/// Returns `Ok(None)` on clean EOF (stream closed).
/// Returns `Err` on I/O errors, corrupt frames, or oversized payloads.
pub async fn read_frame<R: AsyncReadExt + Unpin>(
    reader: &mut R,
) -> io::Result<Option<BackendMessage>> {
    // Read the 4-byte length prefix
    let mut len_buf = [0u8; FRAME_HEADER_SIZE];
    match reader.read_exact(&mut len_buf).await {
        Ok(_) => {}
        Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    }

    let payload_len = u32::from_be_bytes(len_buf);

    if payload_len > MAX_PAYLOAD_SIZE {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!(
                "frame payload too large: {payload_len} bytes (max {MAX_PAYLOAD_SIZE})"
            ),
        ));
    }

    // Read the payload
    let mut payload = vec![0u8; payload_len as usize];
    reader.read_exact(&mut payload).await?;

    // Deserialize
    let msg: BackendMessage = rmp_serde::from_slice(&payload).map_err(|e| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("msgpack deserialize error: {e}"),
        )
    })?;

    Ok(Some(msg))
}

/// Serialize an outbound message to a length-prefixed MessagePack frame and
/// write it to the given writer.
///
/// Wire format: `[u32 BE length][N bytes msgpack payload]`
pub async fn write_frame<W: AsyncWriteExt + Unpin>(
    writer: &mut W,
    msg: &OutboundMessage,
) -> io::Result<()> {
    let payload = rmp_serde::to_vec_named(msg).map_err(|e| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("msgpack serialize error: {e}"),
        )
    })?;

    let len = payload.len() as u32;
    writer.write_all(&len.to_be_bytes()).await?;
    writer.write_all(&payload).await?;
    writer.flush().await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a raw frame (u32 BE length + msgpack payload) from a JSON-like value.
    fn build_raw_frame(value: &serde_json::Value) -> Vec<u8> {
        let payload = rmp_serde::to_vec_named(value).expect("serialize value");
        let len = payload.len() as u32;
        let mut frame = Vec::with_capacity(4 + payload.len());
        frame.extend_from_slice(&len.to_be_bytes());
        frame.extend_from_slice(&payload);
        frame
    }

    #[tokio::test]
    async fn test_read_frame_stream_chunk() {
        let raw = build_raw_frame(&serde_json::json!({
            "type": "StreamChunk",
            "text": "hi",
            "timestamp": 1.0
        }));
        let mut cursor = io::Cursor::new(raw);
        let msg = read_frame(&mut cursor).await.unwrap().unwrap();
        match msg {
            BackendMessage::StreamChunk { text, .. } => assert_eq!(text, "hi"),
            other => panic!("Expected StreamChunk, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn test_read_frame_eof() {
        let mut cursor = io::Cursor::new(Vec::<u8>::new());
        let result = read_frame(&mut cursor).await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_read_frame_oversized() {
        // Create a frame with a length prefix that exceeds MAX_PAYLOAD_SIZE
        let bad_len: u32 = MAX_PAYLOAD_SIZE + 1;
        let mut data = Vec::new();
        data.extend_from_slice(&bad_len.to_be_bytes());
        data.extend_from_slice(&[0u8; 8]); // some dummy bytes
        let mut cursor = io::Cursor::new(data);
        let result = read_frame(&mut cursor).await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::InvalidData);
    }

    #[tokio::test]
    async fn test_write_then_read_roundtrip() {
        let outbound = OutboundMessage::UserInput {
            text: "hello".to_string(),
        };

        // Write to buffer
        let mut buf = Vec::new();
        write_frame(&mut buf, &outbound).await.unwrap();

        // Verify the frame structure: 4-byte header + msgpack
        assert!(buf.len() > 4);
        let payload_len = u32::from_be_bytes([buf[0], buf[1], buf[2], buf[3]]) as usize;
        assert_eq!(payload_len, buf.len() - 4);

        // Verify the msgpack payload deserializes correctly
        let payload = &buf[4..];
        let value: serde_json::Value =
            rmp_serde::from_slice(payload).expect("deserialize");
        assert_eq!(value["type"], "UserInput");
        assert_eq!(value["text"], "hello");
    }

    #[tokio::test]
    async fn test_read_multiple_frames() {
        let mut data = Vec::new();
        data.extend(build_raw_frame(&serde_json::json!({
            "type": "Heartbeat"
        })));
        data.extend(build_raw_frame(&serde_json::json!({
            "type": "StreamChunk",
            "text": "second",
            "timestamp": 2.0
        })));

        let mut cursor = io::Cursor::new(data);

        let first = read_frame(&mut cursor).await.unwrap().unwrap();
        assert_eq!(first, BackendMessage::Heartbeat);

        let second = read_frame(&mut cursor).await.unwrap().unwrap();
        match second {
            BackendMessage::StreamChunk { text, .. } => assert_eq!(text, "second"),
            other => panic!("Expected StreamChunk, got {other:?}"),
        }

        // EOF
        let third = read_frame(&mut cursor).await.unwrap();
        assert!(third.is_none());
    }

    #[tokio::test]
    async fn test_heartbeat_ack_roundtrip() {
        let msg = OutboundMessage::HeartbeatAck;
        let mut buf = Vec::new();
        write_frame(&mut buf, &msg).await.unwrap();

        let payload = &buf[4..];
        let value: serde_json::Value =
            rmp_serde::from_slice(payload).expect("deserialize");
        assert_eq!(value["type"], "HeartbeatAck");
    }
}
