use anchor_lang::prelude::*;

use crate::constants::POLICY_SEED;
use crate::error::PolicyKitError;
use crate::events::PolicyCreated;
use crate::state::{CreatePolicyParams, Policy};

/// Create a new policy PDA under `authority` with the given `policy_id`.
///
/// # Security
/// - `authority` is the sole creator and stored owner (must sign).
/// - PDA seeds bind policy to `(authority, policy_id)` — no shared vaults.
/// - `init` prevents reinitialization.
/// - Agent must not be the default pubkey (same rule as `set_agent`).
/// - Params validated (list sizes, rate window, expiry).
pub fn create_policy_handler(
    ctx: Context<CreatePolicy>,
    policy_id: u64,
    params: CreatePolicyParams,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(
        params.agent != Pubkey::default(),
        PolicyKitError::InvalidAgent
    );

    Policy::validate_lists_and_windows(
        params.program_allowlist_enabled,
        &params.program_allowlist,
        params.program_denylist_enabled,
        &params.program_denylist,
        params.mint_allowlist_enabled,
        &params.mint_allowlist,
        params.max_actions_per_window,
        params.window_seconds,
        params.expires_at,
        now,
    )?;

    let policy = &mut ctx.accounts.policy;
    policy.authority = ctx.accounts.authority.key();
    policy.agent = params.agent;
    policy.policy_id = policy_id;
    policy.bump = ctx.bumps.policy;
    policy.paused = false;
    policy.created_at = now;
    policy.expires_at = params.expires_at;
    policy.spend_mint = params.spend_mint;
    policy.max_per_transaction = params.max_per_transaction;
    policy.max_per_day = params.max_per_day;
    policy.spent_today = 0;
    policy.day_start_ts = now;
    policy.total_spent = 0;
    policy.max_actions_per_window = params.max_actions_per_window;
    policy.window_seconds = params.window_seconds;
    policy.actions_in_window = 0;
    policy.window_start_ts = now;
    policy.program_allowlist_enabled = params.program_allowlist_enabled;
    policy.program_allowlist = params.program_allowlist;
    policy.program_denylist_enabled = params.program_denylist_enabled;
    policy.program_denylist = params.program_denylist;
    policy.mint_allowlist_enabled = params.mint_allowlist_enabled;
    policy.mint_allowlist = params.mint_allowlist;

    emit!(PolicyCreated {
        policy: policy.key(),
        authority: policy.authority,
        agent: policy.agent,
        policy_id,
        spend_mint: policy.spend_mint,
        expires_at: policy.expires_at,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(policy_id: u64)]
pub struct CreatePolicy<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Policy::INIT_SPACE,
        seeds = [
            POLICY_SEED,
            authority.key().as_ref(),
            &policy_id.to_le_bytes(),
        ],
        bump
    )]
    pub policy: Account<'info, Policy>,

    pub system_program: Program<'info, System>,
}
