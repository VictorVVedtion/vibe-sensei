import { c as _c } from "react/compiler-runtime";
import * as React from 'react';
import { Box, Text } from '../../ink.js';
import { env } from '../../utils/env.js';
export type ClawdPose = 'default' | 'arms-up' // both arms raised (used during jump)
| 'look-left' // both pupils shifted left
| 'look-right'; // both pupils shifted right

type Props = {
  pose?: ClawdPose;
};

// Vane — the deep-sea sensei octopus with hachimaki headband.
//
// Design (6 rows, ~15 chars wide):
//
//    ━━◇━━━━━━━       ← hachimaki headband with diamond knot
//    ▐▛██████▜▌       ← rounded dome (mantle)
//   ▝▜█ ◉  ◉ █▛▘     ← face with wise spaced eyes
//    ▝▜██████▛▘       ← body taper
//     ╰┬╮╭┬╮╭┬╯      ← tentacle base (graceful curves)
//    ╰─╯╰─╯╰─╯       ← flowing tentacle tips
//
// Each pose is a pre-built array of 6 strings. Colors are applied
// uniformly via clawd_body theme token.
//
// Pose variations:
//   default    — eyes centered, tentacles resting
//   look-left  — eyes shift left
//   look-right — eyes shift right
//   arms-up    — dome arms raised (▗▟ / ▙▖), tentacles lifted

const POSES: Record<ClawdPose, string[]> = {
  default: [
    '   ━━◇━━━━━━━  ',
    '   ▐▛██████▜▌  ',
    '  ▝▜█ ◉  ◉ █▛▘ ',
    '   ▝▜██████▛▘  ',
    '    ╰┬╮╭┬╮╭┬╯  ',
    '   ╰─╯╰─╯╰─╯  ',
  ],
  'look-left': [
    '   ━━◇━━━━━━━  ',
    '   ▐▛██████▜▌  ',
    '  ▝▜◉  ◉ ██▛▘ ',
    '   ▝▜██████▛▘  ',
    '    ╰┬╮╭┬╮╭┬╯  ',
    '   ╰─╯╰─╯╰─╯  ',
  ],
  'look-right': [
    '   ━━◇━━━━━━━  ',
    '   ▐▛██████▜▌  ',
    '  ▝▜██ ◉  ◉▛▘ ',
    '   ▝▜██████▛▘  ',
    '    ╰┬╮╭┬╮╭┬╯  ',
    '   ╰─╯╰─╯╰─╯  ',
  ],
  'arms-up': [
    '   ━━◇━━━━━━━  ',
    '  ▗▟▛██████▜▙▖ ',
    '   ▜█ ◉  ◉ █▛  ',
    '   ▝▜██████▛▘  ',
    '   ╭─╮╭─╮╭─╮  ',
    '   ╰─╯╰─╯╰─╯  ',
  ],
};

// Apple Terminal fallback: simplified 3-line Vane with headband.
// Apple Terminal bg-fill trick only works for simple horizontal spans.
const APPLE_POSES: Record<ClawdPose, string[]> = {
  default: [
    ' ━◇━━━━━━━',
    ' ◉  █  ◉ ',
    ' ╰─╯╰─╯ ',
  ],
  'look-left': [
    ' ━◇━━━━━━━',
    '◉ ◉  ██  ',
    ' ╰─╯╰─╯ ',
  ],
  'look-right': [
    ' ━◇━━━━━━━',
    '  ██  ◉ ◉',
    ' ╰─╯╰─╯ ',
  ],
  'arms-up': [
    ' ━◇━━━━━━━',
    ' ◉  █  ◉ ',
    ' ╭─╮╭─╮ ',
  ],
};

export function Clawd(t0: Props) {
  const $ = _c(8);
  let t1;
  if ($[0] !== t0) {
    t1 = t0 === undefined ? {} : t0;
    $[0] = t0;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const {
    pose: t2
  } = t1;
  const pose = t2 === undefined ? "default" : t2;
  if (env.terminal === "Apple_Terminal") {
    let t3;
    if ($[2] !== pose) {
      t3 = <AppleTerminalClawd pose={pose} />;
      $[2] = pose;
      $[3] = t3;
    } else {
      t3 = $[3];
    }
    return t3;
  }
  const lines = POSES[pose];
  let t3;
  if ($[4] !== lines) {
    t3 = (
      <Box flexDirection="column">
        {lines.map((line, i) => (
          <Text key={i} color="clawd_body">{line}</Text>
        ))}
      </Box>
    );
    $[4] = lines;
    $[5] = t3;
  } else {
    t3 = $[5];
  }
  return t3;
}

function AppleTerminalClawd(t0: { pose: ClawdPose }) {
  const $ = _c(4);
  const {
    pose
  } = t0;
  const lines = APPLE_POSES[pose];
  let t1;
  if ($[0] !== lines) {
    t1 = (
      <Box flexDirection="column" alignItems="center">
        {lines.map((line, i) => (
          <Text key={i} color="clawd_body">{line}</Text>
        ))}
      </Box>
    );
    $[0] = lines;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  return t1;
}
