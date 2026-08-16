# Security Operations Runbook

This runbook covers production-style operation of a PolicyKit vault. It does
not replace an independent review of the deployed program and surrounding
signing infrastructure.

## Key separation

| Key | Recommended custody | Required balance |
|-----|---------------------|------------------|
| Policy authority | Hardware-backed, cold, or multi-party wallet | SOL for infrequent authority transactions |
| Program upgrade authority | Separate reviewed release custody | SOL only when upgrading |
| Agent | Isolated hot signer with narrow host permissions | Fee SOL only |
| Devnet proof agent | Disposable devnet-only secret | Devnet fee SOL |

Never place spendable tokens directly in the agent wallet when relying on
PolicyKit. The Policy PDA-controlled vault is the protected custody boundary.
Never load production agent secrets into the dashboard; its generated key is a
tab-scoped demonstration key.

## Monitoring contract

Index and alert on:

- `PolicyCreated` and `PolicyUpdated`
- `AgentUpdated`
- `PolicyPaused` and `PolicyUnpaused`
- `SpendExecuted`
- `ClawbackExecuted`
- Failed `execute_spend` transactions involving a monitored Policy PDA

For every spend, retain:

- Signature, slot, block time, policy, agent, mint, amount, destination owner,
  declared intent, and remaining daily/actions state
- RPC endpoint and commitment used for observation
- Whether the observation is a successful transaction, failed transaction,
  client preflight result, or local health result

Recommended alerts:

| Severity | Condition |
|----------|-----------|
| Critical | A forbidden test transaction succeeds; authority or agent changes unexpectedly; unplanned clawback |
| High | Repeated destination/program rejections; daily or rate budget nearly exhausted; proof schema invalid |
| Medium | Agent fee SOL low; vault balance below operating threshold; feed aging |
| Informational | Expected scheduled proof success/rejections; planned policy updates |

## Agent rotation

1. Pause the policy.
2. Stop the old agent host and revoke its signer access.
3. Generate the replacement key in the approved signer system.
4. Confirm the replacement public key through an independent channel.
5. Call `set_agent` as the authority.
6. Give the new agent fee SOL only.
7. Test a minimum-value allowed spend and an expected rejection.
8. Unpause only after monitoring observes the correct key and outcomes.

The old key loses PolicyKit spend authority immediately after the confirmed
`set_agent` transaction, but it may still control assets held outside the vault.

## Compromised agent response

1. Pause the policy.
2. Confirm the pause on-chain; do not rely only on submitted transaction state.
3. Claw back remaining vault assets to an authority-controlled token account.
4. Stop the agent host and preserve logs, signatures, policy state, and RPC data.
5. Determine whether non-vault assets or co-loaded plugins were exposed.
6. Rotate the agent using the procedure above.
7. Tighten limits/allowlists before deliberately re-funding the vault.

## Suspected authority compromise

An authorized authority can rewrite rules and claw back funds; PolicyKit cannot
constrain it. Invoke the authority custody provider's recovery process, halt
funding, preserve chain evidence, and assess the program upgrade authority
separately.

## Proof-loop response

`scripts/live-agent/feed-health.sh` fails when the feed is stale, malformed,
future-dated, contains an unexpected latest result, lacks required signatures,
or differs from the dashboard copy.

On failure:

1. Do not describe the feed as live.
2. Inspect the latest transactions directly through RPC/explorer.
3. Treat an unexpectedly successful adversarial transaction as critical.
4. Replenish only devnet fee SOL or demo vault funds as needed.
5. Run a fresh tick and health check before publishing refreshed evidence.

## Recovery drill record

For each deployment, record without secret material:

- Policy and program addresses
- Authority and agent public keys
- Pause signature
- Clawback signature
- Agent rotation signature
- Allowed-spend signature
- Expected-rejection signature
- Operator/reviewer names and UTC completion time
