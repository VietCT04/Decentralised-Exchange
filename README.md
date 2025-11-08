# Decentralised-Exchange (DEX) 

**NTU Development Project**  
A minimal **order‑book DApp** with: (1) Solidity smart contracts, (2) deployment scripts, and (3) a **Next.js** frontend. You can **issue ERC‑20 tokens**, place **limit orders**, simulate **market orders**, and **cancel/fill** orders on **Hardhat local** or **Sepolia**.

> Stack: **Solidity 0.8.28**, **Hardhat 3**, **ethers.js**, **Next.js (App Router, TS)**

---

## 1) Project Summary (What & Why)
- **What:** A simple on‑chain **order‑book DEX** that supports issuing tokens and submitting/fulfilling limit orders between ERC‑20 pairs.
- **Why (practicality):** Demonstrates token lifecycle (minting & approvals), order creation/cancellation, and fills using a clear, auditable path that TAs can reproduce in minutes.

---

## 2) Architecture Overview

```
User (MetaMask)
   │
   ▼
Next.js Frontend (dex-web)  ──────── reads/writes via ethers.js ────────►  Hardhat JSON-RPC / Sepolia
   │                                                                          │
   ├── IssueTokenCard ─────► TokenFactory.issueToken(...) ── emits TokenIssued │
   ├── DexLimitOrderCard ─► SimpleDex.createOrder / cancel / getOrder         │
   ├── DexMarketOrderCard ─► SimpleDex.fillOrder(...)                          │
   └── OrderBookCard ─────► SimpleDex.getOrdersLength/getOrder                ▼
Smart Contracts
   ├── TokenFactory.sol (ERC‑20 factory)
   ├── SimpleDex.sol (V1 order book)
   ├── SimpleDexV2.sol (refined bookkeeping/helpers)
   └── TokenA/TokenB/TestToken (sample ERC‑20)
```

**Addresses files used by UI**
- `dex-web/src/lib/addresses.local.json` (for Hardhat 31337)
- `dex-web/src/lib/addresses.sepolia.json` (for Sepolia 11155111)

These are **written by the deploy scripts** so TAs don’t have to manually copy addresses.

---

## 3) Contract Specs (Key Interfaces)

### 3.1 TokenFactory.sol
Issues ERC‑20 tokens and emits `TokenIssued`.


### 3.2 SimpleDex.sol (V1)
Minimal order‑book for any ERC‑20 pair. Public methods/events used by UI:


### 3.3 SimpleDexV2.sol (Upgraded internals)
Improved helpers (e.g., `_crosses`) and pair bookkeeping. Same external surface for create/cancel/getters; can be swapped in scripts.


> See `dex-web/src/lib/abi.ts` for the minimal ABIs consumed by the UI (ERC‑20, Factory, DEX).

---

## 4) Reproduction Steps (TA‑friendly)

### Local (Hardhat)
**Terminal 1 — start chain**
```bash
npm install
npx hardhat node    # RPC http://127.0.0.1:8545, ChainID 31337
```

**Terminal 2 — deploy + write addresses**
```bash
node scripts/deployFactory-write-frontend.js
node scripts/deployDex-write-frontend.js
node scripts/deployTokens-standalone.js
```

This writes **`dex-web/src/lib/addresses.local.json`** with FACTORY, DEX, and token addresses.

**Terminal 3 — run frontend**
```bash
cd dex-web
npm install
npm run dev
```
Open the shown URL. In MetaMask:
- Import one of the private keys printed by `npx hardhat node`.
- Ensure network is **Hardhat (31337)**.

### Sepolia (Testnet)
Set environment variables in `.env` at repo root:
```bash
SEPOLIA_RPC_URL=...
SEPOLIA_PRIVATE_KEY=0xYourTestPrivateKey   # use a throwaway account
ETHERSCAN_API_KEY=...                      # optional
```
Deploy:
```bash
node scripts/deployFactory-sepolia.mjs
node scripts/deployDex-sepolia.mjs          # or deployDexV2-sepolia.mjs
node scripts/deployTokens-sepolia.mjs
```
This updates **`dex-web/src/lib/addresses.sepolia.json`**. Run the frontend and switch MetaMask to **Sepolia (11155111)**.

---

## 5) Testing

Run unit/integration tests:
```bash
npx hardhat test
```
Manual test flow (covered by UI):
1. Issue two tokens (e.g., TKA/TKB) via **Issue Token**.
2. Approve DEX to spend each token.
3. Create a **Sell TKA / Buy TKB** limit order.
4. From another account, **fill** the order (or **cancel** from the maker).
5. Verify balances and order book state.

---

## 6) Design Choices & Rationale
- **Order‑book over AMM:** easier to reason about explicit prices and discrete orders in a course setting. Slippage is controlled by the maker’s `(sellAmount, buyAmount)`.
- **Events for state tracking:** order creation/cancellation can be indexed client‑side; UI also uses view getters for simplicity.
- **Address files checked into frontend:** deployment scripts keep them in sync, minimizing TA friction.

---

## 7) Security Notes & Limitations
- **Educational MVP—NOT audited.** No real funds.
- **Approvals:** Users must approve DEX to move tokens. The UI prompts as needed.
- **Reentrancy/Checks‑Effects‑Interactions:** Transfers happen after internal state updates; still, comprehensive audits are out of scope.
- **Matching & partial fills:** Only basic limit placement + fill shown; advanced matching, fee logic, and partial‑fill edge cases are limited.
- **No price oracle:** Prices derive from orders; no TWAP/Chainlink.

---

## 8) Gas & Practicality
- Minimal storage and event fields to keep gas reasonable.
- Scripts use **ethers.js** and avoid unnecessary re‑deploys by writing addresses JSONs for the UI.
- For higher marks, you can extend V2 with partial fills consolidation or event‑efficient indexing.

---

## Repository Layout
```
.
├─ contracts/                # SimpleDex, SimpleDexV2, TokenFactory, TokenA/B/TestToken
├─ dex-web/                  # Next.js app (App Router)
├─ scripts/                  # Local + Sepolia deployment helpers
├─ ignition/modules/         # (sample placeholder)
├─ test/                     # mocha + ethers tests
├─ hardhat.config.js
└─ package.json
```

## License
MIT