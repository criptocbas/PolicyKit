# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Versioned live adversary feed document (`updatedAt`, policy, events) for professional proof UX.
- SDK `assessFreshness` / `parseLiveFeed` helpers + unit tests.
- Dashboard freshness badges (live / recent / stale) on adversary feed and snapshot proof.
- Public policy page embeds filtered adversary ticks.
- `yarn agent:cron` helper and improved Agent Kit bounded-spend example (status, max damage, dest reject).
- Production-readiness checklist covering custody, monitoring, recovery, and release evidence.
- SDK `assessPolicySafety` API with machine-readable configuration findings and
  current-window maximum-damage context.
- Dashboard safety classification for loaded, proposed, and updated policies,
  including explicit confirmation before unbounded or weakened configurations.
- Versioned policy-template metadata and bounded-default regression tests.
- Rust enforcement-invariant tests for exact boundaries, window rollover,
  rejected-spend counter behavior, overflow, and timestamp saturation.
- SDK/IDL error parity test and closer preflight parity for Policy PDA
  destinations and counter overflow.
- Version 2 proof-feed contract with explicit on-chain/preflight/local evidence,
  schema validation, atomic writes, slots, block times, and signatures for
  intentionally rejected devnet transactions.
- Public proof safety classification, linked authority/agent/mint identities,
  rate-window context, and transparent max-damage assumptions.
- Proof-loop health checks for schema integrity, future timestamps, unexpected
  latest-tick results, evidence signatures, and dashboard-copy drift.
- Security operations runbook covering key separation, monitoring severity,
  agent rotation, compromise response, and recovery drills.
- Strict x402 v2 `PAYMENT-REQUIRED` validation and a reproducible
  `policykit-exact` devnet example with quote expiry, replay protection, exact
  token-delta verification, and honest custom-scheme boundaries.

### Changed

- Live proof card labeled as snapshot proof; continuous proof is the adversary feed.
- Corrected Node 22 prerequisites and aligned documented spend-check ordering
  with the on-chain handler.
- Marked completed implementation plans as historical snapshots and refreshed
  the dashboard feature inventory.
- Maximum rate-window damage now accounts for actions already consumed and the
  remaining daily budget.
- Insufficient-vault integration coverage now verifies atomic rollback of all
  spend and action counters.
- Dashboard demo-agent secrets are tab-scoped in `sessionStorage` and the UI
  explicitly warns that browser signing is not production custody.

## [0.4.0] - 2026-07-31

### Added

- Phase D (A+C edge): `yarn agent:setup` / `yarn agent:tick` live adversary loop.
- Public policy page `/p/[address]` with max-damage panel (`computeMaxDamage`).
- Dashboard live agent feed; circuit-breaker pause copy.
- `examples/agent-kit-bounded-spend`; docs: COMPETITIVE, MAX_DAMAGE, ECOSYSTEM, BEACHHEAD_X402.

## [0.3.0] - 2026-07-31

### Added

- Phase C live proof: `yarn deploy:devnet`, `yarn demo:devnet`, `docs/DEVNET.md`.
- Public proof JSON (`proof/devnet-latest.json`, dashboard `/proof/devnet-latest.json`).
- Dashboard **Live proof** card with Solscan links and one-click policy load.

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
