# Agent Kit + PolicyKit (bounded spend)

**15-minute path:** create/load a policy vault, attach the PolicyKit plugin, spend only under rules, see clean rejects.

## Security ops (read first)

1. **Fund the policy vault**, not the agent wallet (agent needs fee SOL only).  
2. Do **not** load unrestricted SPL transfer plugins alongside PolicyKit if you rely on it as the spend control.  
3. Prefer destination + program allowlists enabled.  
4. Authority keeps pause (circuit breaker) + clawback.

## Prerequisites

- Node 20+, yarn  
- Built monorepo packages: from repo root `yarn build:packages`  
- Devnet policy: `yarn agent:setup` (writes `proof/live-config.json`) **or** create via dashboard  

## Run (from this directory)

```bash
# From monorepo root first:
yarn build:packages
yarn agent:setup   # once — needs authority SOL on devnet

cd examples/agent-kit-bounded-spend
cp .env.example .env
# Edit if needed
yarn install
yarn start
```

## What it does

1. Loads live policy from `proof/live-config.json`  
2. Attaches `@policykit/agent-kit-plugin`  
3. Prints status / max-damage summary  
4. Allowed spend under policy  
5. Intentional Drift intent → `ProgramNotAllowed`  

## Links

- Public policy page: `/p/<policy>` on the dashboard  
- Competitive notes: `docs/COMPETITIVE.md`  
- Max damage: `docs/MAX_DAMAGE.md`  
