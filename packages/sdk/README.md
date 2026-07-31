# @policykit/sdk

Typed TypeScript client for the PolicyKit on-chain program.

```ts
import { PolicyKitClient, conservativeTradingTemplate, KNOWN_PROGRAMS } from "@policykit/sdk";

const sdk = new PolicyKitClient(provider);
const { policy } = await sdk.createPolicy(1, conservativeTradingTemplate({
  agent: agentPk,
  spendMint: usdcMint,
}));
await sdk.deposit({ policy, mint: usdcMint, amount: 100_000_000 });
await sdk.executeSpend({
  policy,
  mint: usdcMint,
  amount: 10_000_000,
  intentProgram: KNOWN_PROGRAMS.JUPITER_V6,
  destination: agentAta,
  signers: [agentKeypair], // if agent ≠ provider wallet
});
```

See root [README.md](../../README.md).
