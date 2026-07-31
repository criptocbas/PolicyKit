# PolicyKit Dashboard

Demo-first Next.js control room for Colosseum Eternal.

## Features

- Wallet connect (Phantom, Solflare)
- Create policy from SDK templates (conservative / x402 / research)
- Deposit into vault
- Live status: remaining daily budget, actions left, Active/Paused/Expired
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

Deploy PolicyKit to that cluster before creating policies.

## Vercel

1. Root directory: `apps/dashboard` **or** monorepo root with:
   - Install: `yarn install`
   - Build: `yarn build:packages && yarn workspace @policykit/dashboard build`
2. Set the three `NEXT_PUBLIC_*` env vars.
3. Framework preset: Next.js.

## Demo script (≤30s)

1. Connect wallet  
2. **Create demo mint**  
3. **Create policy** → Conservative trading  
4. **Deposit** 100  
5. **Run success → fail sequence**  
6. Point at remaining budget + coral “Program not allowed” card  
