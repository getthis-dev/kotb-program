import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Kotb } from "../target/types/kotb";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import { initializeState } from "./helpers/test-setup";
import { GAME_STATE_SEED, SETTINGS_SEED, POT_SEED, NEXT_POT_SEED } from "./helpers/constants";

describe("endgame", () => {
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.Kotb as Program<Kotb>;
    const provider = anchor.AnchorProvider.env();

    let gameStatePda: PublicKey;
    let settingsPda: PublicKey;
    let potPda: PublicKey;
    let nextPotPda: PublicKey;

    const authority = provider.wallet.publicKey;
    const feeAccount = Keypair.generate().publicKey;

    before(async () => {
        [gameStatePda] = PublicKey.findProgramAddressSync([Buffer.from(GAME_STATE_SEED)], program.programId);
        [settingsPda] = PublicKey.findProgramAddressSync([Buffer.from(SETTINGS_SEED)], program.programId);
        [potPda] = PublicKey.findProgramAddressSync([Buffer.from(POT_SEED)], program.programId);
        [nextPotPda] = PublicKey.findProgramAddressSync([Buffer.from(NEXT_POT_SEED)], program.programId);
    });

    beforeEach(async () => {
        await initializeState(program, authority, feeAccount, settingsPda);
    });

    describe("Happy Path", () => {
        it("should end game successfully and distribute rewards", async () => {
            // Set slots_to_win to small value for faster testing
            await program.methods
                .updateSettings({
                    slotsToWin: new anchor.BN(5),
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: null,
                    potBps: null,
                    nextBps: null,
                    bidValue: null,
                })
                .accounts({ settings: settingsPda })
                .rpc();

            const winner = Keypair.generate();
            const airdropSig = await provider.connection.requestAirdrop(winner.publicKey, LAMPORTS_PER_SOL);
            await provider.connection.confirmTransaction(airdropSig);

            const winnerProvider = new anchor.AnchorProvider(
                provider.connection,
                new anchor.Wallet(winner),
                provider.opts
            );
            const winnerProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, winnerProvider);

            // Place a bid
            await winnerProgram.methods.bid().accounts({ feeAccount: feeAccount }).rpc();

            const stateAfterBid = await program.account.gameState.fetch(gameStatePda);
            expect(stateAfterBid.lastBidder!.toBase58()).to.equal(winner.publicKey.toBase58());
            const finalSlot = stateAfterBid.finalSlot.toNumber();

            // Get balances before endgame
            const winnerBalanceBefore = await provider.connection.getBalance(winner.publicKey);
            const potBalanceBefore = await provider.connection.getBalance(potPda);
            const nextPotBalanceBefore = await provider.connection.getBalance(nextPotPda);

            // Wait until final_slot is reached
            let currentSlot = await provider.connection.getSlot();
            while (currentSlot < finalSlot) {
                await new Promise((resolve) => setTimeout(resolve, 400));
                currentSlot = await provider.connection.getSlot();
            }

            // Call endgame
            await program.methods
                .endgame()
                .accounts({
                    winner: winner.publicKey,
                })
                .rpc();

            // Verify state was reset
            const stateAfterEndgame = await program.account.gameState.fetch(gameStatePda);
            expect(stateAfterEndgame.lastBidder).to.be.null;
            expect(stateAfterEndgame.finalSlot.toNumber()).to.equal(0);
            expect(stateAfterEndgame.lastWinner!.toBase58()).to.equal(winner.publicKey.toBase58());
            expect(stateAfterEndgame.bidValue.toNumber()).to.be.greaterThan(0);

            // Verify balances changed
            const winnerBalanceAfter = await provider.connection.getBalance(winner.publicKey);
            const potBalanceAfter = await provider.connection.getBalance(potPda);
            const nextPotBalanceAfter = await provider.connection.getBalance(nextPotPda);

            // Winner should have received the prize
            expect(winnerBalanceAfter).to.be.greaterThan(winnerBalanceBefore);

            // Pot should have less (prize was paid out)
            expect(potBalanceAfter).to.be.lessThan(potBalanceBefore);

            // Next pot should have been moved to pot (less lamports remaining)
            expect(nextPotBalanceAfter).to.be.lessThan(nextPotBalanceBefore);

            // Pot should have increased from next_pot transfer
            const settings = await program.account.gameSettings.fetch(settingsPda);
            const minVault = settings.vaultMinLamports.toNumber();
            expect(potBalanceAfter).to.be.at.least(minVault);
            expect(nextPotBalanceAfter).to.be.at.least(minVault);
        });
    });

    describe("Events", () => {
        it("should emit GameEnded event with correct data", async () => {
            // Set slots_to_win to small value
            await program.methods
                .updateSettings({
                    slotsToWin: new anchor.BN(5),
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: null,
                    potBps: null,
                    nextBps: null,
                    bidValue: null,
                })
                .accounts({ settings: settingsPda })
                .rpc();

            const winner = Keypair.generate();
            const airdropSig = await provider.connection.requestAirdrop(winner.publicKey, LAMPORTS_PER_SOL);
            await provider.connection.confirmTransaction(airdropSig);

            const winnerProvider = new anchor.AnchorProvider(
                provider.connection,
                new anchor.Wallet(winner),
                provider.opts
            );
            const winnerProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, winnerProvider);

            // Place a bid
            await winnerProgram.methods.bid().accounts({ feeAccount: feeAccount }).rpc();

            const stateAfterBid = await program.account.gameState.fetch(gameStatePda);
            const finalSlot = stateAfterBid.finalSlot.toNumber();

            // Wait until final_slot is reached
            let currentSlot = await provider.connection.getSlot();
            while (currentSlot < finalSlot) {
                await new Promise((resolve) => setTimeout(resolve, 400));
                currentSlot = await provider.connection.getSlot();
            }

            // Setup event listener
            let eventEmitted = false;
            let eventData: any = null;

            const listener = program.addEventListener("gameEnded", (event) => {
                eventEmitted = true;
                eventData = event;
            });

            // Call endgame
            await program.methods
                .endgame()
                .accounts({
                    winner: winner.publicKey,
                })
                .rpc();

            // Give some time for event to be processed
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Verify event was emitted
            expect(eventEmitted).to.be.true;
            expect(eventData).to.not.be.null;

            // Verify event data
            expect(eventData.winner.toBase58()).to.equal(winner.publicKey.toBase58());
            expect(eventData.prize.toNumber()).to.be.greaterThan(0);
            expect(eventData.potBalanceAfter.toNumber()).to.be.greaterThan(0);
            expect(eventData.nextPotBalanceAfter.toNumber()).to.be.greaterThan(0);
            expect(eventData.slot.toNumber()).to.be.greaterThanOrEqual(finalSlot);

            program.removeEventListener(listener);
        });
    });

    describe("Validations", () => {
        it("should fail when game is still in progress", async () => {
            const bidder = Keypair.generate();
            const airdropSig = await provider.connection.requestAirdrop(bidder.publicKey, LAMPORTS_PER_SOL);
            await provider.connection.confirmTransaction(airdropSig);

            const bidderProvider = new anchor.AnchorProvider(
                provider.connection,
                new anchor.Wallet(bidder),
                provider.opts
            );
            const bidderProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, bidderProvider);

            // Place a bid
            await bidderProgram.methods.bid().accounts({ feeAccount: feeAccount }).rpc();

            const state = await program.account.gameState.fetch(gameStatePda);
            expect(state.lastBidder!.toBase58()).to.equal(bidder.publicKey.toBase58());

            // Verify we're NOT past final_slot yet
            const currentSlot = await provider.connection.getSlot();
            const finalSlot = state.finalSlot.toNumber();
            expect(currentSlot).to.be.lessThan(finalSlot);

            // Try to call endgame while game is still in progress
            try {
                await program.methods
                    .endgame()
                    .accounts({
                        winner: bidder.publicKey,
                    })
                    .rpc();
                expect.fail("Should have thrown error");
            } catch (err: any) {
                expect(err.toString()).to.include("GameInProgress");
            }

            // Verify state was not modified
            const stateAfter = await program.account.gameState.fetch(gameStatePda);
            expect(stateAfter.lastBidder!.toBase58()).to.equal(bidder.publicKey.toBase58());
            expect(stateAfter.finalSlot.toNumber()).to.equal(finalSlot);
        });

        it("should fail when providing wrong winner account", async () => {
            // Set slots_to_win to small value
            await program.methods
                .updateSettings({
                    slotsToWin: new anchor.BN(5),
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: null,
                    potBps: null,
                    nextBps: null,
                    bidValue: null,
                })
                .accounts({ settings: settingsPda })
                .rpc();

            const actualWinner = Keypair.generate();
            const wrongWinner = Keypair.generate();

            const airdrop1 = await provider.connection.requestAirdrop(actualWinner.publicKey, LAMPORTS_PER_SOL);
            const airdrop2 = await provider.connection.requestAirdrop(wrongWinner.publicKey, LAMPORTS_PER_SOL);
            await provider.connection.confirmTransaction(airdrop1);
            await provider.connection.confirmTransaction(airdrop2);

            const winnerProvider = new anchor.AnchorProvider(
                provider.connection,
                new anchor.Wallet(actualWinner),
                provider.opts
            );
            const winnerProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, winnerProvider);

            // Place bid with actual winner
            await winnerProgram.methods.bid().accounts({ feeAccount: feeAccount }).rpc();

            const state = await program.account.gameState.fetch(gameStatePda);
            expect(state.lastBidder!.toBase58()).to.equal(actualWinner.publicKey.toBase58());
            const finalSlot = state.finalSlot.toNumber();

            // Wait until final_slot is reached
            let currentSlot = await provider.connection.getSlot();
            while (currentSlot < finalSlot) {
                await new Promise((resolve) => setTimeout(resolve, 400));
                currentSlot = await provider.connection.getSlot();
            }

            // Try to call endgame with wrong winner
            try {
                await program.methods
                    .endgame()
                    .accounts({
                        winner: wrongWinner.publicKey,
                    })
                    .rpc();
                expect.fail("Should have thrown error");
            } catch (err: any) {
                expect(err.toString()).to.include("WrongWinner");
            }

            // Verify state was not modified
            const stateAfter = await program.account.gameState.fetch(gameStatePda);
            expect(stateAfter.lastBidder!.toBase58()).to.equal(actualWinner.publicKey.toBase58());
        });

        describe("Invalid Pot Accounts", () => {
            it("should fail when providing wrong pot account", async () => {
                // Set slots_to_win to small value
                await program.methods
                    .updateSettings({
                        slotsToWin: new anchor.BN(5),
                        newAuthority: null,
                        newFeeAccount: null,
                        bidValueRateBps: null,
                        feeBps: null,
                        potBps: null,
                        nextBps: null,
                        bidValue: null,
                    })
                    .accounts({ settings: settingsPda })
                    .rpc();

                const winner = Keypair.generate();
                const wrongPot = Keypair.generate().publicKey;

                const airdropSig = await provider.connection.requestAirdrop(winner.publicKey, LAMPORTS_PER_SOL);
                await provider.connection.confirmTransaction(airdropSig);

                const winnerProvider = new anchor.AnchorProvider(
                    provider.connection,
                    new anchor.Wallet(winner),
                    provider.opts
                );
                const winnerProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, winnerProvider);

                // Place a bid
                await winnerProgram.methods.bid().accounts({ feeAccount: feeAccount }).rpc();

                const stateAfterBid = await program.account.gameState.fetch(gameStatePda);
                const finalSlot = stateAfterBid.finalSlot.toNumber();

                // Wait until final_slot is reached
                let currentSlot = await provider.connection.getSlot();
                while (currentSlot < finalSlot) {
                    await new Promise((resolve) => setTimeout(resolve, 400));
                    currentSlot = await provider.connection.getSlot();
                }

                // Try to call endgame with wrong pot account - should fail with ConstraintSeeds
                try {
                    await program.methods
                        .endgame()
                        .accountsPartial({
                            winner: winner.publicKey,
                            pot: wrongPot,
                        })
                        .rpc();
                    expect.fail("Should have thrown error");
                } catch (err: any) {
                    expect(err.toString()).to.include("ConstraintSeeds");
                }
            });

            it("should fail when providing wrong next_pot account", async () => {
                // Set slots_to_win to small value
                await program.methods
                    .updateSettings({
                        slotsToWin: new anchor.BN(5),
                        newAuthority: null,
                        newFeeAccount: null,
                        bidValueRateBps: null,
                        feeBps: null,
                        potBps: null,
                        nextBps: null,
                        bidValue: null,
                    })
                    .accounts({ settings: settingsPda })
                    .rpc();

                const winner = Keypair.generate();
                const wrongNextPot = Keypair.generate().publicKey;

                const airdropSig = await provider.connection.requestAirdrop(winner.publicKey, LAMPORTS_PER_SOL);
                await provider.connection.confirmTransaction(airdropSig);

                const winnerProvider = new anchor.AnchorProvider(
                    provider.connection,
                    new anchor.Wallet(winner),
                    provider.opts
                );
                const winnerProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, winnerProvider);

                // Place a bid
                await winnerProgram.methods.bid().accounts({ feeAccount: feeAccount }).rpc();

                const stateAfterBid = await program.account.gameState.fetch(gameStatePda);
                const finalSlot = stateAfterBid.finalSlot.toNumber();

                // Wait until final_slot is reached
                let currentSlot = await provider.connection.getSlot();
                while (currentSlot < finalSlot) {
                    await new Promise((resolve) => setTimeout(resolve, 400));
                    currentSlot = await provider.connection.getSlot();
                }

                // Try to call endgame with wrong next_pot account - should fail with ConstraintSeeds
                try {
                    await program.methods
                        .endgame()
                        .accountsPartial({
                            winner: winner.publicKey,
                            nextPot: wrongNextPot,
                        })
                        .rpc();
                    expect.fail("Should have thrown error");
                } catch (err: any) {
                    expect(err.toString()).to.include("ConstraintSeeds");
                }
            });
        });
    });
});
