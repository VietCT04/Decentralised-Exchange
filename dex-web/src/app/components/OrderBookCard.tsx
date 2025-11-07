"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/app/providers/WalletProvider";
import { DEX_ABI, ERC20_ABI } from "@/lib/abi";
import addrs from "@/lib/addresses.sepolia.json";

type TokenMeta = { symbol: string; decimals: number };

// helper: (n*m)/d with bigint
const mulDiv = (n: bigint, m: bigint, d: bigint) => (n * m) / d;

export default function OrderBookCard() {
  const { provider } = useWallet();
  const [orders, setOrders] = useState<any[]>([]);
  const [meta, setMeta] = useState<Record<string, TokenMeta>>({});
  const [msg, setMsg] = useState<{
    type: "error" | "success" | "";
    text: string;
  }>({
    type: "",
    text: "",
  });

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
      const need = new Set<string>();

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

        if (active && remainingSell > 0) {
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
          need.add(sellToken);
          need.add(buyToken);
        }
      }

      await Promise.all(Array.from(need).map(fetchMeta));
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

  const activeOrders = useMemo(
    () => orders.filter((o) => o.active && o.remainingSell > 0),
    [orders]
  );

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

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">Order Book (Active)</h2>
        <button
          onClick={loadOrders}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-sm hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {activeOrders.length === 0 && (
          <div className="text-sm text-slate-400">No active orders.</div>
        )}

        {activeOrders.map((o) => {
          // remaining buy proportional to remaining sell
          const remainingBuy = mulDiv(
            o.buyAmount as bigint,
            o.remainingSell as bigint,
            o.sellAmount as bigint
          );

          const haveMeta = meta[o.sellToken] && meta[o.buyToken];
          const price = haveMeta
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
                {fmt(o.buyToken, remainingBuy)}
                <br />
                {price !== undefined && (
                  <span className="text-slate-300">
                    Price ≈ {price.toPrecision(6)} {meta[o.buyToken]?.symbol}/
                    {meta[o.sellToken]?.symbol}
                  </span>
                )}
              </div>
              {/* no input, no Fill button — read-only order book */}
            </div>
          );
        })}
      </div>
    </section>
  );
}
