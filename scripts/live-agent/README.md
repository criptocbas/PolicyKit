# Live agent (compromised-agent demo)

Always-on proof for edge **C**: a hot agent can only move vault funds within policy; rogue program intent and rogue destinations fail on-chain.

## Setup (once)

```bash
# From repo root; uses ~/.config/solana/id.json as authority (devnet SOL)
yarn agent:setup
```

Creates:

- `proof/.agent-keypair.json` — **gitignored** agent secret
- `proof/live-config.json` — public addresses (committed optional)
- Funded policy vault on devnet

## Tick

```bash
yarn agent:tick
```

Each tick:

1. Allowed spend (Jupiter → agent ATA) — or skip if daily budget exhausted  
2. Drift intent → expect `ProgramNotAllowed`  
3. Outsider destination → expect `DestinationNotAllowed`  

Updates `proof/live-feed.json` and `apps/dashboard/public/proof/live-feed.json`.

## Schedule (cron)

```cron
# Every 6 hours
0 */6 * * * cd /path/to/PolicyKit && /usr/bin/yarn agent:tick >> /tmp/policykit-tick.log 2>&1
```

Do **not** put mainnet keys in GitHub Actions. Prefer local cron with a throwaway devnet agent key.

## Env

| Var | Default |
|-----|---------|
| `RPC_URL` | `https://api.devnet.solana.com` |
| `AUTHORITY_KEY` | `~/.config/solana/id.json` |
| `AGENT_KEY` | `proof/.agent-keypair.json` |
| `PROGRAM_ID` | SDK default |
