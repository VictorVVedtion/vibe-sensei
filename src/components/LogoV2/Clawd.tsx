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

// Deep-sea octopus — the Vibe Sensei mascot.
//
// Design (10 rows, ~25 chars wide):
//
//         _.---._
//      .-'       '-.
//     /   o     o   \
//    |   .-------.   |
//     \ / \_.-._/ \ /
//      '/|       |\'
//     / /|       |\ \
//    / / |       | \ \
//   ( (  |       |  ) )
//    '-' '-'   '-' '-'
//
// Each pose is a pre-built array of 10 strings.
// The right-side info panel is rendered separately.

const POSES: Record<ClawdPose, string[]> = {
  default: [
    "        _.---._        ",
    "     .-'       '-.     ",
    "    /   o     o   \\    ",
    "   |   .-------.   |   ",
    "    \\ / \\_.-._/ \\ /    ",
    "     '/|       |\\'     ",
    "    / /|       |\\ \\    ",
    "   / / |       | \\ \\   ",
    "  ( (  |       |  ) )  ",
    "   '-' '-'   '-' '-'   ",
  ],
  'look-left': [
    "        _.---._        ",
    "     .-'       '-.     ",
    "    /  o    o     \\    ",
    "   |   .-------.   |   ",
    "    \\ / \\_.-._/ \\ /    ",
    "     '/|       |\\'     ",
    "    / /|       |\\ \\    ",
    "   / / |       | \\ \\   ",
    "  ( (  |       |  ) )  ",
    "   '-' '-'   '-' '-'   ",
  ],
  'look-right': [
    "        _.---._        ",
    "     .-'       '-.     ",
    "    /     o    o  \\    ",
    "   |   .-------.   |   ",
    "    \\ / \\_.-._/ \\ /    ",
    "     '/|       |\\'     ",
    "    / /|       |\\ \\    ",
    "   / / |       | \\ \\   ",
    "  ( (  |       |  ) )  ",
    "   '-' '-'   '-' '-'   ",
  ],
  'arms-up': [
    "        _.---._        ",
    "     .-'       '-.     ",
    "    /   o     o   \\    ",
    "   |   .-------.   |   ",
    "    \\ / \\_.-._/ \\ /    ",
    "     '/|       |\\'     ",
    "    / /|       |\\ \\    ",
    "   / / |       | \\ \\   ",
    "  ) )  |       |  ( (  ",
    "   '-' '-'   '-' '-'   ",
  ],
};

// Apple Terminal fallback: simplified 5-line octopus.
const APPLE_POSES: Record<ClawdPose, string[]> = {
  default: [
    "    _.---._    ",
    "  /  o   o  \\  ",
    "  | .-----. |  ",
    "  ( |     | )  ",
    "  '-'     '-'  ",
  ],
  'look-left': [
    "    _.---._    ",
    "  / o  o    \\  ",
    "  | .-----. |  ",
    "  ( |     | )  ",
    "  '-'     '-'  ",
  ],
  'look-right': [
    "    _.---._    ",
    "  /    o  o \\  ",
    "  | .-----. |  ",
    "  ( |     | )  ",
    "  '-'     '-'  ",
  ],
  'arms-up': [
    "    _.---._    ",
    "  /  o   o  \\  ",
    "  | .-----. |  ",
    "  ) |     | (  ",
    "  '-'     '-'  ",
  ],
};

// Info lines rendered to the right of the octopus art.
// Indexed by row in the 10-line art. Only rows with info text get it.
function getInfoLines(guardianName?: string, guardianRarity?: string, balance?: string): Record<number, string> {
  return {
    2: 'V I B E   S E N S E I',
    3: 'v0.1.0-abyssal',
    5: `[*] GUARDIAN: ${guardianName ?? '???'} (${guardianRarity ?? '???'})`,
    6: `[$] BALANCE:  ${balance ?? '100,000.00'} USDT [PAPER]`,
    7: '[~] SONAR ACTIVE. AWAITING COMMAND.',
  };
}

export function Clawd({ pose = 'default', guardianName, guardianRarity, balance }: Props) {
  if (env.terminal === "Apple_Terminal") {
    return <AppleTerminalClawd pose={pose} guardianName={guardianName} guardianRarity={guardianRarity} balance={balance} />;
  }

  const lines = POSES[pose];
  const infoLines = getInfoLines(guardianName, guardianRarity, balance);

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Text key={i}>
          <Text color="clawd_body">{line}</Text>
          {infoLines[i] !== undefined && (
            <Text bold={i === 2} dimColor={i !== 2}>{infoLines[i]}</Text>
          )}
        </Text>
      ))}
    </Box>
  );
}

function AppleTerminalClawd({ pose, guardianName, guardianRarity, balance }: { pose: ClawdPose; guardianName?: string; guardianRarity?: string; balance?: string }) {
  const lines = APPLE_POSES[pose];

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Text key={i} color="clawd_body">{line}</Text>
      ))}
      <Text bold>V I B E   S E N S E I</Text>
      {guardianName && <Text dimColor>[*] {guardianName} ({guardianRarity ?? '???'})</Text>}
      {balance && <Text dimColor>[$] {balance} USDT [PAPER]</Text>}
    </Box>
  );
}
