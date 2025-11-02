import hre from "hardhat";      
const { ethers } = hre;          

async function main() {
  const Hello = await ethers.getContractFactory("Hello");
  const hello = await Hello.deploy();
  await hello.waitForDeployment();

  console.log("Hello deployed to:", await hello.getAddress());
  console.log("Ping:", await hello.ping());
}

main().catch((e) => { console.error(e); process.exit(1); });
