# PolicyKit On-Chain Program Design (MVP)

## Security model (non-negotiable)

1. **Funds live in the policy vault**, not in the agent key. Token accounts are ATAs where the **Policy PDA** is the authority.
2. **Only two paths move value out of the vault**:
   - `execute_spend` — agent, subject to every policy rule
   - `clawback` — policy authority only
3. **Agent key never becomes token authority**. The agent can only invoke PolicyKit, which signs vault transfers via PDA seeds after checks pass.
4. **Pure on-chain enforcement**. Limits, allowlists, expiry, and pause are checked in the program before any transfer CPI. There is no off-chain “soft” gate.
5. **Authority retains ultimate control**: pause, unpause, update rules, rotate agent, clawback.

### Intent program (allow/deny lists)

Solana cannot see “what the agent will do next” after funds leave the vault. To keep program allow/deny lists *meaningful* under pure vault custody:

- Every `execute_spend` **must** declare an `intent_program`.
- If the program allowlist is enabled, `intent_program` must be on it.
- If the program denylist is enabled, `intent_program` must not be on it.
- The Agent Kit plugin always sets `intent_program` to the program the agent is about to use (e.g. Jupiter). Monitoring/indexers can reconcile spends vs. subsequent txs.

Spend caps + mint allowlist remain **hard** economic controls even if a malicious agent lies about intent: they still cannot exceed budgets or move non-allowlisted mints.

Full CPI mediation into arbitrary DeFi programs is a deliberate post-MVP hardening path.

---

## PDAs

| Account | Seeds | Role |
|---------|--------|------|
| `Policy` | `["policy", authority, policy_id_le_bytes]` | Rules, counters, agent, pause flag. Also **vault authority**. |
| Vault token ATA | Associated token account of `(policy, mint)` | Holds assets controlled by the policy. |

`policy_id: u64` lets one authority create many independent policies.

---

## Account: `Policy`

| Field | Type | Notes |
|-------|------|--------|
| `authority` | `Pubkey` | Human / protocol owner |
| `agent` | `Pubkey` | Hot key allowed to `execute_spend` |
| `policy_id` | `u64` | Seed component |
| `bump` | `u8` | PDA bump |
| `paused` | `bool` | Blocks spend when true |
| `created_at` | `i64` | Unix ts |
| `expires_at` | `i64` | `0` = never expires |
| `spend_mint` | `Pubkey` | Mint used for spend accounting (immutable after create) |
| `max_per_transaction` | `u64` | `0` = unlimited |
| `max_per_day` | `u64` | `0` = unlimited; 86400s rolling windows |
| `spent_today` | `u64` | Reset when day window elapses |
| `day_start_ts` | `i64` | Start of current day window |
| `total_spent` | `u64` | Lifetime counter (spend_mint only) |
| `max_actions_per_window` | `u32` | `0` = unlimited |
| `window_seconds` | `u32` | Required `> 0` if rate limit enabled |
| `actions_in_window` | `u32` | Reset when window elapses |
| `window_start_ts` | `i64` | Start of current rate window |
| `program_allowlist_enabled` | `bool` | |
| `program_allowlist` | `Vec<Pubkey>` max 10 | |
| `program_denylist_enabled` | `bool` | |
| `program_denylist` | `Vec<Pubkey>` max 10 | |
| `mint_allowlist_enabled` | `bool` | |
| `mint_allowlist` | `Vec<Pubkey>` max 10 | Transferred mint must be listed when enabled |

---

## Instructions

| Instruction | Signer | Description |
|-------------|--------|-------------|
| `create_policy` | authority | Init Policy PDA with full params |
| `update_policy` | authority | Update limits, lists, expiry (not authority/id/spend_mint) |
| `set_agent` | authority | Rotate agent pubkey |
| `pause_policy` | authority | Freeze spends |
| `unpause_policy` | authority | Resume spends |
| `deposit` | depositor | Transfer tokens into vault ATA (`init_if_needed` vault ATA) |
| `clawback` | authority | Withdraw from vault to authority’s token account |
| `execute_spend` | agent | Policy-checked transfer from vault → destination |

### `execute_spend` check order

1. Signer is `policy.agent`
2. Not paused; not expired
3. Refresh day + rate windows from `Clock`
4. Program allowlist / denylist vs `intent_program`
5. Mint allowlist vs transferred mint
6. Rate limit (`actions_in_window < max`)
7. If mint == `spend_mint`: per-tx limit, daily limit; update counters
8. Increment action counter
9. PDA-signed `transfer_checked` CPI
10. Emit `SpendExecuted`

---

## Events

- `PolicyCreated`, `PolicyUpdated`, `AgentUpdated`
- `PolicyPaused`, `PolicyUnpaused`
- `DepositReceived`, `ClawbackExecuted`
- `SpendExecuted` (includes remaining daily budget when applicable)

## Error codes

See `error.rs` — every rejection path has a distinct, client-readable code.

---

## Token program note

MVP uses **classic SPL Token** (`Tokenkeg…`) only. Token-2022 is deferred because current platform-tools (rustc 1.84) cannot compile the `anchor-spl` / `solana-zk-sdk` graph (edition2024). Transfers are raw `spl-token` CPIs validated in-handler (no `anchor-spl` account types).

## Out of scope for this MVP program

- Hierarchical / parent-child policies
- Token-2022 transfer-hook enforcement
- Full CPI proxy into Jupiter/etc.
- Multi-sig / Squads veto
- Closing/realloc lifecycle UX beyond clawback + pause
