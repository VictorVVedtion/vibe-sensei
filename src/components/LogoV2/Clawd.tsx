import * as React from 'react';
import { Box, Text } from '../../ink.js';
import { env } from '../../utils/env.js';
export type ClawdPose = 'default' | 'arms-up' | 'look-left' | 'look-right';

type Props = {
  pose?: ClawdPose;
  guardianName?: string;
  guardianRarity?: string;
  balance?: string;
};

// Deep-sea octopus — compact 3-line block art for condensed logo.
// Rendered in matrix green for visibility on dark terminals.
//
//    ▗▄██▄▖        ← narrow dome
//  ▞▐█◉██◉█▌▚      ← wide body + eyes
//   ▗▚▘  ▝▞▖       ← S-curve tentacles

const POSES: Record<ClawdPose, string[]> = {
  default: [
    "   ▗▄██▄▖   ",
    " ▞▐█◉██◉█▌▚ ",
    "  ▗▚▘  ▝▞▖  ",
  ],
  'look-left': [
    "   ▗▄██▄▖   ",
    " ▞▐◉◉██ █▌▚ ",
    "  ▗▚▘  ▝▞▖  ",
  ],
  'look-right': [
    "   ▗▄██▄▖   ",
    " ▞▐█ ██◉◉▌▚ ",
    "  ▗▚▘  ▝▞▖  ",
  ],
  'arms-up': [
    "   ▗▄██▄▖   ",
    " ▞▐█◉██◉█▌▚ ",
    " ▗▚▘    ▝▞▖ ",
  ],
};

// Apple Terminal fallback — ASCII-safe.
const APPLE_POSES: Record<ClawdPose, string[]> = {
  default: [
    "  .=##=.  ",
    " /|o==o|\\ ",
    "  \\|  |/  ",
  ],
  'look-left': [
    "  .=##=.  ",
    " /|oo= |\\ ",
    "  \\|  |/  ",
  ],
  'look-right': [
    "  .=##=.  ",
    " /| =oo|\\ ",
    "  \\|  |/  ",
  ],
  'arms-up': [
    "  .=##=.  ",
    " /|o==o|\\ ",
    " \\|    |/ ",
  ],
};

export function Clawd({ pose = 'default' }: Props) {
  const lines = env.terminal === "Apple_Terminal" ? APPLE_POSES[pose] : POSES[pose];

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Text key={i} color="clawd_body">{line}</Text>
      ))}
    </Box>
  );
}
