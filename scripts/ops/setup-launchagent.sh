#!/bin/bash
#
# Setup script for Tele GPT Vault Bridge LaunchAgent
#
# Usage:
#   bash scripts/setup-launchagent.sh [options]
#
# Options:
#   --telegram-token <token>  Telegram bot token
#   --vault-token <token>     Vault token
#   --telegpt-url <url>       Tele GPT URL (default: http://localhost:8787)
#   --vault-url <url>         Vault URL (default: http://localhost:8200)
#   --install                 Install and load the LaunchAgent
#   --uninstall               Unload and remove the LaunchAgent
#   --status                  Check LaunchAgent status
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PLIST_SOURCE="$PROJECT_DIR/config/telegpt-vault-bridge.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.telegpt.vault-bridge.plist"

# Defaults
TELEGRAM_TOKEN=""
VAULT_TOKEN=""
TELEGPT_URL="http://localhost:8787"
VAULT_URL="http://localhost:8200"
ACTION=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --telegram-token)
      TELEGRAM_TOKEN="$2"
      shift 2
      ;;
    --vault-token)
      VAULT_TOKEN="$2"
      shift 2
      ;;
    --telegpt-url)
      TELEGPT_URL="$2"
      shift 2
      ;;
    --vault-url)
      VAULT_URL="$2"
      shift 2
      ;;
    --install)
      ACTION="install"
      shift
      ;;
    --uninstall)
      ACTION="uninstall"
      shift
      ;;
    --status)
      ACTION="status"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Interactive mode if no action specified
if [ -z "$ACTION" ]; then
  echo "═══ Tele GPT Vault Bridge Setup ═══"
  echo ""
  echo "Choose an action:"
  echo "  1) Install LaunchAgent"
  echo "  2) Uninstall LaunchAgent"
  echo "  3) Check status"
  read -p "Action [1/2/3]: " choice

  case $choice in
    1) ACTION="install" ;;
    2) ACTION="uninstall" ;;
    3) ACTION="status" ;;
    *) echo "Invalid choice"; exit 1 ;;
  esac
fi

case $ACTION in
  install)
    echo "═══ Installing Tele GPT Vault Bridge ═══"

    # Check prerequisites
    if ! command -v node &> /dev/null; then
      echo "❌ Node.js is not installed. Install it first."
      exit 1
    fi

    if [ ! -f "$PLIST_SOURCE" ]; then
      echo "❌ Source plist not found: $PLIST_SOURCE"
      exit 1
    fi

    # Prompt for tokens if not provided
    if [ -z "$TELEGRAM_TOKEN" ]; then
      read -p "Telegram Bot Token: " TELEGRAM_TOKEN
    fi
    if [ -z "$VAULT_TOKEN" ]; then
      read -s -p "Vault Token: " VAULT_TOKEN
      echo ""
    fi

    # Create LaunchAgents directory
    mkdir -p "$HOME/Library/LaunchAgents"

    # Copy and customize plist
    cp "$PLIST_SOURCE" "$PLIST_DEST"

    # Replace placeholders
    sed -i '' "s|PLACEHOLDER_REPLACE_ME|${TELEGRAM_TOKEN}|1" "$PLIST_DEST"
    # Vault token is the second occurrence
    sed -i '' "s|PLACEHOLDER_REPLACE_ME|${VAULT_TOKEN}|2" "$PLIST_DEST"
    sed -i '' "s|http://localhost:8787|${TELEGPT_URL}|g" "$PLIST_DEST"
    sed -i '' "s|http://localhost:8200|${VAULT_URL}|g" "$PLIST_DEST"

    # Update project path
    sed -i '' "s|/Users/vijaytaitoo/Projects/tele-gpt|${PROJECT_DIR}|g" "$PLIST_DEST"

    # Load the LaunchAgent
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
    launchctl load "$PLIST_DEST"

    echo ""
    echo "✅ LaunchAgent installed and loaded."
    echo ""
    echo "Logs:"
    echo "  stdout: /tmp/telegpt-vault-bridge.out"
    echo "  stderr: /tmp/telegpt-vault-bridge.err"
    echo ""
    echo "Commands:"
    echo "  launchctl list com.telegpt.vault-bridge  # Check status"
    echo "  launchctl unload $PLIST_DEST             # Unload"
    echo "  tail -f /tmp/telegpt-vault-bridge.out    # Follow logs"
    ;;

  uninstall)
    echo "═══ Uninstalling Tele GPT Vault Bridge ═══"

    launchctl unload "$PLIST_DEST" 2>/dev/null || true
    rm -f "$PLIST_DEST"

    echo "✅ LaunchAgent unloaded and removed."
    ;;

  status)
    echo "═══ Tele GPT Vault Bridge Status ═══"
    echo ""

    if launchctl list com.telegpt.vault-bridge 2>/dev/null; then
      echo ""
      echo "✅ LaunchAgent is loaded."
      echo ""
      echo "Recent logs:"
      tail -20 /tmp/telegpt-vault-bridge.out 2>/dev/null || echo "(no stdout log)"
      echo ""
      tail -20 /tmp/telegpt-vault-bridge.err 2>/dev/null || echo "(no stderr log)"
    else
      echo "❌ LaunchAgent is not loaded."
      echo ""
      echo "To install: bash $0 --install"
    fi
    ;;
esac
