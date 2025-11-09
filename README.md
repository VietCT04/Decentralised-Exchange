# DEX-MVP (Sepolia) — How To Run & Grade

## Description  
A minimal order-book DEX you can run from a browser on Sepolia testnet.

- Issue ERC-20 tokens (via ERC20Factory)

- Place limit orders (rest on-chain, auto-match at maker price, partial fills supported)

- Place market orders (walk the book; refunds unused escrow)

- Frontend: Next.js + ethers v6 + MetaMask

- Contracts: ERC20Factory, SimpleDex V2

- Network: Sepolia only (Chain ID 11155111)

> Safety note: This is a teaching MVP for a testnet. Do not use with real funds.
---

## Prerequisites
- Node.js 20+ (22.x OK), npm (or pnpm)

- MetaMask (any Chromium/Firefox)

- Sepolia ETH for gas (faucet)

- An RPC endpoint (Alchemy/Infura or public)

## Environment Variables
#### Create .env at repo root:
```bash
# Used by deploy scripts (server-side; NEVER commit real keys)
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<YOUR_KEY>
SEPOLIA_PRIVATE_KEY=<YOUR_TEST_PRIVATE_KEY>     # test wallet only (must start with 0x)
ETHERSCAN_API_KEY=<optional_for_verification>
```

#### Create dex-web/.env.local:
```bash
# Must be NEXT_PUBLIC_* so the browser can read it
NEXT_PUBLIC_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/<YOUR_KEY>
```
> If NEXT_PUBLIC_SEPOLIA_RPC is omitted, the UI falls back to https://rpc.sepolia.org.

## Install, Compile, Deploy
From repo root:
```bash
# 1) Install deps (root + frontend)
npm i
cd dex-web && npm i && cd ..

# 2) Compile contracts
npx hardhat compile

# 3) Deploy to Sepolia (writes addresses to the UI)
node scripts/deployFactory-sepolia.mjs
node scripts/deployDexV2-sepolia.mjs
```
Expected output (shortened):
```bash
Network: sepolia 11155111
Factory: 0x...  (written to dex-web/src/lib/addresses.sepolia.json)
DEX:     0x...  (written to dex-web/src/lib/addresses.sepolia.json)
```
Verify file: dex-web/src/lib/addresses.sepolia.json contains:
```bash
{
  "FACTORY": "0x...",
  "DEX": "0x..."
}
```

## Run the Frontend
```
cd dex-web
npm run dev
```
Open: http://localhost:3000

Turn on your darkmode (just in case Tailwind don't work on your computer)

Click Connect Wallet → MetaMask will auto-switch to Sepolia (11155111).

Enjoy!!!
