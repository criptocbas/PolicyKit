# PolicyKit — agent rules (package-local)

These rules **override** monorepo/global Solana skill defaults where they conflict.
PolicyKit is a **security product** (on-chain policy vault for AI agents). Prefer correctness and stable demos over stack fashion.

## Intentional stack (do not “upgrade” casually)

| Layer | Pin / choice | Why |
|-------|----------------|-----|
| Program | **Anchor 0.32.x** | Working IDL, tests, SDK, dashboard |
| Tokens | **Classic SPL Token only** | platform-tools / rustc 1.84 cannot cleanly pull Token-2022 / `anchor-spl` graph |
| Transfers | `spl_token::instruction::transfer` via `token_utils` | No `anchor-spl` account types by design |
| Clients | `@coral-xyz/anchor` + `@solana/web3.js` v1 | SDK, Agent Kit plugin, and dashboard depend on this |
| Package manager | **yarn** (workspaces) | Matches `Anchor.toml` and lockfile |
| Tests | `anchor test` → **ts-mocha** integration tests | Real instruction coverage in `tests/` |

**Do not** migrate this package to Kit-first / Anchor 1.1 / LiteSVM-only / npm-only unless the user explicitly requests a stack upgrade and accepts breaking the monorepo packages. Token-2022 / `transfer_checked` / multi-mint agent spend are **documented post-MVP**, not silent refactors.

## Product security model (non-negotiable)

1. Funds live in the **policy vault** (ATA authority = Policy PDA), not the agent key.
2. Only **`execute_spend`** (agent) and **`clawback`** (authority) debit the vault.
3. All limit / allowlist / pause / expiry checks run **before** any transfer CPI.
4. `intent_program` is a **declared** allow/deny signal — economic damage is still bounded by caps; do not claim full CPI mediation until that feature exists.
5. Agent key needs **fee SOL only**; vault holds spendable assets.

Read `docs/PROGRAM_DESIGN.md` and `docs/SECURITY.md` before changing money paths.

## When editing the program

- Prefer Solana Developer MCP for Anchor/SPL questions; do not invent 1.x-only APIs against this 0.32 program.
- After any change under `programs/policykit/`, run **`program_autofixer`** and fix until clean.
- Keep `InitSpace`, stored bump, PDA seeds, `has_one`, and checked math.
- Reject **default pubkey** as agent on both create and rotate (`InvalidAgent`).
- Do not enable `init_if_needed` on the Policy account.
- Do not loosen `check_and_record_spend` order without an explicit design update.

## Definition of done (this package)

1. `program_autofixer` clean on touched Rust.
2. Relevant tests green:
   ```bash
   # from colosseum/eternal/policykit
   yarn build:packages   # if SDK/plugin touched
   anchor build && anchor test
   ```
3. New rules or errors: add a **fails cleanly** case in `tests/policykit.ts` and/or `tests/sdk_and_plugin.ts` (pitch/demo contract).
4. Update `docs/SECURITY.md` / `PROGRAM_DESIGN.md` if invariants or non-goals change.
5. Short risk notes for CPI, tokens, authorities, or agent signing.
6. No mainnet deploy / upgrade authority changes without explicit user confirmation.

## Safety

- Never print or commit keypairs (`target/deploy/*.json` is local build output — do not ship secrets).
- Dashboard demo agent secret in `localStorage` is **demo-only**, not a production pattern.
- Default cluster for agent work: localnet / devnet.

## Layout reminder

```
programs/policykit/     # on-chain
packages/sdk/           # @policykit/sdk
packages/agent-kit-plugin/
apps/dashboard/         # Next.js demo
tests/                  # program + SDK/plugin integration
docs/                   # design + security
```
