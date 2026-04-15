import { c as _c } from "react/compiler-runtime";
import * as React from 'react';
import { useEffect, useState } from 'react';
import { UP_ARROW } from '../../constants/figures.js';
import { Box, Text } from '../../ink.js';
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js';
import { getMainLoopModel, isOpus1mMergeEnabled } from '../../utils/model/model.js';
import { AnimatedAsterisk } from './AnimatedAsterisk.js';
const MAX_SHOW_COUNT = 6;
export function shouldShowOpus1mMergeNotice(): boolean {
  if (!isOpus1mMergeEnabled()) return false;
  // The banner only applies to Claude users — the "1M context" change is
  // specific to Anthropic's Opus. Vibe Sensei ships multi-provider support,
  // and non-Anthropic models are identified by a `<provider>/<model>`
  // prefix convention (e.g. `gemini/gemini-3-flash-preview`,
  // `openai/gpt-5.4`). Suppress the notice for those — it's just confusing
  // Anthropic marketing copy in a session that doesn't use Claude.
  const currentModel = getMainLoopModel();
  if (currentModel && currentModel.includes('/')) return false;
  return (getGlobalConfig().opus1mMergeNoticeSeenCount ?? 0) < MAX_SHOW_COUNT;
}
export function Opus1mMergeNotice() {
  const $ = _c(4);
  const [show] = useState(shouldShowOpus1mMergeNotice);
  let t0;
  let t1;
  if ($[0] !== show) {
    t0 = () => {
      if (!show) {
        return;
      }
      const newCount = (getGlobalConfig().opus1mMergeNoticeSeenCount ?? 0) + 1;
      saveGlobalConfig(prev => {
        if ((prev.opus1mMergeNoticeSeenCount ?? 0) >= newCount) {
          return prev;
        }
        return {
          ...prev,
          opus1mMergeNoticeSeenCount: newCount
        };
      });
    };
    t1 = [show];
    $[0] = show;
    $[1] = t0;
    $[2] = t1;
  } else {
    t0 = $[1];
    t1 = $[2];
  }
  useEffect(t0, t1);
  if (!show) {
    return null;
  }
  let t2;
  if ($[3] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = <Box paddingLeft={2}><AnimatedAsterisk char={UP_ARROW} /><Text dimColor={true}>{" "}Opus now defaults to 1M context · 5x more room, same pricing</Text></Box>;
    $[3] = t2;
  } else {
    t2 = $[3];
  }
  return t2;
}
