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

## Reproducible x402 v2 flow

[`examples/x402-policykit`](../examples/x402-policykit) implements a local HTTP
402 resource server plus a real devnet PolicyKit settlement:

```bash
yarn agent:setup
yarn example:x402
```

The integration uses a deliberately named custom scheme, `policykit-exact`.
It validates the x402 v2 `PAYMENT-REQUIRED` header before signing, settles
through `execute_spend`, and has the resource server verify the transaction,
recipient token delta, quote window, and replay protection.

It does **not** claim compatibility with the standard Solana `exact` payload,
which commonly carries a facilitator-settled signed transaction. A future
facilitator adapter can add that transport without weakening the current claim.

## What we don’t do here

- Host a facilitator  
- Replace x402 protocol  
- Claim monopoly on payments  
- Describe `policykit-exact` as the standard facilitator `exact` scheme
