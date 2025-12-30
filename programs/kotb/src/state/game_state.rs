use anchor_lang::prelude::*;

#[account]
pub struct GameState {
    pub bid_value: u64,
    pub last_bidder: Option<Pubkey>,
    pub final_slot: u64,
    pub last_winner: Option<Pubkey>,
}

impl GameState {
    pub const SIZE: usize = 8 + 33 + 8 + 33;
}

