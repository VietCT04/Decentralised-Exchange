"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/app/providers/WalletProvider";
import { DEX_ABI, ERC20_ABI } from "@/lib/abi";
import addrs from "@/lib/addresses.sepolia.json";
import { NET } from "@/lib/net";

type TokenMeta = { symbol: string; decimals: number };

export default function DexLimitOrderCard() {
  const { provider, account, chainId } = useWallet();

  const [tokenMeta, setTokenMeta] = useState<Record<string, TokenMeta>>({});
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
  }>({
    type: "",
    text: "",
  });

  // ---------- helpers ----------
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
    // verify DEX bytecode on this chain
    const code = await provider.getCode(dexAddress);
    if (code === "0x") {
      setMsg({
        type: "error",
        text:
          "DEX is not deployed at the configured address on Sepolia. " +
          "Re-deploy or update addresses.sepolia.json.",
      });
      return false;
    }
    return true;
  }

  // load SELL token meta + balance of the connected user
  async function readSellTokenMeta(addr: string) {
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
  useEffect(() => {
    readSellTokenMeta(sellToken);
  }, [sellToken, provider]);

  // cache symbol/decimals for any token address
  async function ensureTokenMeta(addr: string) {
    if (!provider || !addr || tokenMeta[addr]) return;
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
      setTokenMeta((m) => ({ ...m, [addr]: { symbol: "?", decimals: 18 } }));
    }
  }

  // ---------- actions ----------
  async function approve() {
    if (!(await requireSepolia())) return;
    try {
      setBusy(true);
      const s = await provider!.getSigner();
      const erc = new ethers.Contract(sellToken, ERC20_ABI, s);
      const dec = sellMeta?.decimals ?? tokenMeta[sellToken]?.decimals ?? 18;
      const amountWei = ethers.parseUnits(sellAmt || "0", dec);
      const tx = await erc.approve(dexAddress, amountWei);
      await tx.wait();
      setMsg({ type: "success", text: "Approved spend for DEX." });
      await readSellTokenMeta(sellToken);
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message ?? "Approve failed" });
    } finally {
      setBusy(false);
    }
  }

  async function createOrder() {
    if (!(await requireSepolia())) return;
    try {
      setBusy(true);

      // make sure we know decimals for both tokens
      await Promise.all([
        ensureTokenMeta(sellToken),
        ensureTokenMeta(buyToken),
      ]);

      const decSell =
        sellMeta?.decimals ?? tokenMeta[sellToken]?.decimals ?? 18;
      const decBuy = tokenMeta[buyToken]?.decimals ?? 18;

      const sellWei = ethers.parseUnits(sellAmt || "0", decSell);
      const buyWei = ethers.parseUnits(buyAmt || "0", decBuy);

      const s = await provider!.getSigner();
      const dex = new ethers.Contract(dexAddress, DEX_ABI, s);

      // allowance check
      const erc = new ethers.Contract(sellToken, ERC20_ABI, s);
      const allowance: bigint = await erc.allowance(
        await s.getAddress(),
        dexAddress
      );
      if (allowance < sellWei) {
        setMsg({
          type: "error",
          text: "Insufficient allowance. Approve first.",
        });
        return;
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
    try {
      // bail out early if wrong chain or bad DEX address
      const code = await provider.getCode(dexAddress);
      if (code === "0x") {
        setOrders([]);
        return;
      }

      const s = await provider.getSigner();
      const me = (await s.getAddress()).toLowerCase();
      const dex = new ethers.Contract(dexAddress, DEX_ABI, s);

      const len = Number(await dex.getOrdersLength());
      const out: any[] = [];

      for (let i = 0; i < len; i++) {
        const o = await dex.getOrder(i);
        const [
          owner,
          sellToken,
          buyToken,
          sellAmount,
          buyAmount,
          remainingSell,
          active,
        ] = o as unknown as [
          string,
          string,
          string,
          bigint,
          bigint,
          bigint,
          boolean
        ];
        if (owner.toLowerCase() === me && active && remainingSell > BigInt(0)) {
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

      // prefetch token decimals/symbols for those seen in orders
      const uniq = Array.from(
        new Set(out.flatMap((o) => [o.sellToken, o.buyToken]))
      );
      await Promise.all(uniq.map(ensureTokenMeta));

      setOrders(out);
    } catch (e: any) {
      // Most common cause is wrong ABI/addr → display friendly hint
      setMsg({
        type: "error",
        text:
          e?.message ??
          "Failed to load orders. Check DEX address and ABI match the deployed contract.",
      });
    }
  }
  useEffect(() => {
    fetchMyOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, account, chainId]);

  async function cancel(id: number) {
    if (!(await requireSepolia())) return;
    try {
      setBusy(true);
      const s = await provider!.getSigner();
      const dex = new ethers.Contract(dexAddress, DEX_ABI, s);
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

  // ---------- UI ----------
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

      <h2 className="mb-4 text-lg font-medium">Create Limit Order</h2>

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
        <h3 className="mb-2 text-sm font-medium text-slate-300">
          My Open Orders
        </h3>
        {orders.length === 0 && (
          <div className="text-sm text-slate-400">No orders yet.</div>
        )}
        <div className="space-y-2">
          {orders.map((o) => {
            const sm = tokenMeta[o.sellToken];
            const bm = tokenMeta[o.buyToken];
            const remainingSell: bigint = (o.remainingSell ??
              BigInt(0)) as bigint;
            const remainingBuy: bigint = remainingSell
              ? (o.buyAmount * remainingSell) / o.sellAmount
              : BigInt(0);
            const sellText = sm
              ? `${ethers.formatUnits(remainingSell, sm.decimals)} ${sm.symbol}`
              : `${o.sellAmount.toString()} ?`;

            const buyText = bm
              ? `${ethers.formatUnits(remainingBuy, bm.decimals)} ${bm.symbol}`
              : `${o.buyAmount.toString()} ?`;

            return (
              <div
                key={o.id}
                className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-slate-300">
                      Order #{o.id} {o.active ? "" : "(inactive)"}
                    </div>
                    <div className="break-all text-slate-400">
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
