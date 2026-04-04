import { c as _c } from "react/compiler-runtime";
import figures from 'figures';
import React, { useEffect, useRef, useState } from 'react';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { stringWidth } from '../ink/stringWidth.js';
import { Box, Text } from '../ink.js';
import { useAppState, useSetAppState } from '../state/AppState.js';
import type { AppState } from '../state/AppStateStore.js';
import { getGlobalConfig } from '../utils/config.js';
import { isFullscreenActive } from '../utils/fullscreen.js';
import { getCompanion } from './companion.js';
import { useGuardianDisplay, pushReaction } from './guardian-display.js';
import { renderFace, renderSprite, spriteFrameCount } from './sprites.js';
import { MASTER_PORTRAITS } from './sprite-atlas.js';
import type { Emotion } from './sprite-atlas.js';
import type { Master } from './types.js';
import { RARITY_COLORS, MASTER_NAMES } from './types.js';
const TICK_MS = 500;
const BUBBLE_SHOW = 20; // ticks → ~10s at 500ms
const FADE_WINDOW = 6; // last ~3s the bubble dims so you know it's about to go
const PET_BURST_MS = 2500; // how long hearts float after /buddy pet

// Idle sequence: mostly rest (frame 0), occasional fidget (frames 1-2), rare blink.
// Sequence indices map to sprite frames; -1 means "blink on frame 0".
const IDLE_SEQUENCE = [0, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 2, 0, 0, 0];

// Hearts float up-and-out over 5 ticks (~2.5s). Prepended above the sprite.
const H = figures.heart;
const PET_HEARTS = [`   ${H}    ${H}   `, `  ${H}  ${H}   ${H}  `, ` ${H}   ${H}  ${H}   `, `${H}  ${H}      ${H} `, '·    ·   ·  '];
function wrap(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur.length + w.length + 1 > width && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function SpeechBubble(t0) {
  const $ = _c(31);
  const {
    text,
    color,
    fading,
    tail
  } = t0;
  let T0;
  let borderColor;
  let t1;
  let t2;
  let t3;
  let t4;
  let t5;
  let t6;
  if ($[0] !== color || $[1] !== fading || $[2] !== text) {
    const lines = wrap(text, 30);
    borderColor = fading ? "inactive" : color;
    T0 = Box;
    t1 = "column";
    t2 = "round";
    t3 = borderColor;
    t4 = 1;
    t5 = 34;
    let t7;
    if ($[11] !== fading) {
      t7 = (l, i) => <Text key={i} italic={true} dimColor={!fading} color={fading ? "inactive" : undefined}>{l}</Text>;
      $[11] = fading;
      $[12] = t7;
    } else {
      t7 = $[12];
    }
    t6 = lines.map(t7);
    $[0] = color;
    $[1] = fading;
    $[2] = text;
    $[3] = T0;
    $[4] = borderColor;
    $[5] = t1;
    $[6] = t2;
    $[7] = t3;
    $[8] = t4;
    $[9] = t5;
    $[10] = t6;
  } else {
    T0 = $[3];
    borderColor = $[4];
    t1 = $[5];
    t2 = $[6];
    t3 = $[7];
    t4 = $[8];
    t5 = $[9];
    t6 = $[10];
  }
  let t7;
  if ($[13] !== T0 || $[14] !== t1 || $[15] !== t2 || $[16] !== t3 || $[17] !== t4 || $[18] !== t5 || $[19] !== t6) {
    t7 = <T0 flexDirection={t1} borderStyle={t2} borderColor={t3} paddingX={t4} width={t5}>{t6}</T0>;
    $[13] = T0;
    $[14] = t1;
    $[15] = t2;
    $[16] = t3;
    $[17] = t4;
    $[18] = t5;
    $[19] = t6;
    $[20] = t7;
  } else {
    t7 = $[20];
  }
  const bubble = t7;
  if (tail === "right") {
    let t8;
    if ($[21] !== borderColor) {
      t8 = <Text color={borderColor}>─</Text>;
      $[21] = borderColor;
      $[22] = t8;
    } else {
      t8 = $[22];
    }
    let t9;
    if ($[23] !== bubble || $[24] !== t8) {
      t9 = <Box flexDirection="row" alignItems="center">{bubble}{t8}</Box>;
      $[23] = bubble;
      $[24] = t8;
      $[25] = t9;
    } else {
      t9 = $[25];
    }
    return t9;
  }
  let t8;
  if ($[26] !== borderColor) {
    t8 = <Box flexDirection="column" alignItems="flex-end" paddingRight={6}><Text color={borderColor}>╲ </Text><Text color={borderColor}>╲</Text></Box>;
    $[26] = borderColor;
    $[27] = t8;
  } else {
    t8 = $[27];
  }
  let t9;
  if ($[28] !== bubble || $[29] !== t8) {
    t9 = <Box flexDirection="column" alignItems="flex-end" marginRight={1}>{bubble}{t8}</Box>;
    $[28] = bubble;
    $[29] = t8;
    $[30] = t9;
  } else {
    t9 = $[30];
  }
  return t9;
}
export const MIN_COLS_FOR_FULL_SPRITE = 100;
const SPRITE_BODY_WIDTH = 12;
const NAME_ROW_PAD = 2; // focused state wraps name in spaces: ` name `
const SPRITE_PADDING_X = 2;
const BUBBLE_WIDTH = 36; // SpeechBubble box (34) + tail column
const NARROW_QUIP_CAP = 24;
function spriteColWidth(nameWidth: number): number {
  return Math.max(SPRITE_BODY_WIDTH, nameWidth + NAME_ROW_PAD);
}

// Width the sprite area consumes. PromptInput subtracts this so text wraps
// correctly. In fullscreen the bubble floats over scrollback (no extra
// width); in non-fullscreen it sits inline and needs BUBBLE_WIDTH more.
// Narrow terminals: 0 — REPL.tsx stacks the one-liner on its own row
// (above input in fullscreen, below in scrollback), so no reservation.
export function companionReservedColumns(terminalColumns: number, speaking: boolean): number {
  return 0; // Minimalist permanent design stacks vertically, preserving full horizontal prompt space
}
export function CompanionSprite(): React.ReactNode {
  const reaction = useAppState(s => s.companionReaction);
  const petAt = useAppState(s => s.companionPetAt);
  const focused = useAppState(s => s.footerSelection === 'companion');
  const setAppState = useSetAppState();
  const {
    columns
  } = useTerminalSize();
  const [tick, setTick] = useState(0);
  const lastSpokeTick = useRef(0);
  // Sync-during-render (not useEffect) so the first post-pet render already
  // has petStartTick=tick and petAge=0 — otherwise frame 0 is skipped.
  const [{
    petStartTick,
    forPetAt
  }, setPetStart] = useState({
    petStartTick: 0,
    forPetAt: petAt
  });
  if (petAt !== forPetAt) {
    setPetStart({
      petStartTick: tick,
      forPetAt: petAt
    });
  }
  useEffect(() => {
    const timer = setInterval(setT => setT((t: number) => t + 1), TICK_MS, setTick);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!reaction) return;
    lastSpokeTick.current = tick;
    const timer = setTimeout(setA => setA((prev: AppState) => prev.companionReaction === undefined ? prev : {
      ...prev,
      companionReaction: undefined
    }), BUBBLE_SHOW * TICK_MS, setAppState);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick intentionally captured at reaction-change, not tracked
  }, [reaction, setAppState]);
  // Guardian display singleton — shared text, fading, emotion, emotionColor
  const { displayText, fading, emotionColor, emotion: singletonEmotion } = useGuardianDisplay();

  // Sync AppState.companionReaction into the guardian-display singleton
  useEffect(() => { pushReaction(reaction); }, [reaction]);

  const companion = getCompanion();
  if (!companion || getGlobalConfig().companionMuted) return null;

  // Narrow terminal guard
  if (columns < 20) return null;

  const color = RARITY_COLORS[companion.rarity];
  const guardianName = MASTER_NAMES[companion.species as Master] ?? companion.name;
  const petAge = petAt ? tick - petStartTick : Infinity;
  const petting = petAge * TICK_MS < PET_BURST_MS;
  const currentEmotion: Emotion = petting ? 'happy' : singletonEmotion;

  const minimalistFaceRow = (
    <Box>
      {petting && <Text color="autoAccept">{figures.heart} </Text>}
      <Text bold color={emotionColor || color}>
        {renderFace(companion)}
      </Text>
      <Text dimColor={!focused} color={focused ? color : undefined} inverse={focused}>
        {' '}{guardianName}
      </Text>
    </Box>
  );

  // Narrow: show face only, no bubble
  if (columns < 40) {
    return <Box paddingX={1} alignSelf="flex-end">{minimalistFaceRow}</Box>;
  }

  // Fullscreen: bubble renders separately in CompanionFloatingBubble
  if (isFullscreenActive()) {
    return <Box paddingX={1} alignSelf="flex-end">{minimalistFaceRow}</Box>;
  }

  // Static scrollback: stack bubble + face vertically
  return (
    <Box flexDirection="column" paddingX={1} alignItems="flex-end" flexShrink={0}>
      <SpeechBubble text={displayText} color={color} fading={fading} tail="down" />
      {minimalistFaceRow}
    </Box>
  );
}

// Floating bubble overlay for fullscreen mode. Mounted in FullscreenLayout's
// bottomFloat slot (outside the overflowY:hidden clip) so it can extend into
// the ScrollBox region. CompanionSprite owns the clear-after-10s timer; this
// just reads companionReaction and renders the fade.
export function CompanionFloatingBubble() {
  const { displayText, fading } = useGuardianDisplay();
  const { columns } = useTerminalSize();
  const companion = getCompanion();
  if (!companion || getGlobalConfig().companionMuted || columns < 40) {
    return null;
  }
  return <SpeechBubble text={displayText} color={RARITY_COLORS[companion.rarity]} fading={fading} tail="down" />;
}
