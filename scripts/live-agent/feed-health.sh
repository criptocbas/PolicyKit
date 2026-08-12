#!/usr/bin/env bash
# Exit 0 if live-feed is fresh (< 48h); exit 1 if stale/missing. For local checks.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FEED="${ROOT}/proof/live-feed.json"
MAX_AGE_H="${1:-48}"

if [[ ! -f "$FEED" ]]; then
  echo "FAIL: missing $FEED"
  exit 1
fi

UPDATED=$(python3 - <<PY
import json, sys
from datetime import datetime, timezone
with open("$FEED") as f:
    d = json.load(f)
ts = d.get("updatedAt") or (d["events"][0]["ts"] if d.get("events") else None)
if not ts:
    print("NONE")
    sys.exit(0)
print(ts)
PY
)

if [[ "$UPDATED" == "NONE" ]]; then
  echo "FAIL: no updatedAt in feed"
  exit 1
fi

python3 - <<PY
from datetime import datetime, timezone
import sys
ts = "$UPDATED"
max_h = float("$MAX_AGE_H")
then = datetime.fromisoformat(ts.replace("Z", "+00:00"))
now = datetime.now(timezone.utc)
age_h = (now - then).total_seconds() / 3600.0
print(f"updatedAt={ts}")
print(f"age_hours={age_h:.2f}")
print(f"max_hours={max_h}")
if age_h > max_h:
    print("FAIL: feed stale")
    sys.exit(1)
print("OK: feed fresh")
PY
