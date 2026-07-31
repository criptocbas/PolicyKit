use anchor_lang::prelude::*;

#[error_code]
pub enum PolicyKitError {
    #[msg("Policy is paused")]
    PolicyPaused,

    #[msg("Policy has expired")]
    PolicyExpired,

    #[msg("Signer is not the policy authority")]
    UnauthorizedAuthority,

    #[msg("Signer is not the policy agent")]
    UnauthorizedAgent,

    #[msg("Amount exceeds per-transaction spend limit")]
    ExceedsPerTransactionLimit,

    #[msg("Amount would exceed daily spend limit")]
    ExceedsDailyLimit,

    #[msg("Rate limit exceeded for this time window")]
    RateLimitExceeded,

    #[msg("Intent program is not on the allowlist")]
    ProgramNotAllowed,

    #[msg("Intent program is on the denylist")]
    ProgramDenied,

    #[msg("Mint is not on the allowlist")]
    MintNotAllowed,

    #[msg("Transfer amount must be greater than zero")]
    ZeroAmount,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Program list exceeds maximum length")]
    ProgramListTooLong,

    #[msg("Mint list exceeds maximum length")]
    MintListTooLong,

    #[msg("Program allowlist enabled but empty")]
    EmptyProgramAllowlist,

    #[msg("Mint allowlist enabled but empty")]
    EmptyMintAllowlist,

    #[msg("Rate limit requires window_seconds > 0")]
    InvalidRateWindow,

    #[msg("expires_at must be 0 (never) or in the future")]
    InvalidExpiry,

    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,

    #[msg("Token account mint mismatch")]
    MintMismatch,

    #[msg("Vault token account authority must be the policy PDA")]
    InvalidVaultAuthority,

    /// MVP: execute_spend may only move `spend_mint` (closes multi-mint cap bypass).
    #[msg("Only the policy spend_mint may be transferred via execute_spend")]
    SpendMintRequired,

    #[msg("Agent pubkey must not be the default public key")]
    InvalidAgent,

    #[msg("Destination token account must not be owned by the policy PDA")]
    InvalidDestination,
}
