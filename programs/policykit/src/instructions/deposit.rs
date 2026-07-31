use anchor_lang::prelude::*;

use crate::constants::POLICY_SEED;
use crate::error::PolicyKitError;
use crate::events::DepositReceived;
use crate::state::Policy;
use crate::token_utils::{self, load_token_account};

/// Deposit tokens into the policy vault token account.
///
/// Anyone may fund a policy (useful for demos and third-party funding).
/// The vault token account must already exist with `authority = policy PDA`
/// (create the ATA client-side before the first deposit).
///
/// # Security
/// - Vault token authority is constrained to the policy PDA.
/// - Transfer is pull-from-depositor; depositor must sign and own `depositor_token`.
/// - Does not grant the depositor any control over the policy.
pub fn deposit_handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, PolicyKitError::ZeroAmount);

    let mint_key = ctx.accounts.mint.key();
    load_token_account(
        &ctx.accounts.depositor_token.to_account_info(),
        &mint_key,
        Some(&ctx.accounts.depositor.key()),
    )?;
    load_token_account(
        &ctx.accounts.vault_token.to_account_info(),
        &mint_key,
        Some(&ctx.accounts.policy.key()),
    )?;

    token_utils::transfer(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.depositor_token.to_account_info(),
        ctx.accounts.vault_token.to_account_info(),
        ctx.accounts.depositor.to_account_info(),
        amount,
    )?;

    emit!(DepositReceived {
        policy: ctx.accounts.policy.key(),
        depositor: ctx.accounts.depositor.key(),
        mint: mint_key,
        amount,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub depositor: Signer<'info>,

    #[account(
        seeds = [
            POLICY_SEED,
            policy.authority.as_ref(),
            &policy.policy_id.to_le_bytes(),
        ],
        bump = policy.bump,
    )]
    pub policy: Account<'info, Policy>,

    /// CHECK: mint validated via SPL pack in handler / owner = token program.
    #[account(owner = spl_token::ID)]
    pub mint: UncheckedAccount<'info>,

    /// CHECK: token account; mint + depositor ownership verified in handler.
    #[account(mut)]
    pub depositor_token: UncheckedAccount<'info>,

    /// CHECK: vault token account; mint + policy ownership verified in handler.
    #[account(mut)]
    pub vault_token: UncheckedAccount<'info>,

    /// CHECK: must be the classic SPL Token program.
    #[account(address = spl_token::ID)]
    pub token_program: UncheckedAccount<'info>,
}
