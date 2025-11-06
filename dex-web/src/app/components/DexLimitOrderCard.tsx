"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/app/providers/WalletProvider";
import { DEX_ABI, ERC20_ABI } from "@/lib/abi";
import addrs from "@/lib/addresses.local.json";

export default function DexLimitOrderCard() {
  const { provider, account, chainId } = useWallet();
  const [tokenMeta, setTokenMeta] = useState<
    Record<string, { symbol: string; decimals: number }>
  >({});

  const [sellToken, setSellToken] = useState("");
  const [buyToken, setBuyToken] = useState("");
  const [sellAmt, setSellAmt] = useState("100");
  const [buyAmt, setBuyAmt] = useState("50");

  const [sellMeta, setSellMeta] = useState<{
    symbol: string;
    decimals: number;
    balance: string;
  } | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{
    type: "error" | "success" | "";
    text: string;
  }>({ type: "", text: "" });

  async function readTokenMeta(addr: string) {
    if (!provider || !addr) return setSellMeta(null);
    try {
      const s = await provider.getSigner();
      const erc = new ethers.Contract(addr, ERC20_ABI, s);
      const [sym, dec, bal] = await Promise.all([
        erc.symbol(),
        erc.decimals(),
        erc.balanceOf(await s.getAddress()),
      ]);
      setSellMeta({
        symbol: sym,
        decimals: Number(dec),
        balance: ethers.formatUnits(bal, dec),
      });
    } catch {
      setSellMeta(null);
    }
  }
  async function ensureTokenMeta(addr: string) {
    if (!provider || !addr) return;
    if (tokenMeta[addr]) return; // cached

    try {
      const erc = new ethers.Contract(addr, ERC20_ABI, provider);
      const [symbol, decimals] = await Promise.all([
        erc.symbol(),
        erc.decimals(),
      ]);
      setTokenMeta((m) => ({
        ...m,
        [addr]: { symbol, decimals: Number(decimals) },
      }));
    } catch {
      // default to 18 if read fails
      setTokenMeta((m) => ({ ...m, [addr]: { symbol: "?", decimals: 18 } }));
    }
  }

  useEffect(() => {
    readTokenMeta(sellToken);
  }, [sellToken, provider]);

  async function approve() {
    if (!provider)
      return setMsg({ type: "error", text: "Connect wallet first." });
    if (chainId !== 31337)
      return setMsg({ type: "error", text: "Switch to Hardhat 31337." });
    try {
      setBusy(true);
      const s = await provider.getSigner();
      const erc = new ethers.Contract(sellToken, ERC20_ABI, s);
      const amountWei = ethers.parseUnits(
        sellAmt || "0",
        sellMeta?.decimals ?? 18
      );
      const tx = await erc.approve((addrs as any).DEX, amountWei);
      await tx.wait();
      setMsg({ type: "success", text: "Approved spend for DEX." });
      await readTokenMeta(sellToken);
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message ?? "Approve failed" });
    } finally {
      setBusy(false);
    }
  }

  async function createOrder() {
    if (!provider)
      return setMsg({ type: "error", text: "Connect wallet first." });
    if (chainId !== 31337)
      return setMsg({ type: "error", text: "Switch to Hardhat 31337." });

    try {
      setBusy(true);
      const s = await provider.getSigner();
      const dex = new ethers.Contract((addrs as any).DEX, DEX_ABI, s);

      const decSell = sellMeta?.decimals ?? 18;
      const sellWei = ethers.parseUnits(sellAmt || "0", decSell);
      // simple: assume 18 decimals for buy token; you can also fetch it like sellMeta
      const buyWei = ethers.parseUnits(buyAmt || "0", 18);

      // verify allowance
      const erc = new ethers.Contract(sellToken, ERC20_ABI, s);
      const allowance = await erc.allowance(
        await s.getAddress(),
        (addrs as any).DEX
      );
      if (allowance < sellWei) {
        return setMsg({
          type: "error",
          text: "Insufficient allowance. Approve first.",
        });
      }

      const tx = await dex.createOrder(sellToken, buyToken, sellWei, buyWei);
      await tx.wait();
      await fetchMyOrders();
      setMsg({ type: "success", text: "Order created." });
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message ?? "Create order failed" });
    } finally {
      setBusy(false);
    }
  }

  async function fetchMyOrders() {
    if (!provider) return;
    const s = await provider.getSigner();
    const me = (await s.getAddress()).toLowerCase();
    const dex = new ethers.Contract((addrs as any).DEX, DEX_ABI, s);

    const len = Number(await dex.getOrdersLength());
    const out: any[] = [];

    for (let i = 0; i < len; i++) {
      const res = await dex.getOrder(i);
      const [
        owner,
        sellToken,
        buyToken,
        sellAmount,
        buyAmount,
        remainingSell,
        active,
      ] = res as unknown as [
        string,
        string,
        string,
        bigint,
        bigint,
        bigint,
        boolean
      ];

      if (owner.toLowerCase() === me) {
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
      }
    }

    // prefetch token meta (symbol/decimals) for all tokens appearing in orders
    const uniq = Array.from(
      new Set(out.flatMap((o) => [o.sellToken, o.buyToken]))
    );
    await Promise.all(uniq.map(ensureTokenMeta));

    setOrders(out);
  }

  useEffect(() => {
    fetchMyOrders();
  }, [provider]);

  async function cancel(id: number) {
    if (!provider) return;
    try {
      setBusy(true);
      const s = await provider.getSigner();
      const dex = new ethers.Contract((addrs as any).DEX, DEX_ABI, s);
      const tx = await dex.cancelOrder(id);
      await tx.wait();
      await fetchMyOrders();
      setMsg({ type: "success", text: "Order cancelled." });
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message ?? "Cancel failed" });
    } finally {
      setBusy(false);
    }
  }

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

      <h2 className="text-lg font-medium mb-4">Create Limit Order</h2>

      <div className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-3">
        <label className="text-slate-400">Sell Token</label>
        <input
          value={sellToken}
          onChange={(e) => setSellToken(e.target.value)}
          placeholder="0x… token address"
          className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
        />

        <label className="text-slate-400">Buy Token</label>
        <input
          value={buyToken}
          onChange={(e) => setBuyToken(e.target.value)}
          placeholder="0x… token address"
          className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
        />

        <label className="text-slate-400">Sell Amount</label>
        <div>
          <input
            value={sellAmt}
            onChange={(e) => setSellAmt(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
          />
          {sellMeta && (
            <p className="mt-1 text-xs text-slate-400">
              Balance:{" "}
              <span className="text-emerald-300">{sellMeta.balance}</span>{" "}
              {sellMeta.symbol}
            </p>
          )}
        </div>

        <label className="text-slate-400">Buy Amount</label>
        <input
          value={buyAmt}
          onChange={(e) => setBuyAmt(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={approve}
          disabled={busy}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 hover:bg-slate-800 disabled:opacity-60"
        >
          Approve Sell Token
        </button>
        <button
          onClick={createOrder}
          disabled={busy}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {busy ? "Processing…" : "Create Order"}
        </button>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-slate-300 mb-2">
          My Open Orders
        </h3>
        {orders.length === 0 && (
          <div className="text-sm text-slate-400">No orders yet.</div>
        )}
        <div className="space-y-2">
          {orders.map((o) => {
            const sm = tokenMeta[o.sellToken];
            const bm = tokenMeta[o.buyToken];

            const sellText = sm
              ? `${ethers.formatUnits(o.sellAmount, sm.decimals)} ${sm.symbol}`
              : `${o.sellAmount.toString()} ?`;

            const buyText = bm
              ? `${ethers.formatUnits(o.buyAmount, bm.decimals)} ${bm.symbol}`
              : `${o.buyAmount.toString()} ?`;

            return (
              <div
                key={o.id}
                className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-slate-300 truncate">
                      Order #{o.id} {o.active ? "" : "(inactive)"}
                    </div>
                    <div className="text-slate-400 break-all">
                      sellToken: {o.sellToken}
                      <br />
                      buyToken: {o.buyToken}
                      <br />
                      <span className="text-slate-300">
                        Amounts:&nbsp;{sellText} → {buyText}
                      </span>
                    </div>
                  </div>
                  {o.active && (
                    <button
                      onClick={() => cancel(o.id)}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
