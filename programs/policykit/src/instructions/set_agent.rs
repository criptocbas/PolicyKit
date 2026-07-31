use anchor_lang::prelude::*;

use crate::constants::POLICY_SEED;
use crate::error::PolicyKitError;
use crate::events::AgentUpdated;
use crate::state::Policy;

/// Rotate the agent hot key authorized to `execute_spend`.
///
/// # Security
/// - Only `policy.authority` may rotate the agent.
/// - Immediate effect: old agent can no longer spend.
pub fn set_agent_handler(ctx: Context<SetAgent>, new_agent: Pubkey) -> Result<()> {
    require!(new_agent != Pubkey::default(), PolicyKitError::InvalidAgent);

    let policy = &mut ctx.accounts.policy;
    let old_agent = policy.agent;
    policy.agent = new_agent;

    emit!(AgentUpdated {
        policy: policy.key(),
        authority: policy.authority,
        old_agent,
        new_agent,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct SetAgent<'info> {
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
