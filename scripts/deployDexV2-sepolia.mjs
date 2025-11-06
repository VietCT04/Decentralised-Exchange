// scripts/deployDexV2-sepolia.mjs
import "dotenv/config";
import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";
import { createRequire } from "module";
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);

// Adjust the path only if your Solidity file name/path differs
const dexJson = require("../artifacts/contracts/SimpleDex.sol/SimpleDex.json");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADDR_FILE = resolve(__dirname, "../dex-web/src/lib/addresses.sepolia.json");

async function readJSON(p) {
  try { return JSON.parse(await readFile(p, "utf8")); }
  catch { return {}; }
}

async function main() {
  const RPC = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
  const PK  = process.env.SEPOLIA_PRIVATE_KEY;

  if (!PK) throw new Error("Missing SEPOLIA_PRIVATE_KEY in .env");
  console.log("RPC:", RPC.replace(/(.{20}).+/, "$1..."));

  const provider = new JsonRpcProvider(RPC);
  const wallet   = new Wallet(PK, provider);

  const net = await provider.getNetwork();
  console.log("Network:", net.name, Number(net.chainId));
  if (Number(net.chainId) !== 11155111) {
    console.warn("⚠ Warning: chainId is not Sepolia (11155111).");
  }
  console.log("Deployer:", wallet.address);

  const factory = new ContractFactory(dexJson.abi, dexJson.bytecode, wallet);
  const dex = await factory.deploy();
  console.log("Deploy tx:", dex.deploymentTransaction()?.hash);

  await dex.waitForDeployment();
  const DEX = await dex.getAddress();
  console.log("DEX:", DEX);

  // Write/merge into addresses.sepolia.json for the frontend
  const cur = await readJSON(ADDR_FILE);
  await mkdir(dirname(ADDR_FILE), { recursive: true });
  await writeFile(ADDR_FILE, JSON.stringify({ ...cur, DEX }, null, 2));
  console.log("Wrote", ADDR_FILE);
}

main().catch((e) => { console.error(e); process.exit(1); });
