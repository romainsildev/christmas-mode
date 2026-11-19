#!/bin/bash
# Build the GitHub Pages site (live in-browser demo) into docs/.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf docs/js docs/assets docs/*.html
mkdir -p docs/assets docs/media
cp web/demo.html docs/index.html
cp web/overlay.html web/wallpaper.html docs/
rsync -a web/js docs/
for d in wallpaper characters vehicles props; do rsync -a --exclude '_*' "assets/$d" docs/assets/; done
touch docs/.nojekyll
echo "docs/ ready"
