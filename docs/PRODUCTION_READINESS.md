# Production Readiness

PolicyKit is security-sensitive infrastructure. A successful devnet demo is not
by itself evidence that a deployment is ready to custody production funds.

## Required before production custody

- [ ] Use a reviewed, reproducible program build and verify the deployed program ID.
- [ ] Obtain an independent security review of the exact deployed revision.
- [ ] Keep the authority in cold, hardware-backed, or multi-party custody.
- [ ] Give the agent only fee SOL; keep spendable tokens in the Policy vault.
- [ ] Configure non-zero per-transaction and daily caps.
- [ ] Configure a rate limit with a non-zero window.
- [ ] Enable a destination-owner allowlist wherever recipients are known.
- [ ] Enable a declared-program allowlist, while treating it as monitoring
      metadata rather than proof of downstream CPI execution.
- [ ] Verify the mint, decimals, recipients, expiry, and agent key out of band.
- [ ] Monitor `SpendExecuted`, policy updates, agent rotations, pause, and clawback.
- [ ] Alert on unexpected rejection/success patterns and depleted fee or vault balances.
- [ ] Exercise pause → clawback → rotate-agent recovery before funding.
- [ ] Pin compatible SDK, plugin, Anchor, Node, and Solana versions.

## Explicit deployment boundaries

- Classic SPL Token only; Token-2022 accounts are unsupported.
- Agent spends are limited to the immutable `spend_mint`.
- `intent_program` is declared by the agent and is not CPI mediation.
- Disabled allowlists are open. A cap of `0` means unlimited.
- The Agent Kit plugin protects Policy vault outflows only. It does not sandbox
  assets held directly by the agent key.
- Browser `localStorage` demo keys are not a production signing architecture.

## Release evidence

Archive the following for each production release:

1. Git commit and clean build instructions.
2. Program binary hash and deployed program data.
3. IDL and package versions.
4. Full unit, integration, dashboard-build, formatting, and security-review results.
5. Authority and upgrade-authority custody records without secret material.
6. Incident contacts, monitoring configuration, and a completed recovery drill.

## Incident response

If agent behavior is suspicious:

1. Pause the policy with the authority.
2. Claw back remaining vault funds to an authority-controlled token account.
3. Preserve signatures, logs, policy state, and relevant RPC responses.
4. Rotate the agent key only after identifying the compromise path.
5. Re-enable spending with tighter rules and a deliberately funded vault.

If the authority or upgrade authority is suspected compromised, pause operational
assumptions immediately and follow the custody provider's recovery process.
PolicyKit cannot protect a policy from its legitimate authority.
