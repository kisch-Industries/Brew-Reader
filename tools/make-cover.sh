#!/bin/sh
# Renders assets/cover.html to assets/cover.png (260x402) and embeds it as the launcher's # Icon: header.
set -e
cd "$(dirname "$0")/.."
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=260,402 --screenshot="$PWD/assets/cover.png" "file://$PWD/assets/cover.html" 2>/dev/null
python3 -I - <<'PY'
import base64
b64 = base64.b64encode(open("assets/cover.png", "rb").read()).decode()
lines = open("brewreader.sh").read().split("\n")
lines = [l for l in lines if not l.startswith("# Icon:")]
lines.insert(lines.index("# Author: Alex Kisch") + 1, "# Icon: data:image/png;base64," + b64)
open("brewreader.sh", "w").write("\n".join(lines))
PY
echo "Updated assets/cover.png and brewreader.sh"
