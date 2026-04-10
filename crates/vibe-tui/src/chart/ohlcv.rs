/// A single OHLCV (Open-High-Low-Close-Volume) candle.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Ohlcv {
    /// Unix timestamp in seconds.
    pub time: u64,
    /// Opening price.
    pub open: f64,
    /// Highest price in the period.
    pub high: f64,
    /// Lowest price in the period.
    pub low: f64,
    /// Closing price.
    pub close: f64,
    /// Volume traded in the period.
    pub volume: f64,
}

impl Ohlcv {
    /// Returns true when close >= open (bullish candle).
    pub fn is_bullish(&self) -> bool {
        self.close >= self.open
    }

    /// The body range: (min(open,close), max(open,close)).
    pub fn body_range(&self) -> (f64, f64) {
        if self.is_bullish() {
            (self.open, self.close)
        } else {
            (self.close, self.open)
        }
    }
}

/// Fixed-capacity ring buffer for OHLCV candles.
///
/// When full, the oldest candle is overwritten. Iteration always
/// returns candles in chronological order (oldest first).
pub struct OhlcvBuffer {
    buf: Vec<Ohlcv>,
    /// Write position (next slot to overwrite).
    head: usize,
    /// Number of valid entries.
    len: usize,
    /// Maximum capacity.
    cap: usize,
}

impl OhlcvBuffer {
    /// Create an empty buffer with the given maximum capacity.
    pub fn new(cap: usize) -> Self {
        assert!(cap > 0, "OhlcvBuffer capacity must be > 0");
        Self {
            buf: Vec::with_capacity(cap),
            head: 0,
            len: 0,
            cap,
        }
    }

    /// Push a new candle. If full, the oldest candle is overwritten.
    pub fn push(&mut self, candle: Ohlcv) {
        if self.buf.len() < self.cap {
            // Still filling up — just append
            self.buf.push(candle);
            self.len = self.buf.len();
            self.head = self.len % self.cap;
        } else {
            // Full — overwrite oldest
            self.buf[self.head] = candle;
            self.head = (self.head + 1) % self.cap;
            // len stays at cap
        }
    }

    /// Number of candles currently stored.
    pub fn len(&self) -> usize {
        self.len
    }

    /// Returns true when the buffer is empty.
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    /// Maximum number of candles the buffer can hold.
    pub fn capacity(&self) -> usize {
        self.cap
    }

    /// Returns the most recently pushed candle, if any.
    pub fn last(&self) -> Option<&Ohlcv> {
        if self.is_empty() {
            return None;
        }
        // The last written index is (head - 1) wrapped
        let idx = if self.head == 0 {
            self.len - 1
        } else {
            self.head - 1
        };
        Some(&self.buf[idx])
    }

    /// Returns an iterator over all candles in chronological order.
    pub fn iter(&self) -> OhlcvIter<'_> {
        OhlcvIter {
            buf: &self.buf,
            start: if self.len < self.cap { 0 } else { self.head },
            count: self.len,
            pos: 0,
            cap: self.cap,
        }
    }

    /// Returns the last `n` candles in chronological order.
    ///
    /// If fewer than `n` candles are stored, returns all of them.
    pub fn visible_range(&self, n: usize) -> Vec<&Ohlcv> {
        let n = n.min(self.len);
        let skip = self.len.saturating_sub(n);
        self.iter().skip(skip).collect()
    }

    /// Compute the average volume across all stored candles.
    pub fn avg_volume(&self) -> f64 {
        if self.is_empty() {
            return 0.0;
        }
        let sum: f64 = self.iter().map(|c| c.volume).sum();
        sum / self.len as f64
    }

    /// Find the global price range (min low, max high) across the last `n` candles.
    pub fn price_range(&self, n: usize) -> Option<(f64, f64)> {
        let candles = self.visible_range(n);
        if candles.is_empty() {
            return None;
        }
        let mut lo = f64::MAX;
        let mut hi = f64::MIN;
        for c in &candles {
            if c.low < lo {
                lo = c.low;
            }
            if c.high > hi {
                hi = c.high;
            }
        }
        Some((lo, hi))
    }

    /// Find the max volume across the last `n` candles.
    pub fn max_volume(&self, n: usize) -> f64 {
        self.visible_range(n)
            .iter()
            .map(|c| c.volume)
            .fold(0.0_f64, f64::max)
    }
}

/// Iterator over an `OhlcvBuffer` in chronological order.
pub struct OhlcvIter<'a> {
    buf: &'a [Ohlcv],
    start: usize,
    count: usize,
    pos: usize,
    cap: usize,
}

impl<'a> Iterator for OhlcvIter<'a> {
    type Item = &'a Ohlcv;

    fn next(&mut self) -> Option<Self::Item> {
        if self.pos >= self.count {
            return None;
        }
        let idx = (self.start + self.pos) % self.cap;
        self.pos += 1;
        Some(&self.buf[idx])
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let remaining = self.count - self.pos;
        (remaining, Some(remaining))
    }
}

impl<'a> ExactSizeIterator for OhlcvIter<'a> {}

#[cfg(test)]
mod tests {
    use super::*;

    fn candle(time: u64, open: f64, close: f64) -> Ohlcv {
        Ohlcv {
            time,
            open,
            high: open.max(close) + 1.0,
            low: open.min(close) - 1.0,
            close,
            volume: 100.0,
        }
    }

    #[test]
    fn test_ohlcv_bullish() {
        let c = Ohlcv {
            time: 0,
            open: 100.0,
            high: 110.0,
            low: 95.0,
            close: 105.0,
            volume: 50.0,
        };
        assert!(c.is_bullish());
        assert_eq!(c.body_range(), (100.0, 105.0));
    }

    #[test]
    fn test_ohlcv_bearish() {
        let c = Ohlcv {
            time: 0,
            open: 105.0,
            high: 110.0,
            low: 95.0,
            close: 100.0,
            volume: 50.0,
        };
        assert!(!c.is_bullish());
        assert_eq!(c.body_range(), (100.0, 105.0));
    }

    #[test]
    fn test_ohlcv_doji() {
        let c = Ohlcv {
            time: 0,
            open: 100.0,
            high: 105.0,
            low: 95.0,
            close: 100.0,
            volume: 50.0,
        };
        assert!(c.is_bullish()); // close == open → bullish by convention
    }

    #[test]
    fn test_buffer_empty() {
        let buf = OhlcvBuffer::new(10);
        assert!(buf.is_empty());
        assert_eq!(buf.len(), 0);
        assert_eq!(buf.capacity(), 10);
        assert!(buf.last().is_none());
    }

    #[test]
    fn test_buffer_push_and_len() {
        let mut buf = OhlcvBuffer::new(5);
        buf.push(candle(1, 100.0, 105.0));
        assert_eq!(buf.len(), 1);
        buf.push(candle(2, 105.0, 110.0));
        assert_eq!(buf.len(), 2);
    }

    #[test]
    fn test_buffer_last() {
        let mut buf = OhlcvBuffer::new(5);
        buf.push(candle(1, 100.0, 105.0));
        buf.push(candle(2, 110.0, 115.0));
        let last = buf.last().unwrap();
        assert_eq!(last.time, 2);
    }

    #[test]
    fn test_buffer_ring_overwrite() {
        let mut buf = OhlcvBuffer::new(3);
        buf.push(candle(1, 100.0, 101.0));
        buf.push(candle(2, 102.0, 103.0));
        buf.push(candle(3, 104.0, 105.0));
        assert_eq!(buf.len(), 3);

        // Push a 4th — should overwrite candle(1)
        buf.push(candle(4, 106.0, 107.0));
        assert_eq!(buf.len(), 3);

        let times: Vec<u64> = buf.iter().map(|c| c.time).collect();
        assert_eq!(times, vec![2, 3, 4]);
    }

    #[test]
    fn test_buffer_ring_last_after_wrap() {
        let mut buf = OhlcvBuffer::new(3);
        for i in 1..=5 {
            buf.push(candle(i, 100.0, 101.0));
        }
        assert_eq!(buf.last().unwrap().time, 5);
    }

    #[test]
    fn test_buffer_iter_order() {
        let mut buf = OhlcvBuffer::new(5);
        for i in 1..=5 {
            buf.push(candle(i, 100.0, 101.0));
        }
        let times: Vec<u64> = buf.iter().map(|c| c.time).collect();
        assert_eq!(times, vec![1, 2, 3, 4, 5]);
    }

    #[test]
    fn test_buffer_visible_range() {
        let mut buf = OhlcvBuffer::new(10);
        for i in 1..=8 {
            buf.push(candle(i, 100.0, 101.0));
        }

        // Request last 3
        let visible: Vec<u64> = buf.visible_range(3).iter().map(|c| c.time).collect();
        assert_eq!(visible, vec![6, 7, 8]);

        // Request more than available
        let all: Vec<u64> = buf.visible_range(100).iter().map(|c| c.time).collect();
        assert_eq!(all, vec![1, 2, 3, 4, 5, 6, 7, 8]);
    }

    #[test]
    fn test_buffer_avg_volume() {
        let mut buf = OhlcvBuffer::new(10);
        buf.push(Ohlcv {
            time: 1,
            open: 100.0,
            high: 110.0,
            low: 90.0,
            close: 105.0,
            volume: 200.0,
        });
        buf.push(Ohlcv {
            time: 2,
            open: 100.0,
            high: 110.0,
            low: 90.0,
            close: 105.0,
            volume: 400.0,
        });
        assert!((buf.avg_volume() - 300.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_buffer_price_range() {
        let mut buf = OhlcvBuffer::new(10);
        buf.push(Ohlcv {
            time: 1,
            open: 100.0,
            high: 120.0,
            low: 80.0,
            close: 110.0,
            volume: 100.0,
        });
        buf.push(Ohlcv {
            time: 2,
            open: 110.0,
            high: 130.0,
            low: 90.0,
            close: 125.0,
            volume: 100.0,
        });
        let (lo, hi) = buf.price_range(10).unwrap();
        assert!((lo - 80.0).abs() < f64::EPSILON);
        assert!((hi - 130.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_buffer_max_volume() {
        let mut buf = OhlcvBuffer::new(10);
        buf.push(Ohlcv {
            time: 1,
            open: 100.0,
            high: 110.0,
            low: 90.0,
            close: 105.0,
            volume: 50.0,
        });
        buf.push(Ohlcv {
            time: 2,
            open: 100.0,
            high: 110.0,
            low: 90.0,
            close: 105.0,
            volume: 300.0,
        });
        assert!((buf.max_volume(10) - 300.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_buffer_price_range_empty() {
        let buf = OhlcvBuffer::new(10);
        assert!(buf.price_range(10).is_none());
    }

    #[test]
    fn test_buffer_avg_volume_empty() {
        let buf = OhlcvBuffer::new(10);
        assert!((buf.avg_volume() - 0.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_iter_exact_size() {
        let mut buf = OhlcvBuffer::new(10);
        for i in 0..7 {
            buf.push(candle(i, 100.0, 101.0));
        }
        let iter = buf.iter();
        assert_eq!(iter.len(), 7);
    }

    #[test]
    #[should_panic(expected = "capacity must be > 0")]
    fn test_buffer_zero_cap_panics() {
        let _ = OhlcvBuffer::new(0);
    }
}
