# KOTB - King of the Block

A Solana on-chain game where players compete to accumulate blocks.

## Program IDs

| Network  | Program ID                                     |
|----------|------------------------------------------------|
| Devnet   | `C5iJH6xmzE9228AEBNfSRsb8F1LU7SdCzMAAUk535RZo` |
| Mainnet  | `ATYRjaUqYm87Z86G5DvteEX4RN2RuYKkMdyq8mhud2dp` |

## Instructions

### `initialize_state`

Initializes the game state and settings. Can only be called once.

**Args:**
- `authority: Pubkey` - Admin wallet
- `fee_account: Pubkey` - Account that receives fees

**Accounts:**
- `payer` (signer, mut) - Pays for account creation
- `game_state` (PDA) - Game state account
- `settings` (PDA) - Game settings account
- `pot` (PDA) - Current pot vault
- `next_pot` (PDA) - Next round pot vault
- `system_program`

---

### `bid`

Places a bid in the current game round. Resets the countdown timer.

**Accounts:**
- `bidder` (signer, mut) - The player placing the bid
- `game_state` (PDA, mut)
- `settings` (PDA)
- `pot` (PDA, mut)
- `next_pot` (PDA, mut)
- `fee_account` (mut) - Must match settings.fee_account
- `system_program`

---

### `update_settings`

Updates game settings. Only callable by the authority.

**Args:**
- `update: SettingsUpdate` - Optional fields to update:
  - `slots_to_win: Option<u64>`
  - `new_authority: Option<Pubkey>`
  - `new_fee_account: Option<Pubkey>`
  - `bid_value_rate_bps: Option<u16>`
  - `fee_bps: Option<u16>`
  - `pot_bps: Option<u16>`
  - `next_bps: Option<u16>`
  - `bid_value: Option<u64>`

**Accounts:**
- `settings` (PDA, mut)
- `authority` (signer, mut) - Must match settings.authority

---

### `endgame`

Ends the game and transfers the prize to the winner. Can be called by anyone after the countdown expires.

**Accounts:**
- `game_state` (PDA, mut)
- `settings` (PDA)
- `pot` (PDA, mut)
- `next_pot` (PDA, mut)
- `winner` (mut) - Must match game_state.last_bidder
- `system_program`

## PDAs (Seeds)

| Account      | Seed          |
|--------------|---------------|
| `game_state` | `"game_state"`|
| `settings`   | `"settings"`  |
| `pot`        | `"pot"`       |
| `next_pot`   | `"next_pot"`  |