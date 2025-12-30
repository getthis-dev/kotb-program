#![allow(deprecated)]
#![allow(ambiguous_glob_reexports)]

use anchor_lang::prelude::*;

#[cfg(feature = "mainnet")]
declare_id!("ATYRjaUqYm87Z86G5DvteEX4RN2RuYKkMdyq8mhud2dp");

#[cfg(not(feature = "mainnet"))]
declare_id!("C5iJH6xmzE9228AEBNfSRsb8F1LU7SdCzMAAUk535RZo");

#[cfg(feature = "mainnet")]
solana_security_txt::security_txt! {
    name: "KOTB - King of the Block",
    project_url: "https://kotb.fun",
    contacts: "email:getthis.dev@gmail.com",
    policy: "https://github.com/getthis-dev/kotb-program/blob/master/SECURITY.md",
    preferred_languages: "en",
    source_code: "https://github.com/getthis-dev/kotb-program",
    auditors: "N/A"
}

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
