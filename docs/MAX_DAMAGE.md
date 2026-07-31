# Compromised-agent max damage

**Scenario:** The agent hot key is stolen or the LLM is jailbroken into “send everything.”

## What still protects funds

| Control | Effect |
|---------|--------|
| Vault custody | Agent is **not** token authority; only `execute_spend` / `clawback` move value |
| Per-tx cap | Single action size limited |
| Daily cap | Rolling 24h economic ceiling |
| Rate limit | Caps actions per time window |
| Destination owner allowlist | Can only pay allowlisted wallets (e.g. agent itself) |
| Program allow/deny | Declared intent must match lists |
| Pause | Authority freezes all spends immediately |
| Clawback | Authority recovers vault balance |

## How to read “max damage”

On the public policy page (`/p/<policy>`) and in the SDK `computeMaxDamage()`:

- **Max per action** = `max_per_transaction`  
- **Max per rate window** ≈ `max_per_transaction × max_actions_per_window` (if both set)  
- **Remaining today** = daily budget left  
- **Can pay only** = destination allowlist  

If daily remaining is 50 and per-tx is 5, a stolen key cannot extract more than remaining daily (and is further limited by rate + destinations).

## What we do *not* claim

- Full sandbox of every Agent Kit plugin  
- Prevention of all post-withdraw behavior once funds leave the vault to an *allowed* destination  
- Formal audit completeness  

See [THREAT_MODEL.md](./THREAT_MODEL.md) and [SECURITY.md](./SECURITY.md).
