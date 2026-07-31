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

**Peers:** `@coral-xyz/anchor` ^0.32, `@solana/web3.js` ^1.95.

**Docs:** root [README](../../README.md) · [error catalog](../../docs/ERROR_CATALOG.md) · [architecture](../../docs/ARCHITECTURE.md)

```bash
yarn workspace @policykit/sdk test   # pure unit tests
```
