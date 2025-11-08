# dex-web - Next.js Frontend

UI for the DEX MVP. **Sepolia default**, Hardhat local supported.

---

## 0) Sepolia Quick Start

1) Ensure repo root `.env` is set and contracts are deployed with the `*-sepolia.mjs` scripts.  
2) Verify `src/lib/addresses.sepolia.json` exists and has DEX/FACTORY/token addresses.  
3) Run UI:
```bash
npm install
npm run dev
```
Open the shown URL and switch MetaMask to **Sepolia (11155111)**.

---

## Features

- **Issue Token** via `TokenFactory`
- **Limit Orders**: create/cancel
- **Market/Fill**: take existing orders
- **Order Book**: list via `getOrdersLength/getOrder`

Key files:
- `src/app/page.tsx`
- `src/app/components/IssueTokenCard.tsx`
- `src/app/components/DexLimitOrderCard.tsx`
- `src/app/components/DexMarketOrderCard.tsx`
- `src/app/components/OrderBookCard.tsx`
- `src/lib/abi.ts` and `src/lib/addresses.sepolia.json`

---

## Local (Hardhat) Alternative

If you prefer local testing:
```bash
# in repo root
npx hardhat node
node scripts/deployFactory-write-frontend.js
node scripts/deployDex-write-frontend.js
node scripts/deployTokens-standalone.js
# then in dex-web/
npm install
npm run dev
```
Switch MetaMask to **Hardhat (31337)** and ensure `src/lib/addresses.local.json` exists.

---

## Typical Flows

**Issue token**
1. Connect MetaMask.
2. Open Issue panel, enter name/symbol/supply.
3. Submit; token address appears (also visible in logs).

**Place limit order**
1. Approve DEX for your token (UI prompts if needed).
2. Choose sell token, buy token, and amounts (price = buy/sell).
3. Submit; order shows in Order Book.

**Fill or cancel**
- Fill from a second account using Market/Fill.
- Maker can cancel their own order.

---

## Troubleshooting

- **No contract at address** - re-run deploy scripts; ensure `addresses.*.json` is correct.
- **insufficient allowance** - approve DEX first.
- **Wrong network** - switch MetaMask to Sepolia/Hardhat to match the addresses file.
- **Restarted local node** - redeploy & rewrite addresses.

## License
MIT
