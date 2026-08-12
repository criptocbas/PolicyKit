#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
if [[ -f proof/.rpc-url ]]; then
  export RPC_URL="$(head -n1 proof/.rpc-url | tr -d '\r')"
fi
# Prefer explicit yarn if PATH has mise node.
exec yarn agent:tick
