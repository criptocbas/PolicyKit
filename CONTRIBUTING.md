# Contributing to PolicyKit

Thanks for helping improve PolicyKit. This project is a **security-sensitive** on-chain policy vault for AI agents. Prefer correctness and clear tests over stack fashion.

## Prerequisites

| Tool | Version / notes |
|------|-----------------|
| Node.js | **20+** |
| yarn | Classic workspaces (see root `package.json`) |
| Solana CLI | Compatible with Anchor 0.32 (Agave) |
| Anchor CLI | **0.32.x** (pin with `avm install 0.32.1 && avm use 0.32.1`) |
| Rust | See `rust-toolchain.toml` |

**Important:** The program targets Anchor **0.32.1**. A newer local `anchor` 1.x CLI is **not** a drop-in for this repo. CI installs 0.32.1 explicitly.

Stack pins and intentional non-goals: see [AGENTS.md](./AGENTS.md).

## Setup

```bash
yarn install
anchor build
yarn build:packages
```

### Platform-tools / rustc 1.84 pin note

If `anchor build` fails on `edition2024` / rustc version, re-apply pins documented in the root [README.md](./README.md). `Cargo.lock` in this repo already pins known-good versions.

## Tests

| Command | What it runs |
|---------|----------------|
| `yarn test:unit` | Pure SDK unit tests (no validator) |
| `yarn test:integration` | Build packages + `anchor test` (local validator) |
| `yarn ci:local` | Packages typecheck + unit + integration |
| `yarn build:dashboard` | Production Next.js build (when UI is touched) |

```bash
# Fast loop (SDK logic)
yarn test:unit

# Full on-chain + SDK/plugin integration
yarn test:integration
```

## Pull requests

1. **Money-path changes** (`programs/policykit/`, especially `execute_spend`, `deposit`, `clawback`, `check_and_record_spend`) require:
   - A regression / fails-cleanly case in `tests/policykit.ts` and/or `tests/sdk_and_plugin.ts`
   - Updates to [docs/SECURITY.md](./docs/SECURITY.md) if invariants or non-goals change
   - Updates to [docs/ERROR_CATALOG.md](./docs/ERROR_CATALOG.md) and SDK error map if you add an error
2. **Do not commit keypairs** — `**/id.json`, `**/*-keypair.json`, and `target/deploy/*.json` secrets must never land in git.
3. Prefer small, reviewable commits. Update [CHANGELOG.md](./CHANGELOG.md) under `[Unreleased]` for user-visible changes.
4. Keep classic SPL Token only unless an explicit stack-upgrade task is agreed.

## Docs map

| Doc | Purpose |
|-----|---------|
| [docs/PROGRAM_DESIGN.md](./docs/PROGRAM_DESIGN.md) | On-chain design |
| [docs/SECURITY.md](./docs/SECURITY.md) | Security model |
| [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md) | Adversarial model |
| [docs/ERROR_CATALOG.md](./docs/ERROR_CATALOG.md) | Error codes |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System architecture |

## License

By contributing, you agree that your contributions will be licensed under the MIT License (see [LICENSE](./LICENSE)).
