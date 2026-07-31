# Phase C — Devnet live proof

PolicyKit is deployed on **Solana devnet** for public demos and Eternal weekly videos.

## Program

| Field | Value |
|-------|--------|
| Program ID | `AoTJDX2z2ej5r4UUKCofEbgDUXApWpGhQnvfk8seZf27` |
| Cluster | devnet |
| Explorer | [Solscan](https://solscan.io/account/AoTJDX2z2ej5r4UUKCofEbgDUXApWpGhQnvfk8seZf27?cluster=devnet) |

Redeploy / upgrade after program changes:

```bash
# Funded authority keypair at ~/.config/solana/id.json (upgrade authority)
yarn deploy:devnet
# or:
bash scripts/deploy-devnet.sh
```

If upgrade fails with “invalid program argument / ExtendProgram”, the script already runs `solana program extend … 10240` first.

**Localnet tests** still use `Anchor.toml` `cluster = Localnet`. Deploy does not change that.

## Live demo script

Creates mint + conservative policy, deposits, succeeds one spend, then fails Drift + outsider destination. Writes proof JSON.

```bash
# Optional: RPC_URL=https://api.devnet.solana.com AUTHORITY_KEY=~/.config/solana/id.json
yarn demo:devnet
```

Outputs:

- `proof/devnet-latest.json` (repo)
- `apps/dashboard/public/proof/devnet-latest.json` (static for dashboard)

Do **not** commit authority keypairs. Proof JSON is public (addresses + signatures only).

## Dashboard against devnet

```bash
cp apps/dashboard/.env.example apps/dashboard/.env.local
# edit RPC if you use a private endpoint
yarn dev:dashboard
```

Load the policy address from `proof/devnet-latest.json` via the policy switcher, or open the **Live proof** card (when proof JSON is present).

## Verify on Solscan

1. Open `explorer.policy` from the proof file.  
2. Open `explorer.successTx` — successful agent spend.  
3. Refresh **Activity → Chain** on the dashboard to pull recent signatures.

## Operational notes

- Faucet rate limits: use existing SOL; airdrop may fail.  
- Prefer public `api.devnet.solana.com` in committed docs — do not commit private RPC API keys.  
- After Phase B layout change, only **new** policies work; recreate if you used a pre-0.2 program binary.  
