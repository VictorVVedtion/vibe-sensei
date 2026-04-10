use std::collections::HashMap;

use serde::{Deserialize, Serialize};

// ─── Inbound (Server → Client): BackendMessage ─────────────────────────────

/// All messages the Rust TUI can receive from the Node.js backend.
///
/// Field names use camelCase to match the Node.js MessagePack wire format.
/// The discriminant is `type` via `#[serde(tag = "type")]`.
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum BackendMessage {
    StreamChunk {
        text: String,
        timestamp: f64,
    },
    ToolCallStart {
        id: String,
        name: String,
        input: HashMap<String, serde::de::IgnoredAny>,
        timestamp: f64,
    },
    ToolCallEnd {
        id: String,
        output: String,
        #[serde(rename = "isError")]
        is_error: bool,
        timestamp: f64,
    },
    GuardianAlert {
        severity: String,
        message: String,
        emotion: String,
        #[serde(rename = "masterName")]
        master_name: String,
        timestamp: f64,
    },
    DebateStart {
        #[serde(rename = "forMaster")]
        for_master: String,
        #[serde(rename = "againstMaster")]
        against_master: String,
        topic: String,
        timestamp: f64,
    },
    GhostWarning {
        #[serde(rename = "ghostId")]
        ghost_id: String,
        #[serde(rename = "ghostName")]
        ghost_name: String,
        #[serde(rename = "triggerReason")]
        trigger_reason: String,
        quote: String,
        timestamp: f64,
    },
    BalanceUpdate {
        balances: Vec<BalanceEntry>,
        timestamp: f64,
    },
    PriceUpdate {
        symbol: String,
        ohlcv: Ohlcv,
        timestamp: f64,
    },
    StateSync {
        #[serde(rename = "fullState")]
        full_state: HashMap<String, serde::de::IgnoredAny>,
        timestamp: f64,
    },
    Heartbeat,
}

/// A single balance entry inside `BalanceUpdate`.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct BalanceEntry {
    pub currency: String,
    pub free: f64,
    pub used: f64,
    pub total: f64,
}

/// OHLCV candle data inside `PriceUpdate`.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct Ohlcv {
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

// ─── Outbound (Client → Server) ────────────────────────────────────────────

/// Messages the Rust TUI sends to the Node.js backend.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "type")]
#[allow(dead_code)]
pub enum OutboundMessage {
    UserInput { text: String },
    ToolApproval { id: String, allow: bool },
    HeartbeatAck,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: round-trip through msgpack to verify serde compat.
    fn deser_backend(value: &serde_json::Value) -> BackendMessage {
        let bytes = rmp_serde::to_vec_named(value).expect("serialize");
        rmp_serde::from_slice(&bytes).expect("deserialize")
    }

    #[test]
    fn test_stream_chunk() {
        let json = serde_json::json!({
            "type": "StreamChunk",
            "text": "Hello world",
            "timestamp": 1234567890.0
        });
        let msg = deser_backend(&json);
        match msg {
            BackendMessage::StreamChunk { text, timestamp } => {
                assert_eq!(text, "Hello world");
                assert!((timestamp - 1_234_567_890.0).abs() < f64::EPSILON);
            }
            other => panic!("Expected StreamChunk, got {other:?}"),
        }
    }

    #[test]
    fn test_tool_call_start() {
        let json = serde_json::json!({
            "type": "ToolCallStart",
            "id": "tc-1",
            "name": "PlaceOrder",
            "input": {"symbol": "BTC/USDT", "amount": 0.1},
            "timestamp": 100.0
        });
        let msg = deser_backend(&json);
        match msg {
            BackendMessage::ToolCallStart {
                id, name, timestamp, ..
            } => {
                assert_eq!(id, "tc-1");
                assert_eq!(name, "PlaceOrder");
                assert!((timestamp - 100.0).abs() < f64::EPSILON);
            }
            other => panic!("Expected ToolCallStart, got {other:?}"),
        }
    }

    #[test]
    fn test_tool_call_end() {
        let json = serde_json::json!({
            "type": "ToolCallEnd",
            "id": "tc-1",
            "output": "Order placed",
            "isError": false,
            "timestamp": 101.0
        });
        let msg = deser_backend(&json);
        match msg {
            BackendMessage::ToolCallEnd {
                id,
                output,
                is_error,
                timestamp,
            } => {
                assert_eq!(id, "tc-1");
                assert_eq!(output, "Order placed");
                assert!(!is_error);
                assert!((timestamp - 101.0).abs() < f64::EPSILON);
            }
            other => panic!("Expected ToolCallEnd, got {other:?}"),
        }
    }

    #[test]
    fn test_guardian_alert() {
        let json = serde_json::json!({
            "type": "GuardianAlert",
            "severity": "high",
            "message": "Position too large!",
            "emotion": "angry",
            "masterName": "Jesse Livermore",
            "timestamp": 200.0
        });
        let msg = deser_backend(&json);
        match msg {
            BackendMessage::GuardianAlert {
                severity,
                message,
                emotion,
                master_name,
                timestamp,
            } => {
                assert_eq!(severity, "high");
                assert_eq!(message, "Position too large!");
                assert_eq!(emotion, "angry");
                assert_eq!(master_name, "Jesse Livermore");
                assert!((timestamp - 200.0).abs() < f64::EPSILON);
            }
            other => panic!("Expected GuardianAlert, got {other:?}"),
        }
    }

    #[test]
    fn test_debate_start() {
        let json = serde_json::json!({
            "type": "DebateStart",
            "forMaster": "Sun Tzu",
            "againstMaster": "Buffett",
            "topic": "leverage",
            "timestamp": 300.0
        });
        let msg = deser_backend(&json);
        match msg {
            BackendMessage::DebateStart {
                for_master,
                against_master,
                topic,
                timestamp,
            } => {
                assert_eq!(for_master, "Sun Tzu");
                assert_eq!(against_master, "Buffett");
                assert_eq!(topic, "leverage");
                assert!((timestamp - 300.0).abs() < f64::EPSILON);
            }
            other => panic!("Expected DebateStart, got {other:?}"),
        }
    }

    #[test]
    fn test_ghost_warning() {
        let json = serde_json::json!({
            "type": "GhostWarning",
            "ghostId": "sbf",
            "ghostName": "SBF",
            "triggerReason": "Overleveraged",
            "quote": "I had a moment of...",
            "timestamp": 400.0
        });
        let msg = deser_backend(&json);
        match msg {
            BackendMessage::GhostWarning {
                ghost_id,
                ghost_name,
                trigger_reason,
                quote,
                timestamp,
            } => {
                assert_eq!(ghost_id, "sbf");
                assert_eq!(ghost_name, "SBF");
                assert_eq!(trigger_reason, "Overleveraged");
                assert_eq!(quote, "I had a moment of...");
                assert!((timestamp - 400.0).abs() < f64::EPSILON);
            }
            other => panic!("Expected GhostWarning, got {other:?}"),
        }
    }

    #[test]
    fn test_balance_update() {
        let json = serde_json::json!({
            "type": "BalanceUpdate",
            "balances": [
                {"currency": "USDT", "free": 95000.0, "used": 5000.0, "total": 100000.0},
                {"currency": "BTC", "free": 0.5, "used": 0.0, "total": 0.5}
            ],
            "timestamp": 500.0
        });
        let msg = deser_backend(&json);
        match msg {
            BackendMessage::BalanceUpdate {
                balances,
                timestamp,
            } => {
                assert_eq!(balances.len(), 2);
                assert_eq!(balances[0].currency, "USDT");
                assert!((balances[0].total - 100_000.0).abs() < f64::EPSILON);
                assert_eq!(balances[1].currency, "BTC");
                assert!((timestamp - 500.0).abs() < f64::EPSILON);
            }
            other => panic!("Expected BalanceUpdate, got {other:?}"),
        }
    }

    #[test]
    fn test_price_update() {
        let json = serde_json::json!({
            "type": "PriceUpdate",
            "symbol": "BTC/USDT",
            "ohlcv": {"open": 60000.0, "high": 61000.0, "low": 59000.0, "close": 60500.0, "volume": 1234.5},
            "timestamp": 600.0
        });
        let msg = deser_backend(&json);
        match msg {
            BackendMessage::PriceUpdate {
                symbol,
                ohlcv,
                timestamp,
            } => {
                assert_eq!(symbol, "BTC/USDT");
                assert!((ohlcv.open - 60_000.0).abs() < f64::EPSILON);
                assert!((ohlcv.close - 60_500.0).abs() < f64::EPSILON);
                assert!((timestamp - 600.0).abs() < f64::EPSILON);
            }
            other => panic!("Expected PriceUpdate, got {other:?}"),
        }
    }

    #[test]
    fn test_state_sync() {
        let json = serde_json::json!({
            "type": "StateSync",
            "fullState": {"key": "value", "nested": {"a": 1}},
            "timestamp": 700.0
        });
        let msg = deser_backend(&json);
        match msg {
            BackendMessage::StateSync { timestamp, .. } => {
                assert!((timestamp - 700.0).abs() < f64::EPSILON);
            }
            other => panic!("Expected StateSync, got {other:?}"),
        }
    }

    #[test]
    fn test_heartbeat() {
        let json = serde_json::json!({"type": "Heartbeat"});
        let msg = deser_backend(&json);
        assert_eq!(msg, BackendMessage::Heartbeat);
    }

    #[test]
    fn test_outbound_user_input_serialize() {
        let msg = OutboundMessage::UserInput {
            text: "buy 1 BTC".to_string(),
        };
        let bytes = rmp_serde::to_vec_named(&msg).expect("serialize");
        let roundtrip: serde_json::Value =
            rmp_serde::from_slice(&bytes).expect("deserialize");
        assert_eq!(roundtrip["type"], "UserInput");
        assert_eq!(roundtrip["text"], "buy 1 BTC");
    }

    #[test]
    fn test_outbound_tool_approval_serialize() {
        let msg = OutboundMessage::ToolApproval {
            id: "tc-42".to_string(),
            allow: true,
        };
        let bytes = rmp_serde::to_vec_named(&msg).expect("serialize");
        let roundtrip: serde_json::Value =
            rmp_serde::from_slice(&bytes).expect("deserialize");
        assert_eq!(roundtrip["type"], "ToolApproval");
        assert_eq!(roundtrip["id"], "tc-42");
        assert_eq!(roundtrip["allow"], true);
    }

    #[test]
    fn test_outbound_heartbeat_ack_serialize() {
        let msg = OutboundMessage::HeartbeatAck;
        let bytes = rmp_serde::to_vec_named(&msg).expect("serialize");
        let roundtrip: serde_json::Value =
            rmp_serde::from_slice(&bytes).expect("deserialize");
        assert_eq!(roundtrip["type"], "HeartbeatAck");
    }
}
