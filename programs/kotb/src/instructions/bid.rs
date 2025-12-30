use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::clock::Clock;
use crate::constants::*;
use crate::state::*;
use crate::utils::*;
use crate::errors::ErrorCode;

pub fn bid(ctx: Context<Bid>) -> Result<()> {
    let settings = &ctx.accounts.settings;
    let state = &mut ctx.accounts.game_state;
    let current_slot = Clock::get()?.slot;

    if state.last_bidder.is_some() && current_slot >= state.final_slot {
        return err!(ErrorCode::BidIsOver);
    }

    let amount = if settings.bid_value > 0 {
        settings.bid_value
    } else {
        state.bid_value
    };

    let fee_amount = amount.saturating_mul(settings.fee_bps as u64) / BPS_DENOM;
    let pot_amount = amount.saturating_mul(settings.pot_bps as u64) / BPS_DENOM;
    let next_pot_amount = amount.saturating_sub(fee_amount).saturating_sub(pot_amount);

    transfer_lamports(
        &ctx.accounts.bidder.to_account_info(),
        &ctx.accounts.fee_account.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        fee_amount,
    )?;

    transfer_lamports(
        &ctx.accounts.bidder.to_account_info(),
        &ctx.accounts.pot.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        pot_amount,
    )?;

    transfer_lamports(
        &ctx.accounts.bidder.to_account_info(),
        &ctx.accounts.next_pot.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        next_pot_amount,
    )?;

    state.last_bidder = Some(ctx.accounts.bidder.key());
    state.final_slot = current_slot + settings.slots_to_win;

    let pot_balance_after = ctx.accounts.pot.lamports();
    state.bid_value = get_bid_value_bps(pot_balance_after, settings.bid_value_rate_bps);

    emit!(BidPlaced {
        bidder: ctx.accounts.bidder.key(),
        bid_value: amount,
        final_slot: state.final_slot,
        pot_balance: ctx.accounts.pot.lamports(),
        next_pot_balance: ctx.accounts.next_pot.lamports(),
    });

    Ok(())
}

#[derive(Accounts)]
pub struct Bid<'info> {
    #[account(mut)]
    pub bidder: Signer<'info>,

    #[account(mut, seeds = [GAME_STATE_SEED], bump)]
    pub game_state: Account<'info, GameState>,

    #[account(seeds = [SETTINGS_SEED], bump)]
    pub settings: Account<'info, GameSettings>,

    #[account(mut, seeds = [POT_SEED], bump)]
    pub pot: SystemAccount<'info>,

    #[account(mut, seeds = [NEXT_POT_SEED], bump)]
    pub next_pot: SystemAccount<'info>,

    /// CHECK: fee_account from settings
    #[account(
        mut,
        constraint = fee_account.key() == settings.fee_account @ ErrorCode::WrongFeeAccount
    )]
    pub fee_account: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
