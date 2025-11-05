"use client";

import { useState } from "react";
import { ethers, Interface } from "ethers";
import { FACTORY_ABI, ERC20_ABI } from "@/lib/abi";
import addrs from "@/lib/addresses.local.json";
import { DEX_ABI } from "@/lib/abi";

type Alert = { type: "error" | "success" | ""; text: string };

export default function Page() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [account, setAccount] = useState<string>("");
  const [name, setName] = useState("VietCT");
  const [symbol, setSymbol] = useState("VCT");
  const [supply, setSupply] = useState("1000000");
  const [issued, setIssued] = useState<{
    address: string;
    name: string;
    symbol: string;
    balance: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Alert>({ type: "", text: "" });

  async function connect() {
    if (!(window as any).ethereum) {
      setMsg({ type: "error", text: "Install MetaMask first." });
      return;
    }
    const p = new ethers.BrowserProvider((window as any).ethereum);
    await p.send("eth_requestAccounts", []);
    const s = await p.getSigner();
    const net = await p.getNetwork();
    console.log("Connected to network:", net);
    if (Number(net.chainId) !== 31337) {
      setMsg({
        type: "error",
        text: "Switch MetaMask to Hardhat (Chain ID 31337).",
      });
    } else {
      setMsg({ type: "", text: "" });
    }
    setProvider(p);
    setAccount(await s.getAddress());
  }
  const LOCAL_RPC = "http://127.0.0.1:8545";
  async function issueToken() {
    if (!provider) {
      setMsg({ type: "error", text: "Connect wallet first." });
      return;
    }
    setBusy(true);
    setMsg({ type: "", text: "" });
    setIssued(null);
    try {
      const signer = await provider.getSigner();
      const factoryAddr = (addrs as any).FACTORY as string;

      // Use direct RPC to avoid MM caching edge cases
      const rpc = new ethers.JsonRpcProvider(LOCAL_RPC);
      let code = "0x";
      try {
        code = await rpc.getCode(factoryAddr);
      } catch {}

      if (code === "0x") {
        throw new Error(
          "Factory not deployed on this chain. Re-run deployFactory-write-frontend.js with the node running."
        );
      }

      const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, signer);
      const supplyWei = ethers.parseUnits(supply || "0", 18);

      // optional: predict address; if it fails, we’ll read from logs
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
              tokenAddr = parsed.args.token;
              break;
            }
          } catch {}
        }
      }
      if (!tokenAddr)
        throw new Error("Could not find new token address in receipt.");

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
      setMsg({ type: "error", text: e?.message ?? "Failed to issue token." });
    } finally {
      setBusy(false);
    }
  }

  

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

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100">
      <div className="container mx-auto max-w-4xl p-6">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            DEX MVP — Issue ERC-20
          </h1>
          <button
            onClick={connect}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800"
          >
            {account
              ? `Connected: ${account.slice(0, 6)}…${account.slice(-4)}`
              : "Connect Wallet"}
          </button>
        </header>

        {msg.text && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              msg.type === "error"
                ? "border-rose-800 bg-rose-950 text-rose-100"
                : msg.type === "success"
                ? "border-emerald-700 bg-emerald-950 text-emerald-100"
                : "border-slate-800 bg-slate-900 text-slate-200"
            }`}
          >
            {msg.text}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
          <h2 className="text-lg font-medium mb-4">New Token</h2>

          <div className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-3">
            <label className="text-slate-400">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <label className="text-slate-400">Symbol</label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <label className="text-slate-400">Initial Supply</label>
            <div>
              <input
                value={supply}
                onChange={(e) => setSupply(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
        </section>

        <p className="mt-4 text-xs text-slate-400">
          Make sure MetaMask is on the Hardhat network (RPC
          http://127.0.0.1:8545, Chain ID 31337).
        </p>
      </div>
    </main>
  );
}
