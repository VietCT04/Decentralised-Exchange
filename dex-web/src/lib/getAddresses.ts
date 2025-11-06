// src/lib/getAddresses.ts
import local from "@/lib/addresses.local.json";
import sepolia from "@/lib/addresses.sepolia.json";

export function getAddresses(chainId?: number) {
  return chainId === 11155111 ? sepolia : local;
}
