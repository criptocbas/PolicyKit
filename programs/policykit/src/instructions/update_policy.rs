use anchor_lang::prelude::*;

use crate::constants::POLICY_SEED;
use crate::error::PolicyKitError;
use crate::events::PolicyUpdated;
use crate::state::{Policy, UpdatePolicyParams};

/// Update mutable policy rules. Does not change authority, agent, policy_id, or spend_mint.
///
/// # Security
/// - Only `policy.authority` may call.
/// - PDA seeds + `has_one` bind the account to the signer.
/// - List/window validation re-run on every update.
pub fn update_policy_handler(ctx: Context<UpdatePolicy>, params: UpdatePolicyParams) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    Policy::validate_lists_and_windows(
        params.program_allowlist_enabled,
        &params.program_allowlist,
        params.program_denylist_enabled,
        &params.program_denylist,
        params.mint_allowlist_enabled,
        &params.mint_allowlist,
        params.destination_allowlist_enabled,
        &params.destination_allowlist,
        params.max_actions_per_window,
        params.window_seconds,
        params.expires_at,
        now,
    )?;

    let policy = &mut ctx.accounts.policy;
    policy.expires_at = params.expires_at;
    policy.max_per_transaction = params.max_per_transaction;
    policy.max_per_day = params.max_per_day;
    policy.max_actions_per_window = params.max_actions_per_window;
    policy.window_seconds = params.window_seconds;
    policy.program_allowlist_enabled = params.program_allowlist_enabled;
    policy.program_allowlist = params.program_allowlist;
    policy.program_denylist_enabled = params.program_denylist_enabled;
    policy.program_denylist = params.program_denylist;
    policy.mint_allowlist_enabled = params.mint_allowlist_enabled;
    policy.mint_allowlist = params.mint_allowlist;
    policy.destination_allowlist_enabled = params.destination_allowlist_enabled;
    policy.destination_allowlist = params.destination_allowlist;

    emit!(PolicyUpdated {
        policy: policy.key(),
        authority: policy.authority,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdatePolicy<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [
            POLICY_SEED,
            policy.authority.as_ref(),
            &policy.policy_id.to_le_bytes(),
        ],
        bump = policy.bump,
        has_one = authority @ PolicyKitError::UnauthorizedAuthority,
    )]
    pub policy: Account<'info, Policy>,
}
