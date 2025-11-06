// app/providers/WalletProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ethers } from "ethers";
import { NET } from "@/lib/net";

type Ctx = {
  provider: ethers.BrowserProvider | null;
  account: string;
  chainId: number | null;
  connect: () => Promise<void>;
};

const WalletContext = createContext<Ctx>({
  provider: null,
  account: "",
  chainId: null,
  connect: async () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);

  async function ensureSepolia() {
    const eth = (globalThis as any).ethereum;
    if (!eth) throw new Error("Install MetaMask");

    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: NET.hex }],
      });
    } catch (e: any) {
      if (e?.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: NET.hex,
              chainName: NET.name,
              rpcUrls: [process.env.NEXT_PUBLIC_SEPOLIA_RPC!], // set this in .env
              nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
              blockExplorerUrls: [NET.explorer],
            },
          ],
        });
      } else {
        throw e;
      }
    }
  }

  const connect = async () => {
    const eth = (globalThis as any).ethereum;
    if (!eth) throw new Error("Install MetaMask");

    await ensureSepolia();

    const p = new ethers.BrowserProvider(eth);
    await p.send("eth_requestAccounts", []);
    const s = await p.getSigner();
    const net = await p.getNetwork();

    setProvider(p);
    setAccount(await s.getAddress());
    setChainId(Number(net.chainId));
  };

  useEffect(() => {
    const eth = (globalThis as any).ethereum;
    if (!eth) return;
    const relog = () => connect().catch(() => {});
    eth.on?.("accountsChanged", relog);
    eth.on?.("chainChanged", relog);
    return () => {
      eth.removeListener?.("accountsChanged", relog);
      eth.removeListener?.("chainChanged", relog);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <WalletContext.Provider value={{ provider, account, chainId, connect }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
