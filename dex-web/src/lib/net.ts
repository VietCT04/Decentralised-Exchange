// client-safe network constants (NEXT_PUBLIC_* only)
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_HEX = "0xaa36a7";

// use your own Alchemy/Infura RPC; must be NEXT_PUBLIC_* to be readable in the browser
export const SEPOLIA_RPC =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC ?? "https://rpc.sepolia.org";

export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

// src/lib/net.ts
export const NET = {
  id: 11155111,
  hex: "0xaa36a7",
  name: "Sepolia",
  explorer: process.env.NEXT_PUBLIC_EXPLORER ?? "https://sepolia.etherscan.io",
  rpc: process.env.NEXT_PUBLIC_SEPOLIA_RPC ?? "https://rpc.sepolia.org",
} as const;
