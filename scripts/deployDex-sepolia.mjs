// scripts/deployDex-sepolia.mjs
import "dotenv/config";
import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";
import { createRequire } from "module";
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// 1) Load compiled artifact (built by `npx hardhat compile`)
const dexJson = require("../artifacts/contracts/SimpleDex.sol/SimpleDex.json");

// 2) Env
const RPC = process.env.SEPOLIA_RPC_URL;
const PK  = process.env.SEPOLIA_PRIVATE_KEY;

if (!RPC) throw new Error("SEPOLIA_RPC_URL missing in .env");
if (!PK?.startsWith("0x") || PK.length !== 66) {
  throw new Error("SEPOLIA_PRIVATE_KEY must be 0x + 64 hex chars");
}

// 3) Connect wallet
const provider = new JsonRpcProvider(RPC);
const wallet   = new Wallet(PK, provider);

// 4) Where to write addresses for the frontend
const ADDR_FILE = resolve(__dirname, "../dex-web/src/lib/addresses.sepolia.json");

async function readJSON(p) { try { return JSON.parse(await readFile(p, "utf8")); } catch { return {}; } }

async function main() {
  const net = await provider.getNetwork();
  console.log("Network:", net.name, Number(net.chainId));

  const factory = new ContractFactory(dexJson.abi, dexJson.bytecode, wallet);
  const dex = await factory.deploy();
  await dex.waitForDeployment();

  const DEX = await dex.getAddress();
  console.log("DEX:", DEX);

  const cur = await readJSON(ADDR_FILE);
  await mkdir(dirname(ADDR_FILE), { recursive: true });
  await writeFile(ADDR_FILE, JSON.stringify({ ...cur, DEX }, null, 2));
  console.log("Wrote", ADDR_FILE);
}

main().catch((e) => { console.error(e); process.exit(1); });
