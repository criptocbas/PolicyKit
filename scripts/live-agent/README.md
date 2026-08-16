# Live agent (compromised-agent demo)

Always-on proof for edge **C**: a hot agent can only move vault funds within policy; rogue program intent and rogue destinations fail on-chain.

## Setup (once)

```bash
# From repo root; uses ~/.config/solana/id.json as authority (devnet SOL)
yarn agent:setup
```

Creates:

- `proof/.agent-keypair.json` — **gitignored** agent secret
- `proof/live-config.json` — public addresses (safe to commit)
- Funded policy vault on devnet

### Prerequisites / blockers

| Need | Why |
|------|-----|
| Authority key with **devnet SOL** | Pays setup + ATA rent (`AUTHORITY_KEY`, default `~/.config/solana/id.json`) |
| Devnet RPC reachable | Public `api.devnet.solana.com` is often slow/rate-limited — prefer a paid RPC |
| `yarn build:packages` | `agent:setup` / `agent:tick` run this first |
| Agent key on disk | After setup: `proof/.agent-keypair.json` (or `AGENT_KEY`) |
| Optional paid RPC | `export RPC_URL='https://devnet.helius-rpc.com/?api-key=…'` **or** write the URL to **gitignored** `proof/.rpc-url` (one line) |

If `proof/live-config.json` is missing → run setup.  
If agent pubkey ≠ `live-config.agent` → tick warns; re-run setup or point `AGENT_KEY` at the correct file.  
If daily budget exhausted → allowed spend becomes `skip_budget` (still exit 0 — **bounding works**).

## Tick

```bash
yarn agent:tick
```

Each tick:

1. Allowed spend (Jupiter → agent ATA) — or skip if daily budget exhausted  
2. Drift intent → submit with preflight bypassed and verify the failed
   `ProgramNotAllowed` transaction on-chain
3. Outsider destination → submit with preflight bypassed and verify the failed
   `DestinationNotAllowed` transaction on-chain

Updates `proof/live-feed.json` and `apps/dashboard/public/proof/live-feed.json`.

### Verified (devnet)

| Check | Result |
|-------|--------|
| `yarn agent:tick` | **OK** — accepted spend plus signed on-chain ProgramNotAllowed and DestinationNotAllowed failures |
| Policy | `GG9quehB9FZEexttoxanCxapSFMHxDhZ5gGV6wsHe66n` (see `proof/live-config.json`) |
| Keys committed | **No** — `proof/.agent-keypair.json` gitignored (`**/.agent-keypair.json`) |

## Schedule (always-on)

### systemd user timer (preferred when `crontab` is missing)

```bash
# Writes units + enables timer (every 6h + soon after boot)
bash scripts/live-agent/install-systemd.sh --install

# Status / logs
systemctl --user list-timers policykit-tick.timer
journalctl --user -u policykit-tick.service -n 50

# Keep timer running after logout (optional, once per machine)
loginctl enable-linger "$USER"
```

### cron (if available)

```bash
# Dry-run (prints the crontab line)
yarn agent:cron

# Install every-6h tick for this checkout
bash scripts/live-agent/install-cron.sh --install
```

### Health check

```bash
bash scripts/live-agent/feed-health.sh 24   # freshness, schema, latest tick, and public-copy integrity
```

Do **not** put mainnet keys in GitHub Actions. Prefer local systemd/cron with a throwaway **devnet-only** agent key.

### Feed format

`proof/live-feed.json` (and the dashboard public copy) is a **versioned document**:

```json
{
  "version": 2,
  "updatedAt": "ISO-8601",
  "cluster": "devnet",
  "policy": "<policy pda>",
  "programId": "<program id>",
  "tickCount": 12,
  "events": [
    {
      "kind": "reject_program",
      "evidence": "onchain_rejection",
      "signature": "<failed transaction signature>",
      "slot": 123
    }
  ]
}
```

Evidence is one of `onchain_success`, `onchain_rejection`,
`preflight_rejection`, or `local_observation`. On-chain claims require a
transaction signature. The dashboard validates this contract and shows
**freshness** from `updatedAt` (live &lt; 6h, recent &lt; 48h, else stale).

## GHA design note (not implemented — needs EngLead OK)

If we add a scheduled workflow later:

| Choice | Recommendation |
|--------|----------------|
| Trigger | `schedule: cron: '0 */6 * * *'` + `workflow_dispatch` |
| Secrets | `AGENT_SECRET` (JSON byte array) and optional `RPC_URL` only — **never** authority clawback key |
| Scope | **devnet only**; hard-fail if `cluster != devnet` |
| Steps | checkout → Node 22 → yarn install → write agent key from secret → `yarn agent:tick` → commit `proof/live-feed.json` via bot token **or** upload artifact only |
| Risk | Public repo + agent secret = bounded drain of **demo vault only**; still a secret leak surface |
| Safer default | Keep **local/systemd cron** for Eternal; use GHA only if feed must update without a laptop |

**Do not implement the workflow until EngLead approves** secrets + auto-commit policy.

## Env

| Var | Default |
|-----|---------|
| `RPC_URL` | env, else first line of `proof/.rpc-url`, else `https://api.devnet.solana.com` |
| `AUTHORITY_KEY` | `~/.config/solana/id.json` |
| `AGENT_KEY` | `proof/.agent-keypair.json` |
| `PROGRAM_ID` | SDK default |

**Never commit** `proof/.rpc-url` or agent keypairs (both gitignored).
