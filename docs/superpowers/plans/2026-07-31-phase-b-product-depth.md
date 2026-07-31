# Phase B — Product Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn PolicyKit from “MVP that demos” into a **control room + stronger vault rules** judges and builders can run daily: complete authority UX, multi-policy session management, chain-backed activity, and an on-chain **destination allowlist** that hardens the declared-intent model.

**Architecture:** Keep Anchor **0.32.1**, classic SPL Token, yarn monorepo, `@solana/web3.js` v1. Phase B is three layers that stack:

1. **Dashboard product** (no program change) — expose SDK power already present (`updatePolicy`, `setAgent`), multi-policy picker, richer status.
2. **Chain activity** (read-only RPC / logs) — merge on-chain events with local activity; no indexer dependency required for MVP of this phase.
3. **On-chain destination allowlist** — new fields + checks in `check_and_record_spend` / `execute_spend`, SDK + templates + tests + dashboard demo path.

**Tech Stack:** Anchor 0.32.1, SPL Token classic, Next.js 15 dashboard, `@policykit/sdk`, mocha/chai + `anchor test`, existing CI.

**Estimated effort:** ~2–3.5 focused engineering weeks (dashboard-first can ship mid-way; on-chain work is a distinct half).

**Repo plan copy:** Also save under `docs/superpowers/plans/2026-07-31-phase-b-product-depth.md` when executing.

---

## Global Constraints

- Stack pins unchanged: Anchor **0.32.x**, classic **SPL only**, yarn, web3.js **v1** (`AGENTS.md`).
- **No** Token-2022, hierarchical policies, full CPI mediation into Jupiter, multi-mint agent budgets, Helius as a hard dependency, marketplace.
- Money-path changes require: integration test + SDK unit/preview update + `docs/SECURITY.md` / `THREAT_MODEL.md` / `ERROR_CATALOG.md` + CHANGELOG.
- Destination allowlist checks **destination token account owner** (wallet pubkey), not the ATA address — matches “who receives funds.”
- Account layout change for destination lists is **breaking** for already-created Policy accounts (new `InitSpace`). Acceptable pre-mainnet; document “recreate policies after upgrade.” Do not invent silent migration.
- Dashboard agent key in `localStorage` remains **demo-only**.
- `anchor test` must stay on **Localnet** (`Anchor.toml` provider).
- Prefer small commits; keep CI green after each major task.
- Work on a branch if preferred, but **main is acceptable** per product owner preference.

---

## Current baseline (post Phase A, 2026-07-31)

| Area | Status |
|------|--------|
| Program instructions | create / update / pause / set_agent / deposit / clawback / execute_spend |
| Destination control | **None** — any dest ATA of `spend_mint` OK if not policy-owned |
| SDK | Full write API including `updatePolicy`, `setAgent` |
| Dashboard authority | Pause / unpause / clawback only |
| Dashboard policy UX | Single policy in localStorage; create + load by address |
| Activity | localStorage only (`apps/dashboard/src/lib/activity.ts`) |
| Status card | Remaining daily/actions, pause/expiry, vault balance |
| Events | `SpendExecuted`, `DepositReceived`, `ClawbackExecuted`, pause, etc. exist on-chain |
| Tests | 30 unit + 54 integration (pitch + Phase A matrix) |
| Docs | DESIGN, SECURITY, THREAT_MODEL, ERROR_CATALOG, ARCHITECTURE |

### Dashboard gap map (what SDK can do vs UI)

| Capability | SDK | Dashboard today |
|------------|-----|-----------------|
| createPolicy + templates | Yes | Yes |
| deposit | Yes | Yes |
| pause / unpause / clawback | Yes | Yes |
| updatePolicy (limits, lists, expiry) | Yes | **No** |
| setAgent | Yes | **No** |
| Multi-policy list / switch | N/A | **No** (one key) |
| Activity from chain | N/A | **No** |
| Destination allowlist | **No** | **No** |

---

## Product thesis for Phase B (one paragraph)

PolicyKit’s human surface becomes a **policy control room**: pick a policy, see live remaining budget, update rules and rotate the agent without leaving the UI, and see spends (success and clean failures) with Solscan links. On-chain, agents can be constrained not only by *how much* and *which program intent*, but **who may receive funds** (destination owner allowlist)—closing a major residual risk from the threat model without requiring full CPI mediation.

---

## File map (create / modify)

### Dashboard (Tasks 1–3)

| Path | Role |
|------|------|
| `apps/dashboard/src/lib/policies-store.ts` | **Create** — multi-policy localStorage list `{ policy, policyId, label, spendMint }[]` |
| `apps/dashboard/src/lib/config.ts` | **Modify** — storage keys for policy list |
| `apps/dashboard/src/lib/activity.ts` | **Modify** — new kinds: `update`, `set_agent`, `chain_*`; optional merge helper |
| `apps/dashboard/src/lib/chain-activity.ts` | **Create** — fetch recent signatures for policy + parse logs/events |
| `apps/dashboard/src/components/policy-switcher.tsx` | **Create** — list / select / load policy by address |
| `apps/dashboard/src/components/update-policy-panel.tsx` | **Create** — edit limits + lists + expiry via `updatePolicy` |
| `apps/dashboard/src/components/set-agent-panel.tsx` | **Create** — rotate agent (demo key or paste pubkey) |
| `apps/dashboard/src/components/authority-controls.tsx` | **Modify** — keep pause/clawback; optionally nest or sit beside new panels |
| `apps/dashboard/src/components/status-card.tsx` | **Modify** — show agent, allowlists summary, destination list, expiry countdown |
| `apps/dashboard/src/components/activity-feed.tsx` | **Modify** — render chain vs local badges |
| `apps/dashboard/src/components/agent-demo-panel.tsx` | **Modify** — destination-denied demo path after program lands |
| `apps/dashboard/src/components/dashboard-app.tsx` | **Modify** — wire switcher + new panels + chain refresh |
| `apps/dashboard/README.md` | **Modify** — demo script update |

### On-chain + SDK (Tasks 4–6)

| Path | Role |
|------|------|
| `programs/policykit/src/constants.rs` | `MAX_DESTINATION_LIST` |
| `programs/policykit/src/state/policy.rs` | Fields + validation + check in `check_and_record_spend` |
| `programs/policykit/src/error.rs` | `EmptyDestinationAllowlist`, `DestinationNotAllowed`, `DestinationListTooLong` |
| `programs/policykit/src/instructions/create_policy.rs` | Pass-through params (if needed) |
| `programs/policykit/src/instructions/update_policy.rs` | Update dest list fields |
| `programs/policykit/src/instructions/execute_spend.rs` | Pass destination **owner** into check |
| `packages/sdk/src/types.ts` | Create/Update params + PolicyAccount fields |
| `packages/sdk/src/helpers.ts` | `previewSpend` destination owner check |
| `packages/sdk/src/errors.ts` | New codes/titles |
| `packages/sdk/src/templates.ts` | Optional `destinationAllowlist` / default agent-only |
| `packages/sdk/src/client.ts` | Normalize new params |
| `packages/sdk/test/*` | Unit tests for preview + error catalog |
| `tests/policykit.ts` | On-chain dest allowlist cases |
| `tests/sdk_and_plugin.ts` | Pitch: forbidden destination fails cleanly |
| IDL copies under `packages/sdk/idl/` | Regenerated after `anchor build` |
| `docs/PROGRAM_DESIGN.md`, `SECURITY.md`, `THREAT_MODEL.md`, `ERROR_CATALOG.md`, `ARCHITECTURE.md` | Sync |
| `CHANGELOG.md`, `README.md` | User-facing notes |

---

## Task breakdown

### Task 1: Multi-policy session store + policy switcher

**Goal:** Authority can create several policies and switch without overwriting a single localStorage key.

**Files:**
- Create: `apps/dashboard/src/lib/policies-store.ts`
- Create: `apps/dashboard/src/components/policy-switcher.tsx`
- Modify: `apps/dashboard/src/lib/config.ts`, `dashboard-app.tsx`

**Design:**

```ts
// policies-store.ts
export interface StoredPolicy {
  address: string;       // base58 policy PDA
  policyId: number;
  spendMint: string;
  label?: string;        // optional human label (template name)
  createdAt: number;
}

export function loadPolicies(): StoredPolicy[];
export function upsertPolicy(p: StoredPolicy): StoredPolicy[];
export function removePolicy(address: string): StoredPolicy[];
export function getActivePolicyAddress(): string | null;
export function setActivePolicyAddress(address: string | null): void;
```

- Migrate: if old single `STORAGE_KEYS.policy` exists, seed list once.
- Switcher UI: dropdown/list of known policies + “Load by address” input + Solscan link.
- On select: set active policy, refresh status, clear stale errors.

**Acceptance:**
- [ ] Create policy A and B; switch between them; status/vault match each PDA.
- [ ] Reload page; list and active selection persist.
- [ ] Invalid address load shows friendly error.
- [ ] `yarn build:dashboard` green.

**Commit:** `feat(dashboard): multi-policy store and switcher`

---

### Task 2: Authority completeness — Update policy + Set agent panels

**Goal:** Expose full authority surface already in the SDK.

**Files:**
- Create: `update-policy-panel.tsx`, `set-agent-panel.tsx`
- Modify: `authority-controls.tsx` (layout only if needed), `dashboard-app.tsx`, `activity.ts` (kinds), `status-card.tsx`

**Update policy panel fields (mirror `UpdatePolicyParams`):**
- expiresAt (unix or “never” toggle + optional hours-from-now)
- maxPerTransaction, maxPerDay (UI amounts, 6 decimals default)
- maxActionsPerWindow, windowSeconds
- program allowlist enabled + comma/newline list of base58 (prefill from status)
- denylist enabled + list
- mint allowlist enabled + list  
- (destination fields added in Task 5 after program lands — stub disabled or hide until then)

**Behavior:**
- Prefill from `client.getPolicy(policy)` / status.
- Submit → `client.updatePolicy(policy, params)` → activity + refresh.
- Validate client-side: empty allowlist if enabled → friendly error before tx.

**Set agent panel:**
- Show current agent (from status).
- Actions: “Use demo agent key” / paste new pubkey / “Generate new demo agent” (updates localStorage agent + calls `setAgent`).
- Warn: rotating agent immediately revokes old key spends.

**Status card upgrades:**
- Show agent short key + Solscan.
- Show expires_at human string or “Never”.
- Show program allowlist count / first entry (Jupiter).
- Remaining daily + vault already present — keep.

**Acceptance:**
- [ ] Update per-tx/daily on-chain; status card reflects new limits after refresh.
- [ ] setAgent to new key; old demo agent spend fails `UnauthorizedAgent`; new key works (demo panel uses active agent).
- [ ] Activity records update/set_agent with signatures.
- [ ] No regression to pause/clawback/create/deposit/demo sequence.
- [ ] `yarn build:dashboard` green.

**Commit:** `feat(dashboard): update policy and set agent control panels`

---

### Task 3: Chain-backed activity feed (RPC, no Helius required)

**Goal:** Activity is not only what this browser recorded — pull recent policy-related signatures from chain.

**Files:**
- Create: `apps/dashboard/src/lib/chain-activity.ts`
- Modify: `activity-feed.tsx`, `dashboard-app.tsx`, `activity.ts`

**Approach (pragmatic MVP):**

1. `connection.getSignaturesForAddress(policy, { limit: 20 })`
2. For each sig (newest first), `getTransaction` with `maxSupportedTransactionVersion: 0`
3. Parse logs for Anchor event/error names where possible:
   - Prefer log substrings: `SpendExecuted`, `DepositReceived`, `ClawbackExecuted`, `PolicyPaused`, error names (`ProgramNotAllowed`, etc.)
4. Map to `ActivityItem` with `kind` + `signature` + `success`
5. **Merge** with localStorage activity: de-dupe by signature; show combined list sorted by time
6. UI: badge “On-chain” vs “Local”; button “Refresh from chain”
7. Rate-limit: only fetch when policy selected / user clicks refresh / after actions (not aggressive polling)

**Do not require** Helius webhooks for Phase B. Optional env `NEXT_PUBLIC_HELIUS_RPC` can be the same as RPC URL later.

**Acceptance:**
- [ ] After a spend on localnet/devnet, “Refresh from chain” shows a row with signature even in a clean browser profile (no local history).
- [ ] Failed spend still appears if tx landed with error logs (best-effort).
- [ ] Degrade gracefully if RPC lacks history (empty + message).
- [ ] `yarn build:dashboard` green.

**Commit:** `feat(dashboard): merge on-chain signatures into activity feed`

---

### Task 4: On-chain destination allowlist (program)

**Goal:** Optional allowlist of **destination token account owners** (wallets). When enabled, `execute_spend` fails unless `destination.owner` is listed.

**Design (locked for implementers):**

```rust
// constants.rs
pub const MAX_DESTINATION_LIST: usize = 10;

// Policy fields (new)
pub destination_allowlist_enabled: bool,
#[max_len(MAX_DESTINATION_LIST)]
pub destination_allowlist: Vec<Pubkey>,
```

**CreatePolicyParams / UpdatePolicyParams:** add the same two fields.

**Validation** (mirror mint allowlist):
- list len ≤ 10 → else `DestinationListTooLong`
- if enabled && empty → `EmptyDestinationAllowlist`

**Enforcement** in `check_and_record_spend` **or** `execute_spend_handler` after destination is loaded:

- Prefer extending `check_and_record_spend` signature to accept `destination_owner: &Pubkey` so unit-level logic stays centralized:

```rust
pub fn check_and_record_spend(
    &mut self,
    amount: u64,
    mint: &Pubkey,
    intent_program: &Pubkey,
    destination_owner: &Pubkey,
    now: i64,
) -> Result<()>
```

Order (insert after mint allowlist, before rate limit — document in SECURITY.md):

1. … mint allowlist …
2. **If `destination_allowlist_enabled`:** require `destination_allowlist` contains `destination_owner` → else `DestinationNotAllowed`
3. rate limit → spend caps …

**Errors (next codes after 6023):**

| Code | Name |
|------|------|
| 6024 | `DestinationListTooLong` |
| 6025 | `EmptyDestinationAllowlist` |
| 6026 | `DestinationNotAllowed` |

**execute_spend.rs:** after loading destination account, pass `&destination.owner` into check (already have dest owner for InvalidDestination).

**Breaking change note:** Policy account size changes → old accounts unreadable; recreate after deploy. Document in CHANGELOG + PROGRAM_DESIGN.

**Tests (`tests/policykit.ts`) — required cases:**
- [ ] create with dest allowlist enabled + agent wallet; spend to agent ATA **succeeds**
- [ ] spend to outsider ATA **fails** `DestinationNotAllowed`
- [ ] enabled + empty list **fails** create `EmptyDestinationAllowlist`
- [ ] 11 destinations **fails** `DestinationListTooLong`
- [ ] update_policy enables dest allowlist and blocks previous open destinations
- [ ] disabled allowlist: any dest still works (except policy-owned)

**Acceptance:**
- [ ] `anchor build && anchor test` all green (including Phase A cases)
- [ ] IDL copied to SDK paths
- [ ] Docs updated (Task 6 can batch docs, but error.rs must exist here)

**Commit:** `feat(program): destination owner allowlist on execute_spend`

---

### Task 5: SDK + templates + plugin preflight for destinations

**Goal:** Clients can set and preview destination rules.

**Files:** types, helpers (`previewSpend`), errors, templates, client normalize, unit tests, sdk_and_plugin integration.

**previewSpend:** add optional `destinationOwner?: PublicKey`; if policy has dest allowlist enabled and owner missing/not listed → `{ ok:false, errorName: "DestinationNotAllowed" }`.

**Templates:**
- `conservativeTradingTemplate`: enable destination allowlist with **`[ctx.agent]`** by default (agent may only pay itself — strongest safe demo default).
- Document that multi-payee agents pass `destinationAllowlist: [...]` via overrides or new optional `TemplateContext.destinationOwners?: PublicKey[]`.

**Plugin:** when building spend, if destination is an ATA, derive owner for preflight if easy; otherwise keep on-chain as source of truth.

**Unit tests:** catalog includes 6024–6026; previewSpend dest cases.

**Acceptance:**
- [ ] `yarn test:unit` green
- [ ] `tests/sdk_and_plugin.ts` has clean failure title for destination denied
- [ ] Templates compile; create via SDK works

**Commit:** `feat(sdk): destination allowlist types, preview, templates`

---

### Task 6: Dashboard demo path + docs sync for destination allowlist

**Goal:** Pitch video path includes destination failure; docs match code.

**Dashboard:**
- Create/Update panels include destination allowlist toggle + list (default agent).
- Agent demo panel: new button **“Pay outsider (should fail)”** → `DestinationNotAllowed` / title **“Destination not allowed”**.
- Success path still pays agent ATA.
- Demo checklist text updated in UI + `apps/dashboard/README.md`.

**Docs:**
- PROGRAM_DESIGN: new fields, check order, breaking account size
- SECURITY + THREAT_MODEL: T2 residual reduced — spoofed intent still possible but **recipient set** constrained
- ERROR_CATALOG: 6024–6026
- ARCHITECTURE: optional note
- README status: Phase B bullets
- CHANGELOG Unreleased / 0.2.0 section

**Acceptance:**
- [ ] Full demo: create (agent-only dest) → deposit → success spend → outsider fail → program fail (Drift) → over budget
- [ ] Docs cross-linked; no stale “destination not controlled” claims without residual nuance
- [ ] `yarn build:dashboard` + `anchor test` + `yarn test:unit` green

**Commit:** `feat(dashboard+docs): destination demo path and Phase B docs`

---

### Task 7: Phase B gate (verification + freeze)

**Run full gate:**

```bash
avm use 0.32.1
yarn install --frozen-lockfile
yarn test:unit
yarn typecheck:packages
anchor build && anchor test
yarn build:dashboard
cargo fmt --all -- --check
```

**Acceptance checklist:**

| Criterion | Met? |
|-----------|------|
| Multi-policy switcher works across reload | |
| updatePolicy + setAgent from dashboard | |
| Chain activity refresh shows recent sigs | |
| Destination allowlist enforced on-chain | |
| SDK preview + error titles for dest | |
| Pitch demo path includes dest failure | |
| Docs + CHANGELOG updated | |
| CI-equivalent commands green | |
| No Token-2022 / CPI mediation scope creep | |

**Commit:** only if gate fixes needed; otherwise tag mental milestone **Phase B complete** / CHANGELOG `0.2.0`.

---

## Suggested execution order & parallelization

```
Task 1 (dashboard store) ──► Task 2 (update/set agent) ──► Task 3 (chain activity)
                                      │
                                      ▼
                         Task 4 (program dest) ──► Task 5 (SDK) ──► Task 6 (UI+docs)
                                      │
                                      ▼
                                 Task 7 (gate)
```

- **Tasks 1–3** can ship as “Phase B.1 dashboard” without waiting for on-chain work.
- **Tasks 4–6** are a vertical slice (B.2 security feature).
- Do **not** parallelize Task 4 with Task 5 on the same tree without coordinating IDL; sequential 4→5→6 is safer.
- Optional: implementer subagent for Task 1–2 while planning Task 4 details; reviewer after each task.

**Workflows / multi-agent guidance:**
- **Subagent-driven** works well: dashboard tasks vs program tasks are separable after Task 3.
- Single **workflow** not required; Phase A-style sequential commits are enough.
- Use parallel agents only for: (a) dashboard Task 1–2 vs (b) program Task 4 design review — not two writers on `policy.rs` + dashboard simultaneously.

---

## Explicitly out of scope (Phase C+)

| Item | Why later |
|------|-----------|
| Helius webhook alerts / Telegram | Needs infra keys; chain poll is enough for B |
| Public hosted demo agent with real USDC | Phase C “proof in the wild” |
| Hierarchical policies | Large design |
| Full CPI proxy / Jupiter mediation | Multi-month |
| Token-2022 / transfer hooks | Toolchain + product scope |
| Policy marketplace | Vision |
| Closing/realloc policy accounts UX | Nice-to-have |
| Mainnet audit + formal verification | Post-traction |

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Policy account size break | Document recreate; localnet/devnet only assumption |
| getSignaturesForAddress empty on some RPCs | Graceful empty state; local activity remains |
| Destination allowlist UX confuses users | Default to agent-only; clear copy “who can receive funds” |
| Demo agent rotation leaves UI agent desynced | setAgent panel always updates localStorage agent used by demo panel |
| IDL drift | Always `anchor build` then copy IDL to both SDK paths + regenerate types if scripted |
| CI Anchor install flaky | Already pinned in Phase A workflow; re-run / fix pins if needed |

---

## Definition of done (Phase B)

A judge can, without reading the repo:

1. Connect wallet → create mint → create **conservative** policy (agent-only destinations).  
2. Fund vault → agent success spend → see status remaining budget.  
3. Agent tries outsider destination → **Destination not allowed**.  
4. Agent tries Drift intent → **Program not allowed**.  
5. Authority updates daily cap and/or rotates agent from the UI.  
6. Activity feed shows signatures (local + chain refresh).  
7. Switch to a second policy without losing the first.

That is the Phase B demo contract.

---

## Self-review (plan vs intent)

| Intent | Tasks |
|--------|-------|
| Dashboard control room | 1, 2 |
| Chain activity | 3 |
| Tighter security (dest) | 4, 5, 6 |
| Professional gate | 7 |
| No scope creep | Global constraints + out of scope |

No placeholder tasks; destination model (owner allowlist) is locked.
