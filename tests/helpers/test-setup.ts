import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Kotb } from "../../target/types/kotb";
import { PublicKey } from "@solana/web3.js";
import {
    DEFAULT_SLOTS_TO_WIN,
    DEFAULT_BID_VALUE_RATE_BPS,
    DEFAULT_FEE_BPS,
    DEFAULT_POT_BPS,
    DEFAULT_NEXT_BPS,
    GAME_STATE_SEED,
} from "./constants";

/**
 * Ensures the game is initialized and reset to default values.
 * This guarantees test isolation - each test starts with a clean state.
 */
export async function initializeState(
    program: Program<Kotb>,
    authority: PublicKey,
    feeAccount: PublicKey,
    settingsPda: PublicKey
): Promise<void> {
    const provider = program.provider as anchor.AnchorProvider;
    const [gameStatePda] = PublicKey.findProgramAddressSync([Buffer.from(GAME_STATE_SEED)], program.programId);

    // Try to initialize - if already exists, ignore error
    try {
        await program.methods.initializeState(authority, feeAccount).rpc();
    } catch (err: any) {
        if (!err.toString().includes("already in use")) {
            throw err;
        }
    }

    // Check if game is over and needs to be reset with endgame
    try {
        const gameState = await program.account.gameState.fetch(gameStatePda);
        if (gameState.lastBidder) {
            const currentSlot = await provider.connection.getSlot();
            const finalSlot = gameState.finalSlot.toNumber();
            // If we're past final_slot, call endgame to reset
            if (currentSlot >= finalSlot) {
                try {
                    await program.methods
                        .endgame()
                        .accounts({
                            winner: gameState.lastBidder,
                        })
                        .rpc();
                } catch (endgameErr: any) {
                    if (!endgameErr.toString().includes("GameInProgress")) {
                        throw endgameErr;
                    }
                }
            }
        }
    } catch (err: any) {
        if (!err.toString().includes("AccountNotInitialized") && !err.toString().includes("Account does not exist")) {
            throw err;
        }
    }

    // Always reset settings to known defaults for test isolation
    await program.methods
        .updateSettings({
            slotsToWin: new anchor.BN(DEFAULT_SLOTS_TO_WIN),
            newAuthority: authority,
            newFeeAccount: feeAccount,
            bidValueRateBps: DEFAULT_BID_VALUE_RATE_BPS,
            feeBps: DEFAULT_FEE_BPS,
            potBps: DEFAULT_POT_BPS,
            nextBps: DEFAULT_NEXT_BPS,
            bidValue: new anchor.BN(0),
        })
        .accounts({
            settings: settingsPda,
        })
        .rpc();
}
