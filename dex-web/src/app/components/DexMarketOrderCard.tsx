"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/app/providers/WalletProvider";
import { DEX_ABI, ERC20_ABI } from "@/lib/abi";
import addrs from "@/lib/addresses.sepolia.json";
import { NET } from "@/lib/net";

type TokenMeta = { symbol: string; decimals: number };
type Side = "sell" | "buy"; // sell= sell base for quote, buy = buy base paying quote

// bigint helpers
const mulDiv = (n: bigint, m: bigint, d: bigint) => (n * m) / d;
const ceilMulDiv = (n: bigint, m: bigint, d: bigint) =>
  (n * m + (d - BigInt(1))) / d;

export default function DexMarketOrderCard() {
  const { provider, chainId } = useWallet();

  const [side, setSide] = useState<Side>("sell");
  const [baseToken, setBaseToken] = useState("");
  const [quoteToken, setQuoteToken] = useState("");
  const [amount, setAmount] = useState("10");

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
      if (active && remainingSell > BigInt(0)) {
        out.push({
          id: i,
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

  async function approveIfNeeded(token: string, needed: bigint, owner: string) {
    const s = await provider!.getSigner();
    const erc = new ethers.Contract(token, ERC20_ABI, s);
    const current: bigint = await erc.allowance(owner, dexAddress);
    if (current < needed) {
      const tx = await erc.approve(dexAddress, needed);
      await tx.wait();
    }
  }

  // --------- EXECUTION (sweeps across best priced orders) ----------
  async function executeMarket() {
    if (!(await requireSepolia())) return;

    try {
      setBusy(true);
      setMsg({ type: "", text: "" });

      if (!baseToken || !quoteToken)
        throw new Error("Enter both token addresses.");

      // decimals + input
      await Promise.all([ensureMeta(baseToken), ensureMeta(quoteToken)]);
      const decBase = meta[baseToken]?.decimals ?? 18;
      const decQuote = meta[quoteToken]?.decimals ?? 18;

      const input = ethers.parseUnits(amount || "0", decBase);
      if (input <= BigInt(0)) throw new Error("Amount must be greater than 0");

      const s = await provider!.getSigner();
      const me = await s.getAddress();
      const dex = new ethers.Contract(dexAddress, DEX_ABI, s);

      const book = await fetchActiveOrders();

      if (side === "sell") {
        // taker sells BASE, wants QUOTE
        // need makers selling QUOTE for BASE  (sellToken=QUOTE, buyToken=BASE)
        const opp = book.filter(
          (o) =>
            o.sellToken.toLowerCase() === quoteToken.toLowerCase() &&
            o.buyToken.toLowerCase() === baseToken.toLowerCase()
        );

        if (opp.length === 0) throw new Error("No liquidity for this pair.");

        // best price: highest QUOTE per BASE first
        opp.sort((a, b) => {
          const pa = Number(a.sellAmount) / Number(a.buyAmount);
          const pb = Number(b.sellAmount) / Number(b.buyAmount);
          return pb - pa;
        });

        // plan fills
        let remainingBase = input;
        let totalBaseToPay = BigInt(0);
        const plan: { id: number; takeQuote: bigint; payBase: bigint }[] = [];

        for (const o of opp) {
          if (remainingBase === BigInt(0)) break;

          // this order can accept up to maxBase = buyAmount * remainingSell / sellAmount
          const maxBase = mulDiv(o.buyAmount, o.remainingSell, o.sellAmount);
          const baseUse = remainingBase <= maxBase ? remainingBase : maxBase;

          if (baseUse === BigInt(0)) continue;

          // quote we take from the order (that's the fillOrder argument)
          const takeQuote = mulDiv(o.sellAmount, baseUse, o.buyAmount);
          // base we must pay (ceil)
          const payBase = ceilMulDiv(o.buyAmount, takeQuote, o.sellAmount);

          plan.push({ id: o.id, takeQuote, payBase });
          totalBaseToPay += payBase;
          remainingBase -= baseUse;
        }

        if (plan.length === 0) throw new Error("Insufficient liquidity.");

        // single allowance for BASE
        await approveIfNeeded(baseToken, totalBaseToPay, me);

        // execute fills
        for (const p of plan) {
          const tx = await dex.fillOrder(p.id, p.takeQuote);
          await tx.wait();
        }

        const gotQuoteHuman = Number(
          ethers.formatUnits(
            plan.reduce((s, p) => s + p.takeQuote, BigInt(0)),
            decQuote
          )
        );
        setMsg({
          type: "success",
          text: `Market sell executed. Received ≈ ${gotQuoteHuman} ${
            meta[quoteToken]?.symbol ?? "token"
          }.`,
        });
      } else {
        // side === "buy": taker buys BASE, pays QUOTE
        // need makers selling BASE for QUOTE (sellToken=BASE, buyToken=QUOTE)
        const opp = book.filter(
          (o) =>
            o.sellToken.toLowerCase() === baseToken.toLowerCase() &&
            o.buyToken.toLowerCase() === quoteToken.toLowerCase()
        );

        if (opp.length === 0) throw new Error("No liquidity for this pair.");

        // best price: lowest QUOTE per BASE first
        opp.sort((a, b) => {
          const pa = Number(a.buyAmount) / Number(a.sellAmount);
          const pb = Number(b.buyAmount) / Number(b.sellAmount);
          return pa - pb;
        });

        let remainingBaseToGet = input;
        let totalQuoteToPay = BigInt(0);
        const plan: { id: number; takeBase: bigint; payQuote: bigint }[] = [];

        for (const o of opp) {
          if (remainingBaseToGet === BigInt(0)) break;

          const takeBase =
            remainingBaseToGet <= o.remainingSell
              ? remainingBaseToGet
              : o.remainingSell;
          if (takeBase === BigInt(0)) continue;

          const payQuote = ceilMulDiv(o.buyAmount, takeBase, o.sellAmount);

          plan.push({ id: o.id, takeBase, payQuote });
          totalQuoteToPay += payQuote;
          remainingBaseToGet -= takeBase;
        }

        if (plan.length === 0) throw new Error("Insufficient liquidity.");

        // single allowance for QUOTE
        const erc = new ethers.Contract(quoteToken, ERC20_ABI, s);
        const allowance: bigint = await erc.allowance(me, dexAddress);
        if (allowance < totalQuoteToPay) {
          const tx = await erc.approve(dexAddress, totalQuoteToPay);
          await tx.wait();
        }

        for (const p of plan) {
          // fillOrder expects "amount of order.sellToken", which is BASE here
          const tx = await dex.fillOrder(p.id, p.takeBase);
          await tx.wait();
        }

        const gotBaseHuman = Number(
          ethers.formatUnits(input - remainingBaseToGet, decBase)
        );
        setMsg({
          type: "success",
          text: `Market buy executed. Received ≈ ${gotBaseHuman} ${
            meta[baseToken]?.symbol ?? "token"
          }.`,
        });
      }
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message ?? "Market order failed" });
    } finally {
      setBusy(false);
    }
  }

  // ---------------- UI ----------------
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
        Executes across the best available orders using <code>fillOrder</code>{" "}
        repeatedly. Approves only the needed token (base for Sell, quote for
        Buy) once before sweeping.
      </p>
    </section>
  );
}
