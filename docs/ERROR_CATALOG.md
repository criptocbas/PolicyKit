# PolicyKit Error Catalog

On-chain custom errors use Anchor base **6000**. Keep this table in sync with:

- `programs/policykit/src/error.rs`
- `packages/sdk/src/errors.ts` (`POLICYKIT_ERROR_CODES`, titles, messages)

When adding an error: update Rust + SDK map + this doc + a fails-cleanly test.

| Code | Name | When it fires | SDK title |
|------|------|---------------|-----------|
| 6000 | `PolicyPaused` | `execute_spend` while `paused` | Policy paused |
| 6001 | `PolicyExpired` | `now >= expires_at` (when `expires_at != 0`) | Policy expired |
| 6002 | `UnauthorizedAuthority` | Non-authority on update/pause/set_agent/clawback | Not authority |
| 6003 | `UnauthorizedAgent` | Non-agent on `execute_spend` | Not agent |
| 6004 | `ExceedsPerTransactionLimit` | Amount > `max_per_transaction` (when max ≠ 0) | Over per-tx limit |
| 6005 | `ExceedsDailyLimit` | Amount would exceed daily window budget | Over daily budget |
| 6006 | `RateLimitExceeded` | `actions_in_window >= max` in current rate window | Rate limited |
| 6007 | `ProgramNotAllowed` | Allowlist enabled and `intent_program` missing | Program not allowed |
| 6008 | `ProgramDenied` | Denylist enabled and `intent_program` present | Program denied |
| 6009 | `MintNotAllowed` | Mint allowlist enabled and mint missing | Mint not allowed |
| 6010 | `ZeroAmount` | Amount is 0 on spend/deposit/clawback paths that require > 0 | Zero amount |
| 6011 | `Overflow` | Checked arithmetic on counters fails | Overflow |
| 6012 | `ProgramListTooLong` | Program allow/deny list length > 10 | Program list too long |
| 6013 | `MintListTooLong` | Mint allowlist length > 10 | Mint list too long |
| 6014 | `EmptyProgramAllowlist` | Allowlist enabled but empty vec | Empty program allowlist |
| 6015 | `EmptyMintAllowlist` | Mint allowlist enabled but empty vec | Empty mint allowlist |
| 6016 | `InvalidRateWindow` | `max_actions_per_window > 0` but `window_seconds == 0` | Invalid rate window |
| 6017 | `InvalidExpiry` | `expires_at != 0` and not in the future at create/update | Invalid expiry |
| 6018 | `InsufficientVaultBalance` | Vault balance < amount after policy checks | Insufficient vault balance |
| 6019 | `MintMismatch` | Token account mint/program mismatch | Mint mismatch |
| 6020 | `InvalidVaultAuthority` | Vault (or expected owner) is not the policy PDA | Invalid vault authority |
| 6021 | `SpendMintRequired` | `execute_spend` mint ≠ `policy.spend_mint` | Wrong mint |
| 6022 | `InvalidAgent` | Agent is default pubkey on create/set_agent | Invalid agent |
| 6023 | `InvalidDestination` | Destination token account owner is the policy PDA | Invalid destination |

## Client mapping

```ts
import { mapPolicyKitError, toPolicyKitError } from "@policykit/sdk";

try {
  await sdk.executeSpend(...);
} catch (e) {
  const err = toPolicyKitError(e);
  console.log(err.errorName, err.title, err.code);
}
```

Pitch/demo titles are intentionally short for UI cards (see `POLICYKIT_ERROR_TITLES`).
