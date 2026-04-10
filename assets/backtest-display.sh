#!/bin/bash
# Renders the Liangxi 519 backtest results as a branded terminal display.
# Used for VHS recording and screenshots.

GREEN='\033[38;2;0;255;136m'
RED='\033[38;2;255;107;107m'
CYAN='\033[38;2;78;205;196m'
YELLOW='\033[38;2;255;217;61m'
DIM='\033[38;2;26;58;92m'
WHITE='\033[38;2;224;224;224m'
BOLD='\033[1m'
RESET='\033[0m'

clear

echo ""
echo -e "${GREEN}${BOLD}  ┌─────────────────────────────────────────────────────────────────────────┐${RESET}"
echo -e "${GREEN}${BOLD}  │  ⚡ VIBE SENSEI — /backtest liangxi                                    │${RESET}"
echo -e "${GREEN}${BOLD}  │  凉兮 Rolling Position Strategy · BTC/USDT 5m · 519 Crash (May 2021)  │${RESET}"
echo -e "${GREEN}${BOLD}  │  Initial: \$1,000 USDT · Leverage: 100x · Direction: SHORT              │${RESET}"
echo -e "${GREEN}${BOLD}  └─────────────────────────────────────────────────────────────────────────┘${RESET}"
echo ""

# Legend
echo -e "  ${GREEN}${BOLD}█${RESET} ${GREEN}Raw 凉兮 (无风控)${RESET}     ${CYAN}${BOLD}░${RESET} ${CYAN}凉兮 + Vibe Sensei Guardian${RESET}"
echo ""

# ASCII Chart (hand-crafted for maximum impact)
echo -e "  ${DIM}Equity (USDT, log scale)${RESET}"
echo -e "  ${WHITE}\$1M ${DIM}│${RESET}                          ${GREEN}█${RESET}${GREEN}█${RESET}${GREEN}█${YELLOW}← PEAK \$985,261 (985x)${RESET}"
echo -e "  ${WHITE}     ${DIM}│${RESET}                       ${GREEN}█${RESET}${GREEN}█${RESET}${GREEN}█${RESET}   ${RED}█${RESET}"
echo -e "  ${WHITE}     ${DIM}│${RESET}                    ${GREEN}█${RESET}${GREEN}█${RESET}${GREEN}█${RESET}${CYAN}░${RESET}      ${RED}█${RESET}"
echo -e "  ${WHITE}100K ${DIM}│${RESET}                 ${GREEN}█${RESET}${GREEN}█${RESET}${GREEN}█${RESET}  ${CYAN}░░${RESET}       ${RED}█${RESET}"
echo -e "  ${WHITE}     ${DIM}│${RESET}              ${GREEN}█${RESET}${GREEN}█${RESET}${GREEN}█${RESET}     ${CYAN}░░░${RESET}       ${RED}█${RESET}"
echo -e "  ${WHITE}     ${DIM}│${RESET}           ${GREEN}█${RESET}${GREEN}█${RESET}${GREEN}█${RESET}       ${CYAN}░░░░░░░░░░░░░░░░░░░${RESET}${CYAN}← SURVIVED \$19,976 (40x)${RESET}"
echo -e "  ${WHITE} 10K ${DIM}│${RESET}        ${GREEN}█${RESET}${GREEN}█${RESET}${GREEN}█${RESET}          ${CYAN}░${RESET}"
echo -e "  ${WHITE}     ${DIM}│${RESET}     ${GREEN}█${RESET}${GREEN}█${RESET}${GREEN}█${RESET}"
echo -e "  ${WHITE}     ${DIM}│${RESET}  ${GREEN}█${RESET}${GREEN}█${RESET}${GREEN}█${RESET}"
echo -e "  ${WHITE}  1K ${DIM}│${RESET}${GREEN}█${RESET}${GREEN}█${RESET}${CYAN}░${RESET}                                   ${RED}█${RESET}"
echo -e "  ${WHITE}     ${DIM}│${RESET}                                        ${RED}█${RED}← LIQUIDATED \$0${RESET}"
echo -e "  ${WHITE}   0 ${DIM}│${RESET}${DIM}────────────────────────────────────────${RED}████████████████████${RESET}"
echo -e "  ${DIM}     └──────────────────────────────────────────────────────────${RESET}"
echo -e "  ${DIM}     May 17        May 18        May 19 (519)     May 20-25${RESET}"
echo ""

# Stats Table
echo -e "  ${GREEN}${BOLD}┌──────────────────────────┬──────────┬─────────┬────────┬──────┬──────────────┐${RESET}"
echo -e "  ${GREEN}${BOLD}│ Strategy                 │ Peak     │ Final   │ Trades │ Wins │ Liquidations │${RESET}"
echo -e "  ${GREEN}${BOLD}├──────────────────────────┼──────────┼─────────┼────────┼──────┼──────────────┤${RESET}"
echo -e "  ${GREEN}│ ${BOLD}Raw 凉兮 (无风控)${RESET}${GREEN}       │ \$985K   │ ${RED}\$0${GREEN}      │ 18     │ 17   │ ${RED}1${GREEN}            │${RESET}"
echo -e "  ${CYAN}│ ${BOLD}凉兮 + Guardian${RESET}${CYAN}          │ \$40K    │ ${GREEN}\$19,976${CYAN} │ 67     │ 35   │ ${GREEN}0${CYAN}            │${RESET}"
echo -e "  ${GREEN}${BOLD}└──────────────────────────┴──────────┴─────────┴────────┴──────┴──────────────┘${RESET}"
echo ""

# Verdict
echo -e "  ${RED}${BOLD}  💀 Raw: peaked at 985x then LIQUIDATED to \$0${RESET}"
echo -e "  ${CYAN}${BOLD}  🛡️  Guardian: SURVIVED at 40x — \$19,976 preserved, 0 liquidations${RESET}"
echo ""

# Quote
echo -e "  ${DIM}\"爆仓线就是我的加仓信号。\" — 凉兮${RESET}"
echo ""

# Branding
echo -e "  ${GREEN}bun run dev -- --demo${RESET}${DIM}                        github.com/VictorVVedtion/vibe-sensei${RESET}"
echo ""

# Keep alive for VHS
sleep 5
