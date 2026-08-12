# Pitch & tech walkthrough scripts (≤3 min each)

Tribunal-safe language. Record these for Colosseum Eternal. Do not improvise category wins.

---

## Product pitch (max 3:00)

### 0:00–0:25 — Problem

> AI agents on Solana need a hot key to sign. If that key is stolen or the model is jailbroken into “send everything,” a normal funded agent wallet can drain the treasury. Prompt instructions are not a security boundary.

### 0:25–0:55 — Model

> PolicyKit puts spendable funds in an **on-chain policy vault**. The Policy PDA is the token authority — **not** the agent key. Only two instructions debit the vault: `execute_spend` (agent) and `clawback` (authority). The agent only needs fee SOL.

### 0:55–1:40 — Live proof (screen share `/p/<policy>`)

> Here’s a public policy page — **no wallet**. You see remaining daily budget, per-tx max, and destination allowlists.  
> Below: live adversary ticks. An allowed micro-spend succeeds. A rogue program intent fails with **ProgramNotAllowed**. A rogue destination fails with **DestinationNotAllowed**. Same error names as our integration tests.  
> Open Solscan on a reject if you want the raw chain receipt.

### 1:40–2:15 — Configuration honesty

> Bounds apply when the vault is funded and rules are configured: **non-zero** caps and allowlists **enabled**. Caps of zero mean unlimited. Fund the vault — not the agent. We do **not** claim full CPI mediation into Jupiter; `intent_program` is a declared allow/deny signal. Economic damage still comes from caps, destinations, pause, and clawback.

### 2:15–2:40 — Where we fit

> We’re complementary to Turnkey/Privy on key policy and Squads on institutional multisig. Our focus is the **open Agent Kit path** for vault outflows plus **public max-damage** so operators and judges can see the bound without trusting a slide.

### 2:40–3:00 — Close

> Beachhead: x402 and API-style spenders under tight caps. Ask: make PolicyKit the default open on-chain guardrail when Solana agents spend from a vault. Repo, public page, and Agent Kit example are linked in the submission.

**On-screen checklist while talking:** public page Active · feed Live · one allowed + two rejects · max-damage bullets.

---

## Technical walkthrough (max 3:00)

### 0:00–0:30 — Architecture

> Authority creates a Policy PDA with rules and counters. Vault ATAs are owned by the Policy PDA. Agent signs `execute_spend`; program runs `check_and_record_spend` **before** any SPL transfer CPI. Pause and clawback are authority-only; clawback works while paused.

### 0:30–1:10 — Code path

> Show `execute_spend` account constraints: agent signer, policy PDA, vault ATA authority. Point at limit checks, destination owner allowlist, declared program list, then `transfer` signed by PDA seeds. Note: MVP is classic SPL, single `spend_mint`.

### 1:10–1:50 — Tests as pitch contract

> Integration tests assert clean errors by name: `ExceedsPerTransactionLimit`, `ExceedsDailyLimit`, `RateLimitExceeded`, `ProgramNotAllowed`, `DestinationNotAllowed`, `PolicyPaused`. The live agent tick expects the same reject names on devnet — not a separate marketing path.

### 1:50–2:25 — Client surface

> `@policykit/sdk` for typed instructions and `computeMaxDamage`. `@policykit/agent-kit-plugin` routes **policy-vault** spends through `execute_spend` only — it does not sandbox co-loaded transfer plugins. Gold example: `examples/agent-kit-bounded-spend`.

### 2:25–3:00 — Ops & residuals

> `yarn agent:tick` publishes `proof/live-feed.json` to the dashboard. Residuals we document: declared intent ≠ full CPI mediation; zero caps = unlimited; authority compromise is full loss; no formal audit claim. That’s intentional honesty, not a missing slide.

---

## Forbidden phrases (cut these)

- “If the agent is stolen, damage is always bounded” *(missing: vault + config)*  
- “We beat Turnkey / Squads / X402Guard”  
- “Full sandbox of the agent”  
- “Default for all Agent Kit agents” *(aspirational; say “shipped path + example”)*  
- “Audited” / “formally verified”

## Allowed replacements

- “Vault outflows are bounded **when** caps and allowlists are configured.”  
- “Differentiates on pure on-chain vault + public max-damage.”  
- “Complementary to key-policy and multisig products.”  
- “Declared program intent, not full CPI mediation.”  
