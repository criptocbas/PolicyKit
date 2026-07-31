use anchor_lang::prelude::*;

#[event]
pub struct PolicyCreated {
    pub policy: Pubkey,
    pub authority: Pubkey,
    pub agent: Pubkey,
    pub policy_id: u64,
    pub spend_mint: Pubkey,
    pub expires_at: i64,
}

#[event]
pub struct PolicyUpdated {
    pub policy: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct AgentUpdated {
    pub policy: Pubkey,
    pub authority: Pubkey,
    pub old_agent: Pubkey,
    pub new_agent: Pubkey,
}

#[event]
pub struct PolicyPausedEvent {
    pub policy: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct PolicyUnpausedEvent {
    pub policy: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct DepositReceived {
    pub policy: Pubkey,
    pub depositor: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ClawbackExecuted {
    pub policy: Pubkey,
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
}

#[event]
pub struct SpendExecuted {
    pub policy: Pubkey,
    pub agent: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub intent_program: Pubkey,
    /// Remaining daily budget for spend_mint; u64::MAX if unlimited or non-spend mint.
    pub remaining_daily: u64,
    pub actions_in_window: u32,
}
