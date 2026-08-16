# RFC: Enforced Protocol Execution

**Status:** Research only — no implementation decision  
**Compatibility:** Would extend the current vault model; must not silently alter
existing `execute_spend` semantics.

## Problem

`intent_program` is declared by the agent. PolicyKit can constrain amount, mint,
destination owner, timing, and declared program, but it cannot prove that a
downstream Jupiter, x402, or DeFi operation occurred after a vault transfer.

## Security objective

For supported integrations, bind value movement to a specific downstream
instruction and enforce the economically relevant outputs before the vault can
lose funds.

This does not imply a whole-agent sandbox or safe arbitrary CPI.

## Options

### 1. Protocol-specific adapters

PolicyKit exposes separately reviewed instructions for supported protocols.
Each adapter validates exact program ID, instruction variant, required accounts,
input mint/amount, destination authority, slippage/minimum output, and writable
account set before CPI.

Advantages:

- Small, explicit supported surface
- Protocol-aware economic validation
- Easier threat modelling and testing

Costs:

- Maintenance for protocol upgrades
- More instructions and audit surface
- Limited composability

### 2. Generic instruction proxy

The agent supplies downstream instruction data and remaining accounts, while a
policy describes permitted programs/accounts/discriminators.

Advantages:

- Broad composability
- Fewer protocol-specific entry points

Costs:

- High account-substitution and instruction-confusion risk
- Generic byte filters do not understand economic outcomes
- Difficult to express route, slippage, token authority, and callback safety
- Significantly larger audit burden

This option should not proceed without a convincing constrained design.

### 3. Signed intent/quote adapter

A trusted facilitator or protocol signs a short-lived quote containing policy,
mint, amount, recipient, expected output, program, expiry, and replay nonce.
PolicyKit verifies the quote and either transfers or CPIs through a narrow
adapter.

Advantages:

- Useful for x402 and quote-based APIs
- Clear expiry and replay semantics

Costs:

- Introduces signer/facilitator trust and rotation
- Still requires transaction/account validation

## Required invariants

- Existing vault custody and authority pause/clawback remain intact.
- Every value-moving CPI occurs only after all policy and adapter checks.
- Downstream program IDs are fixed or explicitly policy-bound.
- Remaining accounts cannot substitute mints, vaults, recipients, authorities,
  or token programs.
- Input amount and minimum acceptable output use checked integer arithmetic.
- Replay protection is on-chain when signed quotes are accepted.
- CPI failure rolls back counters and vault state atomically.
- Classic SPL Token remains the only supported token program until a separate
  Token-2022 design is approved.

## Required test matrix

- Malicious account ordering and duplicate accounts
- Writable/signer privilege escalation attempts
- Wrong program, discriminator, mint, vault, recipient, and token program
- Forged, expired, replayed, and cross-policy quotes
- Excess input, insufficient output, slippage boundary, and arithmetic overflow
- Downstream CPI failure after counter mutation
- Protocol upgrade changing instruction layout
- Compute-budget exhaustion and oversized remaining-account sets

## Migration and API questions

- New instruction versus versioned Policy account extension
- Whether adapter permissions live in a separate PDA to avoid resizing Policy
- How SDK/plugin feature detection works for existing deployments
- Whether spend counters are recorded before or after output validation
- How program upgrades invalidate adapter configurations

## Decision gate

Implementation requires:

1. Evidence of a concrete user integration that declared intent cannot serve.
2. Selection of one narrow protocol or quote flow.
3. Updated program design and threat model.
4. Account-layout and migration proposal.
5. Independent review of CPI and account-substitution risks.

Until then, PolicyKit must continue describing `intent_program` as a declared
allow/deny and monitoring signal.
