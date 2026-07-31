#![allow(unexpected_cfgs)]
//! PolicyKit — open Solana-native on-chain policy engine for AI agents.
//!
//! Humans/protocols create a Policy PDA. Agents may only move vault funds via
//! `execute_spend`, which enforces spend limits, program allow/deny lists,
//! mint allowlists, rate limits, expiry, and pause. Authority always retains
//! pause + clawback.
//!
//! See `docs/PROGRAM_DESIGN.md` for the full security model.

use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;
pub mod token_utils;

use instructions::*;
use state::{CreatePolicyParams, UpdatePolicyParams};

declare_id!("4KSYqUXxHrgMyyAnF56Gwir44Gt9NB49gE43pkPvCYeu");

#[program]
pub mod policykit {
    use super::*;

    /// Initialize a new policy PDA.
    ///
    /// Security: `authority` signs and becomes the immutable owner encoded in
    /// PDA seeds. Reinitialization is prevented by `init`.
    pub fn create_policy(
        ctx: Context<CreatePolicy>,
        policy_id: u64,
        params: CreatePolicyParams,
    ) -> Result<()> {
        create_policy_handler(ctx, policy_id, params)
    }

    /// Update mutable rules (limits, lists, expiry). Not authority/agent/spend_mint.
    ///
    /// Security: authority signer + PDA seeds + has_one.
    pub fn update_policy(ctx: Context<UpdatePolicy>, params: UpdatePolicyParams) -> Result<()> {
        update_policy_handler(ctx, params)
    }

    /// Rotate the agent hot key.
    ///
    /// Security: authority only; old agent loses spend rights immediately.
    pub fn set_agent(ctx: Context<SetAgent>, new_agent: Pubkey) -> Result<()> {
        set_agent_handler(ctx, new_agent)
    }

    /// Freeze spends. Clawback still works.
    pub fn pause_policy(ctx: Context<PausePolicy>) -> Result<()> {
        pause_policy_handler(ctx)
    }

    /// Resume spends after pause.
    pub fn unpause_policy(ctx: Context<UnpausePolicy>) -> Result<()> {
        unpause_policy_handler(ctx)
    }

    /// Fund the policy vault (anyone may deposit).
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        deposit_handler(ctx, amount)
    }

    /// Authority withdraws from the vault (works while paused).
    pub fn clawback(ctx: Context<Clawback>, amount: u64) -> Result<()> {
        clawback_handler(ctx, amount)
    }

    /// Agent spend under full policy enforcement.
    ///
    /// `intent_program` is checked against allow/deny lists. See program design docs.
    pub fn execute_spend(
        ctx: Context<ExecuteSpend>,
        amount: u64,
        intent_program: Pubkey,
    ) -> Result<()> {
        execute_spend_handler(ctx, amount, intent_program)
    }
}
