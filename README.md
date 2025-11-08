# Decentralised-Exchange (DEX) — Monorepo

A minimal **order-book DEX MVP** with Solidity smart contracts, deployment scripts, and a **Next.js** frontend.

- Contracts: `contracts/` (SimpleDex, SimpleDexV2, TokenFactory, sample ERC-20s)
- Frontend: `dex-web/` (Next.js App Router, TypeScript)
- Tooling: **Hardhat 3**, **ethers.js**, **mocha**

## Repo Layout
```
.
├─ contracts/
├─ dex-web/
├─ scripts/
├─ ignition/modules/
├─ test/
├─ hardhat.config.js
└─ package.json
```

## Quickstart (Local)
```bash
npm install
npx hardhat node                           # terminal 1

node scripts/deployFactory-write-frontend.js   # terminal 2
node scripts/deployDex-write-frontend.js
node scripts/deployTokens-standalone.js
```

Addresses are written to `dex-web/src/lib/addresses.local.json`.

Run the frontend:
```bash
cd dex-web
npm install
npm run dev
```

## Sepolia (Testnet)
Set env (e.g. `.env` at repo root):
```bash
SEPOLIA_RPC_URL=...
SEPOLIA_PRIVATE_KEY=0xYourPrivateKey
ETHERSCAN_API_KEY=...
```
Deploy:
```bash
node scripts/deployFactory-sepolia.mjs
node scripts/deployDex-sepolia.mjs        # or deployDexV2-sepolia.mjs
node scripts/deployTokens-sepolia.mjs
```
This updates `dex-web/src/lib/addresses.sepolia.json`.

## Testing
```bash
npx hardhat test
```

## Notes
- Educational MVP — **not audited**. Don’t use with real funds.
- Restarting `npx hardhat node` wipes state; redeploy and refresh addresses.

## License
MIT