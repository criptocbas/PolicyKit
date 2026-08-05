#!/usr/bin/env bash
# Install a user crontab line that runs yarn agent:tick every 6 hours.
# Safe for local demos; uses devnet only via default RPC in the scripts.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG="${POLICYKIT_TICK_LOG:-/tmp/policykit-tick.log}"

# Prefer a stable yarn binary (avoid yarn's ephemeral /tmp/yarn--* shim when
# this script is invoked via `yarn agent:cron`).
YARN_BIN="${POLICYKIT_YARN:-}"
if [[ -z "$YARN_BIN" ]]; then
  for candidate in \
    "$(type -P yarn 2>/dev/null || true)" \
    "$HOME/.yarn/bin/yarn" \
    /usr/local/bin/yarn \
    /usr/bin/yarn; do
    if [[ -n "$candidate" && -x "$candidate" && "$candidate" != /tmp/yarn--* ]]; then
      YARN_BIN="$candidate"
      break
    fi
  done
fi
if [[ -z "$YARN_BIN" || "$YARN_BIN" == /tmp/yarn--* ]]; then
  YARN_BIN="yarn"
fi

CRON_LINE="0 */6 * * * cd ${ROOT} && ${YARN_BIN} agent:tick >> ${LOG} 2>&1"

echo "Proposed crontab entry:"
echo "  ${CRON_LINE}"
echo
echo "Log file: ${LOG}"
echo
if [[ "${1:-}" == "--install" ]]; then
  (crontab -l 2>/dev/null | grep -v 'yarn agent:tick' || true; echo "$CRON_LINE") | crontab -
  echo "Installed. Verify with: crontab -l"
else
  echo "Dry-run only. To install:"
  echo "  bash scripts/live-agent/install-cron.sh --install"
fi
