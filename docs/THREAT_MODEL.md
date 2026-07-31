# PolicyKit Threat Model

> Companion to [SECURITY.md](./SECURITY.md). This document describes **adversarial** assumptions, assets, and residual risks for the MVP program (`0.1.x`).

**Scope:** On-chain Anchor program + `@policykit/sdk` + Agent Kit plugin vault path.  
**Out of scope:** Full agent sandbox, TEE/MPC wallets, price oracles, KYC, Token-2022, full CPI mediation into DeFi.

---

## 1. Assets

| Asset | Location | Sensitivity |
|-------|----------|-------------|
| Vault token balances | ATA(s) with Policy PDA as owner | **Critical** — economic value |
| Policy configuration | Policy PDA account data | High — defines agent power |
| Spend / rate counters | Policy PDA | Medium — integrity of limits |
| Authority key | Off-chain (wallet / hardware) | **Critical** — full control |
| Agent key | Off-chain hot key / agent host | High — spend within rules |
| Demo agent secret | Dashboard `localStorage` | Demo-only — **not** production |

---

## 2. Actors

| Actor | Capabilities |
|-------|----------------|
| **Authority** | create/update/pause/unpause/set_agent/clawback; holds ultimate control |
| **Agent** | `execute_spend` only, if signer matches `policy.agent` |
| **Depositor (anyone)** | `deposit` into vault ATA |
| **Compromised agent host** | Can sign as agent; may co-load unrestricted Agent Kit plugins |
| **Malicious program / third party** | Can call public instructions with their own signers; cannot forge authority/agent without keys |
| **Network / RPC** | Can delay/censor txs; cannot forge signatures |

---

## 3. Trust boundaries

```
┌─────────────────────┐     ┌──────────────────────┐
│ Authority wallet    │     │ Agent host / LLM     │
│ (cold preferred)    │     │ + Agent Kit plugins  │
└─────────┬───────────┘     └──────────┬───────────┘
          │                            │
          │  create/update/pause/      │  execute_spend
          │  clawback                  │  (intent declared)
          ▼                            ▼
┌─────────────────────────────────────────────────┐
│              PolicyKit program (on-chain)         │
│  Policy PDA ──authority of──► Vault ATA          │
└─────────────────────────────────────────────────┘
```

- **On-chain program** is the enforcement boundary for vault outflows.
- **Agent Kit host** is **not** sandboxed by PolicyKit for non-vault assets.
- **`intent_program`** is a **declared** signal checked against allow/deny lists — not proof of subsequent CPIs.

---

## 4. Threats and mitigations

| ID | Threat | Impact | Mitigation | Residual |
|----|--------|--------|------------|----------|
| T1 | Compromised agent key | Drain up to remaining daily/per-tx/rate budget | Caps, rate limit, pause, clawback, program/mint lists | Until authority pauses/rotates, agent spends within caps |
| T2 | Spoofed `intent_program` | Funds leave vault to unexpected destination while claiming allowed intent | Caps + mint allowlist + **destination owner allowlist** + rate limit; monitoring of `SpendExecuted` | **Not full CPI mediation** — recipient set can be constrained; still no forced Jupiter CPI |
| T3 | Agent wallet funded with assets outside vault | Unrestricted movement via other plugins | Operational: fund vault only; agent needs fee SOL only | Plugin does not sandbox co-loaded tools |
| T4 | Malicious depositor | Dust / wrong mint into vault | Clawback recovers any mint; agent can only spend `spend_mint` | Wrong mints sit until clawback |
| T5 | Authority key compromise | Full drain via clawback; rule changes | Cold/hardware authority; separate from agent | Full loss of control |
| T6 | Reinitialization of Policy PDA | Steal vault by re-init | `init` only; PDA seeds bind authority + policy_id | — |
| T7 | Self-transfer grief (vault → policy-owned ATA) | Confuse accounting / lock funds | `InvalidDestination` if dest owner is policy PDA | — |
| T8 | Multi-mint cap bypass | Spend non-`spend_mint` without daily caps | `SpendMintRequired` on `execute_spend` | Multi-asset budgets are post-MVP |
| T9 | Default pubkey as agent | Unusable / unsafe policy | Rejected on create and `set_agent` | — |
| T10 | Clock manipulation | Early expiry / window games | Relies on Solana `Clock` sysvar (same as rest of chain) | Validator-set trust |
| T11 | Open deposit DoS | Fill vault with junk | Economic non-issue for classic SPL; clawback | Storage rent on many vault ATAs |
| T12 | Dashboard demo agent in localStorage | Browser XSS steals demo agent | Demo-only; never production pattern | Explicit non-goal for dashboard demo |

### Worked example: spoofed intent (T2)

1. Authority allowlists Jupiter only; daily cap 50 USDC.  
2. Malicious agent calls `execute_spend` with `intent_program = Jupiter` but destination = attacker ATA.  
3. **Program allows** the transfer if caps/lists pass — it cannot force a Jupiter CPI.  
4. **Bounded damage:** attacker gets at most remaining daily/per-tx, subject to rate limit; authority can pause and clawback remainder.

This is intentional MVP design. Full CPI proxy into DeFi is a separate, larger product.

---

## 5. Security review checklist (money paths)

Reviewed for Phase A (see plan Task 5):

- [x] Counters updated only in `check_and_record_spend` before transfer CPI; failed tx rolls back  
- [x] Agent cannot pause / clawback / update / set_agent  
- [x] Authority cannot be stolen via reinit (`init` + PDA seeds)  
- [x] Default pubkey rejected as agent  
- [x] Destination cannot be policy-owned ATA  
- [x] Non-`spend_mint` cannot exit via `execute_spend`  
- [x] Token program pinned to classic SPL Token  
- [x] PDA seeds: `["policy", authority, policy_id_le]`  
- [x] Plugin validates agent wallet matches `policy.agent`  
- [x] Residual risks T2/T3 documented  

**Code fixes from Phase A review:** none required for money-path logic at time of writing. (If a future review finds a bug, add regression tests + CHANGELOG entry.)

---

## 6. Operational recommendations

See [SECURITY.md](./SECURITY.md) § Operational recommendations. Summary:

1. Fund the **vault**, not the agent wallet.  
2. Tight daily + per-tx caps for hot agents.  
3. Enable program allowlist in production.  
4. Prefer mint allowlist including `spend_mint`.  
5. Monitor `SpendExecuted`; reconcile intent vs subsequent txs.  
6. Keep authority cold; rotate agent on compromise.  
7. On anomaly: pause → clawback → investigate.

---

## 7. Related docs

| Doc | Role |
|-----|------|
| [SECURITY.md](./SECURITY.md) | Invariants and check order |
| [PROGRAM_DESIGN.md](./PROGRAM_DESIGN.md) | Account layout and instructions |
| [ERROR_CATALOG.md](./ERROR_CATALOG.md) | Error codes and client titles |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System components |
