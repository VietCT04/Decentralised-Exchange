# dex-web — Next.js Frontend for DEX MVP

This is the **Next.js (App Router)** UI for the Decentralised-Exchange MVP. It lets you:
- Connect wallet (MetaMask)
- **Issue ERC‑20** via `TokenFactory`
- Place **limit orders**, run **market-style** trades
- View **order book** (reads from `SimpleDex`/`SimpleDexV2`)

## Prerequisites
- Node.js LTS, npm
- MetaMask
- Running contracts + address files:
  - `src/lib/addresses.local.json`  (for Hardhat local)
  - `src/lib/addresses.sepolia.json` (for Sepolia)

These are written by the repo scripts (from the monorepo root):
```bash
node scripts/deployFactory-write-frontend.js
node scripts/deployDex-write-frontend.js
node scripts/deployTokens-standalone.js
```

## Install & Run
```bash
npm install
npm run dev
# open the shown URL (e.g., http://localhost:3000/)
```

## Configure Networks
Switch MetaMask to match the active address file:
- Local Hardhat: RPC `http://127.0.0.1:8545`, Chain ID `31337`
- Sepolia: Chain ID `11155111`

The app imports the right file internally (see `src/lib/addresses.*.json`).

## Key Files
- `src/app/page.tsx` — main page wiring the Issue/Trade/OrderBook components
- `src/app/components/IssueTokenCard.tsx` — calls `TokenFactory.issueToken(...)`
- `src/app/components/DexLimitOrderCard.tsx` / `DexMarketOrderCard.tsx`
- `src/app/components/OrderBookCard.tsx` — reads orders from DEX
- `src/lib/abi.ts` — minimal ABIs (ERC‑20, DEX, Factory)

## Troubleshooting
- **No addresses**: run the deploy scripts to generate `addresses.*.json`.
- **Network mismatch**: change MetaMask network to Hardhat or Sepolia.
- **Allowance errors**: approve the DEX to spend your token first (UI will prompt).

## License
MIT