"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ethers } from "ethers";

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
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  connect: async () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);

  const connect = async () => {
    const eth = (globalThis as any).ethereum;
    if (!eth) throw new Error("Install MetaMask");

    const p = new ethers.BrowserProvider(eth);
    await p.send("eth_requestAccounts", []);
    const s = await p.getSigner();
    const net = await p.getNetwork();

    setProvider(p);
    setAccount(await s.getAddress());
    setChainId(Number(net.chainId));
  };

  async function ensureSepolia() {
    const hex = "0xaa36a7"; // 11155111
    try {
      if (typeof window.ethereum !== "undefined") {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hex }],
        });
        console.log("MetaMask or a compatible wallet is installed!");
      } else {
        console.log(
          "Please install MetaMask or a compatible wallet to use this feature."
        );
      }
    } catch (e: any) {
      if (e.code === 4902) {
        if (typeof window.ethereum !== "undefined") {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: hex,
                chainName: "Sepolia",
                rpcUrls: ["https://eth-sepolia.g.alchemy.com/v2/<YOUR_KEY>"],
                nativeCurrency: {
                  name: "Sepolia ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
          console.log("MetaMask or a compatible wallet is installed!");
        } else {
          console.log(
            "Please install MetaMask or a compatible wallet to use this feature."
          );
        }
      } else {
        throw e;
      }
    }
  }

  // auto-refresh on account / chain changes
  useEffect(() => {
    const eth = (globalThis as any).ethereum;
    if (!eth) return;

    const onAcc = () => connect().catch(() => {});
    const onChain = () => connect().catch(() => {});
    eth.on?.("accountsChanged", onAcc);
    eth.on?.("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAcc);
      eth.removeListener?.("chainChanged", onChain);
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
