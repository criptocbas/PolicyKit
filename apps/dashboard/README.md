# PolicyKit Dashboard

Demo-first Next.js control room for Colosseum Eternal.

## Features

- Wallet connect (Phantom, Solflare) on configured cluster (default **devnet**)
- Create policy from SDK templates (conservative / x402 / research)
- Deposit into vault
- Live status: remaining daily budget, actions left, Active/Paused/Expired
- **Public max-damage page** `/p/[policy]` — no wallet; compromised-agent bounds
- **Live adversary ticks** from `public/proof/live-feed.json`
- Live proof card from `public/proof/devnet-latest.json`
- Authority: pause / unpause / clawback
- Activity feed with Solscan links
- **Agent demo panel**: allowed Jupiter spend → clean Drift rejection with exact PolicyKit error titles

## Dev

From repo root:

```bash
yarn install
yarn build:packages
yarn dev:dashboard
# → http://localhost:3000
```

## Env

Copy `.env.example` → `.env.local`:

```bash
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com   # or Helius
NEXT_PUBLIC_POLICYKIT_PROGRAM_ID=AoTJDX2z2ej5r4UUKCofEbgDUXApWpGhQnvfk8seZf27
NEXT_PUBLIC_CLUSTER=devnet
```

Deploy PolicyKit to that cluster before creating policies. **Wallet network must match `NEXT_PUBLIC_CLUSTER`** or writes look like “account not found.”

## Vercel

1. Root directory: `apps/dashboard` **or** monorepo root with:
   - Install: `yarn install`
   - Build: `yarn build:packages && yarn workspace @policykit/dashboard build`
2. Set the three `NEXT_PUBLIC_*` env vars.
3. Framework preset: Next.js.

---

## CEO / judge demo (&lt; 3 minutes)

**Prep (once):** `yarn demo:devnet` and/or `yarn agent:tick` so proof + feed JSON exist under `apps/dashboard/public/proof/`.

| Time | Step |
|------|------|
| 0:00 | Open control room (`/`). Confirm header badge = **devnet**. |
| 0:20 | **Live proof** card: show policy + success tx on Solscan. Click **Open public max-damage page**. |
| 0:45 | On `/p/<policy>` (no wallet): “If agent key is stolen” bullets — per-tx, daily remaining, allowlists. |
| 1:15 | Back to control room → **Live adversary ticks**: allowed + reject_program + reject_dest. |
| 1:45 | Optional live path: connect **devnet** wallet → Load policy from proof → status / deposit / agent demo rejections. |
| 2:30 | Status card “If agent key stolen” + link re-opens public page for judges. |

**Do not:** switch wallet to mainnet mid-demo; use a policy from another cluster (public page will explain cluster mismatch).

---

## Classic control-room script (≤45s interactive)

1. Connect wallet on **devnet**  
2. **Create demo mint**  
3. **Create policy** → Conservative trading (agent-only destinations)  
4. **Deposit** 100  
5. **Allowed spend (Jupiter)** → success  
6. **Forbidden (Drift)** → “Program not allowed”  
7. **Pay outsider** → “Destination not allowed”  
8. Open **public max-damage** from status card  
9. **Refresh from chain** on activity + Solscan links  
