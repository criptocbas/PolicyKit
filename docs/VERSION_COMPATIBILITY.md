# Version Compatibility

PolicyKit intentionally uses a conservative Solana stack. These are supported
lines, not invitations for automated major-version upgrades.

| Component | Supported line | Notes |
|-----------|----------------|-------|
| Node.js | 22 or newer | CI and Agent Kit require Node 22+ |
| yarn | 1.22.x | Classic workspaces and committed lockfile |
| Anchor CLI / crates | 0.32.x / 0.32.1 | Prefer `avm use 0.32.1` |
| Solana client | `@solana/web3.js` 1.x | SDK, plugin, and dashboard contract |
| SPL tokens | Classic SPL Token | Token-2022 is unsupported |
| Solana Agent Kit | 2.x | Plugin peer dependency |
| TypeScript packages | CommonJS output | Public declarations emitted from `dist` |

## Compatibility policy

- Patch and minor releases preserve exported TypeScript API names and the
  deployed Policy account layout.
- Any Policy account layout change is breaking and requires an explicit
  migration/recreation plan.
- Error names/codes are compatibility surface and are checked against the IDL.
- Template defaults are versioned metadata; changing their economic behavior
  requires a changelog entry.
- Token-2022, Anchor major upgrades, web3.js v2/Kit migration, and full CPI
  mediation are separate design projects.

## Consumer verification

```bash
node --version                 # >= 22
yarn test:unit
yarn build:packages
yarn typecheck:x402
```

Integration consumers should pin package versions and verify the SDK program ID
against the intended deployment.
