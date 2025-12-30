use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program::invoke,
    system_instruction,
};
use crate::constants::*;

pub fn transfer_lamports<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let ix = system_instruction::transfer(from.key, to.key, amount);
    invoke(&ix, &[from.clone(), to.clone(), system_program.clone()])?;
    Ok(())
}

pub fn seed_vault_to_target<'info>(
    payer: &AccountInfo<'info>,
    vault: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    target: u64,
) -> Result<()> {
    let current = vault.lamports();
    if current < target {
        let missing = target - current;
        let ix = system_instruction::transfer(payer.key, vault.key, missing);
        invoke(&ix, &[payer.clone(), vault.clone(), system_program.clone()])?;
    }
    Ok(())
}

pub fn get_bid_value_bps(pot_balance: u64, bid_value_rate_bps: u16) -> u64 {
    let calc = pot_balance.saturating_mul(bid_value_rate_bps as u64) / BPS_DENOM;
    if calc < MIN_BID_VALUE_LAMPORTS {
        MIN_BID_VALUE_LAMPORTS
    } else {
        calc
    }
}

