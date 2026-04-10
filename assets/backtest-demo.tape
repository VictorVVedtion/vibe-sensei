# Vibe Sensei — Liangxi Backtest in the real CLI
# Run: vhs assets/backtest-demo.tape

Output assets/liangxi-cli-backtest.gif
Output assets/liangxi-cli-backtest.webm

Set Shell "zsh"
Set FontFamily "JetBrains Mono"
Set FontSize 14
Set Width 1100
Set Height 750
Set Padding 16
Set Framerate 24
Set TypingSpeed 30ms
Set Theme { "name": "Vibe Sensei", "black": "#0a1628", "red": "#ff6b6b", "green": "#00ff88", "yellow": "#ffd93d", "blue": "#4ecdc4", "magenta": "#c77dff", "cyan": "#4ecdc4", "white": "#e0e0e0", "brightBlack": "#1a3a5c", "brightRed": "#ff8787", "brightGreen": "#33ffaa", "brightYellow": "#ffe066", "brightBlue": "#7ee8de", "brightMagenta": "#d9a8ff", "brightCyan": "#7ee8de", "brightWhite": "#ffffff", "background": "#0a1628", "foreground": "#00ff88", "selection": "#1a3a5c", "cursor": "#00ff88" }

# Clean prompt
Hide
Type `export PS1='$ '`
Enter
Type "alias sensei='./assets/demo-run.sh'"
Enter
Type "clear"
Enter
Show
Sleep 300ms

# Run the backtest through the real CLI
Type "sensei 'backtest liangxi rolling position'"
Sleep 200ms
Enter
Sleep 8s

Sleep 4s
