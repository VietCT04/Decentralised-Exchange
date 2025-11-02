import {
  JsonRpcProvider,
  Wallet,
  ContractFactory,
  NonceManager,
  parseUnits
} from "ethers";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// compiled artifacts (after `npx hardhat compile`)
const tokenAJson = require("../artifacts/contracts/TokenA.sol/TokenA.json");
const tokenBJson = require("../artifacts/contracts/TokenB.sol/TokenB.json");

async function main() {
  const provider = new JsonRpcProvider("http://127.0.0.1:8545");

  // Use ONLY Account #0 to avoid clashes with other processes
  const base = new Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    provider
  );
  const wallet = new NonceManager(base); // prevents “nonce too low”

  const supply = parseUnits("1000000", 18);

  // ---- deploy TKA ----
  const TKA = await new ContractFactory(
    tokenAJson.abi,
    tokenAJson.bytecode,
    wallet
  ).deploy(supply);
  console.log("TKA tx:", TKA.deploymentTransaction().hash);
  await TKA.waitForDeployment();
  const TKA_ADDR = await TKA.getAddress();
  console.log("TKA:", TKA_ADDR);

  // ---- deploy TKB ----
  const TKB = await new ContractFactory(
    tokenBJson.abi,
    tokenBJson.bytecode,
    wallet
  ).deploy(supply);
  console.log("TKB tx:", TKB.deploymentTransaction().hash);
  await TKB.waitForDeployment();
  const TKB_ADDR = await TKB.getAddress();
  console.log("TKB:", TKB_ADDR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
