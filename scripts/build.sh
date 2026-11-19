#!/bin/bash
# Build "Christmas Mode.app".
#   scripts/build.sh              → ~/Library/Caches/ModeNoel/Christmas Mode.app (dev)
#   scripts/build.sh --install    → ~/Applications/Christmas Mode.app
#   scripts/build.sh --release    → universal (Apple silicon + Intel) app zipped to dist/ChristmasMode.zip
set -euo pipefail
cd "$(dirname "$0")/.."
MODE="${1:-}"
CACHE="$HOME/Library/Caches/ModeNoel"            # outside iCloud Documents (Finder xattrs break codesign)
if [[ "$MODE" == "--release" ]]; then
  SP="$CACHE/universal"
  swift build -c release --arch arm64 --arch x86_64 --scratch-path "$SP" >/dev/null 2>&1
  BIN="$SP/out/Products/Release/ModeNoel"
  APP="$CACHE/release/Christmas Mode.app"
else
  SP="$CACHE/build"
  swift build -c release --scratch-path "$SP" >/dev/null
  BIN="$SP/release/ModeNoel"
  if [[ "$MODE" == "--install" ]]; then
    DEST="/Applications"; [[ -w "$DEST" ]] || DEST="$HOME/Applications"
    APP="$DEST/Christmas Mode.app"
  else APP="$CACHE/Christmas Mode.app"; fi
fi
mkdir -p "$(dirname "$APP")"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web/assets"
cp "$BIN" "$APP/Contents/MacOS/ModeNoel"
cp Resources/Info.plist "$APP/Contents/Info.plist"
[[ -f Resources/AppIcon.icns ]] && cp Resources/AppIcon.icns "$APP/Contents/Resources/" || true
rsync -a --exclude '.DS_Store' --exclude 'assets' web/ "$APP/Contents/Resources/web/"
for d in wallpaper characters vehicles props; do
  rsync -a --exclude '.DS_Store' --exclude '_*' "assets/$d" "$APP/Contents/Resources/web/assets/"
done
xattr -cr "$APP"
codesign --force --deep --sign - "$APP" >/dev/null 2>&1
if [[ "$MODE" == "--release" ]]; then
  mkdir -p dist
  rm -f dist/ChristmasMode.zip
  (cd "$(dirname "$APP")" && ditto -c -k --sequesterRsrc --keepParent "Christmas Mode.app" "$OLDPWD/dist/ChristmasMode.zip")
  echo "$PWD/dist/ChristmasMode.zip"
else
  echo "$APP"
fi
