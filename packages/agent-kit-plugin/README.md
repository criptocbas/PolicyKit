# @policykit/agent-kit-plugin

**Edge A:** default Agent Kit path for open on-chain spend policy.  
**Edge C:** economic bounds if the agent key is compromised.

Solana Agent Kit v2 plugin that routes **policy vault** outflows only through on-chain `execute_spend`.

```ts
import { SolanaAgentKit, KeypairWallet } from "solana-agent-kit";
import { createPolicyKitPlugin } from "@policykit/agent-kit-plugin";
import { KNOWN_PROGRAMS, computeMaxDamage } from "@policykit/sdk";

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

const status = await agent.methods.getPolicyStatus();
console.log(computeMaxDamage(status.policy).summary);

await agent.methods.executeSpendUnderPolicy({
  amount: "10000000",
  destination: agent.wallet.publicKey.toBase58(),
  intentProgram: KNOWN_PROGRAMS.JUPITER_V6.toBase58(),
});
```

**Actions:** `POLICYKIT_EXECUTE_SPEND`, `POLICYKIT_GET_STATUS`, `POLICYKIT_CHECK_SPEND`

### Architecture

```
Authority → Policy PDA (rules) → Vault ATA
Agent + this plugin → execute_spend only (checked)
```

### Security ops (composition)

- Gates **vault** spends only — **not** a whole-agent sandbox.
- **Fund the vault**, not the agent key (fee SOL only).
- **Do not** co-load unrestricted transfer/swap plugins if PolicyKit is the sole control.
- Prefer destination + program allowlists enabled.
- Always pass `intentProgram` (or `defaultIntentProgram`).
- Authority: pause (circuit breaker) + clawback.

### Gold example

See monorepo `examples/agent-kit-bounded-spend` and live ticks `yarn agent:tick`.

**Peer:** `solana-agent-kit` ^2.0.

See root [README](../../README.md), [MAX_DAMAGE](../../docs/MAX_DAMAGE.md), [COMPETITIVE](../../docs/COMPETITIVE.md).
