use anchor_lang::prelude::*;

use crate::constants::POLICY_SEED;
use crate::error::PolicyKitError;
use crate::events::SpendExecuted;
use crate::state::Policy;
use crate::token_utils::{self, load_token_account};

/// Agent-initiated spend under full policy enforcement.
///
/// Transfers `amount` of `mint` from the policy vault to `destination_token`
/// only after all rules pass. Updates spend / rate counters.
///
/// # Security
/// - Signer must be `policy.agent` (`has_one`).
/// - Checks: pause, expiry, program allow/deny (`intent_program`), mint allowlist,
///   rate limit, per-tx + daily spend limits (for `spend_mint`).
/// - Vault token authority constrained to policy PDA; transfer signed with PDA seeds.
/// - Destination mint must match; destination owner is unrestricted so agents can
///   pay APIs / routers — economic risk is bounded by spend caps + mint list.
///
/// # Intent program
/// Clients (Agent Kit plugin) must pass the program the agent intends to interact
/// with. See `docs/PROGRAM_DESIGN.md` for the security model and limitations.
pub fn execute_spend_handler(
    ctx: Context<ExecuteSpend>,
    amount: u64,
    intent_program: Pubkey,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let mint_key = ctx.accounts.mint.key();

    let vault = load_token_account(
        &ctx.accounts.vault_token.to_account_info(),
        &mint_key,
        Some(&ctx.accounts.policy.key()),
    )?;
    // Destination must be same mint; owner unrestricted (see security note).
    load_token_account(
        &ctx.accounts.destination_token.to_account_info(),
        &mint_key,
        None,
    )?;

    // Enforce + record before CPI so failed checks never move funds.
    ctx.accounts
        .policy
        .check_and_record_spend(amount, &mint_key, &intent_program, now)?;

    require!(
        vault.amount >= amount,
        PolicyKitError::InsufficientVaultBalance
    );

    let policy = &ctx.accounts.policy;
    let authority_key = policy.authority;
    let policy_id_bytes = policy.policy_id.to_le_bytes();
    let bump = policy.bump;
    let remaining_daily = policy.remaining_daily();
    let actions_in_window = policy.actions_in_window;

    let seeds: &[&[u8]] = &[
        POLICY_SEED,
        authority_key.as_ref(),
        policy_id_bytes.as_ref(),
        &[bump],
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

    emit!(SpendExecuted {
        policy: ctx.accounts.policy.key(),
        agent: ctx.accounts.agent.key(),
        mint: mint_key,
        amount,
        intent_program,
        remaining_daily,
        actions_in_window,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ExecuteSpend<'info> {
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [
            POLICY_SEED,
            policy.authority.as_ref(),
            &policy.policy_id.to_le_bytes(),
        ],
        bump = policy.bump,
        has_one = agent @ PolicyKitError::UnauthorizedAgent,
    )]
    pub policy: Account<'info, Policy>,

    /// CHECK: owner must be SPL Token program.
    #[account(owner = spl_token::ID)]
    pub mint: UncheckedAccount<'info>,

    /// CHECK: vault; validated in handler.
    #[account(mut)]
    pub vault_token: UncheckedAccount<'info>,

    /// CHECK: destination; same mint verified in handler.
    #[account(mut)]
    pub destination_token: UncheckedAccount<'info>,

    /// CHECK: classic SPL Token program.
    #[account(address = spl_token::ID)]
    pub token_program: UncheckedAccount<'info>,
}
