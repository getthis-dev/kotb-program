import { LAMPORTS_PER_SOL } from "@solana/web3.js";

// Bid value constants
export const MIN_BID_VALUE = LAMPORTS_PER_SOL / 100; // 0.01 SOL

// Default game settings
export const DEFAULT_SLOTS_TO_WIN = 150;
export const DEFAULT_BID_VALUE_RATE_BPS = 100; // 1%
export const DEFAULT_FEE_BPS = 1_000; // 10%
export const DEFAULT_POT_BPS = 5_000; // 50%
export const DEFAULT_NEXT_BPS = 4_000; // 40%

// PDA seeds
export const GAME_STATE_SEED = "game_state";
export const SETTINGS_SEED = "settings";
export const POT_SEED = "pot";
export const NEXT_POT_SEED = "next_pot";
