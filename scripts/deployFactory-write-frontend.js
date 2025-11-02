import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";
import { createRequire } from "module";
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
const require = createRequire(import.meta.url);

const factoryJson = require("../artifacts/contracts/TokenFactory.sol/TokenFactory.json");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADDR_FILE = resolve(__dirname, "../dex-web/src/lib/addresses.local.json");

// helper: read/merge address file
async function readAddresses() {
  try {
    const txt = await readFile(ADDR_FILE, "utf8");
    return JSON.parse(txt);
  } catch (_) {
    return {};
  }
}

async function main() {
  const provider = new JsonRpcProvider("http://127.0.0.1:8545");

  // Account #0 (Hardhat default)
  const wallet = new Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    provider
  );

  const factory = await new ContractFactory(factoryJson.abi, factoryJson.bytecode, wallet).deploy();
  await factory.waitForDeployment();
  const FACTORY = await factory.getAddress();
  console.log({ FACTORY });

  const cur = await readAddresses();
  const merged = { ...cur, FACTORY };
  await mkdir(dirname(ADDR_FILE), { recursive: true });
  await writeFile(ADDR_FILE, JSON.stringify(merged, null, 2));
  console.log("Wrote", ADDR_FILE);
}

main().catch(e => { console.error(e); process.exit(1); });
