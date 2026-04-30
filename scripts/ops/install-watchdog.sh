#!/bin/zsh
chmod +x /Users/vijaytaitoo/Projects/tele-gpt/scripts/watchdog-check.sh
mkdir -p ~/Library/LaunchAgents
cat > ~/Library/LaunchAgents/com.telegpt.watchdog.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.telegpt.watchdog</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/zsh</string>
      <string>/Users/vijaytaitoo/Projects/tele-gpt/scripts/watchdog-check.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>/Users/vijaytaitoo/Projects/tele-gpt</string>
    <key>StandardOutPath</key>
    <string>/Users/vijaytaitoo/Projects/tele-gpt/telegram-bot.watchdog.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/vijaytaitoo/Projects/tele-gpt/telegram-bot.watchdog.err.log</string>
  </dict>
</plist>
PLIST
launchctl unload ~/Library/LaunchAgents/com.telegpt.watchdog.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/com.telegpt.watchdog.plist
launchctl kickstart -k gui/$(id -u)/com.telegpt.watchdog
echo "=== WATCHDOG STATUS ==="
launchctl list | grep telegpt