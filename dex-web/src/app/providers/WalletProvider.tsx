'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { ethers } from 'ethers';

type Ctx = {
  provider: ethers.BrowserProvider | null;
  account: string;
  chainId: number | null;
  connect: () => Promise<void>;
};

const WalletContext = createContext<Ctx>({
  provider: null,
  account: '',
  chainId: null,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  connect: async () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState<number | null>(null);

  const connect = async () => {
    const eth = (globalThis as any).ethereum;
    if (!eth) throw new Error('Install MetaMask');

    const p = new ethers.BrowserProvider(eth);
    await p.send('eth_requestAccounts', []);
    const s = await p.getSigner();
    const net = await p.getNetwork();

    setProvider(p);
    setAccount(await s.getAddress());
    setChainId(Number(net.chainId));
  };

  // auto-refresh on account / chain changes
  useEffect(() => {
    const eth = (globalThis as any).ethereum;
    if (!eth) return;

    const onAcc = () => connect().catch(() => {});
    const onChain = () => connect().catch(() => {});
    eth.on?.('accountsChanged', onAcc);
    eth.on?.('chainChanged', onChain);
    return () => {
      eth.removeListener?.('accountsChanged', onAcc);
      eth.removeListener?.('chainChanged', onChain);
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
