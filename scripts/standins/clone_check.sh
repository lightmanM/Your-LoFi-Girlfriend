#!/usr/bin/env bash
# Run the page as a fresh clone of the public repo would: only the files a commit would hold (tracked and new files,
# nothing git-ignored, so none of the private character, scene meshes or music), copied to a scratch folder with its
# own dev server. Expect the stand-in suite to pass and the suites that need the owner's files to skip.
#   scripts/standins/clone_check.sh [scratch folder] [playwright args...]     (PORT defaults to 5177)
set -euo pipefail
REPO=$(git rev-parse --show-toplevel)
DEST=${1:-$(mktemp -d)/clone}; shift || true
PORT=${PORT:-5177}
rm -rf "$DEST" && mkdir -p "$DEST"
(cd "$REPO" && git ls-files -z --cached --others --exclude-standard | python3 -c '
import os, shutil, sys
dest = sys.argv[1]
for f in sys.stdin.buffer.read().decode().split("\0"):
    if f and os.path.lexists(f) and not os.path.islink(f):   # links point at private files outside the repo
        os.makedirs(os.path.join(dest, os.path.dirname(f)), exist_ok=True)
        shutil.copy2(f, os.path.join(dest, f))
' "$DEST")
leaked=$(cd "$DEST" && find . -name '*.vrm' -not -path './web/public/standin/*' -o -name 'chair-visible.glb' -o -name 'plants.glb' -o -name '*.mp3' | grep -v node_modules || true)
if [ -n "$leaked" ]; then echo "private files in the copy: $leaked" >&2; exit 1; fi
# every relative link in the READMEs points at a file the copy has
python3 - "$DEST" <<'PY'
import os, re, sys
dest, bad = sys.argv[1], []
for doc in ("README.md", "web/README.md", "CREDITS.md"):
    text = open(os.path.join(dest, doc), encoding="utf-8").read()
    for link in re.findall(r"\]\(([^)#\s]+)", text) + re.findall(r'!\[[^\]]*\]\(([^)\s]+)', text):
        if not link.startswith(("http", "/")) and not os.path.exists(os.path.normpath(os.path.join(dest, os.path.dirname(doc), link))):
            bad.append(f"{doc}: {link}")
if bad:
    sys.exit("broken links:\n" + "\n".join(bad))
print("readme links: ok")
PY
cd "$DEST/web"
npm ci --silent >/dev/null
npm test >/dev/null && echo "unit tests: pass"
npm run build >/dev/null && echo "build: ok"
PORT=$PORT npx playwright test --reporter=line "$@"
