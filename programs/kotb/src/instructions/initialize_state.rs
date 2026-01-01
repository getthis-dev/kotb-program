use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::*;
use crate::utils::*;

pub fn initialize_state(
    ctx: Context<InitializeState>,
    authority: Pubkey,
    fee_account: Pubkey,
) -> Result<()> {
    let state = &mut ctx.accounts.game_state;
    state.bid_value = MIN_BID_VALUE_LAMPORTS;
    state.last_bidder = None;
    state.final_slot = 0;
    state.last_winner = None;

    let target_min = VAULT_MIN_LAMPORTS;

    let settings = &mut ctx.accounts.settings;
    settings.slots_to_win = DEFAULT_SLOTS_TO_WIN;
    settings.authority = authority;
    settings.fee_account = fee_account;
    settings.bid_value_rate_bps = DEFAULT_BID_VALUE_RATE_BPS;
    settings.fee_bps = DEFAULT_FEE_BPS;
    settings.pot_bps = DEFAULT_POT_BPS;
    settings.next_bps = DEFAULT_NEXT_BPS;
    settings.vault_min_lamports = target_min;
    settings.bid_value = 0;

    seed_vault_to_target(
        &ctx.accounts.payer.to_account_info(),
        &ctx.accounts.pot.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        target_min,
    )?;
    seed_vault_to_target(
        &ctx.accounts.payer.to_account_info(),
        &ctx.accounts.next_pot.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        target_min,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeState<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        seeds = [GAME_STATE_SEED],
        bump,
        space = 8 + GameState::SIZE
    )]
    pub game_state: Account<'info, GameState>,

    #[account(
        init,
        payer = payer,
        seeds = [SETTINGS_SEED],
        bump,
        space = 8 + GameSettings::SIZE
    )]
    pub settings: Account<'info, GameSettings>,

    #[account(
        mut,
        seeds = [POT_SEED],
        bump,
    )]
    pub pot: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [NEXT_POT_SEED],
        bump,
    )]
    pub next_pot: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

