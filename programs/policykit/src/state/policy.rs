use anchor_lang::prelude::*;

use crate::constants::{MAX_DESTINATION_LIST, MAX_MINT_LIST, MAX_PROGRAM_LIST, SECONDS_PER_DAY};
use crate::error::PolicyKitError;

/// On-chain policy: rules, counters, and vault authority.
///
/// PDA seeds: `["policy", authority, policy_id.to_le_bytes()]`
///
/// Security model:
/// - Token vault ATAs use this PDA as authority.
/// - Only `execute_spend` (agent) and `clawback` (authority) move funds out.
/// - All limit / allowlist checks run before any transfer CPI.
#[account]
#[derive(InitSpace)]
pub struct Policy {
    /// Human or protocol that can update, pause, clawback, rotate agent.
    pub authority: Pubkey,
    /// Hot key authorized to call `execute_spend`.
    pub agent: Pubkey,
    /// Unique id under `authority` (PDA seed).
    pub policy_id: u64,
    /// Canonical bump for the policy PDA.
    pub bump: u8,

    /// When true, `execute_spend` always fails.
    pub paused: bool,

    pub created_at: i64,
    /// Unix timestamp after which spends fail. `0` = never expires.
    pub expires_at: i64,

    /// Mint used for spend accounting (immutable after create).
    pub spend_mint: Pubkey,
    /// Max amount of `spend_mint` per single spend. `0` = unlimited.
    pub max_per_transaction: u64,
    /// Max amount of `spend_mint` per day window. `0` = unlimited.
    pub max_per_day: u64,
    /// Amount of `spend_mint` spent in the current day window.
    pub spent_today: u64,
    /// Start of the current day accounting window.
    pub day_start_ts: i64,
    /// Lifetime `spend_mint` spent through this policy.
    pub total_spent: u64,

    /// Max actions per rate window. `0` = unlimited.
    pub max_actions_per_window: u32,
    /// Rate window length in seconds. Required `> 0` if rate limit enabled.
    pub window_seconds: u32,
    /// Actions recorded in the current rate window.
    pub actions_in_window: u32,
    /// Start of the current rate window.
    pub window_start_ts: i64,

    pub program_allowlist_enabled: bool,
    #[max_len(MAX_PROGRAM_LIST)]
    pub program_allowlist: Vec<Pubkey>,

    pub program_denylist_enabled: bool,
    #[max_len(MAX_PROGRAM_LIST)]
    pub program_denylist: Vec<Pubkey>,

    pub mint_allowlist_enabled: bool,
    #[max_len(MAX_MINT_LIST)]
    pub mint_allowlist: Vec<Pubkey>,

    /// When true, destination token account **owner** must be listed.
    pub destination_allowlist_enabled: bool,
    #[max_len(MAX_DESTINATION_LIST)]
    pub destination_allowlist: Vec<Pubkey>,
}

/// Parameters for creating a policy.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CreatePolicyParams {
    pub agent: Pubkey,
    /// `0` = never expires.
    pub expires_at: i64,
    pub spend_mint: Pubkey,
    pub max_per_transaction: u64,
    pub max_per_day: u64,
    pub max_actions_per_window: u32,
    pub window_seconds: u32,
    pub program_allowlist_enabled: bool,
    pub program_allowlist: Vec<Pubkey>,
    pub program_denylist_enabled: bool,
    pub program_denylist: Vec<Pubkey>,
    pub mint_allowlist_enabled: bool,
    pub mint_allowlist: Vec<Pubkey>,
    pub destination_allowlist_enabled: bool,
    pub destination_allowlist: Vec<Pubkey>,
}

/// Parameters for updating mutable policy rules (not authority, agent, id, spend_mint).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct UpdatePolicyParams {
    /// `0` = never expires.
    pub expires_at: i64,
    pub max_per_transaction: u64,
    pub max_per_day: u64,
    pub max_actions_per_window: u32,
    pub window_seconds: u32,
    pub program_allowlist_enabled: bool,
    pub program_allowlist: Vec<Pubkey>,
    pub program_denylist_enabled: bool,
    pub program_denylist: Vec<Pubkey>,
    pub mint_allowlist_enabled: bool,
    pub mint_allowlist: Vec<Pubkey>,
    pub destination_allowlist_enabled: bool,
    pub destination_allowlist: Vec<Pubkey>,
}

impl Policy {
    /// Validate list lengths and rate/expiry invariants shared by create + update.
    pub fn validate_lists_and_windows(
        program_allowlist_enabled: bool,
        program_allowlist: &[Pubkey],
        program_denylist_enabled: bool,
        program_denylist: &[Pubkey],
        mint_allowlist_enabled: bool,
        mint_allowlist: &[Pubkey],
        destination_allowlist_enabled: bool,
        destination_allowlist: &[Pubkey],
        max_actions_per_window: u32,
        window_seconds: u32,
        expires_at: i64,
        now: i64,
    ) -> Result<()> {
        require!(
            program_allowlist.len() <= MAX_PROGRAM_LIST,
            PolicyKitError::ProgramListTooLong
        );
        require!(
            program_denylist.len() <= MAX_PROGRAM_LIST,
            PolicyKitError::ProgramListTooLong
        );
        require!(
            mint_allowlist.len() <= MAX_MINT_LIST,
            PolicyKitError::MintListTooLong
        );
        require!(
            destination_allowlist.len() <= MAX_DESTINATION_LIST,
            PolicyKitError::DestinationListTooLong
        );
        require!(
            !program_allowlist_enabled || !program_allowlist.is_empty(),
            PolicyKitError::EmptyProgramAllowlist
        );
        require!(
            !mint_allowlist_enabled || !mint_allowlist.is_empty(),
            PolicyKitError::EmptyMintAllowlist
        );
        require!(
            !destination_allowlist_enabled || !destination_allowlist.is_empty(),
            PolicyKitError::EmptyDestinationAllowlist
        );
        // Denylist may be empty even when "enabled" (no-op); still require valid rate window.
        let _ = program_denylist_enabled;

        require!(
            max_actions_per_window == 0 || window_seconds > 0,
            PolicyKitError::InvalidRateWindow
        );
        require!(
            expires_at == 0 || expires_at > now,
            PolicyKitError::InvalidExpiry
        );
        Ok(())
    }

    pub fn assert_active(&self, now: i64) -> Result<()> {
        require!(!self.paused, PolicyKitError::PolicyPaused);
        require!(
            self.expires_at == 0 || now < self.expires_at,
            PolicyKitError::PolicyExpired
        );
        Ok(())
    }

    /// Reset day / rate counters when their windows have elapsed.
    pub fn refresh_windows(&mut self, now: i64) {
        // Daily spend window (fixed 86400s buckets aligned from day_start_ts).
        if now >= self.day_start_ts.saturating_add(SECONDS_PER_DAY) {
            let elapsed = now.saturating_sub(self.day_start_ts);
            let periods = elapsed / SECONDS_PER_DAY;
            self.day_start_ts = self
                .day_start_ts
                .saturating_add(periods.saturating_mul(SECONDS_PER_DAY));
            self.spent_today = 0;
        }

        // Rate-limit window (sliding from last window start).
        if self.window_seconds > 0 {
            let window = self.window_seconds as i64;
            if now >= self.window_start_ts.saturating_add(window) {
                self.window_start_ts = now;
                self.actions_in_window = 0;
            }
        }
    }

    /// Remaining daily budget for `spend_mint`. `u64::MAX` if unlimited.
    pub fn remaining_daily(&self) -> u64 {
        if self.max_per_day == 0 {
            u64::MAX
        } else {
            self.max_per_day.saturating_sub(self.spent_today)
        }
    }

    /// Full enforcement path for `execute_spend`. Mutates counters on success.
    ///
    /// Order: active → windows → spend_mint → program lists → mint list →
    /// destination owner allowlist → rate → spend limits → record.
    pub fn check_and_record_spend(
        &mut self,
        amount: u64,
        mint: &Pubkey,
        intent_program: &Pubkey,
        destination_owner: &Pubkey,
        now: i64,
    ) -> Result<()> {
        require!(amount > 0, PolicyKitError::ZeroAmount);
        self.assert_active(now)?;
        self.refresh_windows(now);

        // MVP: only spend_mint may leave the vault via execute_spend.
        // Prevents bypassing per-tx/daily caps with other vault mints.
        require_keys_eq!(*mint, self.spend_mint, PolicyKitError::SpendMintRequired);

        if self.program_allowlist_enabled {
            require!(
                self.program_allowlist.iter().any(|p| p == intent_program),
                PolicyKitError::ProgramNotAllowed
            );
        }
        if self.program_denylist_enabled {
            require!(
                !self.program_denylist.iter().any(|p| p == intent_program),
                PolicyKitError::ProgramDenied
            );
        }

        if self.mint_allowlist_enabled {
            require!(
                self.mint_allowlist.iter().any(|m| m == mint),
                PolicyKitError::MintNotAllowed
            );
        }

        if self.destination_allowlist_enabled {
            require!(
                self.destination_allowlist
                    .iter()
                    .any(|d| d == destination_owner),
                PolicyKitError::DestinationNotAllowed
            );
        }

        if self.max_actions_per_window > 0 {
            require!(
                self.actions_in_window < self.max_actions_per_window,
                PolicyKitError::RateLimitExceeded
            );
        }

        // Economic caps (always on spend_mint after the require above).
        if self.max_per_transaction > 0 {
            require!(
                amount <= self.max_per_transaction,
                PolicyKitError::ExceedsPerTransactionLimit
            );
        }
        if self.max_per_day > 0 {
            let new_spent = self
                .spent_today
                .checked_add(amount)
                .ok_or(PolicyKitError::Overflow)?;
            require!(
                new_spent <= self.max_per_day,
                PolicyKitError::ExceedsDailyLimit
            );
            self.spent_today = new_spent;
        } else {
            self.spent_today = self.spent_today.saturating_add(amount);
        }
        self.total_spent = self
            .total_spent
            .checked_add(amount)
            .ok_or(PolicyKitError::Overflow)?;

        self.actions_in_window = self
            .actions_in_window
            .checked_add(1)
            .ok_or(PolicyKitError::Overflow)?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_700_000_000;

    fn test_policy() -> Policy {
        let spend_mint = Pubkey::new_unique();
        Policy {
            authority: Pubkey::new_unique(),
            agent: Pubkey::new_unique(),
            policy_id: 1,
            bump: 255,
            paused: false,
            created_at: NOW,
            expires_at: NOW + SECONDS_PER_DAY,
            spend_mint,
            max_per_transaction: 20,
            max_per_day: 50,
            spent_today: 10,
            day_start_ts: NOW,
            total_spent: 10,
            max_actions_per_window: 5,
            window_seconds: 60,
            actions_in_window: 1,
            window_start_ts: NOW,
            program_allowlist_enabled: true,
            program_allowlist: vec![Pubkey::new_unique()],
            program_denylist_enabled: false,
            program_denylist: vec![],
            mint_allowlist_enabled: true,
            mint_allowlist: vec![spend_mint],
            destination_allowlist_enabled: true,
            destination_allowlist: vec![Pubkey::new_unique()],
        }
    }

    fn allowed_values(policy: &Policy) -> (Pubkey, Pubkey, Pubkey) {
        (
            policy.spend_mint,
            policy.program_allowlist[0],
            policy.destination_allowlist[0],
        )
    }

    #[test]
    fn exact_limits_succeed_and_record_once() {
        let mut policy = test_policy();
        policy.spent_today = 30;
        let (mint, intent, destination) = allowed_values(&policy);

        policy
            .check_and_record_spend(20, &mint, &intent, &destination, NOW)
            .unwrap();

        assert_eq!(policy.spent_today, 50);
        assert_eq!(policy.total_spent, 30);
        assert_eq!(policy.actions_in_window, 2);
        assert_eq!(policy.remaining_daily(), 0);
    }

    #[test]
    fn day_and_rate_boundaries_reset_before_recording() {
        let mut policy = test_policy();
        policy.spent_today = policy.max_per_day;
        policy.actions_in_window = policy.max_actions_per_window;
        let (mint, intent, destination) = allowed_values(&policy);

        policy
            .check_and_record_spend(1, &mint, &intent, &destination, NOW + SECONDS_PER_DAY)
            .unwrap();

        assert_eq!(policy.spent_today, 1);
        assert_eq!(policy.actions_in_window, 1);
        assert_eq!(policy.day_start_ts, NOW + SECONDS_PER_DAY);
        assert_eq!(policy.window_start_ts, NOW + SECONDS_PER_DAY);
    }

    #[test]
    fn multi_day_refresh_preserves_bucket_alignment() {
        let mut policy = test_policy();
        policy.refresh_windows(NOW + 3 * SECONDS_PER_DAY + 17);

        assert_eq!(policy.day_start_ts, NOW + 3 * SECONDS_PER_DAY);
        assert_eq!(policy.spent_today, 0);
        assert_eq!(policy.window_start_ts, NOW + 3 * SECONDS_PER_DAY + 17);
        assert_eq!(policy.actions_in_window, 0);
    }

    #[test]
    fn rejected_rule_checks_do_not_record_spend_counters() {
        let base = test_policy();
        let (mint, intent, destination) = allowed_values(&base);
        let cases = [
            (0, mint, intent, destination),
            (21, mint, intent, destination),
            (1, Pubkey::new_unique(), intent, destination),
            (1, mint, Pubkey::new_unique(), destination),
            (1, mint, intent, Pubkey::new_unique()),
        ];

        for (amount, case_mint, case_intent, case_destination) in cases {
            let mut policy = test_policy();
            // Use the same allowlisted values from this fresh policy except for
            // the field intentionally changed by the matrix case.
            let own = allowed_values(&policy);
            let resolved_mint = if case_mint == mint { own.0 } else { case_mint };
            let resolved_intent = if case_intent == intent {
                own.1
            } else {
                case_intent
            };
            let resolved_destination = if case_destination == destination {
                own.2
            } else {
                case_destination
            };
            let before = (
                policy.spent_today,
                policy.total_spent,
                policy.actions_in_window,
            );

            assert!(policy
                .check_and_record_spend(
                    amount,
                    &resolved_mint,
                    &resolved_intent,
                    &resolved_destination,
                    NOW,
                )
                .is_err());
            assert_eq!(
                (
                    policy.spent_today,
                    policy.total_spent,
                    policy.actions_in_window,
                ),
                before
            );
        }
    }

    #[test]
    fn rate_and_daily_rejections_do_not_record() {
        let mut rate_limited = test_policy();
        rate_limited.actions_in_window = rate_limited.max_actions_per_window;
        let (mint, intent, destination) = allowed_values(&rate_limited);
        assert!(rate_limited
            .check_and_record_spend(1, &mint, &intent, &destination, NOW)
            .is_err());
        assert_eq!(rate_limited.total_spent, 10);

        let mut daily_limited = test_policy();
        daily_limited.spent_today = daily_limited.max_per_day;
        let (mint, intent, destination) = allowed_values(&daily_limited);
        assert!(daily_limited
            .check_and_record_spend(1, &mint, &intent, &destination, NOW)
            .is_err());
        assert_eq!(daily_limited.total_spent, 10);
        assert_eq!(daily_limited.actions_in_window, 1);
    }

    #[test]
    fn lifetime_counter_overflow_fails_cleanly() {
        let mut policy = test_policy();
        policy.total_spent = u64::MAX;
        let (mint, intent, destination) = allowed_values(&policy);

        assert!(policy
            .check_and_record_spend(1, &mint, &intent, &destination, NOW)
            .is_err());
    }

    #[test]
    fn timestamp_saturation_never_panics() {
        let mut policy = test_policy();
        policy.day_start_ts = i64::MAX - 1;
        policy.window_start_ts = i64::MAX - 1;
        policy.refresh_windows(i64::MAX);

        assert_eq!(policy.day_start_ts, i64::MAX - 1);
        assert_eq!(policy.window_start_ts, i64::MAX - 1);
    }
}
