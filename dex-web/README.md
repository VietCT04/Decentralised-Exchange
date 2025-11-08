# Decentralised-Exchange (DEX) — Hardhat 3 + Next.js

A minimal **order‑book DEX MVP** with a token factory and a Next.js frontend. It lets you **issue ERC‑20 tokens**, place **limit orders**, simulate **market orders**, and **cancel/fill** orders — on a local Hardhat chain or **Sepolia**.

> Core stack: **Solidity 0.8.28**, **Hardhat 3**, **ethers.js**, **Next.js (App Router, TypeScript)**.

---

## How it works

### Smart contracts
- **`TokenFactory.sol`** — Issues ERC‑20 tokens via `issueToken(name, symbol, initialSupply)`. Emits a `TokenIssued` event and returns the token address.
- **`SimpleDex.sol` (V1)** — A simple **limit‑order book** for any ERC‑20 pair. Key functions:
  - `createOrder(sellToken, buyToken, sellAmount, buyAmount)`
  - `fillOrder(id, sellAmountToTake)`
  - `cancelOrder(id)`
  - `getOrdersLength()`, `getOrder(id)`
- **`SimpleDexV2.sol`** — Refined order‑matching helpers (e.g., `_crosses`) and cleaner pair bookkeeping. You can swap this in when you want the upgraded behaviour.
- Helper/mock tokens: **`TokenA.sol`**, **`TokenB.sol`**, **`TestToken.sol`**, plus small samples **`Hello.sol`**, **`Counter.sol`** for sanity tests.

### Frontend (`dex-web/`)
Next.js app with simple cards to:
- **Connect wallet** (MetaMask)
- **Issue token** (via `TokenFactory`)
- **Create limit orders** and **market‑style trades**
- View a live **order book** (reads `getOrdersLength/getOrder`)
- Uses network‑specific address files:
  - `src/lib/addresses.local.json` (Hardhat local)
  - `src/lib/addresses.sepolia.json` (Sepolia testnet)
The deployment scripts keep these files up‑to‑date.

---

## Repository structure

```
.
├─ contracts/                # Solidity contracts
│  ├─ SimpleDex.sol
│  ├─ SimpleDexV2.sol
│  ├─ TokenFactory.sol
│  ├─ TokenA.sol / TokenB.sol / TestToken.sol
│  └─ Hello.sol / Counter.sol
├─ dex-web/                  # Next.js (App Router) frontend
│  └─ src/app/...            # UI (IssueToken, OrderBook, Limit/Market cards)
├─ scripts/                  # Deployment helpers (local + Sepolia)
│  ├─ deployDex-write-frontend.js
│  ├─ deployFactory-write-frontend.js
│  ├─ deployTokens-standalone.js
│  ├─ deployDex-sepolia.mjs / deployDexV2-sepolia.mjs
│  ├─ deployFactory-sepolia.mjs / deployTokens-sepolia.mjs
│  └─ ping.js / ping-standalone.js / send-op-tx.ts
├─ ignition/modules/         # (Sample module placeholder)
├─ test/                     # mocha + ethers tests
│  └─ hello.test.js
├─ hardhat.config.js         # Hardhat 3 config (hardhat + sepolia)
├─ package.json
└─ README.md
```

---

## Prerequisites

- Node.js LTS and npm
- MetaMask browser extension
- (For Sepolia) a funded test account and RPC URL

---

## Setup

Install dependencies at the repo root:
```bash
npm install
```

Install the frontend deps:
```bash
cd dex-web
npm install
cd ..
```

Copy or create the two address files if they don’t exist (the deploy scripts will also create/update them):
```text
dex-web/src/lib/addresses.local.json
dex-web/src/lib/addresses.sepolia.json
```

---

## Local development (Hardhat)

### 1) Start a local chain
```bash
npx hardhat node
```
- RPC: `http://127.0.0.1:8545`, Chain ID: **31337**

### 2) Deploy Factory + DEX + demo tokens (and write frontend addresses)
In a new terminal:
```bash
node scripts/deployFactory-write-frontend.js
node scripts/deployDex-write-frontend.js
node scripts/deployTokens-standalone.js
```
These scripts will write to `dex-web/src/lib/addresses.local.json` with the deployed **FACTORY**, **DEX**, and token addresses.

### 3) Connect MetaMask
- Import one of the private keys shown by `npx hardhat node` (dev accounts).
- Add a **Custom Network**:
  - RPC URL: `http://127.0.0.1:8545`
  - Chain ID: `31337`
  - Currency symbol: `ETH`

### 4) Run the frontend
```bash
cd dex-web
npm run dev
```
Open the local URL (e.g., `http://localhost:3000/`). Make sure MetaMask is on **Hardhat (31337)**.

---

## Sepolia deployment

Set env vars (e.g., in a `.env` at the repo root):
```bash
SEPOLIA_RPC_URL=...
SEPOLIA_PRIVATE_KEY=0xYourPrivateKey # use a throwaway test account
ETHERSCAN_API_KEY=...               # optional, for contract verification
```

Deploy:
```bash
# Factory + DEX + tokens (choose the ones you need)
node scripts/deployFactory-sepolia.mjs
node scripts/deployDex-sepolia.mjs        # or deployDexV2-sepolia.mjs
node scripts/deployTokens-sepolia.mjs
```
The scripts will update `dex-web/src/lib/addresses.sepolia.json`.  
Start the frontend the same way and switch MetaMask to **Sepolia (11155111)**.

---

## NPM scripts

At the root:
```bash
# Run mocha tests
npx hardhat test

# Compile only
npx hardhat compile

# Local JSON-RPC
npx hardhat node
```

At `dex-web/`:
```bash
npm run dev     # start Next.js (App Router)
npm run build   # production build
npm start       # run production server
```

---

## Contract ABIs used in the UI

See `dex-web/src/lib/abi.ts`. The UI uses minimal ABIs for:
- `TokenFactory.issueToken(...)` + `TokenIssued` event
- ERC‑20 methods: `symbol()`, `decimals()`, `balanceOf()`, `approve()`
- DEX methods: `createOrder`, `fillOrder`, `cancelOrder`, `getOrdersLength`, `getOrder`

---

## Troubleshooting

- **Frontend can’t find addresses** — Ensure you ran the deploy scripts that write `addresses.local.json` / `addresses.sepolia.json`.
- **“insufficient allowance” on create/fill** — Approve the DEX to spend your token first. The UI will prompt/guide you.
- **Wrong network** — The UI expects the network that matches the selected `addresses.*.json`. Switch MetaMask or run the appropriate deploy script.
- **Fresh node** — Restarting `npx hardhat node` wipes the chain state; redeploy and refresh addresses.

---

## Security & Notes

- Educational MVP; **not audited**. Don’t use with real funds.
- Keep private keys out of source control. Use environment variables for secrets.

---

## License

MIT