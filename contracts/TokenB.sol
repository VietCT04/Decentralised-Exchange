// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenB extends ERC20 {
    constructor(uint256 initialSupply) ERC20("Token B", "TKB") {
        _mint(msg.sender, initialSupply);
    }
}
