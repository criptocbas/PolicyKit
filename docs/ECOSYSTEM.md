# Ecosystem path (Agent Kit default — edge A)

## Goal

Make PolicyKit the recommended spend guardrail when building with [Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit).

## What we ship

| Artifact | Path |
|----------|------|
| Plugin | `packages/agent-kit-plugin` (`@policykit/agent-kit-plugin`) |
| Gold example | `examples/agent-kit-bounded-spend` |
| Live adversary demo | `yarn agent:setup` / `yarn agent:tick` |
| Public policy page | `/p/<policyPda>` on the dashboard |

## Contribution steps (manual — do not auto-post)

1. Read [Agent Kit CONTRIBUTING](https://github.com/sendaifun/solana-agent-kit/blob/v2/CONTRIBUTING.md).  
2. Open a **Discussion** or **Issue**: “Recommend open on-chain PolicyKit vault for agent spend limits.”  
3. Optionally PR a docs link to our example (external plugin pattern).  
4. Draft text: `docs/superpowers/pr-drafts/agent-kit-example.md`.

## Security ops for integrators

1. Fund the **policy vault**, not the agent key (fee SOL only).  
2. Do not co-load unrestricted transfer plugins if PolicyKit is the spend control.  
3. Enable destination + program allowlists in production.  
4. Keep authority cold; pause on anomaly.  
