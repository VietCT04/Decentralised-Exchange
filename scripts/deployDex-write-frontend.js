import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";
import { createRequire } from "module";
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
const require = createRequire(import.meta.url);

const dexJson = require("../artifacts/contracts/SimpleDex.sol/SimpleDex.json");

// where your Next app keeps addresses:
const __dirname = dirname(fileURLToPath(import.meta.url));
const ADDR_FILE = resolve(__dirname, "../dex-web/src/lib/addresses.local.json");

async function readAddresses() {
  try { return JSON.parse(await readFile(ADDR_FILE, "utf8")); }
  catch { return {}; }
}

async function main() {
  const provider = new JsonRpcProvider("http://127.0.0.1:8545");
  const wallet = new Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Hardhat #0
    provider
  );

  const dex = await new ContractFactory(dexJson.abi, dexJson.bytecode, wallet).deploy();
  await dex.waitForDeployment();
  const DEX = await dex.getAddress();
  console.log({ DEX });

  const cur = await readAddresses();
  await mkdir(dirname(ADDR_FILE), { recursive: true });
  await writeFile(ADDR_FILE, JSON.stringify({ ...cur, DEX }, null, 2));
  console.log("Wrote", ADDR_FILE);
}

main().catch(e => { console.error(e); process.exit(1); });
