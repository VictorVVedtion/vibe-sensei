# Vibe Sensei — Hero Demo GIF
# Run: vhs assets/demo.tape
# Output: assets/demo.gif

Output assets/demo.gif

Set Shell "zsh"
Set FontFamily "JetBrains Mono"
Set FontSize 15
Set Width 960
Set Height 540
Set Padding 16
Set Framerate 24
Set TypingSpeed 40ms
Set Theme { "name": "Vibe Sensei", "black": "#0a1628", "red": "#ff6b6b", "green": "#00ff88", "yellow": "#ffd93d", "blue": "#4ecdc4", "magenta": "#c77dff", "cyan": "#4ecdc4", "white": "#e0e0e0", "brightBlack": "#1a3a5c", "brightRed": "#ff8787", "brightGreen": "#33ffaa", "brightYellow": "#ffe066", "brightBlue": "#7ee8de", "brightMagenta": "#d9a8ff", "brightCyan": "#7ee8de", "brightWhite": "#ffffff", "background": "#0a1628", "foreground": "#00ff88", "selection": "#1a3a5c", "cursor": "#00ff88" }

# Setup: clean prompt
Hide
Type `export PS1='🐙 vibe-sensei $ '`
Enter
Type "clear"
Enter
Show
Sleep 500ms

# Scene 1: Ghost Warning (the viral moment — leads with drama)
Type "bun run dev -- --demo --print '100x leverage yolo all in BTC'"
Sleep 300ms
Enter
Sleep 6s

# Scene 2: Master Debate
Type "bun run dev -- --demo --print '/debate will BTC hit 200k?'"
Sleep 300ms
Enter
Sleep 6s

# Scene 3: Consult a Master
Type "bun run dev -- --demo --print '/consult jesse_livermore should I go long?'"
Sleep 300ms
Enter
Sleep 5s

# Pause for viewer to read final output
Sleep 2s
