// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenA extends ERC20 {
    constructor(uint256 initialSupply) ERC20("Token A", "TKA") {
        _mint(msg.sender, initialSupply);
    }
}
