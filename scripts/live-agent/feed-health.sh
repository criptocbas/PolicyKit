#!/usr/bin/env bash
# Exit 0 if live-feed is fresh (< 48h); exit 1 if stale/missing. For local checks.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FEED="${ROOT}/proof/live-feed.json"
PUBLIC_FEED="${ROOT}/apps/dashboard/public/proof/live-feed.json"
MAX_AGE_H="${1:-48}"

if [[ ! -f "$FEED" ]]; then
  echo "FAIL: missing $FEED"
  exit 1
fi

python3 - <<PY
from datetime import datetime, timezone
import json, pathlib, re, sys

feed_path = pathlib.Path("$FEED")
public_path = pathlib.Path("$PUBLIC_FEED")
max_h = float("$MAX_AGE_H")

try:
    raw = feed_path.read_text()
    data = json.loads(raw)
except Exception as exc:
    print(f"FAIL: invalid feed JSON: {exc}")
    sys.exit(1)

if not isinstance(data, dict):
    print("FAIL: feed must be a versioned object")
    sys.exit(1)
version = data.get("version")
if version not in (1, 2):
    print(f"FAIL: unsupported feed version {version!r}")
    sys.exit(1)
events = data.get("events")
if not isinstance(events, list) or not events:
    print("FAIL: feed has no events")
    sys.exit(1)
ts = data.get("updatedAt") or events[0].get("ts")
if not ts:
    print("FAIL: no updatedAt in feed")
    sys.exit(1)

then = datetime.fromisoformat(ts.replace("Z", "+00:00"))
now = datetime.now(timezone.utc)
age_h = (now - then).total_seconds() / 3600.0
print(f"updatedAt={ts}")
print(f"age_hours={age_h:.2f}")
print(f"max_hours={max_h}")
print(f"version={version}")
print(f"event_count={len(events)}")
if age_h < -0.1:
    print("FAIL: feed timestamp is in the future")
    sys.exit(1)
if age_h > max_h:
    print("FAIL: feed stale")
    sys.exit(1)

if any(event.get("ok") is not True for event in events[:3]):
    print("FAIL: latest tick contains an unexpected result")
    sys.exit(1)

if version >= 2:
    signature_re = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{64,88}$")
    for index, event in enumerate(events):
        evidence = event.get("evidence")
        if evidence in ("onchain_success", "onchain_rejection"):
            signature = event.get("signature", "")
            if not signature_re.fullmatch(signature):
                print(f"FAIL: event {index} claims {evidence} without a valid signature")
                sys.exit(1)

if not public_path.exists():
    print(f"FAIL: missing dashboard copy {public_path}")
    sys.exit(1)
if json.loads(public_path.read_text()) != data:
    print("FAIL: proof feed and dashboard public copy differ")
    sys.exit(1)

print("OK: feed fresh")
PY
