use anchor_lang::prelude::*;

use crate::constants::POLICY_SEED;
use crate::error::PolicyKitError;
use crate::events::ClawbackExecuted;
use crate::state::Policy;
use crate::token_utils::{self, load_token_account};

/// Authority withdraws tokens from the vault. Works even when paused.
///
/// # Security
/// - Only `policy.authority` may clawback.
/// - Vault must be a token account of `mint` with authority = policy PDA.
/// - PDA signs the transfer; authority cannot be spoofed via fake vault.
/// - Destination token account must be owned by authority.
pub fn clawback_handler(ctx: Context<Clawback>, amount: u64) -> Result<()> {
    require!(amount > 0, PolicyKitError::ZeroAmount);

    let mint_key = ctx.accounts.mint.key();
    let vault = load_token_account(
        &ctx.accounts.vault_token.to_account_info(),
        &mint_key,
        Some(&ctx.accounts.policy.key()),
    )?;
    require!(
        vault.amount >= amount,
        PolicyKitError::InsufficientVaultBalance
    );
    load_token_account(
        &ctx.accounts.destination_token.to_account_info(),
        &mint_key,
        Some(&ctx.accounts.authority.key()),
    )?;

    let policy = &ctx.accounts.policy;
    let authority_key = policy.authority;
    let policy_id_bytes = policy.policy_id.to_le_bytes();
    let seeds: &[&[u8]] = &[
        POLICY_SEED,
        authority_key.as_ref(),
        policy_id_bytes.as_ref(),
        &[policy.bump],
    ];
    let signer = &[seeds];

    token_utils::transfer_signed(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.vault_token.to_account_info(),
        ctx.accounts.destination_token.to_account_info(),
        ctx.accounts.policy.to_account_info(),
        amount,
        signer,
    )?;

    emit!(ClawbackExecuted {
        policy: ctx.accounts.policy.key(),
        authority: ctx.accounts.authority.key(),
        mint: mint_key,
        amount,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct Clawback<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [
            POLICY_SEED,
            policy.authority.as_ref(),
            &policy.policy_id.to_le_bytes(),
        ],
        bump = policy.bump,
        has_one = authority @ PolicyKitError::UnauthorizedAuthority,
    )]
    pub policy: Account<'info, Policy>,

    /// CHECK: owner must be SPL Token program.
    #[account(owner = spl_token::ID)]
    pub mint: UncheckedAccount<'info>,

    /// CHECK: vault; validated in handler.
    #[account(mut)]
    pub vault_token: UncheckedAccount<'info>,

    /// CHECK: destination; validated in handler.
    #[account(mut)]
    pub destination_token: UncheckedAccount<'info>,

    /// CHECK: classic SPL Token program.
    #[account(address = spl_token::ID)]
    pub token_program: UncheckedAccount<'info>,
}
