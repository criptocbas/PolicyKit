/// PDA seed prefix for Policy accounts.
pub const POLICY_SEED: &[u8] = b"policy";

/// Maximum program IDs on allow or deny lists.
pub const MAX_PROGRAM_LIST: usize = 10;

/// Maximum mints on the mint allowlist.
pub const MAX_MINT_LIST: usize = 10;

/// Maximum destination owners on the destination allowlist.
pub const MAX_DESTINATION_LIST: usize = 10;

/// Day window length for daily spend accounting (seconds).
pub const SECONDS_PER_DAY: i64 = 86_400;
