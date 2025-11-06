import "dotenv/config";
import { JsonRpcProvider, Wallet, ContractFactory, parseUnits } from "ethers";
import { createRequire } from "module";
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const tokenJson = require("../artifacts/contracts/TestToken.sol/TestToken.json");

const RPC = process.env.SEPOLIA_RPC_URL;
const PK  = process.env.SEPOLIA_PRIVATE_KEY;

const provider = new JsonRpcProvider(RPC);
const wallet   = new Wallet(PK, provider);

const ADDR_FILE = resolve(__dirname, "../dex-web/src/lib/addresses.sepolia.json");
async function readJSON(p){ try { return JSON.parse(await readFile(p,"utf8")); } catch { return {}; } }

async function main() {
  const net = await provider.getNetwork();
  console.log("Network:", net.name, Number(net.chainId));

  const factory = new ContractFactory(tokenJson.abi, tokenJson.bytecode, wallet);

  const tka = await factory.deploy("VietCT Token", "VCT", parseUnits("1000000", 18));
  await tka.waitForDeployment();
  const TKA = await tka.getAddress();
  console.log("TKA:", TKA);

  const tkb = await factory.deploy("The Liems", "TLS", parseUnits("1000000", 18));
  await tkb.waitForDeployment();
  const TKB = await tkb.getAddress();
  console.log("TKB:", TKB);

  const cur = await readJSON(ADDR_FILE);
  await mkdir(dirname(ADDR_FILE), { recursive: true });
  await writeFile(ADDR_FILE, JSON.stringify({ ...cur, TKA, TKB }, null, 2));
  console.log("Wrote", ADDR_FILE);
}

main().catch(e => { console.error(e); process.exit(1); });
