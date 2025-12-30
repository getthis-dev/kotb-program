import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Kotb } from "../target/types/kotb";
import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { initializeState } from "./helpers/test-setup";
import {
    MIN_BID_VALUE,
    DEFAULT_SLOTS_TO_WIN,
    DEFAULT_FEE_BPS,
    DEFAULT_POT_BPS,
    DEFAULT_NEXT_BPS,
    GAME_STATE_SEED,
    SETTINGS_SEED,
    POT_SEED,
    NEXT_POT_SEED,
} from "./helpers/constants";

describe("initialize_state", () => {
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.Kotb as Program<Kotb>;
    const provider = anchor.AnchorProvider.env();

    let gameStatePda: PublicKey;
    let settingsPda: PublicKey;
    let potPda: PublicKey;
    let nextPotPda: PublicKey;

    const authority = provider.wallet.publicKey;
    const feeAccount = anchor.web3.Keypair.generate().publicKey;

    before(async () => {
        [gameStatePda] = PublicKey.findProgramAddressSync([Buffer.from(GAME_STATE_SEED)], program.programId);
        [settingsPda] = PublicKey.findProgramAddressSync([Buffer.from(SETTINGS_SEED)], program.programId);
        [potPda] = PublicKey.findProgramAddressSync([Buffer.from(POT_SEED)], program.programId);
        [nextPotPda] = PublicKey.findProgramAddressSync([Buffer.from(NEXT_POT_SEED)], program.programId);
    });

    beforeEach(async () => {
        await initializeState(program, authority, feeAccount, settingsPda);
    });

    it("initializes game settings with correct default values", async () => {
        const settings = await program.account.gameSettings.fetch(settingsPda);

        expect(settings.authority.toBase58()).to.equal(authority.toBase58());
        expect(settings.feeAccount.toBase58()).to.equal(feeAccount.toBase58());
        expect(settings.slotsToWin.toNumber()).to.equal(DEFAULT_SLOTS_TO_WIN);
        expect(settings.feeBps).to.equal(DEFAULT_FEE_BPS);
        expect(settings.potBps).to.equal(DEFAULT_POT_BPS);
        expect(settings.nextBps).to.equal(DEFAULT_NEXT_BPS);
        expect(settings.vaultMinLamports.toNumber()).to.be.greaterThan(0);
    });

    it("initializes game state with correct bid value", async () => {
        const gameState = await program.account.gameState.fetch(gameStatePda);
        expect(gameState.bidValue.toNumber()).to.equal(MIN_BID_VALUE);
    });

    it("creates pot and next_pot vaults with sufficient rent", async () => {
        const potAccount = await provider.connection.getAccountInfo(potPda);
        const nextPotAccount = await provider.connection.getAccountInfo(nextPotPda);

        expect(potAccount).to.not.be.null;
        expect(nextPotAccount).to.not.be.null;

        const settings = await program.account.gameSettings.fetch(settingsPda);
        const minBalance = settings.vaultMinLamports.toNumber();

        expect(potAccount!.lamports).to.be.at.least(minBalance);
        expect(nextPotAccount!.lamports).to.be.at.least(minBalance);
    });

    it("fails when called twice", async () => {
        try {
            await program.methods.initializeState(authority, feeAccount).rpc();
            expect.fail("Should have thrown error");
        } catch (err: any) {
            expect(err.message).to.include("already in use");
        }
    });
});
