# PolicyKit

**Open, Solana-native on-chain policy engine for AI agents.**

Humans (or protocols) create enforceable on-chain policies. Agents can only move vault funds within those rules. Every spend is checked on-chain. Exceed a limit or call a forbidden program intent → clean transaction failure.

Built for Colosseum Eternal. Evolution of the X402Guard pattern into a general policy primitive.

## Status (Phase 1)

- [x] Anchor program: create / update / pause / set_agent / deposit / clawback / execute_spend  
- [x] Rules: per-tx + daily spend, program allow/deny, mint allowlist, rate limit, expiry  
- [x] Events + distinct error codes  
- [x] Comprehensive integration tests  
- [ ] Solana Agent Kit plugin (Phase 2)  
- [ ] Dashboard (Phase 3)  

## Quick start

```bash
# Prerequisites: Solana CLI, Anchor 0.32.x, Node 20+, yarn
cd policykit
yarn install
anchor build
anchor test
```

### Dependency pins (platform-tools rustc 1.84)

If `anchor build` fails on `edition2024` / rustc version, re-apply:

```bash
cargo update zeroize --precise 1.7.0
cargo update proc-macro-crate@3.5.0 --precise 3.2.0 2>/dev/null || true
cargo update indexmap --precise 2.7.1
cargo update unicode-segmentation --precise 1.12.0
```

`Cargo.lock` in this repo already pins these.

## Architecture

```
┌─────────────┐     create/update/pause/clawback      ┌──────────────────┐
│  Authority  │ ───────────────────────────────────►  │  Policy PDA      │
│  (human)    │                                       │  rules+counters  │
└─────────────┘                                       │  = vault auth    │
                                                      └────────┬─────────┘
┌─────────────┐     execute_spend (checked)                    │
│  Agent key  │ ──────────────────────────────────────────────►│
│  (hot)      │     deposit (anyone)                           │
└─────────────┘                                       ┌────────▼─────────┐
                                                      │  Vault token ATA │
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
Vault  = ATA(Policy, mint)   // created client-side
```

## Demo narrative (target)

1. Human creates conservative trading policy ($50/day, Jupiter only, rate limited).  
2. Funds vault with USDC.  
3. Agent successfully executes several spends (intent = Jupiter).  
4. Agent tries Drift / exceeds daily limit → on-chain rejection.  
5. Dashboard shows remaining budget + Solscan links.

## License

MIT (intended; confirm before public release).
