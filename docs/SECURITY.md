# PolicyKit Security Model

> Full adversarial model: [THREAT_MODEL.md](./THREAT_MODEL.md). Error reference: [ERROR_CATALOG.md](./ERROR_CATALOG.md). Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md).

## Trust boundaries

| Actor | Can do | Cannot do |
|-------|--------|-----------|
| **Authority** | create/update policy, pause/unpause, set agent, clawback | Impersonate agent without agent key |
| **Agent** | `execute_spend` of **spend_mint** within rules | Pause, clawback, update rules, spend past limits, spend non-`spend_mint` |
| **Anyone** | `deposit` into vault | Move funds out of vault |
| **Program** | PDA-sign vault transfers after checks | Move funds without an instruction path |

## Invariants

1. **Vault custody** — All protected assets sit in token accounts whose owner is the Policy PDA. The agent key is never the token authority.
2. **Single outbound paths** — Only `execute_spend` (agent) and `clawback` (authority) debit the vault.
3. **Checks before CPI** — `check_and_record_spend` runs fully before the token transfer. Failed checks abort the transaction; counters are not committed.
4. **Authority supremacy** — Pause and clawback work regardless of agent state. Clawback works while paused (any mint).
5. **PDA binding** — Seeds are `["policy", authority, policy_id]`. No shared vaults across authorities.
6. **No reinitialization** — `create_policy` uses `init` only.
7. **spend_mint-only agent spends (MVP)** — `execute_spend` requires `mint == policy.spend_mint`. Mistaken other-mint deposits are recovered via `clawback`, not agent spend.

## Rule enforcement (`execute_spend`)

Order of checks:

1. Anchor account constraints verify the agent, Policy PDA, mint owner, and token program.
2. Handler deserializes the vault and verifies its mint and Policy PDA authority.
3. Handler deserializes the destination and verifies the mint.
4. Destination owner ≠ Policy PDA (`InvalidDestination`).
5. Amount > 0.
6. Not paused.
7. Not expired (`expires_at == 0 || now < expires_at`).
8. Refresh day window (86400s) and rate window.
9. **`mint == spend_mint`** (`SpendMintRequired`).
10. Program allowlist and denylist, when enabled.
11. Mint allowlist, when enabled.
12. Destination owner allowlist, when enabled.
13. Rate limit (`actions_in_window < max`).
14. Per-transaction and daily limits; record spend and action counters.
15. Vault balance check.
16. PDA-signed classic SPL `Transfer`.

All state changes and the transfer are atomic. A later balance or CPI failure rolls
back the counter mutations. Client-side preflight is advisory: it can reject an
attempt before submission, but only a submitted transaction is on-chain evidence.

## Intent program (honest limitations)

Solana cannot observe what an agent does *after* tokens leave the vault. `intent_program` is a **declared** program ID checked against allow/deny lists. The Agent Kit plugin always sets it to the program about to be used.

A malicious agent could declare an allowed intent and send funds elsewhere. **Economic damage is still bounded** by:

- Per-transaction and daily spend caps on `spend_mint`
- Mint allowlist (when enabled)
- **Destination owner allowlist** (when enabled) — recipient set is constrained even if intent is spoofed
- Rate limits
- Pause + clawback by authority

Full CPI mediation into DeFi programs is the intentional post-MVP hardening path. With destination allowlist + caps, spoofed intent cannot pay arbitrary wallets.

## Agent Kit composition

The PolicyKit plugin **only** gates outflows from the **policy vault** via `execute_spend`.

- **Do fund** the vault ATA, not the agent key (agent needs fee SOL only).
- **Do not** load unrestricted transfer/swap plugins that move agent-held balances if you rely on PolicyKit as the sole spend control.
- Co-loaded Agent Kit plugins can still move **non-vault** assets the agent wallet holds — that is outside on-chain PolicyKit.

## Account validation

- Policy: typed `Account<Policy>` + PDA seeds + bump + `has_one` for authority/agent
- Token accounts: owner must be classic SPL Token program; mint + authority checked via `Pack` deserialize in handler
- Token program: constrained to `spl_token::ID`
- No `init_if_needed` on the Policy account; vault ATA is created client-side
- Checked arithmetic on counters
- `create_policy` and `set_agent` both reject the default pubkey as agent

## Known non-goals (MVP)

- Token-2022 / transfer hooks  
- Hierarchical policies  
- Multi-sig authority (compose with Squads off-program)  
- Multi-asset `execute_spend` budgets (only `spend_mint`)  
- Formal verification  
- Whole-agent sandbox of every Agent Kit plugin  

## Operational recommendations

1. Fund the **vault**, not the agent wallet (agent only needs fee SOL).  
2. Use tight daily + per-tx caps for hot agents.  
3. Enable program allowlist for production.  
4. Prefer mint allowlist that includes `spend_mint`.  
5. Monitor `SpendExecuted` events; reconcile intent vs subsequent txs.  
6. Keep authority key cold / hardware-backed; rotate agent with `set_agent` if compromised.  
7. Prefer pause → clawback → investigate on anomaly.  
8. Redeploy the program after security patches before relying on new checks.  
