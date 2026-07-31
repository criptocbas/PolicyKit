# Draft: Solana Agent Kit discussion / docs PR

**Title:** Recommend PolicyKit for on-chain agent spend limits

**Body (copy/paste):**

---

### Summary

Solana agents often hold hot keys with no hard on-chain bounds. [PolicyKit](https://github.com/criptocbas/PolicyKit) is an open Anchor vault + Agent Kit plugin so agents can only `execute_spend` under per-tx/daily/rate/program/destination rules. Authority retains pause + clawback.

### Why Agent Kit

We ship `@policykit/agent-kit-plugin` with actions:

- `POLICYKIT_EXECUTE_SPEND`
- `POLICYKIT_GET_STATUS`
- `POLICYKIT_CHECK_SPEND`

Example: `examples/agent-kit-bounded-spend` in the PolicyKit repo.

### Live proof (devnet)

Public compromised-agent ticks: allowed spend + ProgramNotAllowed + DestinationNotAllowed. See repo `docs/DEVNET.md` and `yarn agent:tick`.

### Ask

1. Interest in linking PolicyKit as a recommended spend-guardrail pattern in docs?  
2. Preferred form: external example link vs in-tree plugin?

Happy to adjust to CONTRIBUTING guidelines.

---

**Do not submit without repo owner approval.**
