# PolicyKit Security Model

## Trust boundaries

| Actor | Can do | Cannot do |
|-------|--------|-----------|
| **Authority** | create/update policy, pause/unpause, set agent, clawback | Impersonate agent without agent key |
| **Agent** | `execute_spend` within rules | Pause, clawback, update rules, spend past limits |
| **Anyone** | `deposit` into vault | Move funds out of vault |
| **Program** | PDA-sign vault transfers after checks | Move funds without an instruction path |

## Invariants

1. **Vault custody** — All protected assets sit in token accounts whose owner is the Policy PDA. The agent key is never the token authority.
2. **Single outbound paths** — Only `execute_spend` (agent) and `clawback` (authority) debit the vault.
3. **Checks before CPI** — `check_and_record_spend` runs fully before the token transfer. Failed checks abort the transaction; counters are not committed.
4. **Authority supremacy** — Pause and clawback work regardless of agent state. Clawback works while paused.
5. **PDA binding** — Seeds are `["policy", authority, policy_id]`. No shared vaults across authorities.
6. **No reinitialization** — `create_policy` uses `init` only.

## Rule enforcement (`execute_spend`)

Order of checks:

1. Amount > 0  
2. Not paused  
3. Not expired (`expires_at == 0 || now < expires_at`)  
4. Refresh day window (86400s) and rate window  
5. Program allowlist (if enabled)  
6. Program denylist (if enabled)  
7. Mint allowlist (if enabled)  
8. Rate limit (`actions_in_window < max`)  
9. If mint == `spend_mint`: per-tx limit, daily limit; update spend counters  
10. Increment action counter  
11. Balance check  
12. PDA-signed SPL transfer  

## Intent program (honest limitations)

Solana cannot observe what an agent does *after* tokens leave the vault. `intent_program` is a **declared** program ID checked against allow/deny lists. The Agent Kit plugin always sets it to the program about to be used.

A malicious agent could declare an allowed intent and send funds elsewhere. **Economic damage is still bounded** by:

- Per-transaction and daily spend caps on `spend_mint`
- Mint allowlist
- Rate limits
- Pause + clawback by authority

Full CPI mediation into DeFi programs (vault never releases tokens except via policy-signed CPI into an allowlisted program) is the intentional post-MVP hardening path.

## Account validation

- Policy: typed `Account<Policy>` + PDA seeds + bump + `has_one` for authority/agent
- Token accounts: owner must be classic SPL Token program; mint + authority checked via `Pack` deserialize in handler
- Token program: constrained to `spl_token::ID`
- No `init_if_needed` on the Policy account
- Checked arithmetic on counters

## Known non-goals (MVP)

- Token-2022 / transfer hooks  
- Hierarchical policies  
- Multi-sig authority (compose with Squads off-program)  
- Formal verification  

## Operational recommendations

1. Fund the **vault**, not the agent wallet (agent only needs fee SOL).  
2. Use tight daily + per-tx caps for hot agents.  
3. Enable program allowlist for production.  
4. Monitor `SpendExecuted` events; reconcile intent vs subsequent txs.  
5. Keep authority key cold / hardware-backed; rotate agent with `set_agent` if compromised.  
6. Prefer pause → clawback → investigate on anomaly.
