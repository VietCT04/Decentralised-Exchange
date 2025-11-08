# Decentralised-Exchange (DEX): SC4053 Development Project

**Description**  
A minimal **order-book DApp** with Solidity contracts, deployment scripts, and a **Next.js** frontend. You can **issue ERC‑20 tokens**, place **limit orders**, and **fill/cancel** orders on **Sepolia** or **Hardhat local**.

> Stack: **Solidity 0.8.28**, **Hardhat 3**, **ethers.js**, **Next.js (App Router, TS)**

---

## 0) TA Quick Start - Sepolia (Recommended)

1. **Environment**
   - Create `.env` at repo root:
     ```bash
     SEPOLIA_RPC_URL=...            # Alchemy/Infura
     SEPOLIA_PRIVATE_KEY=0x...      # throwaway test account
     ETHERSCAN_API_KEY=...          # optional
     ```
   - Ensure MetaMask is on **Sepolia (11155111)** and funded via faucet.

2. **Deploy**
   ```bash
   npm install
   node scripts/deployFactory-sepolia.mjs
   node scripts/deployDex-sepolia.mjs        # or deployDexV2-sepolia.mjs
   node scripts/deployTokens-sepolia.mjs
   ```
   These write `dex-web/src/lib/addresses.sepolia.json` for the frontend.

3. **Run frontend**
   ```bash
   cd dex-web
   npm install
   npm run dev
   ```
   Open the shown URL and interact (Issue Token → Approve → Create Order → Fill/Cancel).

---

## 1) What & Why

- **What:** On-chain **order-book DEX** supporting token issuance and limit orders for any ERC‑20 pair.
- **Why:** Demonstrates token lifecycle (mint, approve, transfer) and basic exchange mechanics in a reproducible, auditable setup.

---

## 2) Architecture

```
User (MetaMask)
   │
   ▼
Next.js (dex-web) ─────── ethers.js ───────► Sepolia / Hardhat
   │
   ├─ IssueTokenCard  ──► TokenFactory.issueToken(...)  (emits TokenIssued)
   ├─ DexLimitOrderCard ► SimpleDex.createOrder / cancel / getOrder
   ├─ DexMarketOrderCard► SimpleDex.fillOrder(...)
   └─ OrderBookCard     ► SimpleDex.getOrdersLength/getOrder
Smart Contracts
   ├─ TokenFactory.sol
   ├─ SimpleDex.sol (V1)
   ├─ SimpleDexV2.sol
   └─ TokenA/TokenB/TestToken
```

**Frontend address files**
- `dex-web/src/lib/addresses.sepolia.json` (Sepolia)
- `dex-web/src/lib/addresses.local.json` (Hardhat 31337)

Deployment scripts **write/update** these files automatically.

---

## 3) Contract Interfaces (high level)

- **TokenFactory.sol**
  - `issueToken(string name, string symbol, uint256 initialSupply)`
  - `TokenIssued(address token, address owner, string name, string symbol, uint256 initialSupply)`
- **SimpleDex.sol / SimpleDexV2.sol**
  - `createOrder(address sellToken, address buyToken, uint256 sellAmount, uint256 buyAmount)`
  - `fillOrder(uint256 id, uint256 sellAmountToTake)`
  - `cancelOrder(uint256 id)`
  - `getOrdersLength()` / `getOrder(uint256 id)`

(See `dex-web/src/lib/abi.ts` for minimal ABIs used by the UI.)

---

## 4) Local Development (Hardhat)

**Terminal 1**
```bash
npm install
npx hardhat node           # RPC http://127.0.0.1:8545, ChainID 31337
```

**Terminal 2 (deploy + write addresses)**
```bash
node scripts/deployFactory-write-frontend.js
node scripts/deployDex-write-frontend.js
node scripts/deployTokens-standalone.js
```
Writes **`dex-web/src/lib/addresses.local.json`**.

**Terminal 3 (frontend)**
```bash
cd dex-web
npm install
npm run dev
```
Switch MetaMask to **Hardhat (31337)** and import a dev key from the node output.

---

## 5) Testing

```bash
npx hardhat test
```
Manual flow: Issue two tokens → approve DEX → create order → fill/cancel → verify balances & order book.

---

## 6) Design Choices

- **Order-book (not AMM)** for explicit price control and simpler grading.
- **Events + getters** for easy client sync and TA verification.
- **Address JSONs** maintained by deploy scripts to avoid copy‑paste errors.

---

## 7) Security & Limitations

- Educational MVP - **not audited**. Do not use real funds.
- Approvals are required; UI assists with `approve(...)`.
- Basic matching & partial fills only; no fees / no oracle pricing.

---

## Repository Layout

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

## License
MIT
