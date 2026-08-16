# Package Release Checklist

This repository does not publish automatically. A human release owner must
review package contents and deployment compatibility.

## Before tagging

1. Update `CHANGELOG.md` and package versions consistently.
2. Confirm [VERSION_COMPATIBILITY.md](./VERSION_COMPATIBILITY.md).
3. Run:

   ```bash
   yarn install --frozen-lockfile
   yarn verify:fast
   anchor build
   anchor test
   cargo fmt --all -- --check
   ```

4. Run the program autofixer on touched Rust when the Solana developer tooling
   is available.
5. Confirm the bundled IDL address and errors match the intended program.
6. Review security, threat-model, and production-readiness changes.

## Inspect artifacts

```bash
yarn workspace @policykit/sdk pack --filename /tmp/policykit-sdk.tgz
yarn workspace @policykit/agent-kit-plugin pack --filename /tmp/policykit-plugin.tgz
tar -tzf /tmp/policykit-sdk.tgz
tar -tzf /tmp/policykit-plugin.tgz
```

Artifacts must contain compiled JavaScript, declarations, package metadata, and
the SDK IDL. They must not contain keypairs, RPC credentials, `.env` files,
proof-agent secrets, test ledgers, or deployment keypairs.

## Release boundaries

- Publishing packages does not authorize a mainnet program deployment.
- A program upgrade requires separate confirmation from the upgrade authority
  owner and preservation of the exact build evidence.
- Do not mark the project audited unless the exact revision and deployed binary
  received that review.
- Submit upstream Agent Kit listings separately after published packages can be
  installed from a clean consumer project.
