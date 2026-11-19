#!/bin/bash
# Christmas Mode — one-line installer
#   curl -fsSL https://raw.githubusercontent.com/romainsildev/christmas-mode/main/install.sh | bash
set -euo pipefail
REPO="${CHRISTMAS_MODE_REPO:-romainsildev/christmas-mode}"
URL="${CHRISTMAS_MODE_URL:-https://github.com/$REPO/releases/latest/download/ChristmasMode.zip}"
DEST="/Applications"; [[ -w "$DEST" ]] || DEST="$HOME/Applications"
APP="$DEST/Christmas Mode.app"

[[ "$(uname)" == "Darwin" ]] || { echo "Christmas Mode is a macOS app."; exit 1; }
major=$(sw_vers -productVersion | cut -d. -f1)
(( major >= 14 )) || { echo "Christmas Mode needs macOS 14 Sonoma or newer."; exit 1; }

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
echo "❄️  Downloading Christmas Mode…"
curl -fsSL "$URL" -o "$tmp/ChristmasMode.zip"
ditto -x -k "$tmp/ChristmasMode.zip" "$tmp"
osascript -e 'tell application id "app.christmasmode.mac" to quit' >/dev/null 2>&1 || true
mkdir -p "$DEST"
rm -rf "$APP"
ditto "$tmp/Christmas Mode.app" "$APP"
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
open "$APP"
echo "🎄 Installed in $DEST. Look for the ❄️ in your menu bar — right-click it to toggle, ⌃⌥N anywhere."
