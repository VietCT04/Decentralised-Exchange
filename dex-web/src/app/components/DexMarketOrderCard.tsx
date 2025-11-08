"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/app/providers/WalletProvider";
import { DEX_ABI, ERC20_ABI } from "@/lib/abi";
import addrs from "@/lib/addresses.sepolia.json";
import { NET } from "@/lib/net";

type TokenMeta = { symbol: string; decimals: number };
type Side = "sell" | "buy";

// ---- BigInt helpers (no BigInt literals) ----
const BI0 = BigInt(0);
const BI1 = BigInt(1);
const mulDiv = (n: bigint, m: bigint, d: bigint) => (n * m) / d;
const ceilMulDiv = (n: bigint, m: bigint, d: bigint) => (n * m + (d - BI1)) / d;

export default function DexMarketOrderCard() {
  const { provider, chainId } = useWallet();

  const [side, setSide] = useState<Side>("sell");
  const [baseToken, setBaseToken] = useState("");
  const [quoteToken, setQuoteToken] = useState("");
  const [amount, setAmount] = useState("10"); // base amount (sell for Sell, buy for Buy)

  const [meta, setMeta] = useState<Record<string, TokenMeta>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{
    type: "error" | "success" | "";
    text: string;
  }>({
    type: "",
    text: "",
  });

  const dexAddress = (addrs as any).DEX as string;

  // ------------ guards & metadata ------------
  async function requireSepolia(): Promise<boolean> {
    if (!provider) {
      setMsg({ type: "error", text: "Connect wallet first." });
      return false;
    }
    if (chainId !== NET.id) {
      setMsg({
        type: "error",
        text: `Switch MetaMask to ${NET.name} (${NET.id}).`,
      });
      return false;
    }
    const code = await provider.getCode(dexAddress);
    if (code === "0x") {
      setMsg({
        type: "error",
        text: "DEX is not deployed at the configured address on Sepolia.",
      });
      return false;
    }
    return true;
  }

  async function ensureMeta(addr: string) {
    if (!provider || !addr || meta[addr]) return;
    try {
      const erc = new ethers.Contract(addr, ERC20_ABI, provider);
      const [symbol, decimals] = await Promise.all([
        erc.symbol(),
        erc.decimals(),
      ]);
      setMeta((m) => ({
        ...m,
        [addr]: { symbol, decimals: Number(decimals) },
      }));
    } catch {
      setMeta((m) => ({ ...m, [addr]: { symbol: "?", decimals: 18 } }));
    }
  }

  useEffect(() => {
    ensureMeta(baseToken);
    ensureMeta(quoteToken);
  }, [baseToken, quoteToken, provider]);

  // ------------ book helpers (for BUY simulation) ------------
  async function fetchActiveOrders() {
    const s = await provider!.getSigner();
    const dex = new ethers.Contract(dexAddress, DEX_ABI, s);
    const len = Number(await dex.getOrdersLength());
    const out: any[] = [];
    for (let i = 0; i < len; i++) {
      const r = await dex.getOrder(i);
      const [
        owner,
        sellToken,
        buyToken,
        sellAmount,
        buyAmount,
        remainingSell,
        active,
      ] = r as unknown as [
        string,
        string,
        string,
        bigint,
        bigint,
        bigint,
        boolean
      ];
      if (active && remainingSell > BI0) {
        out.push({
          id: i,
          owner,
          sellToken,
          buyToken,
          sellAmount,
          buyAmount,
          remainingSell,
        });
      }
    }
    return out;
  }

  // ------------ ERC20 helpers ------------
  async function balanceOf(token: string, who: string) {
    const erc = new ethers.Contract(token, ERC20_ABI, provider!);
    return (await erc.balanceOf(who)) as bigint;
  }

  async function approveIfNeeded(token: string, needed: bigint, owner: string) {
    const s = await provider!.getSigner();
    const erc = new ethers.Contract(token, ERC20_ABI, s);
    const current: bigint = await erc.allowance(owner, dexAddress);
    if (current < needed) {
      const tx = await erc.approve(dexAddress, needed);
      await tx.wait();
    }
  }

  // ------------ receipt parsing ------------
  const dexInterface = new ethers.Interface(DEX_ABI as any);
  function extractCreatedId(receipt: ethers.TransactionReceipt): bigint | null {
    for (const log of receipt.logs) {
      try {
        const parsed = dexInterface.parseLog(log);
        if (parsed?.name === "OrderCreated") {
          return parsed.args?.id as bigint;
        }
      } catch {}
    }
    return null;
  }

  // ------------ main execution ------------
  async function executeMarket() {
    if (!(await requireSepolia())) return;
    if (!baseToken || !quoteToken) {
      setMsg({ type: "error", text: "Enter both token addresses." });
      return;
    }

    try {
      setBusy(true);
      setMsg({ type: "", text: "" });

      await Promise.all([ensureMeta(baseToken), ensureMeta(quoteToken)]);
      const decBase = meta[baseToken]?.decimals ?? 18;
      const decQuote = meta[quoteToken]?.decimals ?? 18;

      const s = await provider!.getSigner();
      const me = await s.getAddress();
      const dex = new ethers.Contract(dexAddress, DEX_ABI, s);

      if (side === "sell") {
        // -------- SELL: user sells BASE for QUOTE (keep existing flow) --------
        const sellBase = ethers.parseUnits(amount || "0", decBase);
        if (sellBase <= BI0) throw new Error("Amount must be greater than 0");

        await approveIfNeeded(baseToken, sellBase, me);

        const beforeQuote = await balanceOf(quoteToken, me);

        // Aggressive taker: tiny buyAmount in QUOTE ensures crossing
        const buyMinQuote = BI1;

        const tx = await dex.createOrder(
          baseToken,
          quoteToken,
          sellBase,
          buyMinQuote
        );
        const rc = await tx.wait();

        // Cancel any resting remainder to refund escrow
        const createdId = extractCreatedId(rc);
        if (createdId !== null) {
          const tx2 = await dex.cancelOrder(createdId);
          await tx2.wait();
        }

        const afterQuote = await balanceOf(quoteToken, me);
        const gotQuote = afterQuote - beforeQuote;

        setMsg({
          type: "success",
          text: `Market sell executed. Received ≈ ${Number(
            ethers.formatUnits(gotQuote, decQuote)
          )} ${meta[quoteToken]?.symbol ?? "token"}.`,
        });
      } else {
        // -------- BUY: user buys BASE paying QUOTE (single tx via fillManyBuyBase) --------
        const wantBase = ethers.parseUnits(amount || "0", decBase);
        if (wantBase <= BI0) throw new Error("Amount must be greater than 0");

        // 1) Read the opposite book (asks: sellToken=BASE, buyToken=QUOTE)
        const book = await fetchActiveOrders();
        const asks = book.filter(
          (o) =>
            o.sellToken.toLowerCase() === baseToken.toLowerCase() &&
            o.buyToken.toLowerCase() === quoteToken.toLowerCase()
        );
        if (asks.length === 0) throw new Error("No liquidity for this pair.");

        // 2) Sort by best price first (lowest QUOTE per BASE)
        asks.sort((a, b) => {
          const pa = Number(a.buyAmount) / Number(a.sellAmount);
          const pb = Number(b.buyAmount) / Number(b.sellAmount);
          return pa - pb;
        });

        // 3) Plan the sweep off-chain
        const makerIds: number[] = [];
        const takeBase: bigint[] = [];
        let remaining = wantBase;
        let maxQuote = BI0; // slippage cap = sum of ceil pay per maker

        for (const o of asks) {
          if (remaining === BI0) break;
          const take =
            remaining <= o.remainingSell ? remaining : o.remainingSell;
          if (take === BI0) continue;

          makerIds.push(o.id);
          takeBase.push(take);

          // QUOTE to pay this maker at maker price (ceil)
          maxQuote += ceilMulDiv(o.buyAmount, take, o.sellAmount);
          remaining -= take;
        }

        if (remaining > BI0) {
          const availHuman = Number(
            ethers.formatUnits(wantBase - remaining, decBase)
          );
          const wantHuman = Number(ethers.formatUnits(wantBase, decBase));
          throw new Error(
            `Insufficient liquidity: want ${wantHuman}, available ${availHuman}.`
          );
        }

        // 4) Approve once for maxQuote
        await approveIfNeeded(quoteToken, maxQuote, me);

        // 5) Execute in one tx
        const beforeBase = await balanceOf(baseToken, me);
        const tx = await dex.fillManyBuyBase(
          baseToken,
          quoteToken,
          wantBase,
          maxQuote,
          makerIds,
          takeBase
        );
        await tx.wait();

        // 6) Show result (contract refunds any unused QUOTE, no resting remainder)
        const afterBase = await balanceOf(baseToken, me);
        const gotBase = afterBase - beforeBase;

        setMsg({
          type: "success",
          text: `Market buy executed. Received ≈ ${Number(
            ethers.formatUnits(gotBase, decBase)
          )} ${meta[baseToken]?.symbol ?? "token"}.`,
        });
      }
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message ?? "Market order failed" });
    } finally {
      setBusy(false);
    }
  }

  // -------------- UI --------------
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
      {msg.text && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            msg.type === "error"
              ? "border-rose-800 bg-rose-950 text-rose-100"
              : "border-emerald-700 bg-emerald-950 text-emerald-100"
          }`}
        >
          {msg.text}
        </div>
      )}

      <h2 className="mb-4 text-lg font-medium">Market Order</h2>

      <div className="mb-3 inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
        <button
          onClick={() => setSide("sell")}
          className={`px-4 py-2 rounded-lg text-sm ${
            side === "sell"
              ? "bg-indigo-600 text-white"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          Sell
        </button>
        <button
          onClick={() => setSide("buy")}
          className={`ml-1 px-4 py-2 rounded-lg text-sm ${
            side === "buy"
              ? "bg-indigo-600 text-white"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          Buy
        </button>
      </div>

      <div className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-3">
        <label className="text-slate-400">Base Token</label>
        <input
          value={baseToken}
          onChange={(e) => setBaseToken(e.target.value)}
          placeholder="0x… token address"
          className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
        />

        <label className="text-slate-400">Quote Token</label>
        <input
          value={quoteToken}
          onChange={(e) => setQuoteToken(e.target.value)}
          placeholder="0x… token address"
          className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
        />

        <label className="text-slate-400">
          {side === "sell" ? "Sell Amount (base)" : "Buy Amount (base)"}
        </label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={executeMarket}
          disabled={busy}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {busy ? "Processing…" : "Execute Market"}
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Works with <code>SimpleDexV2</code> (no <code>fillOrder</code>): we post
        an aggressive order and cancel any remainder immediately.
      </p>
    </section>
  );
}
