# Agent Kit + PolicyKit (bounded spend)

**Gold-standard 15-minute path:** load a policy vault, attach the PolicyKit plugin, spend only under rules, see clean on-chain rejects.

This is the artifact that makes edge **A** real: developers copy this pattern, not raw SPL transfers.

## Security ops (read first)

1. **Fund the policy vault**, not the agent wallet (agent needs fee SOL only).  
2. Do **not** co-load unrestricted SPL transfer plugins if PolicyKit is your spend control.  
3. Prefer destination + program allowlists enabled.  
4. Authority keeps **pause** (circuit breaker) + **clawback**.

## Prerequisites

| Need | Why |
|------|-----|
| Node **22+** | `solana-agent-kit` engines |
| Monorepo packages built | `yarn build:packages` from repo root |
| Devnet live policy | `yarn agent:setup` (writes `proof/live-config.json` + agent key) |

## Run

```bash
# From monorepo root (once):
yarn install
yarn build:packages
yarn agent:setup          # needs authority SOL on devnet

# From monorepo root (preferred — workspace links the SDK/plugin):
yarn example:agent-kit

# Or:
cd examples/agent-kit-bounded-spend
cp .env.example .env      # optional overrides
yarn start                # after root yarn install
```

## What it proves

| Step | Expected |
|------|----------|
| Status + max damage | Remaining budget / worst-case if key stolen |
| Allowed spend | Jupiter intent → agent ATA succeeds (or budget bound) |
| Rogue program | Drift intent → `ProgramNotAllowed` |
| Rogue destination | Outsider wallet → `DestinationNotAllowed` |

## Env

| Variable | Default |
|----------|---------|
| `RPC_URL` | `https://api.devnet.solana.com` |
| `LIVE_CONFIG` | `../../proof/live-config.json` |
| `AGENT_KEY` | `../../proof/.agent-keypair.json` |

## Links

- Public policy page: `/p/<policy>` on the dashboard  
- Continuous adversary ticks: `yarn agent:tick`  
- Competitive notes: [`docs/COMPETITIVE.md`](../../docs/COMPETITIVE.md)  
- Ecosystem contribution path: [`docs/ECOSYSTEM.md`](../../docs/ECOSYSTEM.md)  
