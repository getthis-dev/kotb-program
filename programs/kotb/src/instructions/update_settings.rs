use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::*;
use crate::errors::ErrorCode;

pub fn update_settings(ctx: Context<UpdateSettings>, update: SettingsUpdate) -> Result<()> {
    let s = &mut ctx.accounts.settings;

    if let Some(slots) = update.slots_to_win {
        require!(slots > 0, ErrorCode::InvalidValue);
        s.slots_to_win = slots;
    }
    if let Some(new_auth) = update.new_authority {
        s.authority = new_auth;
    }
    if let Some(new_fee) = update.new_fee_account {
        s.fee_account = new_fee;
    }
    if let Some(rate_bps) = update.bid_value_rate_bps {
        require!((rate_bps as u64) > 0 && (rate_bps as u64) <= BPS_DENOM, ErrorCode::InvalidValue);
        s.bid_value_rate_bps = rate_bps;
    }
    if let Some(fee_bps) = update.fee_bps {
        require!((fee_bps as u64) <= BPS_DENOM, ErrorCode::InvalidValue);
        s.fee_bps = fee_bps;
    }
    if let Some(pot_bps) = update.pot_bps {
        require!((pot_bps as u64) <= BPS_DENOM, ErrorCode::InvalidValue);
        s.pot_bps = pot_bps;
    }
    if let Some(next_bps) = update.next_bps {
        require!((next_bps as u64) <= BPS_DENOM, ErrorCode::InvalidValue);
        s.next_bps = next_bps;
    }
    if let Some(bid_value) = update.bid_value {
        // bid_value can be 0 or any positive value
        s.bid_value = bid_value;
    }

    let total = s.fee_bps as u64 + s.pot_bps as u64 + s.next_bps as u64;
    require!(total == BPS_DENOM, ErrorCode::InvalidPercentages);

    emit!(SettingsUpdated {
        slots_to_win: s.slots_to_win,
        new_authority: s.authority,
        new_fee_account: s.fee_account,
        bid_value_rate_bps: s.bid_value_rate_bps,
        fee_bps: s.fee_bps,
        pot_bps: s.pot_bps,
        next_bps: s.next_bps,
        vault_min_lamports: s.vault_min_lamports,
        bid_value: s.bid_value,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateSettings<'info> {
    #[account(
        mut,
    )]
    pub settings: Account<'info, GameSettings>,

    #[account(
        mut,
        constraint = authority.key() == settings.authority @ ErrorCode::Unauthorized,
    )]
    pub authority: Signer<'info>,
}
