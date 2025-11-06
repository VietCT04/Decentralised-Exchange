import { ethers, network } from "hardhat";
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADDR_FILE = resolve(__dirname, "../dex-web/src/lib/addresses.sepolia.json");

async function readJSON(p) {
  try { return JSON.parse(await readFile(p, "utf8")); }
  catch { return {}; }
}

async function main() {
  console.log("Network:", network.name, Number((await ethers.provider.getNetwork()).chainId));

  const Dex = await ethers.getContractFactory("SimpleDex");
  const dex = await Dex.deploy();
  await dex.waitForDeployment();
  const DEX = await dex.getAddress();
  console.log("DEX:", DEX);

  const cur = await readJSON(ADDR_FILE);
  await mkdir(dirname(ADDR_FILE), { recursive: true });
  await writeFile(ADDR_FILE, JSON.stringify({ ...cur, DEX }, null, 2));
  console.log("Wrote", ADDR_FILE);
}

main().catch((e) => { console.error(e); process.exit(1); });
