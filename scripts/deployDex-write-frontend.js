// scripts/deployDex-write-frontend.js
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// ✅ Import the Hardhat Runtime Environment as a module namespace (NO .default)
const hre = await import("hardhat");

const __dirname = dirname(fileURLToPath(import.meta.url));

function addrFileFor(netName) {
  const suffix = netName === "sepolia" ? "sepolia" : "local";
  return resolve(__dirname, `../dex-web/src/lib/addresses.${suffix}.json`);
}

async function readJSON(p) {
  try { return JSON.parse(await readFile(p, "utf8")); }
  catch { return {}; }
}

async function main() {
  console.log(`Deploying to: ${hre.network.name}`);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const Dex = await hre.ethers.getContractFactory("SimpleDex");
  const dex = await Dex.deploy();
  await dex.waitForDeployment();
  const DEX = await dex.getAddress();
  console.log("DEX:", DEX);

  const file = addrFileFor(hre.network.name);
  const cur = await readJSON(file);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ ...cur, DEX }, null, 2));
  console.log("Wrote", file);
}

main().catch((e) => { console.error(e); process.exit(1); });
