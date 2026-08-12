# Competitive landscape (honest)

**Edge (shipped focus, not measured monopoly):** **A+C** — open Solana Agent Kit path that routes **policy-vault** outflows through on-chain `execute_spend`, plus compromised-agent **max-damage** surfaces (caps/allowlists/pause/clawback, `computeMaxDamage`, public `/p/<policy>`, live reject ticks) **when funds sit in a configured vault**.

Overlaps exist. Layers are often **complementary** (key/session policy vs vault outflows vs multisig vs payment rails). We do not claim the category is empty.

| Competitor | Layer | Where they win | Where PolicyKit differentiates |
|------------|-------|----------------|--------------------------------|
| **Turnkey / Privy / CDP / DFNS** | Key / session / MPC policy | Production multi-chain DevEx, enclave/TEE or MPC pre-sign policy, scoped API keys, org UX | Pure **on-chain** Policy PDA vault + public rules/counters/max-damage; not locked to their infra. Does **not** replace their key plane. |
| **Squads (+ SPN)** | Smart accounts / policy network | Institutions, m-of-n, roles, time locks, audits/FV mindshare | Single-signer **agent vault** + Agent Kit path; no policy-network membership. Not a multisig product (optionally set Squads-controlled key as authority **off-program**). |
| **X402Guard / Valeo-class** | Narrow spend vault / payment plugin | Focused x402/API demos (endpoint allowlist, MCP pay loop) | Wider **general** vault rules (declared program + dest owner + rate + per-tx/daily) + control room + public max-damage. Beachhead = x402/API spenders under A+C, not payments monopoly. |
| **Subscriptions & Allowances** | Protocol-native budget primitive | Shared/audited Foundation program; Token + Token-2022 | Agent-native productization (plugin, templates, adversary loop, multi-control vault policy + pause/clawback)—not the allowance standard. |
| **PayAI / facilitators** | x402 settle middleware | verify/settle rails, multi-network volume | Payer-side vault guardrails **before** funds leave; facilitators are complementary, not a damage bound. |
| **DIY hot wallet** | Unconstrained agent key | Fastest time-to-first-transfer | Hard on-chain rejects, pause, clawback, public bounds—**if** vault is funded and rules configured. |

## Residual (ours)

- `intent_program` is **declared**, not full CPI mediation into Jupiter/DeFi.
- Plugin does **not** sandbox co-loaded Agent Kit transfer plugins (fund vault, not agent).
- Caps of `0` / disabled allowlists ⇒ **no** economic bound; bounds are configuration + custody discipline.
- Not a multisig network; not a Turnkey/Privy replacement; no formal audit/FV claim.
- No post-withdraw control once funds reach an **allowed** destination.

## Do not claim yet

- Unconditional “stolen key ⇒ damage always bounded.”
- Proven category superiority over key-policy vendors, Squads, Foundation allowances, or X402Guard.
- Whole-agent sandbox or “plugin forces all value movement.”
- Full CPI mediation, Token-2022 multi-mint budgets, hierarchical orgs, native multi-sig (roadmap / non-goals).

## Roadmap (not this phase)

- Full CPI mediation (E)
- Protocol-native integrations (D)
- Hierarchical multi-agent orgs
