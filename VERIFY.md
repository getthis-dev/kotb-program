# Verifiable Build

**Program ID:** `ATYRjaUqYm87Z86G5DvteEX4RN2RuYKkMdyq8mhud2dp`  
**Network:** Mainnet-beta  
**Repository:** https://github.com/getthis-dev/kotb-program  
**Tag:** v2.0.1

## Prerequisites

```bash
cargo install solana-verify
```

## Manual Verification

### 1. Get On-Chain Hash

```bash
solana-verify get-program-hash \
  --url mainnet-beta \
  ATYRjaUqYm87Z86G5DvteEX4RN2RuYKkMdyq8mhud2dp
```

**Expected:** `90ece2c92a90a8cef3317a4bc7c5c46c8ad66d5714bfdce442effff38bf80487`

### 2. Clone and Build

```bash
git clone https://github.com/getthis-dev/kotb-program
cd kotb-program
git checkout v2.0.1

SVB_DOCKER_MEMORY_LIMIT=4g SVB_DOCKER_CPU_LIMIT=4 \
  solana-verify build --library-name kotb -- --features mainnet
```

### 3. Get Local Hash

```bash
solana-verify get-executable-hash target/deploy/kotb.so
```

### 4. Compare

If hashes match → **Verified** ✅