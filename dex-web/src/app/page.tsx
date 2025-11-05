"use client";

import ConnectButton from "./components/ConnectButton";
import IssueTokenCard from "./components/IssueTokenCard";
import DexLimitOrderCard from "./components/DexLimitOrderCard";

export default function Page() {
  return (
    <main className="min-h-dvh">
      <div className="container mx-auto max-w-4xl p-6">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            DEX MVP — Issue ERC-20
          </h1>
          <ConnectButton />
        </header>

        <IssueTokenCard />
        <div className="h-6" />
        <DexLimitOrderCard />
      </div>
    </main>
  );
}
