# PolicyKit x402 v2 example

This example runs a local HTTP 402 resource server and pays it on Solana devnet
from a PolicyKit vault.

It uses the custom x402 scheme **`policykit-exact`**:

1. Server returns HTTP 402 with a base64 `PAYMENT-REQUIRED` header.
2. Client validates network, mint, raw amount, recipient, timeout, and declared
   intent before signing.
3. Client settles the token transfer through PolicyKit `execute_spend`.
4. Client retries with a `PAYMENT-SIGNATURE` containing the confirmed signature.
5. Server verifies the successful PolicyKit invocation, block-time quote window,
   exact recipient token delta, policy address, and one-time signature.

This is deliberately not labelled Solana’s standard x402 `exact` scheme. That
scheme commonly carries a facilitator-settled signed transaction. PolicyKit
currently settles directly through `execute_spend`, so interoperability requires
the resource server to explicitly support `policykit-exact`.

## Run

```bash
# Once, from repository root
yarn agent:setup

# Starts a local resource server, performs one devnet payment, verifies it,
# prints the protected result, and exits.
yarn example:x402
```

Environment:

| Variable | Default |
|----------|---------|
| `LIVE_CONFIG` | `proof/live-config.json` |
| `AGENT_KEY` | `proof/.agent-keypair.json` |
| `RPC_URL` | public devnet RPC |
| `PORT` | `3402` |
| `X402_PRICE` | `1000000` base units |
| `X402_MAX_PRICE` | `2000000` base units |
| `X402_PAY_TO` | configured demo agent |
| `X402_INTENT_PROGRAM` | Jupiter v6 declared intent |

The payee must be on the policy destination-owner allowlist, its token ATA must
already exist, and the intent must be allowlisted. The agent wallet should hold
fee SOL only.

## Failure demonstrations

The SDK adapter has deterministic tests for excessive amount, wrong recipient,
wrong mint, wrong network, wrong intent, expired/excessive timeout, malformed
headers, and missing headers:

```bash
yarn test:unit
```

The HTTP server also rejects replayed signatures and transactions outside the
quote window.
