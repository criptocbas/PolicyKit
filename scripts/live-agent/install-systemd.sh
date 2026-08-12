#!/usr/bin/env bash
# Install a systemd --user timer that runs yarn agent:tick every 6 hours.
# Prefer this when crontab is unavailable (common on minimal desktop installs).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SERVICE_SRC="${ROOT}/scripts/live-agent/policykit-tick.service"
TIMER_SRC="${ROOT}/scripts/live-agent/policykit-tick.timer"
SERVICE_DST="${UNIT_DIR}/policykit-tick.service"
TIMER_DST="${UNIT_DIR}/policykit-tick.timer"
LOG_HINT="journalctl --user -u policykit-tick.service -n 50"

# Rewrite WorkingDirectory + yarn path to this checkout and detected yarn.
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

YARN_DIR="$(dirname "$YARN_BIN")"
mkdir -p "$UNIT_DIR"

# Generate service with absolute paths for this machine.
cat >"$SERVICE_DST" <<EOF
[Unit]
Description=PolicyKit live adversary tick (devnet)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${ROOT}
Environment=PATH=${YARN_DIR}:/usr/local/bin:/usr/bin:/bin
ExecStart=/bin/bash ${ROOT}/scripts/live-agent/run-tick-wrapper.sh
Nice=10

[Install]
WantedBy=default.target
EOF

cp "$TIMER_SRC" "$TIMER_DST"

# Wrapper keeps RPC_URL + logging logic out of the unit file.
WRAPPER="${ROOT}/scripts/live-agent/run-tick-wrapper.sh"
cat >"$WRAPPER" <<'WRAP'
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
if [[ -f proof/.rpc-url ]]; then
  export RPC_URL="$(head -n1 proof/.rpc-url | tr -d '\r')"
fi
# Prefer explicit yarn if PATH has mise node.
exec yarn agent:tick
WRAP
chmod +x "$WRAPPER"

echo "Wrote:"
echo "  $SERVICE_DST"
echo "  $TIMER_DST"
echo "  $WRAPPER"
echo

if [[ "${1:-}" == "--install" ]]; then
  systemctl --user daemon-reload
  systemctl --user enable --now policykit-tick.timer
  systemctl --user status policykit-tick.timer --no-pager || true
  echo
  echo "Installed. Next tick schedule:"
  systemctl --user list-timers policykit-tick.timer --no-pager || true
  echo
  echo "Logs: $LOG_HINT"
  echo "Manual run: systemctl --user start policykit-tick.service"
else
  echo "Dry-run only (unit files written). To enable:"
  echo "  bash scripts/live-agent/install-systemd.sh --install"
fi
