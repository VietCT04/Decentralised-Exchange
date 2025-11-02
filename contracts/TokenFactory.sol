// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MinimalERC20 is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_,
        address owner_
    ) ERC20(name_, symbol_) {
        _mint(owner_, initialSupply_); // 18 decimals by default
    }
}

contract TokenFactory {
    event TokenIssued(
        address indexed token,
        address indexed owner,
        string name,
        string symbol,
        uint256 initialSupply
    );

    function issueToken(
        string calldata name_,
        string calldata symbol_,
        uint256 initialSupply_
    ) external returns (address token) {
        MinimalERC20 t = new MinimalERC20(
            name_,
            symbol_,
            initialSupply_,
            msg.sender
        );
        token = address(t);
        emit TokenIssued(token, msg.sender, name_, symbol_, initialSupply_);
    }
}
