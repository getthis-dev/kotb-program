use anchor_lang::prelude::*;

#[event]
pub struct BidPlaced {
    pub bidder: Pubkey,
    pub bid_value: u64,
    pub final_slot: u64,
    pub pot_balance: u64,
    pub next_pot_balance: u64,
}

#[event]
pub struct GameEnded {
    pub winner: Pubkey,
    pub prize: u64,
    pub pot_balance_after: u64,
    pub next_pot_balance_after: u64,
    pub slot: u64,
}

#[event]
pub struct SettingsUpdated {
    pub slots_to_win: u64,
    pub new_authority: Pubkey,
    pub new_fee_account: Pubkey,
    pub bid_value_rate_bps: u16,
    pub fee_bps: u16,
    pub pot_bps: u16,
    pub next_bps: u16,
    pub vault_min_lamports: u64,
    pub bid_value: u64,
}

