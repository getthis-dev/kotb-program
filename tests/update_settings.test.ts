import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Kotb } from "../target/types/kotb";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import { initializeState } from "./helpers/test-setup";
import { GAME_STATE_SEED, SETTINGS_SEED, POT_SEED, NEXT_POT_SEED } from "./helpers/constants";

describe("update_settings", () => {
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.Kotb as Program<Kotb>;
    const provider = anchor.AnchorProvider.env();

    let settingsPda: PublicKey;
    let gameStatePda: PublicKey;
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

    describe("Authorization", () => {
        it("should fail if not called by authority", async () => {
            const unauthorizedUser = Keypair.generate();

            // Airdrop to unauthorized user
            const airdropSig = await provider.connection.requestAirdrop(unauthorizedUser.publicKey, LAMPORTS_PER_SOL);
            await provider.connection.confirmTransaction(airdropSig);

            try {
                await program.methods
                    .updateSettings({
                        slotsToWin: new anchor.BN(200),
                        newAuthority: null,
                        newFeeAccount: null,
                        bidValueRateBps: null,
                        feeBps: null,
                        potBps: null,
                        nextBps: null,
                        bidValue: null,
                    })
                    .accounts({
                        settings: settingsPda,
                        authority: unauthorizedUser.publicKey
                    })
                    .signers([unauthorizedUser])
                    .rpc();
                
                expect.fail("Should have thrown error");
            } catch (err: any) {
                expect(err.toString()).to.include("Unauthorized");
            }
        });

        it("should fail if authority account is different from signer", async () => {
            const unauthorizedUser = Keypair.generate();

            // Airdrop to unauthorized user
            const airdropSig = await provider.connection.requestAirdrop(unauthorizedUser.publicKey, LAMPORTS_PER_SOL);
            await provider.connection.confirmTransaction(airdropSig);

            try {
                await program.methods
                    .updateSettings({
                        slotsToWin: new anchor.BN(200),
                        newAuthority: null,
                        newFeeAccount: null,
                        bidValueRateBps: null,
                        feeBps: null,
                        potBps: null,
                        nextBps: null,
                        bidValue: null,
                    })
                    .accounts({
                        settings: settingsPda,
                        authority
                    })
                    .signers([unauthorizedUser])
                    .rpc();
                
                expect.fail("Should have thrown error");
            } catch (err: any) {
                expect(err.toString()).to.include("unknown signer");
            }
        });

        it("should allow updates by authority", async () => {
            const newSlotsToWin = 200;

            await program.methods
                .updateSettings({
                    slotsToWin: new anchor.BN(newSlotsToWin),
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: null,
                    potBps: null,
                    nextBps: null,
                    bidValue: null,
                })
                .accounts({
                    settings: settingsPda,
                })
                .rpc();

            const settings = await program.account.gameSettings.fetch(settingsPda);
            expect(settings.slotsToWin.toNumber()).to.equal(newSlotsToWin);
        });
    });

    describe("Field Validation", () => {
        it("should fail if slots_to_win is 0", async () => {
            try {
                await program.methods
                    .updateSettings({
                        slotsToWin: new anchor.BN(0),
                        newAuthority: null,
                        newFeeAccount: null,
                        bidValueRateBps: null,
                        feeBps: null,
                        potBps: null,
                        nextBps: null,
                        bidValue: null,
                    })
                    .accounts({
                        settings: settingsPda,
                    })
                    .rpc();

                expect.fail("Should have thrown error");
            } catch (err: any) {
                expect(err.toString()).to.include("InvalidValue");
            }
        });

        it("should fail if bid_value_rate_bps is 0", async () => {
            try {
                await program.methods
                    .updateSettings({
                        slotsToWin: null,
                        newAuthority: null,
                        newFeeAccount: null,
                        bidValueRateBps: 0,
                        feeBps: null,
                        potBps: null,
                        nextBps: null,
                        bidValue: null,
                    })
                    .accounts({
                        settings: settingsPda,
                    })
                    .rpc();

                expect.fail("Should have thrown error");
            } catch (err: any) {
                expect(err.toString()).to.include("InvalidValue");
            }
        });

        it("should fail if bid_value_rate_bps is > 10,000", async () => {
            try {
                await program.methods
                    .updateSettings({
                        slotsToWin: null,
                        newAuthority: null,
                        newFeeAccount: null,
                        bidValueRateBps: 10_001,
                        feeBps: null,
                        potBps: null,
                        nextBps: null,
                        bidValue: null,
                    })
                    .accounts({
                        settings: settingsPda,
                    })
                    .rpc();

                expect.fail("Should have thrown error");
            } catch (err: any) {
                expect(err.toString()).to.include("InvalidValue");
            }
        });

        it("should fail if fee_bps is > 10,000", async () => {
            try {
                await program.methods
                    .updateSettings({
                        slotsToWin: null,
                        newAuthority: null,
                        newFeeAccount: null,
                        bidValueRateBps: null,
                        feeBps: 10_001,
                        potBps: null,
                        nextBps: null,
                        bidValue: null,
                    })
                    .accounts({
                        settings: settingsPda,
                    })
                    .rpc();

                expect.fail("Should have thrown error");
            } catch (err: any) {
                expect(err.toString()).to.include("InvalidValue");
            }
        });

        it("should fail if pot_bps is > 10,000", async () => {
            try {
                await program.methods
                    .updateSettings({
                        slotsToWin: null,
                        newAuthority: null,
                        newFeeAccount: null,
                        bidValueRateBps: null,
                        feeBps: null,
                        potBps: 10_001,
                        nextBps: null,
                        bidValue: null,
                    })
                    .accounts({
                        settings: settingsPda,
                    })
                    .rpc();

                expect.fail("Should have thrown error");
            } catch (err: any) {
                expect(err.toString()).to.include("InvalidValue");
            }
        });

        it("should fail if next_bps is > 10,000", async () => {
            try {
                await program.methods
                    .updateSettings({
                        slotsToWin: null,
                        newAuthority: null,
                        newFeeAccount: null,
                        bidValueRateBps: null,
                        feeBps: null,
                        potBps: null,
                        nextBps: 10_001,
                        bidValue: null,
                    })
                    .accounts({
                        settings: settingsPda,
                    })
                    .rpc();

                expect.fail("Should have thrown error");
            } catch (err: any) {
                expect(err.toString()).to.include("InvalidValue");
            }
        });

        it("should accept bid_value = 0 (dynamic mode)", async () => {
            await program.methods
                .updateSettings({
                    slotsToWin: null,
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: null,
                    potBps: null,
                    nextBps: null,
                    bidValue: new anchor.BN(0),
                })
                .accounts({
                    settings: settingsPda,
                })
                .rpc();

            const settings = await program.account.gameSettings.fetch(settingsPda);
            expect(settings.bidValue.toNumber()).to.equal(0);
        });

        it("should accept positive bid_value (fixed mode)", async () => {
            const fixedBidValue = LAMPORTS_PER_SOL;

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
        });
    });

    describe("Percentage Validation", () => {
        it("should fail if BPS sum is not 10,000", async () => {
            try {
                await program.methods
                    .updateSettings({
                        slotsToWin: null,
                        newAuthority: null,
                        newFeeAccount: null,
                        bidValueRateBps: null,
                        feeBps: 1_000,
                        potBps: 5_000,
                        nextBps: 3_000, // Total = 9,000 (invalid)
                        bidValue: null,
                    })
                    .accounts({
                        settings: settingsPda,
                    })
                    .rpc();

                expect.fail("Should have thrown error");
            } catch (err: any) {
                expect(err.toString()).to.include("InvalidPercentages");
            }
        });

        it("should accept valid BPS sum of 10,000", async () => {
            await program.methods
                .updateSettings({
                    slotsToWin: null,
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: 1_000,
                    potBps: 5_000,
                    nextBps: 4_000, // Total = 10,000 (valid)
                    bidValue: null,
                })
                .accounts({
                    settings: settingsPda,
                })
                .rpc();

            const settings = await program.account.gameSettings.fetch(settingsPda);
            expect(settings.feeBps).to.equal(1_000);
            expect(settings.potBps).to.equal(5_000);
            expect(settings.nextBps).to.equal(4_000);
        });

        it("should maintain valid BPS sum on partial update", async () => {
            // First set valid values
            await program.methods
                .updateSettings({
                    slotsToWin: null,
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: 2_000,
                    potBps: 4_000,
                    nextBps: 4_000,
                    bidValue: null,
                })
                .accounts({
                    settings: settingsPda,
                })
                .rpc();

            // Try to update only fee_bps to a value that breaks the sum
            try {
                await program.methods
                    .updateSettings({
                        slotsToWin: null,
                        newAuthority: null,
                        newFeeAccount: null,
                        bidValueRateBps: null,
                        feeBps: 3_000, // Would make total 11,000
                        potBps: null,
                        nextBps: null,
                        bidValue: null,
                    })
                    .accounts({
                        settings: settingsPda,
                    })
                    .rpc();

                expect.fail("Should have thrown error");
            } catch (err: any) {
                expect(err.toString()).to.include("InvalidPercentages");
            }
        });
    });

    describe("Field Updates", () => {
        it("should update slots_to_win", async () => {
            const newValue = 300;

            await program.methods
                .updateSettings({
                    slotsToWin: new anchor.BN(newValue),
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: null,
                    potBps: null,
                    nextBps: null,
                    bidValue: null,
                })
                .accounts({
                    settings: settingsPda,
                })
                .rpc();

            const settings = await program.account.gameSettings.fetch(settingsPda);
            expect(settings.slotsToWin.toNumber()).to.equal(newValue);
        });

        it("should update authority and new authority can make updates", async () => {
            const newAuthority = Keypair.generate();

            try {
                // Airdrop to new authority
                const airdropSig = await provider.connection.requestAirdrop(newAuthority.publicKey, LAMPORTS_PER_SOL);
                await provider.connection.confirmTransaction(airdropSig);

                // Update to new authority
                await program.methods
                    .updateSettings({
                        slotsToWin: null,
                        newAuthority: newAuthority.publicKey,
                        newFeeAccount: null,
                        bidValueRateBps: null,
                        feeBps: null,
                        potBps: null,
                        nextBps: null,
                        bidValue: null,
                    })
                    .accounts({
                        settings: settingsPda,
                    })
                    .rpc();

                // Verify new authority
                let settings = await program.account.gameSettings.fetch(settingsPda);
                expect(settings.authority.toBase58()).to.equal(newAuthority.publicKey.toBase58());

                // New authority can update - create temporary provider with newAuthority
                const newProvider = new anchor.AnchorProvider(
                    provider.connection,
                    new anchor.Wallet(newAuthority),
                    provider.opts
                );
                const newProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, newProvider);

                await newProgram.methods
                    .updateSettings({
                        slotsToWin: new anchor.BN(400),
                        newAuthority: null,
                        newFeeAccount: null,
                        bidValueRateBps: null,
                        feeBps: null,
                        potBps: null,
                        nextBps: null,
                        bidValue: null,
                    })
                    .accounts({
                        settings: settingsPda,
                    })
                    .rpc();

                settings = await program.account.gameSettings.fetch(settingsPda);
                expect(settings.slotsToWin.toNumber()).to.equal(400);

                // Old authority cannot update
                try {
                    await program.methods
                        .updateSettings({
                            slotsToWin: new anchor.BN(500),
                            newAuthority: null,
                            newFeeAccount: null,
                            bidValueRateBps: null,
                            feeBps: null,
                            potBps: null,
                            nextBps: null,
                            bidValue: null,
                        })
                        .accounts({
                            settings: settingsPda,
                        })
                        .rpc();

                    expect.fail("Old authority should not be able to update");
                } catch (err: any) {
                    expect(err.toString()).to.include("Unauthorized");
                }
            } finally {
                // ALWAYS restore original authority, even if test fails
                try {
                    const newProvider = new anchor.AnchorProvider(
                        provider.connection,
                        new anchor.Wallet(newAuthority),
                        provider.opts
                    );
                    const newProgram = new anchor.Program<Kotb>(program.idl as anchor.Idl, newProvider);

                    await newProgram.methods
                        .updateSettings({
                            slotsToWin: null,
                            newAuthority: authority,
                            newFeeAccount: null,
                            bidValueRateBps: null,
                            feeBps: null,
                            potBps: null,
                            nextBps: null,
                            bidValue: null,
                        })
                        .accounts({
                            settings: settingsPda,
                        })
                        .rpc();
                } catch (restoreErr) {
                    console.error("Failed to restore authority:", restoreErr);
                    throw restoreErr;
                }
            }
        });

        it("should update fee_account", async () => {
            const newFeeAccount = Keypair.generate().publicKey;

            await program.methods
                .updateSettings({
                    slotsToWin: null,
                    newAuthority: null,
                    newFeeAccount: newFeeAccount,
                    bidValueRateBps: null,
                    feeBps: null,
                    potBps: null,
                    nextBps: null,
                    bidValue: null,
                })
                .accounts({
                    settings: settingsPda,
                })
                .rpc();

            const settings = await program.account.gameSettings.fetch(settingsPda);
            expect(settings.feeAccount.toBase58()).to.equal(newFeeAccount.toBase58());
        });

        it("should update multiple fields at once", async () => {
            const newSlotsToWin = 250;
            const newBidValue = LAMPORTS_PER_SOL * 2; // 2 SOL
            const newFeeBps = 1_500;

            await program.methods
                .updateSettings({
                    slotsToWin: new anchor.BN(newSlotsToWin),
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: newFeeBps,
                    potBps: 4_500,
                    nextBps: 4_000,
                    bidValue: new anchor.BN(newBidValue),
                })
                .accounts({
                    settings: settingsPda,
                })
                .rpc();

            const settings = await program.account.gameSettings.fetch(settingsPda);
            expect(settings.slotsToWin.toNumber()).to.equal(newSlotsToWin);
            expect(settings.bidValue.toNumber()).to.equal(newBidValue);
            expect(settings.feeBps).to.equal(newFeeBps);
        });

        it("should transition bid_value from 0 to fixed", async () => {
            // Set to dynamic mode
            await program.methods
                .updateSettings({
                    slotsToWin: null,
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: null,
                    potBps: null,
                    nextBps: null,
                    bidValue: new anchor.BN(0),
                })
                .accounts({
                    settings: settingsPda,
                })
                .rpc();

            let settings = await program.account.gameSettings.fetch(settingsPda);
            expect(settings.bidValue.toNumber()).to.equal(0);

            // Transition to fixed mode
            const fixedValue = LAMPORTS_PER_SOL * 5;
            await program.methods
                .updateSettings({
                    slotsToWin: null,
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: null,
                    potBps: null,
                    nextBps: null,
                    bidValue: new anchor.BN(fixedValue),
                })
                .accounts({
                    settings: settingsPda,
                })
                .rpc();

            settings = await program.account.gameSettings.fetch(settingsPda);
            expect(settings.bidValue.toNumber()).to.equal(fixedValue);
        });

        it("should transition bid_value from fixed to 0", async () => {
            // Set to fixed mode
            const fixedValue = LAMPORTS_PER_SOL * 3;
            await program.methods
                .updateSettings({
                    slotsToWin: null,
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: null,
                    potBps: null,
                    nextBps: null,
                    bidValue: new anchor.BN(fixedValue),
                })
                .accounts({
                    settings: settingsPda,
                })
                .rpc();

            let settings = await program.account.gameSettings.fetch(settingsPda);
            expect(settings.bidValue.toNumber()).to.equal(fixedValue);

            // Transition to dynamic mode
            await program.methods
                .updateSettings({
                    slotsToWin: null,
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: null,
                    potBps: null,
                    nextBps: null,
                    bidValue: new anchor.BN(0),
                })
                .accounts({
                    settings: settingsPda,
                })
                .rpc();

            settings = await program.account.gameSettings.fetch(settingsPda);
            expect(settings.bidValue.toNumber()).to.equal(0);
        });

        it("should not alter fields not passed in update", async () => {
            // First, set known values
            const initialSlotsToWin = 150;
            const initialFeeBps = 1_000;
            const initialPotBps = 5_000;
            const initialNextBps = 4_000;
            const initialBidValue = LAMPORTS_PER_SOL;

            await program.methods
                .updateSettings({
                    slotsToWin: new anchor.BN(initialSlotsToWin),
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: initialFeeBps,
                    potBps: initialPotBps,
                    nextBps: initialNextBps,
                    bidValue: new anchor.BN(initialBidValue),
                })
                .accounts({
                    settings: settingsPda,
                })
                .rpc();

            let settings = await program.account.gameSettings.fetch(settingsPda);
            expect(settings.slotsToWin.toNumber()).to.equal(initialSlotsToWin);
            expect(settings.feeBps).to.equal(initialFeeBps);
            expect(settings.bidValue.toNumber()).to.equal(initialBidValue);

            // Update only slots_to_win, everything else should remain unchanged
            const newSlotsToWin = 200;
            await program.methods
                .updateSettings({
                    slotsToWin: new anchor.BN(newSlotsToWin),
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: null,
                    potBps: null,
                    nextBps: null,
                    bidValue: null,
                })
                .accounts({
                    settings: settingsPda,
                })
                .rpc();

            settings = await program.account.gameSettings.fetch(settingsPda);

            // Updated field
            expect(settings.slotsToWin.toNumber()).to.equal(newSlotsToWin);

            // Unchanged fields
            expect(settings.feeBps).to.equal(initialFeeBps);
            expect(settings.potBps).to.equal(initialPotBps);
            expect(settings.nextBps).to.equal(initialNextBps);
            expect(settings.bidValue.toNumber()).to.equal(initialBidValue);
        });
    });

    describe("Events", () => {
        it("should emit SettingsUpdated event with all values including bid_value", async () => {
            const newSlotsToWin = 175;
            const newBidValue = LAMPORTS_PER_SOL / 10;

            const listener = program.addEventListener("settingsUpdated", (event) => {
                expect(event.slotsToWin.toNumber()).to.equal(newSlotsToWin);
                expect(event.bidValue.toNumber()).to.equal(newBidValue);
                expect(event.newAuthority.toBase58()).to.equal(authority.toBase58());
                expect(event.feeBps).to.be.a("number");
                expect(event.potBps).to.be.a("number");
                expect(event.nextBps).to.be.a("number");
                expect(event.vaultMinLamports.toNumber()).to.be.greaterThan(0);
            });

            await program.methods
                .updateSettings({
                    slotsToWin: new anchor.BN(newSlotsToWin),
                    newAuthority: null,
                    newFeeAccount: null,
                    bidValueRateBps: null,
                    feeBps: null,
                    potBps: null,
                    nextBps: null,
                    bidValue: new anchor.BN(newBidValue),
                })
                .accounts({
                    settings: settingsPda,
                })
                .rpc();

            // Give some time for event to be processed
            await new Promise((resolve) => setTimeout(resolve, 1000));

            program.removeEventListener(listener);
        });
    });
});
