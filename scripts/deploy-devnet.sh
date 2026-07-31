#!/usr/bin/env bash
# Deploy / upgrade PolicyKit on Solana devnet.
# Requires: avm use 0.32.1, solana CLI, funded ~/.config/solana/id.json
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RPC="${RPC_URL:-https://api.devnet.solana.com}"
WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"
PROGRAM_KP="$ROOT/target/deploy/policykit-keypair.json"
SO="$ROOT/target/deploy/policykit.so"

echo "==> Using RPC $RPC"
echo "==> Wallet $WALLET ($(solana-keygen pubkey "$WALLET"))"
echo "==> Program id $(solana-keygen pubkey "$PROGRAM_KP")"

avm use 0.32.1
anchor build

# Close any leftover buffers (best-effort)
# solana program show may list intermediate accounts on failed deploys

SIZE=$(wc -c < "$SO" | tr -d ' ')
echo "==> Binary size $SIZE bytes"

# Extend program data if upgrade needs more room (min 10240 bytes per extend)
# Ignore failure if already large enough or first deploy
solana program extend "$(solana-keygen pubkey "$PROGRAM_KP")" 10240 \
  -u "$RPC" --keypair "$WALLET" 2>/dev/null || true

echo "==> Deploying / upgrading..."
solana program deploy "$SO" \
  --program-id "$PROGRAM_KP" \
  -u "$RPC" \
  --keypair "$WALLET"

echo "==> Done. Program:"
solana program show "$(solana-keygen pubkey "$PROGRAM_KP")" -u "$RPC"
echo ""
echo "Dashboard env:"
echo "  NEXT_PUBLIC_CLUSTER=devnet"
echo "  NEXT_PUBLIC_RPC_URL=$RPC"
echo "  NEXT_PUBLIC_POLICYKIT_PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KP")"
