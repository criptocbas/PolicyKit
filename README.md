# PolicyKit

[![CI](https://github.com/criptocbas/PolicyKit/actions/workflows/ci.yml/badge.svg)](https://github.com/criptocbas/PolicyKit/actions/workflows/ci.yml)

**Open, Solana-native on-chain policy engine for AI agents.**

Humans (or protocols) create enforceable on-chain policies. Agents can only move vault funds within those rules. Every spend is checked on-chain. Exceed a limit or call a forbidden program intent → clean transaction failure.

Built for Colosseum Eternal. Evolution of the X402Guard pattern into a general policy primitive.

## Status

- [x] **Phase 1** — Anchor program: create / update / pause / set_agent / deposit / clawback / execute_spend  
- [x] Rules: per-tx + daily spend, program allow/deny, mint allowlist, rate limit, expiry  
- [x] Events + distinct error codes + integration tests  
- [x] **Phase 2** — TypeScript SDK (`@policykit/sdk`) + Solana Agent Kit plugin  
- [x] **Phase 3** — Next.js dashboard (`apps/dashboard`)  
- [x] **Phase A (quality)** — CI, unit tests, threat model, error catalog, architecture docs  
- [x] **Phase B (product depth)** — dashboard control room, chain activity, destination owner allowlist  

MVP + control room + destination allowlist. Next: public proof (devnet agent) / distribution — not stack rewrites.

## Docs

| Doc | Purpose |
|-----|---------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System diagram and package map |
| [docs/PROGRAM_DESIGN.md](./docs/PROGRAM_DESIGN.md) | On-chain design |
| [docs/SECURITY.md](./docs/SECURITY.md) | Security model and invariants |
| [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md) | Adversarial model and residual risks |
| [docs/ERROR_CATALOG.md](./docs/ERROR_CATALOG.md) | Error codes 6000–6023 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Build, test, PR rules |
| [CHANGELOG.md](./CHANGELOG.md) | Release notes |
| [AGENTS.md](./AGENTS.md) | Agent / contributor stack pins |

## Repo layout

```
programs/policykit/          # Anchor program
packages/sdk/                # @policykit/sdk — typed client
packages/agent-kit-plugin/   # @policykit/agent-kit-plugin
apps/dashboard/              # Next.js 15 demo dashboard
tests/                       # Program + SDK/plugin integration tests
docs/                        # Design, security, threat model, architecture
```

## Quick start

```bash
# Prerequisites: Solana CLI, Anchor 0.32.x (avm use 0.32.1), Node 20+, yarn
yarn install
anchor build
anchor test
yarn dev:dashboard    # http://localhost:3000
```

### Verify (CI-equivalent)

```bash
yarn install --frozen-lockfile
yarn typecheck:packages
yarn test:unit              # pure SDK tests (no validator)
yarn test:integration       # anchor build + anchor test (localnet)
# when UI changed:
yarn build:dashboard
```

Or: `yarn ci:local` (typecheck + unit + integration).

### Dependency pins (platform-tools rustc 1.84)

If `anchor build` fails on `edition2024` / rustc version, re-apply:

```bash
cargo update zeroize --precise 1.7.0
cargo update proc-macro-crate@3.5.0 --precise 3.2.0 2>/dev/null || true
cargo update indexmap --precise 2.7.1
cargo update unicode-segmentation --precise 1.12.0
```

`Cargo.lock` in this repo already pins these.

---

## Agent Kit + PolicyKit quickstart

### 1. Authority: create a conservative policy and fund the vault

```ts
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  PolicyKitClient,
  conservativeTradingTemplate,
  KNOWN_PROGRAMS,
} from "@policykit/sdk";

const sdk = new PolicyKitClient(provider);

const { policy } = await sdk.createPolicy(1, conservativeTradingTemplate({
  agent: agentPubkey,
  spendMint: usdcMint,       // e.g. devnet USDC
  decimals: 6,
}));

// Fund the vault (not the agent wallet)
await sdk.deposit({ policy, mint: usdcMint, amount: 100_000_000 }); // 100 USDC
```

### 2. Agent: load Solana Agent Kit with the PolicyKit plugin

```ts
import { SolanaAgentKit, KeypairWallet } from "solana-agent-kit";
import { createPolicyKitPlugin } from "@policykit/agent-kit-plugin";
import { KNOWN_PROGRAMS } from "@policykit/sdk";

// Wallet MUST be the policy agent keypair
const wallet = new KeypairWallet(agentKeypair, rpcUrl);

const agent = new SolanaAgentKit(wallet, rpcUrl, {}).use(
  createPolicyKitPlugin({
    policy: policyPda,
    defaultMint: usdcMint,
    defaultIntentProgram: KNOWN_PROGRAMS.JUPITER_V6,
  })
);

// Check remaining budget
const status = await agent.methods.getPolicyStatus();
console.log(status.formatted);

// ONLY supported spend path for vault funds:
const result = await agent.methods.executeSpendUnderPolicy({
  amount: "10000000", // 10 USDC raw
  destination: agent.wallet.publicKey.toBase58(),
  intentProgram: KNOWN_PROGRAMS.JUPITER_V6.toBase58(),
});

if (result.status === "error") {
  // Demo-friendly: "Over daily budget", "Program not allowed", "Rate limited", ...
  console.error(result.errorTitle, result.message);
} else {
  console.log("ok", result.signature, "remaining daily", result.remainingDaily);
}
```

### 3. LLM actions exposed by the plugin

| Action | Purpose |
|--------|---------|
| `POLICYKIT_EXECUTE_SPEND` | Spend vault funds via on-chain `execute_spend` |
| `POLICYKIT_GET_STATUS` | Remaining daily budget, rate window, pause/expiry |
| `POLICYKIT_CHECK_SPEND` | Client-side preflight before submitting a spend |

Wire with `createVercelAITools(agent, agent.actions)` / LangChain helpers from `solana-agent-kit`.

### Security model (agent integration)

1. **Fund the policy vault**, not the agent key. Agent only needs fee SOL.  
2. All **vault** outflows go through `execute_spend` (plugin methods).  
3. Always set `intentProgram` to the program the agent is about to use (Jupiter, etc.).  
4. On-chain limits still apply even if intent is spoofed — see [docs/SECURITY.md](docs/SECURITY.md).  
5. MVP: agent may only spend **`spend_mint`**; recover other vault mints with clawback.  
6. The plugin does **not** sandbox other Agent Kit plugins — do not fund the agent wallet with spendable assets.  

### Demo failure paths (pitch video)

| Attempt | Error name | Title |
|---------|------------|--------|
| Intent = Drift (not allowlisted) | `ProgramNotAllowed` | Program not allowed |
| Amount > per-tx cap | `ExceedsPerTransactionLimit` | Over per-tx limit |
| Amount would exceed daily cap | `ExceedsDailyLimit` | Over daily budget |
| Too many actions in window | `RateLimitExceeded` | Rate limited |
| Wrong key signs | `UnauthorizedAgent` | Not agent |
| Authority paused policy | `PolicyPaused` | Policy paused |
| After `expires_at` | `PolicyExpired` | Policy expired |

---

## Architecture

```
┌─────────────┐     create/update/pause/clawback      ┌──────────────────┐
│  Authority  │ ───────────────────────────────────►  │  Policy PDA      │
│  (human)    │                                       │  rules+counters  │
└─────────────┘                                       │  = vault auth    │
                                                      └────────┬─────────┘
┌─────────────┐     execute_spend (checked)                    │
│  Agent key  │ ──────────────────────────────────────────────►│
│  + Agent Kit│     deposit (anyone)                           │
│    plugin   │                                       ┌────────▼─────────┐
└─────────────┘                                       │  Vault token ATA │
                                                      │  (SPL Token)     │
                                                      └──────────────────┘
```

See [docs/PROGRAM_DESIGN.md](docs/PROGRAM_DESIGN.md) and [docs/SECURITY.md](docs/SECURITY.md).

## Instruction set

| Instruction | Signer | Purpose |
|-------------|--------|---------|
| `create_policy` | authority | Init Policy PDA |
| `update_policy` | authority | Update limits / lists / expiry |
| `set_agent` | authority | Rotate agent key |
| `pause_policy` / `unpause_policy` | authority | Freeze / resume spends |
| `deposit` | depositor | Fund vault |
| `clawback` | authority | Withdraw (works while paused) |
| `execute_spend` | agent | Policy-checked transfer |

## PDA

```
Policy = PDA(["policy", authority, policy_id_le_bytes], program_id)
Vault  = ATA(Policy, mint)   // created client-side (SDK deposit does this)
```

Program ID (local/devnet; matches deploy keypair): `AoTJDX2z2ej5r4UUKCofEbgDUXApWpGhQnvfk8seZf27`  
(See `Anchor.toml` / `@policykit/sdk` `POLICYKIT_PROGRAM_ID`. Deploy keypair is gitignored under `target/deploy/`.)

## Dashboard (Phase 3)

Demo-first control room for judges and weekly videos.

```bash
yarn dev:dashboard
# production / Vercel check:
yarn build:dashboard
```

| UI | Purpose |
|----|---------|
| Status card | Remaining daily budget, actions left, Active/Paused/Expired |
| Create policy | Three SDK templates + editable limits |
| Fund vault | Deposit into policy ATA |
| Authority | Pause / Unpause / Clawback |
| Agent demo | Success (Jupiter) → fail (**Program not allowed** / **Over daily budget**) |
| Activity | Recent actions + Solscan links |

Configure `apps/dashboard/.env.local` (see `apps/dashboard/.env.example`). Deploy PolicyKit to the same cluster as `NEXT_PUBLIC_RPC_URL`.

Details: [apps/dashboard/README.md](apps/dashboard/README.md).

## SDK surface (`@policykit/sdk`)

```ts
const sdk = new PolicyKitClient(provider);

await sdk.createPolicy(id, params);
await sdk.updatePolicy(policy, params);
await sdk.setAgent(policy, newAgent);
await sdk.pausePolicy(policy);
await sdk.unpausePolicy(policy);
await sdk.deposit({ policy, mint, amount });
await sdk.clawback({ policy, mint, amount });
await sdk.executeSpend({ policy, mint, amount, intentProgram, destination, signers? });

await sdk.getPolicy(policy);
await sdk.getPolicyStatus(policy);  // remainingDaily, remainingActions, isActive, ...
await sdk.remainingDaily(policy);
await sdk.remainingActions(policy);

// Templates
conservativeTradingTemplate({ agent, spendMint })
x402PaymentsTemplate({ agent, spendMint })
researchLimitedSpendTemplate({ agent, spendMint })

// Errors
catch (e) {
  const err = e as PolicyKitError;
  console.log(err.errorName, err.title, err.message);
}
```

## License

[MIT](./LICENSE)
