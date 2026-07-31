# Phase D — A+C Edge: Agent Kit Default Path + Compromised-Agent Max Damage

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make PolicyKit the **default open on-chain policy vault for Solana Agent Kit agents**, proven by a **public “compromised agent is still bounded”** live system — not by feature sprawl or presentation-only polish.

**Strategy one-liner (locked):**  
*PolicyKit is the open on-chain policy vault Solana agents should use by default — so a compromised agent can only hurt you within rules you set, not drain the treasury. Beachhead: x402/API-style spenders under tight caps + destination allowlists.*

**Architecture:** Keep Anchor 0.32 + classic SPL + yarn monorepo. Do **not** rewrite stack. Split work into four workstreams that reinforce A and C:

| Workstream | Edge | Outcome |
|------------|------|---------|
| **W1 — Always-on adversary demo** | **C** | Public agent loop that succeeds under policy and fails when “rogue” |
| **W2 — Damage-bound product hardener** | **C** | Rules + UX that make max-loss obvious (total budget, session, public policy page) |
| **W3 — Agent Kit default path** | **A** | Best-in-class plugin, examples, PR/docs path into ecosystem |
| **W4 — Beachhead B (thin)** | **B under A+C** | x402/API template + one live payment-shaped run — not a rebrand |

**Tech stack:** Existing PolicyKit + Solana Agent Kit v2 plugin + Next.js dashboard + devnet scripts. Optional: lightweight cron/systemd or GitHub Action for the public agent loop; Helius webhooks if free tier available (not required for MVP of this phase).

**Estimated effort:** **3–5 focused weeks** for a credible A+C proof; Eternal packaging (video) only after W1–W3 land.

**Repo plan copy:** `docs/superpowers/plans/2026-08-01-phase-d-edge-a-plus-c.md`

---

## Global constraints

- **Positioning is A+C only.** Do not pitch Squads-killer, full DeFi CPI proxy, marketplace, or insurance.
- **B is beachhead only** (template + demo path), not identity.
- **E (full CPI mediation) and D (protocol integrations)** are **out of scope** except as README roadmap bullets.
- Stack pins unchanged (`AGENTS.md`): Anchor 0.32.x, classic SPL, yarn, web3.js v1.
- Money-path program changes require tests + SECURITY/THREAT_MODEL/ERROR_CATALOG updates.
- Never commit authority keypairs; agent keys for public demo may be **devnet-only** and documented as such.
- Prefer **devnet** for public agent; mainnet only with explicit user approval and tiny budgets.
- Every workstream must leave **CI green** (`yarn test:unit`, `anchor test` when program touched, `yarn build:dashboard` when UI touched).

---

## North-star success criteria (definition of done for Phase D)

A skeptical Eternal judge can, **without a video**, conclude:

1. **C is real:** There is a **public policy + public agent** that periodically attempts allowed and forbidden spends; Solscan shows success and clean rejects; remaining budget is visible.  
2. **Max damage is legible:** One page states *worst-case loss if agent key is stolen* (per-tx × rate window, daily cap, destination set).  
3. **A is real:** A developer can `npm/yarn` the plugin and run a **copy-paste Agent Kit example** that only moves value via PolicyKit; CONTRIBUTING/docs make upstream PR path clear.  
4. **Differentiation is written:** Honest matrix vs Turnkey/Privy, Squads SPN, X402Guard/allowances — where we win / lose.  
5. **Not a feature dump:** No hierarchical policies, Token-2022, full Jupiter CPI mediation, or marketplace.

**Quantitative targets (stretch = nice):**

| Metric | Target |
|--------|--------|
| Public agent “tick” frequency | ≥ 1 success + 1 intentional fail per day on devnet |
| Example repo time-to-first-bounded-spend | &lt; 15 minutes for a developer with Solana CLI |
| Program tests | All existing green + new cases for any new rule |
| External PR | Draft or open PR / discussion issue on solana-agent-kit **or** published external example linked from Agent Kit issues |

---

## Current baseline (what we already have)

| Asset | Status | Serves |
|-------|--------|--------|
| On-chain policy vault + dest allowlist | Shipped | C |
| SDK + templates (incl. x402) | Shipped | A, B |
| Agent Kit plugin (3 actions) | Shipped, external package | A |
| Dashboard control room | Shipped | C (human) |
| `yarn demo:devnet` one-shot proof | Shipped | C (snapshot) |
| Always-on public agent loop | **Missing** | C, A |
| Public policy page (no wallet) | **Missing** | C, packaging |
| Total remaining budget / session “max loss” | **Partial** (daily/per-tx only; no total remaining) | C |
| Agent Kit upstream PR / official example | **Missing** | A |
| Competitive matrix doc | **Missing** | Edge clarity |
| Alerts on reject | **Missing** | C ops |

---

## Workstream 1 — Always-on adversary demo (**C**, critical)

**Goal:** Replace one-shot `demo:devnet` with a **recurring public agent** that proves compromised-agent bounding every day.

### Design

```
┌─────────────┐     tick (cron / GH Action / node daemon)
│  Runner     │──────────────────────────────────────────►
│  (devnet)   │   1) getPolicyStatus
└─────────────┘   2) executeSpend allowed (Jupiter intent → agent ATA)
                  3) executeSpend rogue program (Drift) → expect ProgramNotAllowed
                  4) executeSpend rogue dest → expect DestinationNotAllowed
                  5) append proof/live-feed.json + update public/proof/
```

- **Funded once:** vault holds demo mint (or tiny USDC if available on devnet).  
- **Agent key:** dedicated **devnet-only** keypair stored outside git (env `AGENT_SECRET` / local file gitignored).  
- **Authority:** only used for top-ups / pause; not in the hot loop.  
- **Idempotent:** if daily budget exhausted, tick records “bounded — daily exhausted” as **success of C**, not failure of runner.

### Tasks

#### Task 1.1 — Live agent runner script

**Files:**
- Create: `scripts/live-agent/run-tick.ts`
- Create: `scripts/live-agent/config.ts` (RPC, program, policy, mint, paths)
- Create: `scripts/live-agent/README.md`
- Modify: `package.json` → `"agent:tick": "ts-node ..."`, `"agent:setup": "..."` (create policy + fund once)

**Behavior:**
- [ ] Load policy PDA from env or `proof/live-config.json`
- [ ] Run allowed spend (small amount)
- [ ] Run Drift intent → assert error name `ProgramNotAllowed`
- [ ] Run outsider destination → assert `DestinationNotAllowed`
- [ ] Write structured event log:

```ts
type TickEvent = {
  ts: string;
  kind: "allowed" | "reject_program" | "reject_dest" | "reject_budget" | "error";
  ok: boolean;
  errorName?: string;
  signature?: string;
  remainingDaily?: string;
  explorer?: { tx?: string; policy: string };
};
```

- [ ] Append to `proof/live-feed.jsonl` (or rolling JSON array max 100)
- [ ] Update `apps/dashboard/public/proof/live-feed.json` for static hosting
- [ ] Exit 0 if expected rejects fire; exit 1 only on unexpected errors

**Commit:** `feat(agent): always-on live tick runner for compromised-agent demo`

#### Task 1.2 — One-time setup script (policy + fund)

**Files:**
- Create: `scripts/live-agent/setup-live-policy.ts`
- Writes `proof/live-config.json` (policy, mint, agent pubkey — **not** secrets)

**Setup creates:**
- Conservative or stricter “adversary demo” template:
  - per-tx small, daily small, rate limit tight
  - program allowlist: Jupiter only
  - destination allowlist: agent only
- Deposit fixed amount
- Print Solscan links

**Commit:** `feat(agent): setup script for public live policy`

#### Task 1.3 — Automation (pick one, document both)

**Preferred for simplicity:** GitHub Action scheduled workflow (devnet only) **if** secrets can hold `AUTHORITY`/`AGENT` carefully — *or* document local cron to avoid putting main authority in GitHub.

**Safer default for this plan:**
- [ ] Document `cron` / `systemd` user timer calling `yarn agent:tick` every N hours
- [ ] Optional: `.github/workflows/live-agent.yml` with **repository secrets**, dry-run mode, and clear warning — implement only if user opts in

**Commit:** `docs(agent): schedule live tick via cron (optional GHA)`

#### Task 1.4 — Dashboard “Live adversary” feed

**Files:**
- Create: `apps/dashboard/src/components/live-agent-feed.tsx`
- Modify: `dashboard-app.tsx` — show feed from `/proof/live-feed.json`
- Modify: `live-proof-card.tsx` — link to live feed + “last tick”

**Acceptance:**
- [ ] Without wallet, visitor sees last N ticks: allowed + two reject types with Solscan
- [ ] `yarn build:dashboard` green

**Commit:** `feat(dashboard): public live agent feed`

---

## Workstream 2 — Max-damage product hardener (**C**)

**Goal:** Make “worst-case loss if agent is stolen” a first-class product concept, not a paragraph in SECURITY.md.

### Task 2.1 — Public policy page (no wallet)

**Files:**
- Create: `apps/dashboard/src/app/p/[address]/page.tsx` (server or client fetch)
- Create: `apps/dashboard/src/components/public-policy-view.tsx`
- Modify: `lib/policy-client.ts` / read-only connection helper (no wallet adapter required)

**Page shows:**
- Status: Active / Paused / Expired  
- Remaining daily, per-tx max, rate window remaining  
- Destination allowlist (pubkeys short)  
- Program allowlist  
- **Max damage panel** (computed client-side):

```
If agent key is stolen right now:
- Max per action: max_per_transaction
- Max per rate window: max_per_tx * max_actions_per_window (if both set)
- Max per day: max_per_day
- Can pay only: [destination owners]
- Can claim intents only: [programs]
- Authority can: pause + clawback
```

- Solscan links for policy + recent activity (reuse chain-activity)

**Acceptance:**
- [ ] Shareable URL `/p/<policyPda>` works on devnet for live-config policy
- [ ] No wallet connect required to read

**Commit:** `feat(dashboard): public read-only policy page with max-damage panel`

### Task 2.2 — Optional on-chain `max_total_spend` (only if cheap)

**Decision gate:** Prefer **client-computed max damage** first (Task 2.1). Add on-chain total remaining only if time allows and it strengthens C without layout thrash.

If implemented:

**Files:**
- `state/policy.rs`: `max_total: u64` (`0` = unlimited), check in `check_and_record_spend` against `total_spent`
- errors: `ExceedsTotalLimit`
- SDK + templates + tests + ERROR_CATALOG
- **Breaking account size** — document recreate

**If deferred:** document as roadmap under C in COMPETITIVE.md

**Commit (if done):** `feat(program): optional max_total spend cap`

### Task 2.3 — “Circuit breaker” UX on dashboard

**Files:**
- Modify: `authority-controls.tsx` — primary **Pause (circuit breaker)** styling + confirm copy: “Stops all agent spends immediately”
- Modify: `status-card.tsx` — show max-damage summary one-liner when policy loaded

**Commit:** `feat(dashboard): circuit-breaker pause emphasis + max-damage summary`

### Task 2.4 — Threat model refresh for A+C narrative

**Files:**
- Modify: `docs/THREAT_MODEL.md` — “compromised agent” as primary scenario; table of max loss
- Create: `docs/MAX_DAMAGE.md` — short canonical explainer for judges

**Commit:** `docs: compromised-agent max damage guide`

---

## Workstream 3 — Agent Kit default path (**A**, critical)

**Goal:** Make installing PolicyKit the path of least resistance for Solana agents.

### Task 3.1 — Gold-standard example package

**Files:**
- Create: `examples/agent-kit-bounded-spend/` (standalone mini-package or folder)
  - `package.json` (depends on `solana-agent-kit`, `@policykit/*`)
  - `src/index.ts` — full flow: create policy (or load PDA) → plugin → status → spend → intentional fail
  - `.env.example` — RPC, keys paths
  - `README.md` — 15-minute path, security ops, link to public policy page

**Acceptance:**
- [ ] Cold developer path documented end-to-end
- [ ] Example refuses to load unrestricted transfer plugins without warning banner in README

**Commit:** `feat(examples): Agent Kit bounded-spend gold standard`

### Task 3.2 — Plugin product quality for “default”

**Files:**
- `packages/agent-kit-plugin/`
  - Expand README with: architecture diagram, “fund vault not agent”, composition dangers, max-damage blurb
  - Add `simulateRogueAgent()` helper **or** example-only rogue calls (prefer example, not production API bloat)
  - Ensure actions’ LLM descriptions emphasize: only vault spends; check status before spend
  - Version bump toward publishable `0.2.0` (optional npm publish — only with user approval)

- [ ] Unit/integration still green for plugin tests

**Commit:** `docs+feat(plugin): default-path quality and composition warnings`

### Task 3.3 — Ecosystem PR / listing path

**Files:**
- Create: `docs/ECOSYSTEM.md` — steps to:
  1. Open discussion/issue on `sendaifun/solana-agent-kit` proposing PolicyKit as recommended spend guardrail
  2. PR adding docs example link (if they accept external plugins)
  3. Alternative: Superteam/Solana AI guides external example

- Create: draft PR body in `docs/superpowers/pr-drafts/agent-kit-example.md` (text only; **do not open PR without user approval**)

**Acceptance:**
- [ ] User has a one-click path to submit (copy/paste PR)
- [ ] No unauthorized GitHub posts from agents unless user says so

**Commit:** `docs: Agent Kit ecosystem contribution path`

### Task 3.4 — Root README rewrite for A+C (not marketing fluff)

**Structure:**
1. One-liner (A+C)  
2. “If agent is compromised” max-damage box  
3. Quickstart Agent Kit (link example)  
4. Live proof + public policy link  
5. Competitive honesty (link COMPETITIVE.md)  
6. Architecture  
7. Security non-goals  

**Commit:** `docs: README A+C positioning`

---

## Workstream 4 — Thin beachhead B (x402 / API spender)

**Goal:** First vertical that makes A+C concrete — not a rebrand.

### Task 4.1 — “Safe API spender” template + demo script

**Files:**
- Harden `x402PaymentsTemplate` defaults (tight caps, dest allowlist to agent or known facilitator pubkey placeholder)
- Create: `scripts/live-agent/tick-x402-style.ts` **or** mode flag on tick: allowed “payment” intent program + reject random dest
- Docs: `docs/BEACHHEAD_X402.md` — how facilitators compose; PolicyKit bounds economic damage

**Commit:** `feat: x402-style beachhead template and docs`

### Task 4.2 — Optional outreach list (non-code)

**Files:**
- `docs/GTM_PILOTS.md` — 10 accounts/repos to contact (x402, agent kits, Superteam) — **user sends messages**, plan only drafts

---

## Workstream 5 — Competitive honesty (edge insurance)

### Task 5.1 — COMPETITIVE.md matrix

**Create:** `docs/COMPETITIVE.md`

| Competitor | Layer | Win | Lose |
|------------|-------|-----|------|
| Turnkey / Privy | Key infra | DevEx, multi-chain | Not open on-chain vault; soft/TEE policies |
| Squads / SPN | Smart account network | Institutions, multisig | Heavier; not Agent Kit default |
| X402Guard / Valeo-class | Narrow vault/plugin | Focused payments | Narrower; less general primitive |
| Subscriptions & Allowances | Delegation | Native spend budget | Different model; less agent UX |
| **PolicyKit** | Open vault + Agent Kit | Default agent path + max-damage demo + dest/program/rate | No full CPI mediation yet; no network |

**Rules:** no strawmen; cite residual risks.

**Commit:** `docs: competitive matrix for A+C wedge`

---

## Suggested calendar (best-possible execution)

| Week | Focus | Exit criteria |
|------|--------|----------------|
| **Week 1** | W1.1–1.2, W2.1, W5.1 | Tick runs manually; public `/p/[policy]`; COMPETITIVE.md |
| **Week 2** | W1.3–1.4, W2.3–2.4, W3.1 | Cron + dashboard feed; max-damage docs; gold example |
| **Week 3** | W3.2–3.4, W4.1 | Plugin polish; README A+C; x402 beachhead |
| **Week 4** | Hardening + optional W2.2 + PR draft | Stable ticks 7 days; ecosystem PR ready; freeze features |
| **After** | Eternal video + weekly updates | Packaging only — product already proves A+C |

Parallelism: **W1 and W2** can run in parallel after setup; **W3** after example needs stable SDK; **W5** early (docs only).

---

## Explicit non-goals (this phase)

- Full Jupiter/DeFi CPI mediation (E)  
- Hierarchical multi-agent orgs  
- Token-2022 transfer hooks  
- Protocol partnership closes (D) as primary KPI  
- Mainnet treasury / real USDC at scale  
- npm publish of monorepo packages unless user requests  
- Opening GitHub PRs/issues without user approval  
- Policy marketplace / insurance  

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Devnet RPC 429 kills live agent | Retry/backoff; optional Helius URL in env (never commit keys) |
| Agent key leaked in GH Actions | Prefer local cron; if GHA, dedicated throwaway devnet key only |
| Daily budget exhausts — looks “broken” | Treat as C success; auto-log; optional authority top-up script |
| Agent Kit rejects external plugin PR | Ship standalone example + ECOSYSTEM.md; still win A via tutorials |
| Scope creep into E | Any CPI mediation requires new plan + user OK |
| Public page abuse / spam | Read-only; rate-limit RPC; no write endpoints |

---

## File map (summary)

| Path | Workstream |
|------|------------|
| `scripts/live-agent/*` | W1 |
| `proof/live-config.json`, `proof/live-feed.json` | W1 |
| `apps/dashboard/src/app/p/[address]/` | W2 |
| `apps/dashboard/src/components/live-agent-feed.tsx` | W1 |
| `apps/dashboard/src/components/public-policy-view.tsx` | W2 |
| `examples/agent-kit-bounded-spend/` | W3 |
| `packages/agent-kit-plugin/**` | W3 |
| `docs/COMPETITIVE.md`, `MAX_DAMAGE.md`, `ECOSYSTEM.md`, `BEACHHEAD_X402.md` | W3–W5 |
| `README.md` | W3 |
| Optional: `programs/policykit` max_total | W2.2 only |

---

## Phase D gate checklist

| # | Criterion | Done |
|---|-----------|------|
| 1 | `yarn agent:tick` produces allowed + 2 expected rejects on devnet | |
| 2 | Tick scheduled or documented for ≥ daily run | |
| 3 | `/p/<policy>` shows max-damage without wallet | |
| 4 | Dashboard shows live feed from public JSON | |
| 5 | `examples/agent-kit-bounded-spend` runs documented path | |
| 6 | COMPETITIVE.md + MAX_DAMAGE.md + A+C README | |
| 7 | Ecosystem PR draft ready (not necessarily submitted) | |
| 8 | Unit + integration tests green; dashboard builds | |
| 9 | No E/D scope creep in code | |

---

## How this is “best possible” (not just more features)

| Trap | This plan’s response |
|------|----------------------|
| “Ship everything” | Only A+C (+ thin B) |
| “Presentation only” | Live agent + public page are product proofs |
| “Rewrite for moat” | Deepen default path + max-damage legibility |
| “Win by claiming uniqueness” | COMPETITIVE.md admits overlaps |
| “Demo once” | Recurring tick = continuous proof |

---

## Execution options (after approval)

1. **Full Phase D** — W1→W5 in order above  
2. **C-first** — W1 + W2 only (fastest judge-visible proof)  
3. **A-first** — W3 + W5 (distribution), then W1  

**Recommended:** Full Phase D with **W1+W2 in week 1** so C is undeniable before A outreach.

---

## Self-review

| Strategy element | Covered |
|------------------|---------|
| A Agent Kit default | W3, gate 5–7 |
| C Max damage | W1, W2, gate 1–4 |
| B beachhead thin | W4 |
| No all-edges sprawl | Non-goals |
| Eternal packaging deferred | After gate |
