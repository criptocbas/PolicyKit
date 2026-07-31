# @policykit/agent-kit-plugin

Solana Agent Kit v2 plugin that forces vault spends through PolicyKit `execute_spend`.

```ts
import { SolanaAgentKit, KeypairWallet } from "solana-agent-kit";
import { createPolicyKitPlugin } from "@policykit/agent-kit-plugin";
import { KNOWN_PROGRAMS } from "@policykit/sdk";

const agent = new SolanaAgentKit(
  new KeypairWallet(agentKeypair, rpcUrl),
  rpcUrl,
  {}
).use(
  createPolicyKitPlugin({
    policy: policyPda,
    defaultMint: usdcMint,
    defaultIntentProgram: KNOWN_PROGRAMS.JUPITER_V6,
  })
);

await agent.methods.executeSpendUnderPolicy({
  amount: "10000000",
  destination: agent.wallet.publicKey.toBase58(),
  intentProgram: KNOWN_PROGRAMS.JUPITER_V6.toBase58(),
});
```

**Actions:** `POLICYKIT_EXECUTE_SPEND`, `POLICYKIT_GET_STATUS`, `POLICYKIT_CHECK_SPEND`

See root [README.md](../../README.md).
