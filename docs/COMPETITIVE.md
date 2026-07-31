# Competitive landscape (honest)

PolicyKit’s edge is **A+C**: default open vault for Solana Agent Kit agents + compromised-agent max damage. Overlaps exist — we do not claim the category is empty.

| Competitor | Layer | Where they win | Where PolicyKit wins |
|------------|-------|----------------|----------------------|
| **Turnkey / Privy** | Key / session policy | Production DevEx, multi-chain, scoped API keys | Pure **on-chain** vault + public rules/counters; not locked to their infra |
| **Squads (+ SPN)** | Smart accounts / policy network | Institutions, multisig, automation guardrails | Lightweight **Agent Kit** path; open vault without joining a network |
| **X402Guard / Valeo-class plugins** | Narrow spend vault / payment | Focused x402/API demos | Broader rules (program + dest + rate + daily) + control room + public max-damage |
| **Subscriptions & Allowances** | Native spend delegation | Protocol-native budget primitive | Agent-native UX (plugin, templates, demo adversary loop) |
| **DIY hot wallet** | None | Speed | Hard bounds, pause, clawback, auditable events |

## Residual (ours)

- `intent_program` is **declared**, not full CPI mediation into Jupiter/DeFi.
- Plugin does not sandbox co-loaded Agent Kit transfer plugins (fund vault, not agent).
- Not a multisig network (compose Squads as authority if needed).

## Roadmap (not this phase)

- Full CPI mediation (E)  
- Protocol-native integrations (D)  
- Hierarchical multi-agent orgs  
