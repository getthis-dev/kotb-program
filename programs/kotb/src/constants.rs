// Basic conversion from SOL to lamports
pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
// Minimum bid value = 0.01 SOL
pub const MIN_BID_VALUE_LAMPORTS: u64 = LAMPORTS_PER_SOL / 100;

// Denominator for BPS (basis points): 1 BPS = 0.01% = 1/10,000
pub const BPS_DENOM: u64 = 10_000;

// Number of slots (blocks) needed to win the game
pub const DEFAULT_SLOTS_TO_WIN: u64 = 150;
// Rate of increase for minimum bid value: 100 BPS = 1%
pub const DEFAULT_BID_VALUE_RATE_BPS: u16 = 100;
// Platform fee: 1,000 BPS = 10%
pub const DEFAULT_FEE_BPS: u16 = 1_000;
// Percentage of bid that goes to current pot: 5,000 BPS = 50%
pub const DEFAULT_POT_BPS: u16 = 5_000;
// Percentage of bid that goes to next pot: 4,000 BPS = 40%
pub const DEFAULT_NEXT_BPS: u16 = 4_000;

pub const VAULT_MIN_LAMPORTS: u64 = 1_000_000;

// Seeds for PDA (Program Derived Address) derivation
pub const POT_SEED: &[u8] = b"pot";
pub const NEXT_POT_SEED: &[u8] = b"next_pot";
pub const GAME_STATE_SEED: &[u8] = b"game_state";
pub const SETTINGS_SEED: &[u8] = b"settings";

