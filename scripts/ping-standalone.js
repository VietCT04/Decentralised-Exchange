import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// compiled artifact from Hardhat
const helloJson = require("../artifacts/contracts/Hello.sol/Hello.json");

async function main() {
  // 1) connect to the local Hardhat node
  const provider = new JsonRpcProvider("http://127.0.0.1:8545");

  // 2) use the FIRST private key printed by `npx hardhat node`
  const wallet = new Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    provider
  );

  // 3) deploy Hello
  const factory = new ContractFactory(helloJson.abi, helloJson.bytecode, wallet);
  const hello = await factory.deploy();
  await hello.waitForDeployment();

  console.log("Hello deployed to:", await hello.getAddress());

  // 4) call ping()
  console.log("Ping:", await hello.ping());
}

main().catch((e) => { console.error(e); process.exit(1); });
