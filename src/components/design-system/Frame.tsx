import React from 'react'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { Text } from '../../ink.js'
import type { Theme } from '../../utils/theme.js'
import ThemedBox from './ThemedBox.js'

type FrameProps = {
  children: React.ReactNode
  /** Bracket label shown in top border, e.g., "SYSTEM_LOG" → [SYSTEM_LOG] */
  label?: string
  /** Theme color key for the border */
  borderColor?: keyof Theme
  /** Border style: 'single' for sharp corners, 'double' for heavy emphasis */
  borderStyle?: 'single' | 'double'
  /** Use dim border color */
  dimBorder?: boolean
  /** Only show left border (accent bar style) */
  leftOnly?: boolean
  /** Horizontal padding inside the frame */
  paddingX?: number
}

/**
 * Operator-dashboard frame component. Wraps content in box-drawing borders
 * with an optional [BRACKET_LABEL] in the top border.
 *
 * @example
 * <Frame label="SYSTEM_LOG" borderColor="frameBorder">
 *   <Text>Content here</Text>
 * </Frame>
 *
 * Renders:
 * ┌─[SYSTEM_LOG]──────────────────────────────┐
 * │ Content here                               │
 * └────────────────────────────────────────────┘
 */
export function Frame({
  children,
  label,
  borderColor = 'frameBorder',
  borderStyle = 'single',
  dimBorder = false,
  leftOnly = false,
  paddingX = 1,
}: FrameProps) {
  const { columns } = useTerminalSize()

  if (leftOnly) {
    return (
      <ThemedBox
        borderStyle="single"
        borderColor={dimBorder ? 'frameBorderDim' : borderColor}
        borderLeft={true}
        borderRight={false}
        borderTop={false}
        borderBottom={false}
        paddingLeft={1}
      >
        {children}
      </ThemedBox>
    )
  }

  // Full frame with optional label
  const maxWidth = Math.min(60, columns - 2)

  return (
    <ThemedBox
      borderStyle={borderStyle}
      borderColor={dimBorder ? 'frameBorderDim' : borderColor}
      paddingX={paddingX}
      width={maxWidth}
    >
      {label && (
        <Text color="panelLabel" bold>[{label}]</Text>
      )}
      {children}
    </ThemedBox>
  )
}
