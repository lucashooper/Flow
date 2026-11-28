#!/bin/bash
# Install or update Flow Notes on a Mac, then open it.
#
#   curl -fsSL https://flow-notes.app/install.sh | bash
#
# Downloads the latest release from GitHub, replaces /Applications/Flow Notes.app
# (your notes and vault are not touched), clears the "downloaded from the
# internet" flag so macOS doesn't block it, and opens it.
set -euo pipefail

APP="Flow Notes"
DMG_URL="https://github.com/lucashooper/Flow/releases/latest/download/Flow-Notes-macOS.dmg"
DEST="/Applications/$APP.app"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "This installer is for macOS. On Windows or Linux, download Flow from https://flow-notes.app" >&2
  exit 1
fi

TMP="$(mktemp -d)"
MOUNT="$TMP/mount"
cleanup() {
  hdiutil detach "$MOUNT" -quiet >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "↓ Downloading the latest Flow Notes…"
curl -fL --progress-bar -o "$TMP/Flow.dmg" "$DMG_URL"

echo "→ Installing…"
mkdir -p "$MOUNT"
hdiutil attach "$TMP/Flow.dmg" -nobrowse -readonly -mountpoint "$MOUNT" -quiet
SRC="$(find "$MOUNT" -maxdepth 1 -name '*.app' | head -n 1)"
if [[ -z "$SRC" ]]; then
  echo "Couldn't find the app inside the download." >&2
  exit 1
fi

# Quit Flow if it's open, so it can be replaced.
osascript -e "tell application \"$APP\" to quit" >/dev/null 2>&1 || true
for _ in 1 2 3 4 5 6 7 8 9 10; do
  pgrep -xq "$APP" || break
  sleep 0.5
done
pkill -x "$APP" >/dev/null 2>&1 || true

SUDO=""
if [[ -e "$DEST" && ! -w "$DEST" ]] || [[ ! -w "/Applications" ]]; then
  echo "  (your Mac password is needed to write to /Applications)"
  SUDO="sudo"
fi
$SUDO rm -rf "$DEST"
$SUDO ditto "$SRC" "$DEST"
$SUDO xattr -dr com.apple.quarantine "$DEST" >/dev/null 2>&1 || true

VERSION="$(defaults read "$DEST/Contents/Info" CFBundleShortVersionString 2>/dev/null || echo "?")"
echo "✓ Flow Notes $VERSION installed. Opening…"
open "$DEST"
