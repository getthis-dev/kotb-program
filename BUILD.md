# Build and Deploy Guide

**IMPORTANT:** Always use `solana-verify build`, never `anchor build` for production.

## Prerequisites

- Anchor CLI 0.31.1
- Solana CLI
- Docker
- solana-verify CLI (mainnet only)

## Deploy to Devnet

### 1. Build

```bash
anchor build --arch sbf
```

### 2. Deploy

```bash
anchor deploy --provider.cluster devnet \
  --program-keypair keypairs/kotb-devnet-keypair.json \
  --program-name kotb
```

### 3. Initialize

```bash
cd scripts
ts-node initialize.ts
```

## Deploy to Mainnet

### 1. Build with solana-verify

```bash
SVB_DOCKER_MEMORY_LIMIT=4g SVB_DOCKER_CPU_LIMIT=4 \
  solana-verify build --library-name kotb -- --features mainnet
```

### 2. Backup Binary

```bash
cp target/deploy/kotb.so target/deploy/kotb-verified.so
```

### 3. Generate IDL (if needed)

**IMPORTANT:** Use `--provider.cluster mainnet` to generate IDL with the correct program ID.

```bash
anchor build --arch sbf --provider.cluster mainnet -- --features mainnet
cp target/deploy/kotb-verified.so target/deploy/kotb.so
```

### 4. Verify Hash

```bash
solana-verify get-executable-hash target/deploy/kotb.so
```

### 5. Deploy

```bash
solana program deploy target/deploy/kotb.so \
  --program-id keypairs/kotb-mainnet-keypair.json \
  --keypair <YOUR_AUTHORITY_KEYPAIR> \
  --url mainnet-beta \
  --with-compute-unit-price 100000
```

### 6. Verify On-Chain

```bash
solana-verify get-program-hash --url mainnet <PROGRAM_ID>
```

Hashes must match.

### 7. Commit and Tag

```bash
git add -A
git commit -m "chore: update program to v0.X.0"
git push origin master
git tag v0.X.0
git push origin v0.X.0
```

### 8. Publish Verification

```bash
SVB_DOCKER_MEMORY_LIMIT=4g SVB_DOCKER_CPU_LIMIT=4 \
  solana-verify verify-from-repo -y \
  --program-id <PROGRAM_ID> \
  https://github.com/getthis-dev/kotb-program \
  --commit-hash v0.X.0 \
  --library-name kotb \
  -- --features mainnet
```

### 9. Publish IDL On-Chain

**First time (init):**
```bash
anchor idl init \
  --filepath target/idl/kotb.json \
  --provider.cluster mainnet \
  --provider.wallet <YOUR_AUTHORITY_KEYPAIR> \
  <PROGRAM_ID>
```

**Updates (upgrade):**
```bash
anchor idl upgrade \
  --filepath target/idl/kotb.json \
  --provider.cluster mainnet \
  --provider.wallet <YOUR_AUTHORITY_KEYPAIR> \
  <PROGRAM_ID>
```

## Troubleshooting

**Insufficient funds:** Close old buffers
```bash
solana program show --buffers --url mainnet-beta
solana program close <BUFFER_ADDRESS> --url mainnet-beta
```

**Hash mismatch:** Ensure you used `solana-verify build` and didn't overwrite the binary.
