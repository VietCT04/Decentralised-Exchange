"use client";

import { useState } from "react";
import { ethers, Interface } from "ethers";
import { useWallet } from "@/app/providers/WalletProvider";
import { FACTORY_ABI, ERC20_ABI } from "@/lib/abi";
import addrs from "@/lib/addresses.local.json";

const LOCAL_RPC = "http://127.0.0.1:8545";

export default function IssueTokenCard() {
  const { provider, account, chainId } = useWallet();
  const [name, setName] = useState("VietCT");
  const [symbol, setSymbol] = useState("VCT");
  const [supply, setSupply] = useState("1000000");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{
    type: "error" | "success" | "";
    text: string;
  }>({ type: "", text: "" });
  const [issued, setIssued] = useState<{
    address: string;
    name: string;
    symbol: string;
    balance: string;
  } | null>(null);

  async function addToMM() {
    if (!issued) return;
    await (window as any).ethereum?.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: issued.address,
          symbol: issued.symbol,
          decimals: 18,
        },
      },
    });
  }

  async function issueToken() {
    if (!provider) {
      setMsg({ type: "error", text: "Connect wallet first." });
      return;
    }
    if (chainId !== 31337) {
      setMsg({ type: "error", text: "Switch MetaMask to Hardhat (31337)." });
      return;
    }

    setBusy(true);
    setMsg({ type: "", text: "" });
    setIssued(null);

    try {
      const signer = await provider.getSigner();
      const factoryAddr = (addrs as any).FACTORY as string;

      // verify code via direct RPC to bypass caching
      const rpc = new ethers.JsonRpcProvider(LOCAL_RPC);
      const code = await rpc.getCode(factoryAddr);
      if (code === "0x")
        throw new Error(
          "Factory not deployed on this chain. Re-deploy & refresh."
        );

      const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, signer);
      const supplyWei = ethers.parseUnits(supply || "0", 18);

      let predicted: string | undefined;
      try {
        predicted = await factory.issueToken.staticCall(
          name,
          symbol,
          supplyWei
        );
      } catch {}

      const tx = await factory.issueToken(name, symbol, supplyWei);
      const receipt = await tx.wait();

      let tokenAddr = predicted;
      if (!tokenAddr) {
        const iface = new Interface(FACTORY_ABI);
        for (const log of receipt!.logs) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed?.name === "TokenIssued") {
              tokenAddr = parsed.args.token as string;
              break;
            }
          } catch {}
        }
      }
      if (!tokenAddr) throw new Error("Could not determine new token address.");

      const token = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
      const [bal, dec] = await Promise.all([
        token.balanceOf(await signer.getAddress()),
        token.decimals(),
      ]);
      setIssued({
        address: tokenAddr,
        name,
        symbol,
        balance: ethers.formatUnits(bal, dec),
      });
      setMsg({ type: "success", text: "Token issued successfully." });
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message ?? "Issue failed." });
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

      <h2 className="text-lg font-medium mb-4">New Token</h2>

      <div className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-3">
        <label className="text-slate-400">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
        />

        <label className="text-slate-400">Symbol</label>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
        />

        <label className="text-slate-400">Initial Supply</label>
        <div>
          <input
            value={supply}
            onChange={(e) => setSupply(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-slate-400">
            18 decimals. Example: 1000000 = 1,000,000 tokens.
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={issueToken}
          disabled={busy}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {busy ? "Issuing…" : "Issue Token"}
        </button>
      </div>

      {issued && (
        <div className="mt-6 space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm">
            <div className="text-slate-300">
              Deployed:{" "}
              <span className="font-medium">
                {issued.name} ({issued.symbol})
              </span>
            </div>
            <div className="mt-1 break-all">
              <span className="text-slate-400">Address:</span>{" "}
              <span className="text-indigo-300">{issued.address}</span>
            </div>
            <div className="mt-1">
              <span className="text-slate-400">Your balance:</span>{" "}
              <span className="text-emerald-300">
                {issued.balance} {issued.symbol}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={addToMM}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 hover:bg-slate-800"
            >
              Add to MetaMask
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(issued.address)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 hover:bg-slate-800"
            >
              Copy Address
            </button>
          </div>
        </div>
      )}
      <p className="mt-4 text-xs text-slate-400">
        Make sure MetaMask is on the Hardhat network (RPC http://127.0.0.1:8545,
        Chain ID 31337).
      </p>
    </section>
  );
}
