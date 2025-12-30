import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { Kotb } from "../target/types/kotb";
import {
    DEFAULT_FEE_BPS,
    DEFAULT_NEXT_BPS,
    DEFAULT_POT_BPS,
    DEFAULT_SLOTS_TO_WIN,
    GAME_STATE_SEED,
    MIN_BID_VALUE,
    NEXT_POT_SEED,
    POT_SEED,
    SETTINGS_SEED,
} from "./helpers/constants";
import { initializeState } from "./helpers/test-setup";

describe("bid", () => {
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
        it("should accept the first bid and update state correctly", async () => {
            const bidder = Keypair.generate();

            // Airdrop to bidder
            const airdropSig = await provider.connection.requestAirdrop(bidder.publicKey, LAMPORTS_PER_SOL);
            await provider.connection.confirmTransaction(airdropSig);

            // Get initial balances
            const initialBidderBalance = await provider.connection.getBalance(bidder.publicKey);
            const initialFeeAccountBalance = await provider.connection.getBalance(feeAccount);
            const initialPotBalance = await provider.connection.getBalance(potPda);
            const initialNextPotBalance = await provider.connection.getBalance(nextPotPda);

            // Get initial state
            const initialState = await program.account.gameState.fetch(gameStatePda);
            expect(initialState.lastBidder).to.be.null;
            expect(initialState.finalSlot.toNumber()).to.equal(0);

            // Get current slot for final_slot calculation
            const slot = await provider.connection.getSlot();

            // Place bid
            const bidderProvider = new anchor.AnchorProvider(
                provider.connection,
                new anchor.Wallet(bidder),
                provider.opts
            );
            const bidderProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, bidderProvider);

            await bidderProgram.methods
                .bid()
                .accounts({
                    feeAccount: feeAccount,
                })
                .rpc();

            // Fetch state updates
            const state = await program.account.gameState.fetch(gameStatePda);

            // Verify last_bidder was set
            expect(state.lastBidder).to.not.be.null;
            expect(state.lastBidder!.toBase58()).to.equal(bidder.publicKey.toBase58());

            // Verify final_slot was set correctly (current slot + slots_to_win)
            expect(state.finalSlot.toNumber()).to.be.greaterThan(slot);
            expect(state.finalSlot.toNumber()).to.be.at.most(slot + DEFAULT_SLOTS_TO_WIN + 1);

            // Calculate expected amounts
            const bidAmount = MIN_BID_VALUE;
            const feeAmount = (bidAmount * DEFAULT_FEE_BPS) / 10_000;
            const potAmount = (bidAmount * DEFAULT_POT_BPS) / 10_000;
            const nextPotAmount = (bidAmount * DEFAULT_NEXT_BPS) / 10_000;

            const finalBidderBalance = await provider.connection.getBalance(bidder.publicKey);
            const finalFeeAccountBalance = await provider.connection.getBalance(feeAccount);
            const finalPotBalance = await provider.connection.getBalance(potPda);
            const finalNextPotBalance = await provider.connection.getBalance(nextPotPda);

            expect(initialBidderBalance - finalBidderBalance).to.be.at.least(bidAmount);
            expect(initialBidderBalance - finalBidderBalance).to.be.at.most(bidAmount + 10_000);
            expect(finalFeeAccountBalance - initialFeeAccountBalance).to.equal(feeAmount);
            expect(finalPotBalance - initialPotBalance).to.equal(potAmount);
            expect(finalNextPotBalance - initialNextPotBalance).to.equal(nextPotAmount);
            expect(state.bidValue.toNumber()).to.be.greaterThan(0);
        });

        it("should accept a second bid from a different bidder", async () => {
            const firstBidder = Keypair.generate();
            const secondBidder = Keypair.generate();

            // Airdrop to both bidders
            const airdrop1 = await provider.connection.requestAirdrop(firstBidder.publicKey, LAMPORTS_PER_SOL);
            const airdrop2 = await provider.connection.requestAirdrop(secondBidder.publicKey, LAMPORTS_PER_SOL);
            await provider.connection.confirmTransaction(airdrop1);
            await provider.connection.confirmTransaction(airdrop2);

            // First bid
            const firstBidderProvider = new anchor.AnchorProvider(
                provider.connection,
                new anchor.Wallet(firstBidder),
                provider.opts
            );
            const firstBidderProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, firstBidderProvider);

            await firstBidderProgram.methods
                .bid()
                .accounts({
                    feeAccount: feeAccount,
                })
                .rpc();

            const stateAfterFirst = await program.account.gameState.fetch(gameStatePda);
            expect(stateAfterFirst.lastBidder!.toBase58()).to.equal(firstBidder.publicKey.toBase58());

            const firstFinalSlot = stateAfterFirst.finalSlot.toNumber();

            // Second bid
            const secondBidderProvider = new anchor.AnchorProvider(
                provider.connection,
                new anchor.Wallet(secondBidder),
                provider.opts
            );
            const secondBidderProgram = new anchor.Program<Kotb>(
                program.idl as anchor.Idl,
                secondBidderProvider
            );

            const potBalanceBeforeSecondBid = await provider.connection.getBalance(potPda);
            const nextPotBalanceBeforeSecondBid = await provider.connection.getBalance(nextPotPda);

            await secondBidderProgram.methods
                .bid()
                .accounts({
                    feeAccount: feeAccount,
                })
                .rpc();

            const stateAfterSecond = await program.account.gameState.fetch(gameStatePda);

            // Verify last_bidder was updated to second bidder
            expect(stateAfterSecond.lastBidder!.toBase58()).to.equal(secondBidder.publicKey.toBase58());

            // Verify final_slot was extended
            const slot = await provider.connection.getSlot();
            expect(stateAfterSecond.finalSlot.toNumber()).to.be.greaterThan(firstFinalSlot);
            expect(stateAfterSecond.finalSlot.toNumber()).to.be.greaterThan(slot);

            // Verify pot and next_pot balances increased
            const potBalanceAfterSecondBid = await provider.connection.getBalance(potPda);
            const nextPotBalanceAfterSecondBid = await provider.connection.getBalance(nextPotPda);

            expect(potBalanceAfterSecondBid).to.be.greaterThan(potBalanceBeforeSecondBid);
            expect(nextPotBalanceAfterSecondBid).to.be.greaterThan(nextPotBalanceBeforeSecondBid);
        });

        it("should work with fixed bid value mode", async () => {
            // Update settings to use fixed bid value (not dynamic)
            const fixedBidValue = LAMPORTS_PER_SOL; // 1 SOL

            await program.methods
                .updateSettings({
                    slotsToWin: null,
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: null,
                    potBps: null,
                    nextBps: null,
                    bidValue: new anchor.BN(fixedBidValue),
                })
                .accounts({
                    settings: settingsPda,
                })
                .rpc();

            const settings = await program.account.gameSettings.fetch(settingsPda);
            expect(settings.bidValue.toNumber()).to.equal(fixedBidValue);

            const bidder = Keypair.generate();

            // Airdrop to bidder (need more for 1 SOL bid)
            const airdropSig = await provider.connection.requestAirdrop(bidder.publicKey, LAMPORTS_PER_SOL * 2);
            await provider.connection.confirmTransaction(airdropSig);

            // Get initial balances
            const initialBidderBalance = await provider.connection.getBalance(bidder.publicKey);
            const initialPotBalance = await provider.connection.getBalance(potPda);
            const initialNextPotBalance = await provider.connection.getBalance(nextPotPda);
            const initialFeeAccountBalance = await provider.connection.getBalance(feeAccount);

            // Place bid
            const bidderProvider = new anchor.AnchorProvider(
                provider.connection,
                new anchor.Wallet(bidder),
                provider.opts
            );
            const bidderProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, bidderProvider);

            await bidderProgram.methods
                .bid()
                .accounts({
                    feeAccount: feeAccount,
                })
                .rpc();

            // Verify state updates
            const state = await program.account.gameState.fetch(gameStatePda);
            expect(state.lastBidder!.toBase58()).to.equal(bidder.publicKey.toBase58());
            expect(state.finalSlot.toNumber()).to.be.greaterThan(0);

            // Calculate expected amounts based on fixed bid value
            const feeAmount = (fixedBidValue * DEFAULT_FEE_BPS) / 10_000;
            const potAmount = (fixedBidValue * DEFAULT_POT_BPS) / 10_000;
            const nextPotAmount = (fixedBidValue * DEFAULT_NEXT_BPS) / 10_000;

            // Verify balance changes
            const finalBidderBalance = await provider.connection.getBalance(bidder.publicKey);
            const finalPotBalance = await provider.connection.getBalance(potPda);
            const finalNextPotBalance = await provider.connection.getBalance(nextPotPda);
            const finalFeeAccountBalance = await provider.connection.getBalance(feeAccount);

            // Bidder should have paid fixed bid amount + transaction fee
            expect(initialBidderBalance - finalBidderBalance).to.be.at.least(fixedBidValue);
            expect(initialBidderBalance - finalBidderBalance).to.be.at.most(fixedBidValue + 10_000);

            // Pot should receive pot amount
            expect(finalPotBalance - initialPotBalance).to.equal(potAmount);

            // Next pot should receive next pot amount
            expect(finalNextPotBalance - initialNextPotBalance).to.equal(nextPotAmount);

            // Fee account should receive fee amount
            expect(finalFeeAccountBalance - initialFeeAccountBalance).to.equal(feeAmount);

            // In fixed mode, state.bid_value should still be updated based on pot
            expect(state.bidValue.toNumber()).to.be.greaterThan(0);
        });

        it("should increase bid_value when pot accumulates enough value", async () => {
            // To see bid_value grow, we need pot to reach at least 1 SOL
            // (1% of 1 SOL = 0.01 SOL = MIN_BID_VALUE)
            // With 50% going to pot, we need 2 SOL in bids total
            // So we'll make multiple bids with larger fixed bid value

            // Set fixed bid value to 1 SOL
            const largeBidValue = LAMPORTS_PER_SOL;
            await program.methods
                .updateSettings({
                    slotsToWin: null,
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: null,
                    potBps: null,
                    nextBps: null,
                    bidValue: new anchor.BN(largeBidValue),
                })
                .accounts({
                    settings: settingsPda,
                })
                .rpc();

            const bidder = Keypair.generate();

            // Airdrop enough for multiple bids
            const airdropSig = await provider.connection.requestAirdrop(bidder.publicKey, LAMPORTS_PER_SOL * 5);
            await provider.connection.confirmTransaction(airdropSig);

            const bidderProvider = new anchor.AnchorProvider(
                provider.connection,
                new anchor.Wallet(bidder),
                provider.opts
            );
            const bidderProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, bidderProvider);

            // First bid: 1 SOL -> pot gets 0.5 SOL
            await bidderProgram.methods
                .bid()
                .accounts({
                    feeAccount: feeAccount,
                })
                .rpc();

            // Second bid: 1 SOL -> pot gets another 0.5 SOL (total 1 SOL in pot)
            await bidderProgram.methods
                .bid()
                .accounts({
                    feeAccount: feeAccount,
                })
                .rpc();

            const stateAfterSecond = await program.account.gameState.fetch(gameStatePda);
            const secondBidValue = stateAfterSecond.bidValue.toNumber();

            // After 2 bids of 1 SOL each, pot should have ~1 SOL
            // So 1% of pot should be >= MIN_BID_VALUE
            expect(secondBidValue).to.be.at.least(MIN_BID_VALUE);
            const potBalance = await provider.connection.getBalance(potPda);
            const expectedBidValue = Math.max(MIN_BID_VALUE, Math.floor((potBalance * 100) / 10_000));
            expect(secondBidValue).to.equal(expectedBidValue);
        });
    });

    describe("Events", () => {
        it("should emit BidPlaced event with correct data", async () => {
            const bidder = Keypair.generate();
            const airdropSig = await provider.connection.requestAirdrop(bidder.publicKey, LAMPORTS_PER_SOL);
            await provider.connection.confirmTransaction(airdropSig);

            // Get state before bid to know what bid_value will be used
            const stateBefore = await program.account.gameState.fetch(gameStatePda);
            const settings = await program.account.gameSettings.fetch(settingsPda);
            const expectedBidValue =
                settings.bidValue.toNumber() > 0 ? settings.bidValue.toNumber() : stateBefore.bidValue.toNumber();

            // Setup event listener
            let eventEmitted = false;
            let eventData: any = null;
            const listener = program.addEventListener("bidPlaced", (event) => {
                eventEmitted = true;
                eventData = event;
            });

            // Place bid
            const bidderProvider = new anchor.AnchorProvider(
                provider.connection,
                new anchor.Wallet(bidder),
                provider.opts
            );
            const bidderProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, bidderProvider);

            await bidderProgram.methods.bid().accounts({ feeAccount: feeAccount }).rpc();

            // Give some time for event to be processed
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Verify event was emitted
            expect(eventEmitted).to.be.true;
            expect(eventData).to.not.be.null;

            // Verify event data
            expect(eventData.bidder.toBase58()).to.equal(bidder.publicKey.toBase58());
            expect(eventData.bidValue.toNumber()).to.equal(expectedBidValue);
            expect(eventData.finalSlot.toNumber()).to.be.greaterThan(0);
            expect(eventData.potBalance.toNumber()).to.be.greaterThan(0);
            expect(eventData.nextPotBalance.toNumber()).to.be.greaterThan(0);

            program.removeEventListener(listener);
        });
    });

    describe("Validations", () => {
        describe("BidIsOver", () => {
            it("should fail when trying to bid at final_slot (boundary)", async () => {
                // Set slots_to_win to a small value to avoid long waits
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

                const bidder = Keypair.generate();
                const airdropSig = await provider.connection.requestAirdrop(bidder.publicKey, LAMPORTS_PER_SOL);
                await provider.connection.confirmTransaction(airdropSig);

                const bidderProvider = new anchor.AnchorProvider(
                    provider.connection,
                    new anchor.Wallet(bidder),
                    provider.opts
                );
                const bidderProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, bidderProvider);

                // First bid to set final_slot
                await bidderProgram.methods.bid().accounts({ feeAccount: feeAccount }).rpc();

                const state = await program.account.gameState.fetch(gameStatePda);
                const finalSlot = state.finalSlot.toNumber();

                // Wait until we reach final_slot
                let currentSlot = await provider.connection.getSlot();
                while (currentSlot < finalSlot) {
                    await new Promise((resolve) => setTimeout(resolve, 400));
                    currentSlot = await provider.connection.getSlot();
                }

                // Try to bid at final_slot (should fail)
                try {
                    await bidderProgram.methods.bid().accounts({ feeAccount: feeAccount }).rpc();
                    expect.fail("Should have thrown error");
                } catch (err: any) {
                    expect(err.toString()).to.include("BidIsOver");
                }
            });

            it("should fail when trying to bid after final_slot", async () => {
                // Set slots_to_win to a small value to avoid long waits
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

                const bidder = Keypair.generate();
                const airdropSig = await provider.connection.requestAirdrop(bidder.publicKey, LAMPORTS_PER_SOL);
                await provider.connection.confirmTransaction(airdropSig);

                const bidderProvider = new anchor.AnchorProvider(
                    provider.connection,
                    new anchor.Wallet(bidder),
                    provider.opts
                );
                const bidderProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, bidderProvider);

                // First bid to set final_slot
                await bidderProgram.methods.bid().accounts({ feeAccount: feeAccount }).rpc();

                const state = await program.account.gameState.fetch(gameStatePda);
                const finalSlot = state.finalSlot.toNumber();

                // Wait until we're past final_slot
                let currentSlot = await provider.connection.getSlot();
                while (currentSlot <= finalSlot) {
                    await new Promise((resolve) => setTimeout(resolve, 400));
                    currentSlot = await provider.connection.getSlot();
                }

                // Verify we're actually past final_slot
                currentSlot = await provider.connection.getSlot();
                expect(currentSlot).to.be.greaterThan(finalSlot);

                // Try to bid after final_slot (should fail)
                try {
                    await bidderProgram.methods.bid().accounts({ feeAccount: feeAccount }).rpc();
                    expect.fail("Should have thrown error");
                } catch (err: any) {
                    expect(err.toString()).to.include("BidIsOver");
                }
            });
        });

        describe("Invalid Fee Account", () => {
            it("should fail when providing wrong fee account", async () => {
                const bidder = Keypair.generate();
                const wrongFeeAccount = Keypair.generate().publicKey;

                const airdropSig = await provider.connection.requestAirdrop(bidder.publicKey, LAMPORTS_PER_SOL);
                await provider.connection.confirmTransaction(airdropSig);

                const bidderProvider = new anchor.AnchorProvider(
                    provider.connection,
                    new anchor.Wallet(bidder),
                    provider.opts
                );
                const bidderProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, bidderProvider);

                // Try to bid with wrong fee account
                try {
                    await bidderProgram.methods.bid().accounts({ feeAccount: wrongFeeAccount }).rpc();
                    expect.fail("Should have thrown error");
                } catch (err: any) {
                    expect(err.toString()).to.include("WrongFeeAccount");
                }
            });
        });

        describe("Invalid Pot Accounts", () => {
            it("should fail when providing wrong pot account", async () => {
                const bidder = Keypair.generate();
                const wrongPot = Keypair.generate().publicKey;

                const airdropSig = await provider.connection.requestAirdrop(bidder.publicKey, LAMPORTS_PER_SOL);
                await provider.connection.confirmTransaction(airdropSig);

                const bidderProvider = new anchor.AnchorProvider(
                    provider.connection,
                    new anchor.Wallet(bidder),
                    provider.opts
                );
                const bidderProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, bidderProvider);

                // Try to bid with wrong pot account - should fail with ConstraintSeeds
                try {
                    await bidderProgram.methods
                        .bid()
                        .accountsPartial({
                            feeAccount: feeAccount,
                            pot: wrongPot,
                        })
                        .rpc();
                    expect.fail("Should have thrown error");
                } catch (err: any) {
                    expect(err.toString()).to.include("ConstraintSeeds");
                }
            });

            it("should fail when providing wrong next_pot account", async () => {
                const bidder = Keypair.generate();
                const wrongNextPot = Keypair.generate().publicKey;

                const airdropSig = await provider.connection.requestAirdrop(bidder.publicKey, LAMPORTS_PER_SOL);
                await provider.connection.confirmTransaction(airdropSig);

                const bidderProvider = new anchor.AnchorProvider(
                    provider.connection,
                    new anchor.Wallet(bidder),
                    provider.opts
                );
                const bidderProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, bidderProvider);

                // Try to bid with wrong next_pot account - should fail with ConstraintSeeds
                try {
                    await bidderProgram.methods
                        .bid()
                        .accountsPartial({
                            feeAccount: feeAccount,
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
