# Judge pack (Colosseum Eternal)

**60-second cold open.** No wallet. No local build.

## Live policy (devnet)

**Production host (share this):** [https://policy-kit-dashboard.vercel.app](https://policy-kit-dashboard.vercel.app)

Prefer the stable production domain — not a per-deployment URL (`…-jnv404zwj-…`). Those can be SSO-protected or go stale after the next deploy.

| What | Link |
|------|------|
| **Public max-damage page** | https://policy-kit-dashboard.vercel.app/p/GG9quehB9FZEexttoxanCxapSFMHxDhZ5gGV6wsHe66n |
| **Control room** | https://policy-kit-dashboard.vercel.app/ |
| **Policy on Solscan** | https://solscan.io/account/GG9quehB9FZEexttoxanCxapSFMHxDhZ5gGV6wsHe66n?cluster=devnet |
| **Program on Solscan** | https://solscan.io/account/AoTJDX2z2ej5r4UUKCofEbgDUXApWpGhQnvfk8seZf27?cluster=devnet |
| **Repo** | https://github.com/criptocbas/PolicyKit |
| **Agent Kit example** | [examples/agent-kit-bounded-spend](../examples/agent-kit-bounded-spend) |

Local dashboard: `yarn dev:dashboard` → open `/p/GG9quehB9FZEexttoxanCxapSFMHxDhZ5gGV6wsHe66n`.

## What you should see

1. **Active** policy with remaining daily budget, per-tx max, destination/program allowlists.  
2. **If agent key is stolen** — max per action, remaining today, who they can pay (configuration-scoped).  
3. **Live adversary ticks** — recent `allowed` + `reject_program` (`ProgramNotAllowed`) + `reject_dest` (`DestinationNotAllowed`) with Solscan links when available.  
4. Feed badge **Live** (not Stale). If stale, ask the team to run `yarn agent:tick`.

## Honest edge (one sentence)

Open Solana policy vault: Agent Kit routes **vault** spends through on-chain `execute_spend` with configurable caps, allowlists, pause/clawback, and public max-damage proofs — **when funds sit in a configured vault**.

## What we do **not** claim

- Full CPI mediation into Jupiter/DeFi  
- Sandbox of co-loaded Agent Kit transfer plugins (fund the vault, not the agent key)  
- Formal audit completeness  
- Category monopoly over Turnkey/Privy, Squads, or Foundation allowances  

See [COMPETITIVE.md](./COMPETITIVE.md) and [MAX_DAMAGE.md](./MAX_DAMAGE.md).

## Feed freshness (maintainers)

```bash
yarn agent:tick                 # one-shot refresh
bash scripts/live-agent/feed-health.sh 24
# preferred on this machine (no crontab):
bash scripts/live-agent/install-systemd.sh --install
# or cron if available:
bash scripts/live-agent/install-cron.sh --install
```
