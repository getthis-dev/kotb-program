use anchor_lang::prelude::*;

#[account]
pub struct GameSettings {
    pub slots_to_win: u64,
    pub authority: Pubkey,
    pub fee_account: Pubkey,
    pub bid_value_rate_bps: u16,
    pub fee_bps: u16,
    pub pot_bps: u16,
    pub next_bps: u16,
    pub vault_min_lamports: u64,
    pub bid_value: u64, // If > 0, overrides GameState.bid_value
}

impl GameSettings {
    pub const SIZE: usize = 8 + 32 + 32 + 2 + 2 + 2 + 2 + 8 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SettingsUpdate {
    pub slots_to_win: Option<u64>,
    pub new_authority: Option<Pubkey>,
    pub new_fee_account: Option<Pubkey>,
    pub bid_value_rate_bps: Option<u16>,
    pub fee_bps: Option<u16>,
    pub pot_bps: Option<u16>,
    pub next_bps: Option<u16>,
    pub bid_value: Option<u64>,
}

