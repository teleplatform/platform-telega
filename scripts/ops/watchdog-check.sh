#!/bin/zsh
cd /Users/vijaytaitoo/Projects/tele-gpt

LOG_FILE="telegram-bot.watchdog.log"
LAST_REPLY_FILE="telegram-bot.lastreply"

# Get last reply time from bot log
get_last_reply() {
    local last_line
    last_line=$(tail -50 telegram-bot.out.log 2>/dev/null | grep "bridge result: text" | tail -1 | head -1)
    if [ -n "$last_line" ]; then
        echo "$(date +%s)"
    else
        echo "0"
    fi
}

check_health() {
    local last_reply="$1"
    local now
    now=$(date +%s)
    
    if [ "$last_reply" -eq 0 ]; then
        return
    fi
    
    local diff=$((now - last_reply))
    
    if [ "$diff" -gt 60 ]; then
        echo "[$(date)] WARNING: No reply for ${diff}s, restarting service" >> "$LOG_FILE"
        launchctl kickstart -k com.telegpt.bot
    fi
}

while true; do
    last_reply=$(get_last_reply)
    check_health "$last_reply"
    sleep 15
done