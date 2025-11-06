import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "dotenv/config";

export default {
  solidity: "0.8.28",
  networks: {
    hardhat: { type: "edr-simulated", chainId: 31337 },
    sepolia: {
      type: "http",
      chainId: 11155111,
      url: process.env.SEPOLIA_RPC_URL ?? "",
      accounts: process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : undefined,
    },
  },
  etherscan: { apiKey: process.env.ETHERSCAN_API_KEY },
};
