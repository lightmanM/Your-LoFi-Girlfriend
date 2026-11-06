#!/usr/bin/env bash
# Recreate the throwaway Unity project, import the purchased Marycia package
# (with its .meta files), dump Unity's evaluation of the clips, then compare
# with the portable converter. Nothing from the package is executed; only
# LofiParity.cs (ours) runs inside the editor.
#
# Usage: scripts/marycia/unity/run_parity.sh [--skip-create]
# Env:   UNITY, PKG (extracted Assets/BeroarN dir), PROJ (project dir), LOGS
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
UNITY="${UNITY:-/Applications/Unity/Hub/Editor/6000.6.8f1/Unity.app/Contents/MacOS/Unity}"
PKG="${PKG:-$HOME/Library/Caches/lofi-asset-review/marycia-c8b312ba/extracted/Assets/BeroarN}"
PROJ="${PROJ:-$HOME/Library/Caches/lofi-asset-review/unity-marycia}"
LOGS="${LOGS:-$HOME/Library/Caches/lofi-asset-review/unity-marycia-logs}"
SOURCE="$REPO/web/public/models/marycia/source-motions.json"
CURVES="${CURVES:-$REPO/assets/characters/marycia/source-curves.json}"
OUT="${OUT:-$REPO/assets/characters/marycia/unity-dump.json}"
mkdir -p "$LOGS" "$REPO/docs/marycia-parity"

if [[ "${1:-}" != "--skip-create" ]]; then
  rm -rf "$PROJ"
  "$UNITY" -batchmode -nographics -quit -createProject "$PROJ" -logFile "$LOGS/00-create.log"
  mkdir -p "$PROJ/Assets/Editor"
  cp -R "$PKG" "$PROJ/Assets/BeroarN"
fi
cp "$REPO/scripts/marycia/unity/LofiParity.cs" "$PROJ/Assets/Editor/LofiParity.cs"

# Frame times copied from the curve extraction so both dumps line up exactly.
python3 -I - "$CURVES" "$PROJ/lofi-times.txt" <<'PY'
import json, sys
clips = json.load(open(sys.argv[1]))["clips"]
with open(sys.argv[2], "w") as f:
    for key, clip in clips.items():
        f.write(key + " " + clip["sourceFile"] + " " + " ".join(repr(float(t)) for t in clip["times"]) + "\n")
PY

"$UNITY" -batchmode -nographics -quit -projectPath "$PROJ" \
  -executeMethod Lofi.LofiParity.Dump -lofiOut "$OUT" -lofiTimes "$PROJ/lofi-times.txt" \
  -logFile "$LOGS/01-import-dump.log"

# COMPARE=1 measures the old Godot converter against this dump (clips present in both).
[[ "${COMPARE:-0}" == "1" ]] && cd "$REPO" && python3 -I scripts/marycia/compare_parity.py --unity "$OUT" --source "$SOURCE" --out docs/marycia-parity/parity.json
