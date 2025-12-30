#![allow(deprecated)]
#![allow(ambiguous_glob_reexports)]

use anchor_lang::prelude::*;

#[cfg(feature = "mainnet")]
declare_id!("75LonRXVLyBZbwdKXS3yqoeZUAeeDbsZHnG8Ut3gbhew");

#[cfg(not(feature = "mainnet"))]
declare_id!("C5iJH6xmzE9228AEBNfSRsb8F1LU7SdCzMAAUk535RZo");

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

pub use constants::*;
pub use errors::ErrorCode;
pub use instructions::*;
pub use state::*;
pub use utils::*;

#[program]
pub mod kotb {
    use super::*;

    pub fn initialize_state(
        ctx: Context<InitializeState>,
        authority: Pubkey,
        fee_account: Pubkey,
    ) -> Result<()> {
        instructions::initialize_state::initialize_state(ctx, authority, fee_account)
    }

    pub fn update_settings(ctx: Context<UpdateSettings>, update: SettingsUpdate) -> Result<()> {
        instructions::update_settings::update_settings(ctx, update)
    }

    pub fn bid(ctx: Context<Bid>) -> Result<()> {
        instructions::bid::bid(ctx)
    }

    pub fn endgame(ctx: Context<Endgame>) -> Result<()> {
        instructions::endgame::endgame(ctx)
    }
}
