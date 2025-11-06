// scripts/deployFactory-sepolia.mjs
import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

// Replace the artifact path and contract name with YOUR factory contract
const FACTORY_JSON = JSON.parse(
  await readFile(
    new URL("../artifacts/contracts/TokenFactory.sol/TokenFactory.json", import.meta.url)
  )
);

const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const wallet   = new Wallet(process.env.SEPOLIA_PRIVATE_KEY, provider);

const factory  = await new ContractFactory(
  FACTORY_JSON.abi,
  FACTORY_JSON.bytecode,
  wallet
).deploy();

await factory.waitForDeployment();
const FACTORY = await factory.getAddress();
console.log("FACTORY:", FACTORY);

// write to dex-web/src/lib/addresses.sepolia.json
const OUT = resolve(__dirname, "../dex-web/src/lib/addresses.sepolia.json");
let cur = {};
try { cur = JSON.parse(await readFile(OUT, "utf8")); } catch {}
cur.FACTORY = FACTORY;
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(cur, null, 2));
console.log("Wrote", OUT);
