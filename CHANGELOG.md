# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-07-31

### Added

- **Destination owner allowlist** on-chain (`destination_allowlist_*`, errors 6024–6026).
- Dashboard control room: multi-policy switcher, update policy, set agent, chain activity feed.
- Agent demo: “Pay outsider (dest deny)” failure path.
- Templates default to agent-only destination allowlist.

### Changed

- Policy account layout (breaking for pre-0.2 policies — recreate after upgrade).
- `check_and_record_spend` takes destination owner; `previewSpend` supports `destinationOwner`.

## [0.1.1] - 2026-07-31

### Added

- GitHub Actions CI (SDK unit tests, `anchor test`, dashboard build, `cargo fmt`).
- SDK pure unit tests (window math, error catalog 6000–6023, PDA helpers).
- Expanded on-chain rejection matrix (list limits, underfunded vault, authority checks, multi-policy).
- Docs: `THREAT_MODEL.md`, `ERROR_CATALOG.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `LICENSE`.
- Root scripts: `test:unit`, `test:integration`, `ci:local`, `typecheck:*`.

### Changed

- Pin Anchor toolchain to **0.32.1** in `Anchor.toml`.
- Default provider cluster for tests is **Localnet** (avoid devnet airdrop limits).
- Local/devnet program id synced to deploy keypair `AoTJDX2z2ej5r4UUKCofEbgDUXApWpGhQnvfk8seZf27`.
- Flaky `PolicyExpired` integration tests use absolute expiry wait.

## [0.1.0] - 2026-07-30

### Added

- Anchor program: create/update/pause/set_agent/deposit/clawback/execute_spend.
- `@policykit/sdk` and `@policykit/agent-kit-plugin`.
- Next.js demo dashboard.
- Integration tests for pitch success/failure paths.
