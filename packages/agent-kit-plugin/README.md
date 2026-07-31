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

### Security ops

- Gates **vault** spends only via on-chain `execute_spend` — not a whole-agent sandbox.
- Fund the **policy vault**, not the agent key (agent needs fee SOL only).
- Avoid loading unrestricted transfer/swap plugins that move agent-held balances if you rely on PolicyKit as the spend control.
- Always pass `intentProgram` (or set `defaultIntentProgram`) for allowlist checks.

See root [README.md](../../README.md) and [docs/SECURITY.md](../../docs/SECURITY.md).
