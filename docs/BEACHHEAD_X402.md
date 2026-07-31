# Beachhead: x402 / API-style spenders (thin B)

Not our identity — our **first vertical** under A+C.

## Job

Agents that pay APIs / facilitators with USDC-like tokens under:

- tight per-tx + daily caps  
- program allowlist (facilitator / router)  
- destination owner allowlist  
- rate limits  

## Use PolicyKit

```ts
import { x402PaymentsTemplate } from "@policykit/sdk";

const params = x402PaymentsTemplate({
  agent: agentPk,
  spendMint: usdcMint,
  // extraPrograms: [facilitatorProgramId],
});
// destination allowlist defaults to agent-only; set destinationOwners for payees
```

## Live proof

Same adversary tick (`yarn agent:tick`) demonstrates: allowed micro-spend + reject wrong program + reject wrong dest — the economic story x402 builders need.

## What we don’t do here

- Host a facilitator  
- Replace x402 protocol  
- Claim monopoly on payments  
