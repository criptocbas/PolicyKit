//! SPL Token helpers without `anchor-spl` (toolchain / IDL compatibility).

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::{invoke, invoke_signed};
use anchor_lang::solana_program::program_pack::Pack;
use spl_token::state::{Account as SplTokenAccount, Mint as SplMint};

use crate::error::PolicyKitError;

/// SPL Token program id (classic token program).
pub fn token_program_id() -> Pubkey {
    spl_token::ID
}

/// Deserialize and validate a classic SPL token account.
pub fn load_token_account(
    info: &AccountInfo,
    expected_mint: &Pubkey,
    expected_owner: Option<&Pubkey>,
) -> Result<SplTokenAccount> {
    require_keys_eq!(
        *info.owner,
        spl_token::ID,
        PolicyKitError::MintMismatch
    );
    let account = SplTokenAccount::unpack(&info.try_borrow_data()?)
        .map_err(|_| error!(PolicyKitError::MintMismatch))?;
    require_keys_eq!(account.mint, *expected_mint, PolicyKitError::MintMismatch);
    if let Some(owner) = expected_owner {
        require_keys_eq!(account.owner, *owner, PolicyKitError::InvalidVaultAuthority);
    }
    Ok(account)
}

/// Deserialize and validate a classic SPL mint account.
pub fn load_mint(info: &AccountInfo) -> Result<SplMint> {
    require_keys_eq!(*info.owner, spl_token::ID, PolicyKitError::MintMismatch);
    SplMint::unpack(&info.try_borrow_data()?)
        .map_err(|_| error!(PolicyKitError::MintMismatch))
}

/// SPL Token `Transfer` (instruction index 3).
pub fn transfer<'info>(
    token_program: AccountInfo<'info>,
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    require_keys_eq!(*token_program.key, spl_token::ID, PolicyKitError::MintMismatch);
    let ix = spl_token::instruction::transfer(
        token_program.key,
        from.key,
        to.key,
        authority.key,
        &[],
        amount,
    )
    .map_err(|_| error!(PolicyKitError::MintMismatch))?;
    invoke(&ix, &[from, to, authority, token_program])?;
    Ok(())
}

/// PDA-signed SPL Token `Transfer`.
pub fn transfer_signed<'info>(
    token_program: AccountInfo<'info>,
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    amount: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    require_keys_eq!(*token_program.key, spl_token::ID, PolicyKitError::MintMismatch);
    let ix = spl_token::instruction::transfer(
        token_program.key,
        from.key,
        to.key,
        authority.key,
        &[],
        amount,
    )
    .map_err(|_| error!(PolicyKitError::MintMismatch))?;
    invoke_signed(&ix, &[from, to, authority, token_program], signer_seeds)?;
    Ok(())
}
