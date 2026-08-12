# Compromised-agent max damage

**Scenario:** The agent hot key is stolen or the LLM is jailbroken into “send everything.”

**Prerequisite:** Spendable funds are in the **policy vault** (not the agent key), and rules are **configured** (non-zero caps where you want a bound; allowlists enabled when you want destination/program restriction).

## What still protects **vault** funds

| Control | Effect |
|---------|--------|
| Vault custody | Agent is **not** token authority; only `execute_spend` / `clawback` move vault value |
| Per-tx cap | Single action size limited (**if ≠ 0**; `0` = unlimited) |
| Daily cap | Rolling 24h economic ceiling (**if ≠ 0**) |
| Rate limit | Caps actions per time window (**if configured**) |
| Destination owner allowlist | Can only pay allowlisted wallets when **enabled** |
| Program allow/deny | Declared intent must match lists when **enabled** (not full CPI mediation) |
| Pause | Authority freezes all spends immediately |
| Clawback | Authority recovers vault balance |

## How to read “max damage”

On the public policy page (`/p/<policy>`) and in the SDK `computeMaxDamage()`:

- **Max per action** = `max_per_transaction`  
- **Max per rate window** ≈ `max_per_transaction × max_actions_per_window` (if both set)  
- **Remaining today** = daily budget left  
- **Can pay only** = destination allowlist  

If daily remaining is 50 and per-tx is 5, a stolen key cannot extract more than remaining daily from the **vault** via `execute_spend` (and is further limited by rate + destinations when enabled).

## What we do *not* claim

- Unconditional “stolen key ⇒ always bounded” without vault custody + configured caps/lists  
- Full sandbox of every Agent Kit plugin (fund the vault; co-loaded transfers can move agent-held balances)  
- Prevention of all post-withdraw behavior once funds leave the vault to an *allowed* destination  
- Full CPI mediation into Jupiter/DeFi (`intent_program` is declared allow/deny)  
- Formal audit completeness  

See [THREAT_MODEL.md](./THREAT_MODEL.md) and [SECURITY.md](./SECURITY.md).
