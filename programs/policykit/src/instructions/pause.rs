use anchor_lang::prelude::*;

use crate::constants::POLICY_SEED;
use crate::error::PolicyKitError;
use crate::events::{PolicyPausedEvent, PolicyUnpausedEvent};
use crate::state::Policy;

/// Freeze all `execute_spend` calls. Authority retains clawback.
///
/// # Security
/// - Only `policy.authority` may pause.
pub fn pause_policy_handler(ctx: Context<PausePolicy>) -> Result<()> {
    let policy = &mut ctx.accounts.policy;
    policy.paused = true;

    emit!(PolicyPausedEvent {
        policy: policy.key(),
        authority: policy.authority,
    });

    Ok(())
}

/// Resume spends after pause.
///
/// # Security
/// - Only `policy.authority` may unpause.
pub fn unpause_policy_handler(ctx: Context<UnpausePolicy>) -> Result<()> {
    let policy = &mut ctx.accounts.policy;
    policy.paused = false;

    emit!(PolicyUnpausedEvent {
        policy: policy.key(),
        authority: policy.authority,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct PausePolicy<'info> {
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

#[derive(Accounts)]
pub struct UnpausePolicy<'info> {
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
