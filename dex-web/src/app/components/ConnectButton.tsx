"use client";

import { useWallet } from "@/app/providers/WalletProvider";

export default function ConnectButton() {
  const { account, chainId, connect } = useWallet();

  const label = account
    ? `Connected: ${account.slice(0, 6)}…${account.slice(-4)}`
    : "Connect Wallet";

  const wrongNet = account && chainId !== 31337;

  return (
    <button
      onClick={connect}
      className={`rounded-full border px-3 py-2 text-sm transition
      ${
        wrongNet
          ? "border-rose-700 bg-rose-900/40 text-rose-100"
          : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
      }`}
      title={wrongNet ? "Switch MetaMask to Hardhat (31337)" : ""}
    >
      {label}
    </button>
  );
}
