"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/app/providers/WalletProvider";
import { DEX_ABI, ERC20_ABI } from "@/lib/abi";
import addrs from "@/lib/addresses.sepolia.json";

type TokenMeta = { symbol: string; decimals: number };

export default function OrderBookCard() {
  const { provider, chainId } = useWallet();
  const [orders, setOrders] = useState<any[]>([]);
  const [meta, setMeta] = useState<Record<string, TokenMeta>>({});
  const [amountInput, setAmountInput] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<{
    type: "error" | "success" | "";
    text: string;
  }>({ type: "", text: "" });
  const [busy, setBusy] = useState(false);

  const dexAddr = (addrs as any).DEX as string;

  async function fetchMeta(addr: string) {
    if (!provider || meta[addr]) return;
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

  async function loadOrders() {
    if (!provider) return;
    try {
      const s = await provider.getSigner();
      const dex = new ethers.Contract(dexAddr, DEX_ABI, s);
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
        if (active) {
          out.push({
            id: i,
            owner,
            sellToken,
            buyToken,
            sellAmount,
            buyAmount,
            remainingSell,
            active,
          });
          await Promise.all([fetchMeta(sellToken), fetchMeta(buyToken)]);
        }
      }
      setOrders(out);
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message ?? "Load failed" });
    }
  }

  useEffect(() => {
    loadOrders();
  }, [provider]);

  function fmt(addr: string, amount: bigint) {
    const m = meta[addr];
    return m
      ? `${ethers.formatUnits(amount, m.decimals)} ${m.symbol}`
      : `${amount.toString()} ?`;
  }

  async function approveBuyToken(order: any, takerSellAmount: string) {
    if (!provider) return;
    const s = await provider.getSigner();
    const buyToken = new ethers.Contract(order.buyToken, ERC20_ABI, s);

    const sellToTakeWei = ethers.parseUnits(
      takerSellAmount || "0",
      meta[order.sellToken]?.decimals ?? 18
    );
    if (sellToTakeWei <= BigInt(0)) throw new Error("Amount must be > 0");

    // buyRequired = ceil( sellToTake * buyAmount / sellAmount )
    const buyRequired =
      (order.buyAmount * sellToTakeWei + (order.sellAmount - BigInt(1))) /
      order.sellAmount;

    const allowance: bigint = await buyToken.allowance(
      await s.getAddress(),
      dexAddr
    );
    if (allowance < buyRequired) {
      const tx = await buyToken.approve(dexAddr, buyRequired);
      await tx.wait();
    }
  }

  async function fill(order: any) {
    if (!provider)
      return setMsg({ type: "error", text: "Connect wallet first." });
    if (chainId !== 11155111)
      return setMsg({ type: "error", text: "Switch to Sepolia." });

    try {
      setBusy(true);
      const amt = amountInput[order.id] || "";
      await approveBuyToken(order, amt);

      const s = await provider.getSigner();
      const dex = new ethers.Contract(dexAddr, DEX_ABI, s);

      const sellToTakeWei = ethers.parseUnits(
        amt || "0",
        meta[order.sellToken]?.decimals ?? 18
      );

      const tx = await dex.fillOrder(order.id, sellToTakeWei);
      await tx.wait();
      setMsg({ type: "success", text: "Filled order." });
      await loadOrders();
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message ?? "Fill failed" });
    } finally {
      setBusy(false);
    }
  }

  const activeOrders = useMemo(() => orders.filter((o) => o.active), [orders]);

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
      <h2 className="text-lg font-medium mb-4">Order Book (Active)</h2>

      <div className="space-y-3">
        {activeOrders.length === 0 && (
          <div className="text-sm text-slate-400">No active orders.</div>
        )}

        {activeOrders.map((o) => {
          const price =
            meta[o.sellToken] && meta[o.buyToken]
              ? Number(
                  ethers.formatUnits(o.buyAmount, meta[o.buyToken].decimals)
                ) /
                Number(
                  ethers.formatUnits(o.sellAmount, meta[o.sellToken].decimals)
                )
              : undefined;

          return (
            <div
              key={o.id}
              className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm"
            >
              <div className="text-slate-300">Order #{o.id}</div>
              <div className="text-slate-400 break-all">
                {fmt(o.sellToken, o.remainingSell)} available ↔ wants{" "}
                {fmt(o.buyToken, o.buyAmount)}
                <br />
                {price !== undefined && (
                  <span className="text-slate-300">
                    Price ≈ {price.toPrecision(6)} {meta[o.buyToken]?.symbol}/
                    {meta[o.sellToken]?.symbol}
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-3">
                <input
                  value={amountInput[o.id] ?? ""}
                  onChange={(e) =>
                    setAmountInput((m) => ({ ...m, [o.id]: e.target.value }))
                  }
                  placeholder={`Sell amount to take (${
                    meta[o.sellToken]?.symbol ?? "token"
                  })`}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => fill(o)}
                  disabled={busy}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-60"
                >
                  {busy ? "Processing…" : "Fill"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
