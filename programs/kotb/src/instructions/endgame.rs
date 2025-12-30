use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    sysvar::clock::Clock,
    program::invoke_signed,
    system_instruction,
};
use crate::constants::*;
use crate::state::*;
use crate::utils::*;
use crate::errors::ErrorCode;

fn transfer_prize<'info>(
    pot: &AccountInfo<'info>,
    winner: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    prize: u64,
    pot_bump: u8,
) -> Result<()> {
    if prize == 0 {
        return Ok(());
    }
    let seeds: &[&[&[u8]]] = &[&[POT_SEED, &[pot_bump]]];
    invoke_signed(
        &system_instruction::transfer(pot.key, winner.key, prize),
        &[pot.clone(), winner.clone(), system_program.clone()],
        seeds,
    )?;
    Ok(())
}

fn rotate_pots<'info>(
    next_pot: &AccountInfo<'info>,
    pot: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    amount: u64,
    next_pot_bump: u8,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let seeds: &[&[&[u8]]] = &[&[NEXT_POT_SEED, &[next_pot_bump]]];
    invoke_signed(
        &system_instruction::transfer(next_pot.key, pot.key, amount),
        &[next_pot.clone(), pot.clone(), system_program.clone()],
        seeds,
    )?;
    Ok(())
}

pub fn endgame(ctx: Context<Endgame>) -> Result<()> {
    let settings = &ctx.accounts.settings;
    let state = &mut ctx.accounts.game_state;
    let current_slot = Clock::get()?.slot;

    require!(state.last_bidder.is_some(), ErrorCode::GameInProgress);
    require!(current_slot >= state.final_slot, ErrorCode::GameInProgress);

    let last = state.last_bidder.unwrap();
    let winner_key = ctx.accounts.winner.key();
    require!(winner_key == last, ErrorCode::WrongWinner);

    let min_vault = settings.vault_min_lamports;

    let pot_balance = ctx.accounts.pot.lamports();
    let prize = pot_balance.saturating_sub(min_vault);
    transfer_prize(
        &ctx.accounts.pot.to_account_info(),
        &ctx.accounts.winner.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        prize,
        ctx.bumps.pot,
    )?;

    let next_balance = ctx.accounts.next_pot.lamports();
    let movable = next_balance.saturating_sub(min_vault);
    rotate_pots(
        &ctx.accounts.next_pot.to_account_info(),
        &ctx.accounts.pot.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        movable,
        ctx.bumps.next_pot,
    )?;

    state.last_winner = Some(last);
    state.last_bidder = None;
    state.final_slot = 0;

    let pot_balance_after = ctx.accounts.pot.lamports();
    state.bid_value = MIN_BID_VALUE_LAMPORTS;

    emit!(GameEnded {
        winner: last,
        prize,
        pot_balance_after,
        next_pot_balance_after: ctx.accounts.next_pot.lamports(),
        slot: current_slot,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct Endgame<'info> {
    #[account(mut, seeds = [GAME_STATE_SEED], bump)]
    pub game_state: Account<'info, GameState>,

    #[account(seeds = [SETTINGS_SEED], bump)]
    pub settings: Account<'info, GameSettings>,

    #[account(mut, seeds = [POT_SEED], bump)]
    pub pot: SystemAccount<'info>,

    #[account(mut, seeds = [NEXT_POT_SEED], bump)]
    pub next_pot: SystemAccount<'info>,

    /// CHECK: validated in runtime
    #[account(mut)]
    pub winner: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
