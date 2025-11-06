// hardhat.config.js
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";   // optional: for Etherscan verification
import "dotenv/config";

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY, // optional
  },
};
