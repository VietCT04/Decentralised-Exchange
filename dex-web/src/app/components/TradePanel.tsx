"use client";

import { useState, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DexLimitOrderCard from "./DexLimitOrderCard";
import DexMarketOrderCard from "./DexMarketOrderCard";

type OrderType = "limit" | "market";

export default function TradePanel() {
  const sp = useSearchParams();
  const router = useRouter();

  // read from URL, default to "limit"
  const initialType = (sp.get("type") as OrderType) || "limit";
  const [type, setType] = useState<OrderType>(initialType);

  const isLimit = type === "limit";
  const isMarket = type === "market";

  function select(next: OrderType) {
    setType(next);
    const params = new URLSearchParams(sp); // clone
    if (next === "limit") params.delete("type");
    else params.set("type", next);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <section className="space-y-4">
      {/* segmented control */}
      <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
        <button
          onClick={() => select("limit")}
          className={`px-4 py-2 rounded-lg text-sm transition ${
            isLimit
              ? "bg-indigo-600 text-white"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          Limit
        </button>
        <button
          onClick={() => select("market")}
          className={`ml-1 px-4 py-2 rounded-lg text-sm transition ${
            isMarket
              ? "bg-indigo-600 text-white"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          Market
        </button>
      </div>

      <Suspense fallback={<div className="text-slate-400">Loading…</div>}>
        {isLimit ? <DexLimitOrderCard /> : <DexMarketOrderCard />}
      </Suspense>
    </section>
  );
}
